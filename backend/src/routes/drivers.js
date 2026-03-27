const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const { createError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /drivers
 * List all drivers with optional status filter
 */
router.get('/', async (req, res, next) => {
  try {
    let where = [];
    let replacements = [];

    if (req.query.status) {
      where.push('status = ?');
      replacements.push(req.query.status);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const [drivers] = await sequelize.query(
      `SELECT * FROM drivers ${whereClause} ORDER BY created_at DESC`,
      { replacements }
    );

    res.json({ data: drivers });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /drivers/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const [drivers] = await sequelize.query(
      'SELECT * FROM drivers WHERE id = ?',
      { replacements: [req.params.id] }
    );

    if (drivers.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_DRIVER', 'Driver not found'),
        { statusCode: 404 }
      ));
    }

    res.json({ data: drivers[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /drivers
 * Create a new driver
 */
router.post('/', [
  body('name').notEmpty().withMessage('Name is required'),
  body('license_number').notEmpty().withMessage('License number is required'),
  body('license_expires_at').notEmpty().isISO8601().withMessage('Valid license expiry date is required'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(Object.assign(
        createError('VALIDATION_ERROR', 'Invalid input', { fields: errors.array() }),
        { statusCode: 422 }
      ));
    }

    const { name, license_number, license_expires_at, phone, status = 'ACTIVE' } = req.body;
    const id = uuidv4();

    // Check duplicate license number
    const [existing] = await sequelize.query(
      'SELECT id FROM drivers WHERE license_number = ?',
      { replacements: [license_number] }
    );
    if (existing.length > 0) {
      return next(Object.assign(
        createError('CONFLICT_LICENSE', 'License number already exists'),
        { statusCode: 409 }
      ));
    }

    await sequelize.query(
      `INSERT INTO drivers (id, name, license_number, license_expires_at, phone, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      { replacements: [id, name, license_number, license_expires_at, phone, status] }
    );

    await req.audit({ action: 'CREATE_DRIVER', resourceType: 'DRIVER', resourceId: id, result: 'SUCCESS', detail: { name, license_number } });

    const [created] = await sequelize.query('SELECT * FROM drivers WHERE id = ?', { replacements: [id] });
    res.status(201).json({ data: created[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /drivers/:id
 * Update driver fields
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const [drivers] = await sequelize.query(
      'SELECT id FROM drivers WHERE id = ?',
      { replacements: [req.params.id] }
    );
    if (drivers.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_DRIVER', 'Driver not found'),
        { statusCode: 404 }
      ));
    }

    const allowedFields = ['name', 'license_number', 'license_expires_at', 'phone', 'status'];
    const setClauses = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (setClauses.length === 0) {
      return next(Object.assign(
        createError('VALIDATION_ERROR', 'No valid fields to update'),
        { statusCode: 422 }
      ));
    }

    values.push(req.params.id);
    await sequelize.query(
      `UPDATE drivers SET ${setClauses.join(', ')} WHERE id = ?`,
      { replacements: values }
    );

    await req.audit({ action: 'UPDATE_DRIVER', resourceType: 'DRIVER', resourceId: req.params.id, result: 'SUCCESS', detail: req.body });

    const [updated] = await sequelize.query('SELECT * FROM drivers WHERE id = ?', { replacements: [req.params.id] });
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /drivers/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const [drivers] = await sequelize.query(
      'SELECT id FROM drivers WHERE id = ?',
      { replacements: [req.params.id] }
    );
    if (drivers.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_DRIVER', 'Driver not found'),
        { statusCode: 404 }
      ));
    }

    // Check if driver is assigned to active vehicle
    const [activeVehicles] = await sequelize.query(
      "SELECT id FROM vehicles WHERE driver_id = ? AND status IN ('ACTIVE', 'IDLE')",
      { replacements: [req.params.id] }
    );
    if (activeVehicles.length > 0) {
      return next(Object.assign(
        createError('BUSINESS_DRIVER_ASSIGNED', 'Cannot delete driver assigned to active vehicles'),
        { statusCode: 409 }
      ));
    }

    await sequelize.query('DELETE FROM drivers WHERE id = ?', { replacements: [req.params.id] });
    await req.audit({ action: 'DELETE_DRIVER', resourceType: 'DRIVER', resourceId: req.params.id, result: 'SUCCESS' });

    res.json({ data: { message: 'Driver deleted successfully' } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
