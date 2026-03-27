const express = require('express');
const { body, validationResult } = require('express-validator');
const sequelize = require('../config/database');
const { createError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /checkpoints
 * List checkpoints, optionally filtered by trip_id
 */
router.get('/', async (req, res, next) => {
  try {
    let where = [];
    let replacements = [];

    if (req.query.trip_id) {
      where.push('trip_id = ?');
      replacements.push(req.query.trip_id);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const [checkpoints] = await sequelize.query(
      `SELECT * FROM checkpoints ${whereClause} ORDER BY trip_id, sequence`,
      { replacements }
    );

    res.json({ data: checkpoints });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /checkpoints/:id/status
 * Update checkpoint status with sequence enforcement:
 * - ARRIVED must come before DEPARTED
 * - Must follow sequence order (previous checkpoints must be completed first)
 */
router.patch('/:id/status', [
  body('status').isIn(['ARRIVED', 'DEPARTED', 'SKIPPED']).withMessage('Status must be ARRIVED, DEPARTED, or SKIPPED')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(Object.assign(
        createError('VALIDATION_ERROR', 'Invalid input', { fields: errors.array() }),
        { statusCode: 422 }
      ));
    }

    const { status } = req.body;

    // Get the checkpoint
    const [checkpoints] = await sequelize.query(
      'SELECT * FROM checkpoints WHERE id = ?',
      { replacements: [req.params.id] }
    );
    if (checkpoints.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_CHECKPOINT', 'Checkpoint not found'),
        { statusCode: 404 }
      ));
    }

    const checkpoint = checkpoints[0];

    // Get all checkpoints for this trip, ordered by sequence
    const [tripCheckpoints] = await sequelize.query(
      'SELECT * FROM checkpoints WHERE trip_id = ? ORDER BY sequence',
      { replacements: [checkpoint.trip_id] }
    );

    // Enforce sequence order: all previous checkpoints must be DEPARTED or SKIPPED
    for (const cp of tripCheckpoints) {
      if (cp.sequence < checkpoint.sequence) {
        if (cp.status !== 'DEPARTED' && cp.status !== 'SKIPPED') {
          return next(Object.assign(
            createError('BUSINESS_SEQUENCE_VIOLATION',
              `Checkpoint "${cp.location_name}" (sequence ${cp.sequence}) must be completed (DEPARTED or SKIPPED) before updating checkpoint at sequence ${checkpoint.sequence}`,
              { blocking_checkpoint_id: cp.id, blocking_sequence: cp.sequence, blocking_location: cp.location_name }
            ),
            { statusCode: 409 }
          ));
        }
      }
    }

    // Enforce ARRIVED before DEPARTED
    if (status === 'DEPARTED' && checkpoint.status !== 'ARRIVED') {
      return next(Object.assign(
        createError('BUSINESS_STATUS_SEQUENCE', 'Checkpoint must be ARRIVED before it can be DEPARTED'),
        { statusCode: 409 }
      ));
    }

    // Cannot go backwards
    if (status === 'ARRIVED' && (checkpoint.status === 'DEPARTED' || checkpoint.status === 'SKIPPED')) {
      return next(Object.assign(
        createError('BUSINESS_STATUS_SEQUENCE', `Cannot change status from ${checkpoint.status} back to ARRIVED`),
        { statusCode: 409 }
      ));
    }

    // Build update
    let updateFields = 'status = ?';
    let updateValues = [status];

    if (status === 'ARRIVED') {
      updateFields += ', arrived_at = NOW()';
    } else if (status === 'DEPARTED') {
      updateFields += ', departed_at = NOW()';
    }

    updateValues.push(req.params.id);

    await sequelize.query(
      `UPDATE checkpoints SET ${updateFields} WHERE id = ?`,
      { replacements: updateValues }
    );

    await req.audit({
      action: 'UPDATE_CHECKPOINT',
      resourceType: 'CHECKPOINT',
      resourceId: req.params.id,
      result: 'SUCCESS',
      detail: { trip_id: checkpoint.trip_id, sequence: checkpoint.sequence, new_status: status }
    });

    const [updated] = await sequelize.query('SELECT * FROM checkpoints WHERE id = ?', { replacements: [req.params.id] });
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
