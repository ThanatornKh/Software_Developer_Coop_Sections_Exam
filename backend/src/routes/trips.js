const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const { createError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /trips
 * List trips with optional filters: status, vehicle_id, driver_id
 */
router.get('/', async (req, res, next) => {
  try {
    let where = [];
    let replacements = [];

    if (req.query.status) {
      where.push('t.status = ?');
      replacements.push(req.query.status);
    }
    if (req.query.vehicle_id) {
      where.push('t.vehicle_id = ?');
      replacements.push(req.query.vehicle_id);
    }
    if (req.query.driver_id) {
      where.push('t.driver_id = ?');
      replacements.push(req.query.driver_id);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const [trips] = await sequelize.query(
      `SELECT t.*, v.license_plate, d.name as driver_name
       FROM trips t
       JOIN vehicles v ON v.id = t.vehicle_id
       JOIN drivers d ON d.id = t.driver_id
       ${whereClause}
       ORDER BY t.created_at DESC`,
      { replacements }
    );

    res.json({ data: trips });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /trips/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const [trips] = await sequelize.query(
      `SELECT t.*, v.license_plate, d.name as driver_name
       FROM trips t
       JOIN vehicles v ON v.id = t.vehicle_id
       JOIN drivers d ON d.id = t.driver_id
       WHERE t.id = ?`,
      { replacements: [req.params.id] }
    );

    if (trips.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_TRIP', 'Trip not found'),
        { statusCode: 404 }
      ));
    }

    // Include checkpoints
    const [checkpoints] = await sequelize.query(
      'SELECT * FROM checkpoints WHERE trip_id = ? ORDER BY sequence',
      { replacements: [req.params.id] }
    );

    res.json({ data: { ...trips[0], checkpoints } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /trips
 * Create a new trip. Validates vehicle has only 1 IN_PROGRESS trip at a time.
 */
router.post('/', [
  body('vehicle_id').notEmpty().withMessage('Vehicle ID is required'),
  body('driver_id').notEmpty().withMessage('Driver ID is required'),
  body('origin').notEmpty().withMessage('Origin is required'),
  body('destination').notEmpty().withMessage('Destination is required'),
  body('distance_km').optional().isFloat({ min: 0 }),
  body('cargo_type').optional().isIn(['GENERAL', 'FRAGILE', 'HAZARDOUS', 'REFRIGERATED']),
  body('cargo_weight_kg').optional().isFloat({ min: 0 }),
  body('checkpoints').optional().isArray()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(Object.assign(
        createError('VALIDATION_ERROR', 'Invalid input', { fields: errors.array() }),
        { statusCode: 422 }
      ));
    }

    const { vehicle_id, driver_id, origin, destination, distance_km, cargo_type, cargo_weight_kg, checkpoints } = req.body;
    const id = uuidv4();

    const t = await sequelize.transaction();
    try {
      // Check vehicle exists
      const [vehicles] = await sequelize.query(
        'SELECT id, status FROM vehicles WHERE id = ?',
        { replacements: [vehicle_id], transaction: t }
      );
      if (vehicles.length === 0) {
        await t.rollback();
        return next(Object.assign(
          createError('NOT_FOUND_VEHICLE', 'Vehicle not found'),
          { statusCode: 404 }
        ));
      }

      // Check vehicle doesn't have IN_PROGRESS trip
      const [activeTrips] = await sequelize.query(
        "SELECT id FROM trips WHERE vehicle_id = ? AND status = 'IN_PROGRESS'",
        { replacements: [vehicle_id], transaction: t }
      );
      if (activeTrips.length > 0) {
        await t.rollback();
        return next(Object.assign(
          createError('BUSINESS_ACTIVE_TRIP', 'Vehicle already has an in-progress trip'),
          { statusCode: 409 }
        ));
      }

      // Check driver exists
      const [drivers] = await sequelize.query(
        'SELECT id, license_expires_at FROM drivers WHERE id = ?',
        { replacements: [driver_id], transaction: t }
      );
      if (drivers.length === 0) {
        await t.rollback();
        return next(Object.assign(
          createError('NOT_FOUND_DRIVER', 'Driver not found'),
          { statusCode: 404 }
        ));
      }

      await sequelize.query(
        `INSERT INTO trips (id, vehicle_id, driver_id, status, origin, destination, distance_km, cargo_type, cargo_weight_kg)
         VALUES (?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?)`,
        {
          replacements: [id, vehicle_id, driver_id, origin, destination, distance_km || null, cargo_type || null, cargo_weight_kg || null],
          transaction: t
        }
      );

      // Create checkpoints if provided
      if (checkpoints && checkpoints.length > 0) {
        for (let i = 0; i < checkpoints.length; i++) {
          const cp = checkpoints[i];
          const cpId = uuidv4();
          await sequelize.query(
            `INSERT INTO checkpoints (id, trip_id, sequence, status, location_name, latitude, longitude, purpose, notes)
             VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)`,
            {
              replacements: [
                cpId, id, cp.sequence || (i + 1), cp.location_name,
                cp.latitude || null, cp.longitude || null,
                cp.purpose || null, cp.notes || null
              ],
              transaction: t
            }
          );
        }
      }

      await t.commit();

      await req.audit({ action: 'CREATE_TRIP', resourceType: 'TRIP', resourceId: id, result: 'SUCCESS', detail: { vehicle_id, driver_id, origin, destination } });

      const [created] = await sequelize.query(
        `SELECT t.*, v.license_plate, d.name as driver_name
         FROM trips t
         JOIN vehicles v ON v.id = t.vehicle_id
         JOIN drivers d ON d.id = t.driver_id
         WHERE t.id = ?`,
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
 * PATCH /trips/:id/start
 * Change SCHEDULED to IN_PROGRESS
 */
router.patch('/:id/start', async (req, res, next) => {
  try {
    const [trips] = await sequelize.query(
      'SELECT * FROM trips WHERE id = ?',
      { replacements: [req.params.id] }
    );
    if (trips.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_TRIP', 'Trip not found'),
        { statusCode: 404 }
      ));
    }

    const trip = trips[0];
    if (trip.status !== 'SCHEDULED') {
      return next(Object.assign(
        createError('BUSINESS_INVALID_STATUS', `Cannot start trip with status ${trip.status}. Trip must be SCHEDULED.`),
        { statusCode: 409 }
      ));
    }

    // Check vehicle doesn't already have IN_PROGRESS trip
    const [activeTrips] = await sequelize.query(
      "SELECT id FROM trips WHERE vehicle_id = ? AND status = 'IN_PROGRESS'",
      { replacements: [trip.vehicle_id] }
    );
    if (activeTrips.length > 0) {
      return next(Object.assign(
        createError('BUSINESS_ACTIVE_TRIP', 'Vehicle already has an in-progress trip'),
        { statusCode: 409 }
      ));
    }

    await sequelize.query(
      "UPDATE trips SET status = 'IN_PROGRESS', started_at = NOW() WHERE id = ?",
      { replacements: [req.params.id] }
    );

    // Update vehicle status to ACTIVE
    await sequelize.query(
      "UPDATE vehicles SET status = 'ACTIVE' WHERE id = ?",
      { replacements: [trip.vehicle_id] }
    );

    await req.audit({ action: 'START_TRIP', resourceType: 'TRIP', resourceId: req.params.id, result: 'SUCCESS' });

    const [updated] = await sequelize.query('SELECT * FROM trips WHERE id = ?', { replacements: [req.params.id] });
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /trips/:id/complete
 * Complete trip: update mileage_km, check next_service_km in same transaction
 */
router.patch('/:id/complete', async (req, res, next) => {
  try {
    const [trips] = await sequelize.query(
      'SELECT * FROM trips WHERE id = ?',
      { replacements: [req.params.id] }
    );
    if (trips.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_TRIP', 'Trip not found'),
        { statusCode: 404 }
      ));
    }

    const trip = trips[0];
    if (trip.status !== 'IN_PROGRESS') {
      return next(Object.assign(
        createError('BUSINESS_INVALID_STATUS', `Cannot complete trip with status ${trip.status}. Trip must be IN_PROGRESS.`),
        { statusCode: 409 }
      ));
    }

    const t = await sequelize.transaction();
    try {
      // Mark trip as COMPLETED
      await sequelize.query(
        "UPDATE trips SET status = 'COMPLETED', ended_at = NOW() WHERE id = ?",
        { replacements: [req.params.id], transaction: t }
      );

      // Update vehicle mileage if distance_km is set
      if (trip.distance_km) {
        await sequelize.query(
          'UPDATE vehicles SET mileage_km = mileage_km + ? WHERE id = ?',
          { replacements: [parseFloat(trip.distance_km), trip.vehicle_id], transaction: t }
        );
      }

      // Check if mileage now exceeds next_service_km
      const [vehicleRows] = await sequelize.query(
        'SELECT id, mileage_km, next_service_km, license_plate FROM vehicles WHERE id = ?',
        { replacements: [trip.vehicle_id], transaction: t }
      );
      const vehicle = vehicleRows[0];

      if (vehicle.next_service_km && vehicle.mileage_km > vehicle.next_service_km) {
        // Auto-change status to MAINTENANCE and create maintenance record
        await sequelize.query(
          "UPDATE vehicles SET status = 'MAINTENANCE' WHERE id = ?",
          { replacements: [trip.vehicle_id], transaction: t }
        );
        const maintId = uuidv4();
        await sequelize.query(
          `INSERT INTO maintenance (id, vehicle_id, status, type, scheduled_at, mileage_at_service)
           VALUES (?, ?, 'SCHEDULED', 'INSPECTION', NOW(), ?)`,
          { replacements: [maintId, trip.vehicle_id, vehicle.mileage_km], transaction: t }
        );
      } else {
        // Set vehicle back to IDLE
        await sequelize.query(
          "UPDATE vehicles SET status = 'IDLE' WHERE id = ?",
          { replacements: [trip.vehicle_id], transaction: t }
        );
      }

      await t.commit();

      await req.audit({ action: 'COMPLETE_TRIP', resourceType: 'TRIP', resourceId: req.params.id, result: 'SUCCESS', detail: { vehicle_id: trip.vehicle_id, distance_km: trip.distance_km } });

      const [updated] = await sequelize.query('SELECT * FROM trips WHERE id = ?', { replacements: [req.params.id] });
      res.json({ data: updated[0] });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /trips/:id/cancel
 */
router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const [trips] = await sequelize.query(
      'SELECT * FROM trips WHERE id = ?',
      { replacements: [req.params.id] }
    );
    if (trips.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_TRIP', 'Trip not found'),
        { statusCode: 404 }
      ));
    }

    const trip = trips[0];
    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
      return next(Object.assign(
        createError('BUSINESS_INVALID_STATUS', `Cannot cancel trip with status ${trip.status}`),
        { statusCode: 409 }
      ));
    }

    await sequelize.query(
      "UPDATE trips SET status = 'CANCELLED' WHERE id = ?",
      { replacements: [req.params.id] }
    );

    if (trip.status === 'IN_PROGRESS') {
      await sequelize.query(
        "UPDATE vehicles SET status = 'IDLE' WHERE id = ?",
        { replacements: [trip.vehicle_id] }
      );
    }

    await req.audit({ action: 'CANCEL_TRIP', resourceType: 'TRIP', resourceId: req.params.id, result: 'SUCCESS' });

    const [updated] = await sequelize.query('SELECT * FROM trips WHERE id = ?', { replacements: [req.params.id] });
    res.json({ data: updated[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
