import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';
import { queueAnalyticsUpdate } from '../services/queue.service';
import { redisClient } from '../services/redis.service';

const router = Router();

// Validation schemas
const createApplicationSchema = z.object({
  company: z.string().min(1).max(255),
  position: z.string().min(1).max(255),
  location: z.string().optional(),
  jobBoardSource: z.string().optional(),
  jobUrl: z.string().url().optional(),
  salary: z.string().optional(),
  cvVersionId: z.string().uuid().optional(),
  coverLetter: z.boolean().default(false),
  notes: z.string().optional(),
  timeSpent: z.number().optional(),
  customFields: z.record(z.any()).optional(),
  captureMethod: z.enum(['MANUAL', 'EXTENSION', 'EMAIL_SYNC', 'API']).default('MANUAL'),
  confidence: z.number().min(0).max(1).optional(),
});

const updateApplicationSchema = createApplicationSchema.partial().extend({
  status: z.enum([
    'APPLIED',
    'VIEWED',
    'SHORTLISTED',
    'INTERVIEW_SCHEDULED',
    'INTERVIEWED',
    'OFFERED',
    'REJECTED',
    'WITHDRAWN',
    'ACCEPTED',
  ]).optional(),
  responseDate: z.string().datetime().optional(),
  interviewDate: z.string().datetime().optional(),
});

// Get all applications for user with filtering
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      page = '1',
      limit = '20',
      status,
      company,
      startDate,
      endDate,
      source,
      sortBy = 'appliedAt',
      order = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = { userId };

    if (status) where.status = status;
    if (company) where.company = { contains: company as string, mode: 'insensitive' };
    if (source) where.jobBoardSource = source;
    if (startDate || endDate) {
      where.appliedAt = {};
      if (startDate) where.appliedAt.gte = new Date(startDate as string);
      if (endDate) where.appliedAt.lte = new Date(endDate as string);
    }

    // Get applications with pagination
    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy as string]: order },
        include: {
          cvVersion: {
            select: {
              name: true,
              version: true,
            },
          },
          events: {
            select: {
              eventType: true,
              timestamp: true,
            },
            orderBy: { timestamp: 'desc' },
            take: 5,
          },
        },
      }),
      prisma.application.count({ where }),
    ]);

    // Cache frequently accessed data
    const cacheKey = `applications:${userId}:${pageNum}:${limitNum}`;
    await redisClient.setex(cacheKey, 300, JSON.stringify(applications)); // Cache for 5 minutes

    res.json({
      applications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Error fetching applications:', error);
    res.status(500).json({
      error: 'Failed to fetch applications',
      message: 'Unable to retrieve applications. Please try again.',
    });
  }
});

// Get single application
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const application = await prisma.application.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        cvVersion: true,
        events: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!application) {
      return res.status(404).json({
        error: 'Application not found',
        message: 'The requested application does not exist.',
      });
    }

    res.json(application);
  } catch (error) {
    logger.error('Error fetching application:', error);
    res.status(500).json({
      error: 'Failed to fetch application',
      message: 'Unable to retrieve application details.',
    });
  }
});

// Create new application
router.post('/', validateRequest(createApplicationSchema), async (req, res) => {
  try {
    const userId = req.user?.id;
    const applicationData = req.body;

    // Create application with event
    const application = await prisma.application.create({
      data: {
        ...applicationData,
        userId,
        events: {
          create: {
            eventType: 'APPLICATION_CREATED',
            data: {
              source: applicationData.captureMethod,
              confidence: applicationData.confidence,
            },
          },
        },
      },
      include: {
        cvVersion: true,
        events: true,
      },
    });

    // Update CV version stats if applicable
    if (applicationData.cvVersionId) {
      await prisma.cvVersion.update({
        where: { id: applicationData.cvVersionId },
        data: {
          totalApplications: { increment: 1 },
        },
      });
    }

    // Queue analytics update
    await queueAnalyticsUpdate(userId, {
      type: 'APPLICATION_CREATED',
      applicationId: application.id,
      timestamp: new Date(),
    });

    // Update user's last active time
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });

    logger.info(`New application created: ${application.id} for user ${userId}`);

    res.status(201).json({
      message: 'Application created successfully',
      application,
    });
  } catch (error) {
    logger.error('Error creating application:', error);
    res.status(500).json({
      error: 'Failed to create application',
      message: 'Unable to save application. Please try again.',
    });
  }
});

