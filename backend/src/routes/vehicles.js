const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const { createError } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /vehicles
 * List vehicles with optional filters: status, type, driver_id
 */
router.get('/', async (req, res, next) => {
  try {
    let where = [];
    let replacements = [];

    if (req.query.status) {
      where.push('v.status = ?');
      replacements.push(req.query.status);
    }
    if (req.query.type) {
      where.push('v.type = ?');
      replacements.push(req.query.type);
    }
    if (req.query.driver_id) {
      where.push('v.driver_id = ?');
      replacements.push(req.query.driver_id);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const [vehicles] = await sequelize.query(
      `SELECT v.*, d.name as driver_name
       FROM vehicles v
       LEFT JOIN drivers d ON d.id = v.driver_id
       ${whereClause}
       ORDER BY v.created_at DESC`,
      { replacements }
    );

    res.json({ data: vehicles });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /vehicles/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const [vehicles] = await sequelize.query(
      `SELECT v.*, d.name as driver_name
       FROM vehicles v
       LEFT JOIN drivers d ON d.id = v.driver_id
       WHERE v.id = ?`,
      { replacements: [req.params.id] }
    );

    if (vehicles.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_VEHICLE', 'Vehicle not found'),
        { statusCode: 404 }
      ));
    }

    res.json({ data: vehicles[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /vehicles/:id/history
 * Combined trips + maintenance sorted by date, each with type field
 */
router.get('/:id/history', async (req, res, next) => {
  try {
    const [vehicle] = await sequelize.query(
      'SELECT id FROM vehicles WHERE id = ?',
      { replacements: [req.params.id] }
    );
    if (vehicle.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_VEHICLE', 'Vehicle not found'),
        { statusCode: 404 }
      ));
    }

    const [trips] = await sequelize.query(
      `SELECT id, 'trip' as type, status, origin, destination, distance_km,
              started_at, ended_at, COALESCE(started_at, created_at) as event_date
       FROM trips
       WHERE vehicle_id = ?
       ORDER BY event_date DESC`,
      { replacements: [req.params.id] }
    );

    const [maintenanceRecords] = await sequelize.query(
      `SELECT id, 'maintenance' as type, status, type as maintenance_type,
              scheduled_at, completed_at, cost_thb, technician,
              COALESCE(completed_at, scheduled_at) as event_date
       FROM maintenance
       WHERE vehicle_id = ?
       ORDER BY event_date DESC`,
      { replacements: [req.params.id] }
    );

    // Combine and sort by date descending
    const history = [...trips, ...maintenanceRecords].sort((a, b) => {
      const dateA = new Date(a.event_date);
      const dateB = new Date(b.event_date);
      return dateB - dateA;
    });

    res.json({ data: history });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /vehicles
 * Create a new vehicle with full validation
 */
router.post('/', [
  body('license_plate').notEmpty().withMessage('License plate is required'),
  body('type').isIn(['TRUCK', 'VAN', 'MOTORCYCLE', 'PICKUP']).withMessage('Invalid vehicle type'),
  body('brand').optional().isString(),
  body('model').optional().isString(),
  body('year').optional().isInt({ min: 1900, max: 2100 }),
  body('fuel_type').optional().isIn(['DIESEL', 'GASOLINE', 'ELECTRIC', 'HYBRID']),
  body('mileage_km').optional().isInt({ min: 0 }),
  body('next_service_km').optional().isInt({ min: 0 }),
  body('driver_id').optional().isString()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(Object.assign(
        createError('VALIDATION_ERROR', 'Invalid input', { fields: errors.array() }),
        { statusCode: 422 }
      ));
    }

    const id = uuidv4();
    const {
      license_plate, type, brand, model, year, fuel_type,
      mileage_km = 0, last_service_km, next_service_km, driver_id, status = 'IDLE'
    } = req.body;

    const t = await sequelize.transaction();
    try {
      // Check for duplicate license plate
      const [existing] = await sequelize.query(
        'SELECT id FROM vehicles WHERE license_plate = ?',
        { replacements: [license_plate], transaction: t }
      );
      if (existing.length > 0) {
        await t.rollback();
        return next(Object.assign(
          createError('CONFLICT_LICENSE_PLATE', 'License plate already exists'),
          { statusCode: 409 }
        ));
      }

      // If driver_id provided, check license expiry
      if (driver_id) {
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
        if (new Date(drivers[0].license_expires_at) < new Date()) {
          await t.rollback();
          return next(Object.assign(
            createError('BUSINESS_EXPIRED_LICENSE', 'Driver with expired license cannot be assigned to a vehicle'),
            { statusCode: 409 }
          ));
        }
      }

      // Determine status based on mileage
      let finalStatus = status;
      let autoMaintenance = false;
      if (next_service_km && mileage_km > next_service_km) {
        finalStatus = 'MAINTENANCE';
        autoMaintenance = true;
      }

      await sequelize.query(
        `INSERT INTO vehicles (id, license_plate, type, status, driver_id, brand, model, year, fuel_type, mileage_km, last_service_km, next_service_km)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        {
          replacements: [id, license_plate, type, finalStatus, driver_id || null, brand || null, model || null, year || null, fuel_type || null, mileage_km, last_service_km || null, next_service_km || null],
          transaction: t
        }
      );

      // Auto-create maintenance if mileage exceeds next_service_km
      if (autoMaintenance) {
        const maintId = uuidv4();
        await sequelize.query(
          `INSERT INTO maintenance (id, vehicle_id, status, type, scheduled_at)
           VALUES (?, ?, 'SCHEDULED', 'INSPECTION', NOW())`,
          { replacements: [maintId, id], transaction: t }
        );
      }

      await t.commit();

      // Audit
      await req.audit({ action: 'CREATE_VEHICLE', resourceType: 'VEHICLE', resourceId: id, result: 'SUCCESS', detail: { license_plate } });

      const [created] = await sequelize.query('SELECT * FROM vehicles WHERE id = ?', { replacements: [id] });
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
 * PATCH /vehicles/:id
 * Update vehicle fields (status, driver_id, mileage_km, etc.)
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const [vehicles] = await sequelize.query(
      'SELECT * FROM vehicles WHERE id = ?',
      { replacements: [req.params.id] }
    );
    if (vehicles.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_VEHICLE', 'Vehicle not found'),
        { statusCode: 404 }
      ));
    }

    const vehicle = vehicles[0];
    const updates = req.body;
    const t = await sequelize.transaction();

    try {
      // If assigning a driver, check license expiry
      if (updates.driver_id) {
        const [drivers] = await sequelize.query(
          'SELECT id, license_expires_at FROM drivers WHERE id = ?',
          { replacements: [updates.driver_id], transaction: t }
        );
        if (drivers.length === 0) {
          await t.rollback();
          return next(Object.assign(
            createError('NOT_FOUND_DRIVER', 'Driver not found'),
            { statusCode: 404 }
          ));
        }
        if (new Date(drivers[0].license_expires_at) < new Date()) {
          await t.rollback();
          return next(Object.assign(
            createError('BUSINESS_EXPIRED_LICENSE', 'Driver with expired license cannot be assigned to a vehicle'),
            { statusCode: 409 }
          ));
        }
      }

      // Build dynamic update
      const allowedFields = ['license_plate', 'type', 'status', 'driver_id', 'brand', 'model', 'year', 'fuel_type', 'mileage_km', 'last_service_km', 'next_service_km'];
      const setClauses = [];
      const values = [];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          setClauses.push(`${field} = ?`);
          values.push(updates[field]);
        }
      }

      if (setClauses.length === 0) {
        await t.rollback();
        return next(Object.assign(
          createError('VALIDATION_ERROR', 'No valid fields to update'),
          { statusCode: 422 }
        ));
      }

      values.push(req.params.id);
      await sequelize.query(
        `UPDATE vehicles SET ${setClauses.join(', ')} WHERE id = ?`,
        { replacements: values, transaction: t }
      );

      // Check mileage vs next_service_km after update
      const newMileage = updates.mileage_km !== undefined ? updates.mileage_km : vehicle.mileage_km;
      const newNextService = updates.next_service_km !== undefined ? updates.next_service_km : vehicle.next_service_km;

      if (newNextService && newMileage > newNextService) {
        await sequelize.query(
          `UPDATE vehicles SET status = 'MAINTENANCE' WHERE id = ?`,
          { replacements: [req.params.id], transaction: t }
        );
        const maintId = uuidv4();
        await sequelize.query(
          `INSERT INTO maintenance (id, vehicle_id, status, type, scheduled_at)
           VALUES (?, ?, 'SCHEDULED', 'INSPECTION', NOW())`,
          { replacements: [maintId, req.params.id], transaction: t }
        );
      }

      await t.commit();

      await req.audit({ action: 'UPDATE_VEHICLE', resourceType: 'VEHICLE', resourceId: req.params.id, result: 'SUCCESS', detail: updates });

      const [updated] = await sequelize.query('SELECT * FROM vehicles WHERE id = ?', { replacements: [req.params.id] });
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
 * DELETE /vehicles/:id
 * Only ADMIN can delete. Cannot delete if vehicle has IN_PROGRESS trip.
 */
router.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const [vehicles] = await sequelize.query(
      'SELECT id FROM vehicles WHERE id = ?',
      { replacements: [req.params.id] }
    );
    if (vehicles.length === 0) {
      return next(Object.assign(
        createError('NOT_FOUND_VEHICLE', 'Vehicle not found'),
        { statusCode: 404 }
      ));
    }

    // Check for IN_PROGRESS trips
    const [activeTrips] = await sequelize.query(
      "SELECT id FROM trips WHERE vehicle_id = ? AND status = 'IN_PROGRESS'",
      { replacements: [req.params.id] }
    );
    if (activeTrips.length > 0) {
      return next(Object.assign(
        createError('BUSINESS_ACTIVE_TRIP', 'Cannot delete vehicle with an in-progress trip'),
        { statusCode: 409 }
      ));
    }

    // Delete related records in order
    await sequelize.query(
      `DELETE cp FROM checkpoints cp
       INNER JOIN trips t ON t.id = cp.trip_id
       WHERE t.vehicle_id = ?`,
      { replacements: [req.params.id] }
    );
    await sequelize.query('DELETE FROM trips WHERE vehicle_id = ?', { replacements: [req.params.id] });
    await sequelize.query(
      `DELETE mp FROM maintenance_parts mp
       INNER JOIN maintenance m ON m.id = mp.maintenance_id
       WHERE m.vehicle_id = ?`,
      { replacements: [req.params.id] }
    );
    await sequelize.query('DELETE FROM maintenance WHERE vehicle_id = ?', { replacements: [req.params.id] });
    await sequelize.query('DELETE FROM vehicles WHERE id = ?', { replacements: [req.params.id] });

    await req.audit({ action: 'DELETE_VEHICLE', resourceType: 'VEHICLE', resourceId: req.params.id, result: 'SUCCESS' });

    res.json({ data: { message: 'Vehicle deleted successfully' } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
