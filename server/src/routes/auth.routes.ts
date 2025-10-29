import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';
import { generateToken, verifyToken } from '../utils/jwt.utils';
import { redisClient } from '../services/redis.service';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  consentTracking: z.boolean().default(false),
  consentAnalytics: z.boolean().default(false),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register endpoint
router.post('/register', validateRequest(registerSchema), async (req, res) => {
  try {
    const { email, password, firstName, lastName, consentTracking, consentAnalytics } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        consentTracking,
        consentAnalytics,
        profileData: {
          onboardingCompleted: false,
          preferredJobBoards: [],
          skills: [],
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        subscription: true,
        createdAt: true,
      },
    });

    // Generate token
    const token = generateToken(user.id);

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        userAgent: req.headers['user-agent'] || '',
        ipAddress: req.ip || '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Cache session in Redis
    await redisClient.set(`session:${token}`, user.id, 'EX', 7 * 24 * 60 * 60);

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      message: 'Account created successfully',
      user,
      token,
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'Unable to create account. Please try again.',
    });
  }
});

// Login endpoint
router.post('/login', validateRequest(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        subscription: true,
        weeklyTarget: true,
        monthlyTarget: true,
        consentTracking: true,
        consentAnalytics: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        userAgent: req.headers['user-agent'] || '',
        ipAddress: req.ip || '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    // Cache session in Redis
    await redisClient.set(`session:${token}`, user.id, 'EX', 7 * 24 * 60 * 60);

    // Remove password from response
    const { passwordHash: _, ...userWithoutPassword } = user;

    logger.info(`User logged in: ${user.email}`);

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Unable to login. Please try again.',
    });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      // Remove session from database
      await prisma.session.deleteMany({
        where: { token },
      });

      // Remove from Redis
      await redisClient.del(`session:${token}`);
    }

    res.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'Unable to logout. Please try again.',
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
        message: 'Authentication required',
      });
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired',
      });
    }

    // Check session in database
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({
        error: 'Session expired',
        message: 'Please login again',
      });
    }

    // Generate new token
    const newToken = generateToken(session.userId);

    // Update session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: newToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Update Redis
    await redisClient.del(`session:${token}`);
    await redisClient.set(`session:${newToken}`, session.userId, 'EX', 7 * 24 * 60 * 60);

    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: 'Unable to refresh token. Please login again.',
    });
  }
});

// Verify email endpoint
router.get('/verify-email/:token', async (req, res) => {
  // Implementation for email verification
  res.json({ message: 'Email verification endpoint - To be implemented' });
});

// Password reset request
router.post('/forgot-password', async (req, res) => {
  // Implementation for password reset
  res.json({ message: 'Password reset endpoint - To be implemented' });
});

export default router;