// Update application
router.put('/:id', validateRequest(updateApplicationSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const updates = req.body;

    // Check if application exists and belongs to user
    const existingApplication = await prisma.application.findFirst({
      where: { id, userId },
    });

    if (!existingApplication) {
      return res.status(404).json({
        error: 'Application not found',
        message: 'The requested application does not exist.',
      });
    }

    // Track status changes
    const events: any[] = [];
    if (updates.status && updates.status !== existingApplication.status) {
      events.push({
        eventType: 'STATUS_CHANGED',
        data: {
          from: existingApplication.status,
          to: updates.status,
        },
      });

      // Update CV version success stats if status is positive
      if (
        ['INTERVIEW_SCHEDULED', 'INTERVIEWED', 'OFFERED', 'ACCEPTED'].includes(updates.status) &&
        existingApplication.cvVersionId
      ) {
        await prisma.cvVersion.update({
          where: { id: existingApplication.cvVersionId },
          data: {
            successfulApps: { increment: 1 },
          },
        });
      }
    }

    // Update application
    const application = await prisma.application.update({
      where: { id },
      data: {
        ...updates,
        events: events.length > 0 ? { create: events } : undefined,
      },
      include: {
        cvVersion: true,
        events: {
          orderBy: { timestamp: 'desc' },
          take: 5,
        },
      },
    });

    // Queue analytics update
    await queueAnalyticsUpdate(userId, {
      type: 'APPLICATION_UPDATED',
      applicationId: application.id,
      timestamp: new Date(),
      changes: updates,
    });

    res.json({
      message: 'Application updated successfully',
      application,
    });
  } catch (error) {
    logger.error('Error updating application:', error);
    res.status(500).json({
      error: 'Failed to update application',
      message: 'Unable to update application. Please try again.',
    });
  }
});

// Delete application
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Check if application exists and belongs to user
    const application = await prisma.application.findFirst({
      where: { id, userId },
    });

    if (!application) {
      return res.status(404).json({
        error: 'Application not found',
        message: 'The requested application does not exist.',
      });
    }

    // Delete application (cascade will handle events)
    await prisma.application.delete({
      where: { id },
    });

    res.json({
      message: 'Application deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting application:', error);
    res.status(500).json({
      error: 'Failed to delete application',
      message: 'Unable to delete application. Please try again.',
    });
  }
});

// Bulk create applications (for extension)
router.post('/bulk', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { applications } = req.body;

    if (!Array.isArray(applications) || applications.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Applications array is required',
      });
    }

    // Validate and create applications
    const createdApplications = await prisma.$transaction(
      applications.map((app) =>
        prisma.application.create({
          data: {
            ...app,
            userId,
            captureMethod: 'EXTENSION',
            events: {
              create: {
                eventType: 'APPLICATION_CREATED',
                data: { source: 'BULK_IMPORT' },
              },
            },
          },
        })
      )
    );

    // Queue analytics update
    await queueAnalyticsUpdate(userId, {
      type: 'BULK_APPLICATIONS_CREATED',
      count: createdApplications.length,
      timestamp: new Date(),
    });

    res.status(201).json({
      message: `${createdApplications.length} applications created successfully`,
      applications: createdApplications,
    });
  } catch (error) {
    logger.error('Error creating bulk applications:', error);
    res.status(500).json({
      error: 'Failed to create applications',
      message: 'Unable to save applications. Please try again.',
    });
  }
});

// Get application statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { period = '30' } = req.query;
    const days = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get aggregated stats
    const stats = await prisma.application.groupBy({
      by: ['status'],
      where: {
        userId,
        appliedAt: { gte: startDate },
      },
      _count: {
        status: true,
      },
    });

    // Get total applications
    const total = await prisma.application.count({
      where: {
        userId,
        appliedAt: { gte: startDate },
      },
    });

    // Calculate average time per application
    const avgTime = await prisma.application.aggregate({
      where: {
        userId,
        appliedAt: { gte: startDate },
        timeSpent: { not: null },
      },
      _avg: {
        timeSpent: true,
      },
    });

    // Get response rate
    const withResponse = await prisma.application.count({
      where: {
        userId,
        appliedAt: { gte: startDate },
        responseDate: { not: null },
      },
    });

    res.json({
      period: days,
      total,
      byStatus: stats.reduce((acc, curr) => {
        acc[curr.status] = curr._count.status;
        return acc;
      }, {} as Record<string, number>),
      averageTimePerApplication: avgTime._avg.timeSpent || 0,
      responseRate: total > 0 ? (withResponse / total) * 100 : 0,
    });
  } catch (error) {
    logger.error('Error fetching application stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: 'Unable to retrieve application statistics.',
    });
  }
});

export default router;
