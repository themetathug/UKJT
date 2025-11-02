import { Router } from 'express';
import { z } from 'zod';
import { EmailParserService, EmailConfig } from '../services/email-parser.service';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';

const router = Router();
const emailParserService = new EmailParserService();

// Validation schemas
const emailConfigSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  tls: z.boolean().optional().default(true),
});

const parseEmailsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  tls: z.boolean().optional().default(true),
  days: z.number().int().min(1).max(30).optional().default(7),
});

/**
 * POST /api/email-parser/test-connection
 * Test IMAP connection
 */
router.post('/test-connection', validateRequest(emailConfigSchema), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email, password, host, port, tls } = req.body;

    const config: EmailConfig = {
      user: email,
      password,
      host,
      port,
      tls: tls !== false,
    };

    const isConnected = await emailParserService.testConnection(config);

    if (isConnected) {
      return res.json({
        success: true,
        message: 'Email connection successful',
      });
    } else {
      return res.status(400).json({
        error: 'Email connection failed',
        message: 'Unable to connect to email server. Please check your credentials.',
      });
    }
  } catch (error: any) {
    logger.error('Error testing email connection:', error);
    return res.status(500).json({
      error: 'Failed to test connection',
      message: error.message || 'Unable to test email connection.',
    });
  }
});

/**
 * POST /api/email-parser/parse
 * Parse emails and extract job-related information
 */
router.post('/parse', validateRequest(parseEmailsSchema), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email, password, host, port, tls, days } = req.body;

    const config: EmailConfig = {
      user: email,
      password,
      host,
      port,
      tls: tls !== false,
    };

    logger.info(`Starting email parsing for user ${userId}`);

    const parsedEmails = await emailParserService.fetchEmails(config, userId, days);

    return res.json({
      success: true,
      message: `Successfully parsed ${parsedEmails.length} job-related emails`,
      count: parsedEmails.length,
      emails: parsedEmails.map(e => ({
        position: e.position,
        company: e.company,
        location: e.location,
        senderEmail: e.senderEmail,
        subject: e.subject,
        sentAt: e.sentAt,
      })),
    });
  } catch (error: any) {
    logger.error('Error parsing emails:', error);
    return res.status(500).json({
      error: 'Failed to parse emails',
      message: error.message || 'Unable to parse emails. Please check your email configuration.',
    });
  }
});

/**
 * GET /api/email-parser/gmail-config
 * Get Gmail IMAP configuration (helper endpoint)
 */
router.get('/gmail-config', async (req, res) => {
  return res.json({
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    instructions: 'For Gmail, you may need to enable "Less secure app access" or use an App Password.',
  });
});

/**
 * GET /api/email-parser/outlook-config
 * Get Outlook IMAP configuration (helper endpoint)
 */
router.get('/outlook-config', async (req, res) => {
  return res.json({
    host: 'outlook.office365.com',
    port: 993,
    tls: true,
    instructions: 'For Outlook, use your regular password or app-specific password.',
  });
});

export default router;

