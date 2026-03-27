const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const { createError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /maintenance
 * List maintenance records with optional filters: vehicle_id, status, type
 */
router.get('/', async (req, res, next) => {
  try {
    let where = [];
    let replacements = [];

    if (req.query.vehicle_id) {
      where.push('m.vehicle_id = ?');
      replacements.push(req.query.vehicle_id);
    }
    if (req.query.status) {
      where.push('m.status = ?');
      replacements.push(req.query.status);
    }
    if (req.query.type) {
      where.push('m.type = ?');
      replacements.push(req.query.type);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const [records] = await sequelize.query(
      `SELECT m.*, v.license_plate
       FROM maintenance m
       JOIN vehicles v ON v.id = m.vehicle_id
       ${whereClause}
       ORDER BY m.scheduled_at DESC`,
      { replacements }
    );

    res.json({ data: records });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /maintenance/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const [records] = await sequelize.query(
      `SELECT m.*, v.license_plate
       FROM maintenance m
       JOIN vehicles v ON v.id = m.vehicle_id
       WHERE m.id = ?`,
      { replacements: [req.params.id] }
    );
    if (records.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_MAINTENANCE', 'Maintenance record not found'),
        { statusCode: 404 }
      ));
    }

    // Include parts
    const [parts] = await sequelize.query(
      'SELECT * FROM maintenance_parts WHERE maintenance_id = ?',
      { replacements: [req.params.id] }
    );

    res.json({ data: { ...records[0], parts } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /maintenance
 * Create a maintenance record
 */
router.post('/', [
  body('vehicle_id').notEmpty().withMessage('Vehicle ID is required'),
  body('type').isIn(['OIL_CHANGE', 'TIRE', 'BRAKE', 'ENGINE', 'INSPECTION', 'REPAIR']).withMessage('Invalid maintenance type'),
  body('scheduled_at').notEmpty().isISO8601().withMessage('Valid scheduled date is required'),
  body('technician').optional().isString(),
  body('cost_thb').optional().isFloat({ min: 0 }),
  body('notes').optional().isString(),
  body('parts').optional().isArray()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(Object.assign(
        createError('VALIDATION_ERROR', 'Invalid input', { fields: errors.array() }),
        { statusCode: 422 }
      ));
    }

    const { vehicle_id, type, scheduled_at, technician, cost_thb, notes, status = 'SCHEDULED', parts } = req.body;
    const id = uuidv4();

    // Check vehicle exists
    const [vehicles] = await sequelize.query(
      'SELECT id FROM vehicles WHERE id = ?',
      { replacements: [vehicle_id] }
    );
    if (vehicles.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_VEHICLE', 'Vehicle not found'),
        { statusCode: 404 }
      ));
    }

    const t = await sequelize.transaction();
    try {
      await sequelize.query(
        `INSERT INTO maintenance (id, vehicle_id, status, type, scheduled_at, technician, cost_thb, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        {
          replacements: [id, vehicle_id, status, type, scheduled_at, technician || null, cost_thb || null, notes || null],
          transaction: t
        }
      );

      // Insert parts if provided
      if (parts && parts.length > 0) {
        for (const part of parts) {
          const partId = uuidv4();
          await sequelize.query(
            `INSERT INTO maintenance_parts (id, maintenance_id, part_name, part_number, quantity, cost_thb)
             VALUES (?, ?, ?, ?, ?, ?)`,
            {
              replacements: [partId, id, part.part_name, part.part_number || null, part.quantity || 1, part.cost_thb || null],
              transaction: t
            }
          );
        }
      }

      await t.commit();

      await req.audit({ action: 'CREATE_MAINTENANCE', resourceType: 'MAINTENANCE', resourceId: id, result: 'SUCCESS', detail: { vehicle_id, type } });

      const [created] = await sequelize.query(
        `SELECT m.*, v.license_plate FROM maintenance m JOIN vehicles v ON v.id = m.vehicle_id WHERE m.id = ?`,
        { replacements: [id] }
      );
      res.status(201).json({ data: created[0] });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /maintenance/:id
 * Update maintenance record
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const [records] = await sequelize.query(
      'SELECT * FROM maintenance WHERE id = ?',
      { replacements: [req.params.id] }
    );
    if (records.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_MAINTENANCE', 'Maintenance record not found'),
        { statusCode: 404 }
      ));
    }

    const allowedFields = ['status', 'type', 'scheduled_at', 'completed_at', 'mileage_at_service', 'technician', 'cost_thb', 'notes'];
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
      `UPDATE maintenance SET ${setClauses.join(', ')} WHERE id = ?`,
      { replacements: values }
    );

    // If status changed to COMPLETED, consider updating vehicle status
    if (req.body.status === 'COMPLETED') {
      const record = records[0];
      // Check if there are other pending maintenance for this vehicle
      const [pendingMaint] = await sequelize.query(
        "SELECT id FROM maintenance WHERE vehicle_id = ? AND id != ? AND status IN ('SCHEDULED', 'IN_PROGRESS')",
        { replacements: [record.vehicle_id, req.params.id] }
      );
      if (pendingMaint.length === 0) {
        await sequelize.query(
          "UPDATE vehicles SET status = 'IDLE' WHERE id = ? AND status = 'MAINTENANCE'",
          { replacements: [record.vehicle_id] }
        );
      }
    }

    await req.audit({ action: 'UPDATE_MAINTENANCE', resourceType: 'MAINTENANCE', resourceId: req.params.id, result: 'SUCCESS', detail: req.body });

    const [updated] = await sequelize.query(
      'SELECT m.*, v.license_plate FROM maintenance m JOIN vehicles v ON v.id = m.vehicle_id WHERE m.id = ?',
      { replacements: [req.params.id] }
    );
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /maintenance/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const [records] = await sequelize.query(
      'SELECT id FROM maintenance WHERE id = ?',
      { replacements: [req.params.id] }
    );
    if (records.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_MAINTENANCE', 'Maintenance record not found'),
        { statusCode: 404 }
      ));
    }

    await sequelize.query('DELETE FROM maintenance_parts WHERE maintenance_id = ?', { replacements: [req.params.id] });
    await sequelize.query('DELETE FROM maintenance WHERE id = ?', { replacements: [req.params.id] });

    await req.audit({ action: 'DELETE_MAINTENANCE', resourceType: 'MAINTENANCE', resourceId: req.params.id, result: 'SUCCESS' });

    res.json({ data: { message: 'Maintenance record deleted successfully' } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
