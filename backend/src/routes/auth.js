const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const sequelize = require('../config/database');
const { createError } = require('../middleware/errorHandler');
const { logAudit } = require('../middleware/auditLog');

const router = express.Router();

/**
 * POST /auth/register
 * Create a new user account
 */
router.post('/register', [
  body('username').notEmpty().withMessage('Username is required').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['DISPATCHER', 'ADMIN']).withMessage('Role must be DISPATCHER or ADMIN')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(Object.assign(
        createError('VALIDATION_ERROR', 'Invalid input', { fields: errors.array() }),
        { statusCode: 422 }
      ));
    }

    const { username, password, role = 'DISPATCHER' } = req.body;

    // Check if username already exists
    const [existing] = await sequelize.query(
      'SELECT id FROM users WHERE username = ?',
      { replacements: [username] }
    );
    if (existing.length > 0) {
      return next(Object.assign(
        createError('CONFLICT_USERNAME', 'Username already exists'),
        { statusCode: 409 }
      ));
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();

    await sequelize.query(
      'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
      { replacements: [id, username, password_hash, role] }
    );

    const ip = req.ip || req.connection.remoteAddress;
    await logAudit({ userId: id, action: 'REGISTER', resourceType: 'AUTH', ipAddress: ip, result: 'SUCCESS', detail: { username, role } });

    res.status(201).json({
      data: {
        id,
        username,
        role,
        message: 'User registered successfully'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/login
 * Accepts username + password, returns JWT access token + refresh token
 */
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(Object.assign(
        createError('VALIDATION_ERROR', 'Invalid input', { fields: errors.array() }),
        { statusCode: 422 }
      ));
    }

    const { username, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    // Find user
    const [users] = await sequelize.query(
      'SELECT id, username, password_hash, role FROM users WHERE username = ?',
      { replacements: [username] }
    );

    if (users.length === 0) {
      await logAudit({ userId: 'unknown', action: 'LOGIN', resourceType: 'AUTH', ipAddress: ip, result: 'FAIL', detail: { username, reason: 'User not found' } });
      return next(Object.assign(
        createError('AUTH_INVALID_CREDENTIALS', 'Invalid username or password'),
        { statusCode: 401 }
      ));
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      await logAudit({ userId: user.id, action: 'LOGIN', resourceType: 'AUTH', ipAddress: ip, result: 'FAIL', detail: { reason: 'Invalid password' } });
      return next(Object.assign(
        createError('AUTH_INVALID_CREDENTIALS', 'Invalid username or password'),
        { statusCode: 401 }
      ));
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    await logAudit({ userId: user.id, action: 'LOGIN', resourceType: 'AUTH', ipAddress: ip, result: 'SUCCESS' });

    res.json({
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: process.env.JWT_EXPIRES_IN || '15m',
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/refresh
 * Accept refresh token, return new access token
 */
router.post('/refresh', [
  body('refresh_token').notEmpty().withMessage('Refresh token is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(Object.assign(
        createError('VALIDATION_ERROR', 'Invalid input', { fields: errors.array() }),
        { statusCode: 422 }
      ));
    }

    const { refresh_token } = req.body;

    let decoded;
    try {
      decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return next(Object.assign(
        createError('AUTH_REFRESH_INVALID', 'Invalid or expired refresh token. Please login again.'),
        { statusCode: 401 }
      ));
    }

    if (decoded.type !== 'refresh') {
      return next(Object.assign(
        createError('AUTH_REFRESH_INVALID', 'Invalid token type'),
        { statusCode: 401 }
      ));
    }

    // Issue new access token
    const accessToken = jwt.sign(
      { id: decoded.id, username: decoded.username, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    res.json({
      data: {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: process.env.JWT_EXPIRES_IN || '15m'
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
