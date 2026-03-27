const express = require('express');
const sequelize = require('../config/database');

const router = express.Router();

/**
 * GET /dashboard/stats
 * Returns aggregated statistics:
 * - total vehicles
 * - active trips today
 * - total distance today
 * - overdue maintenance count
 */
router.get('/stats', async (req, res, next) => {
  try {
    // Total vehicles (non-retired)
    const [vehicleCount] = await sequelize.query(
      "SELECT COUNT(*) as total FROM vehicles WHERE status != 'RETIRED'"
    );

    // Active trips today (IN_PROGRESS)
    const [activeTrips] = await sequelize.query(
      `SELECT COUNT(*) as total FROM trips
       WHERE status = 'IN_PROGRESS'
         AND DATE(COALESCE(started_at, created_at)) = CURDATE()`
    );

    // Total distance today (completed trips today)
    const [distanceToday] = await sequelize.query(
      `SELECT COALESCE(SUM(distance_km), 0) as total FROM trips
       WHERE status = 'COMPLETED'
         AND DATE(ended_at) = CURDATE()`
    );

    // Overdue maintenance count (SCHEDULED with scheduled_at in the past)
    const [overdueMaintenance] = await sequelize.query(
      `SELECT COUNT(*) as total FROM maintenance
       WHERE status = 'SCHEDULED'
         AND scheduled_at < NOW()`
    );

    // Vehicles by status (as object: { ACTIVE: 2, IDLE: 1, ... })
    const [vehiclesByStatusRows] = await sequelize.query(
      `SELECT status, COUNT(*) as count FROM vehicles GROUP BY status`
    );
    const vehiclesByStatus = {};
    vehiclesByStatusRows.forEach(row => {
      vehiclesByStatus[row.status] = parseInt(row.count);
    });

    // Trip distance trend (last 7 days)
    const [tripTrend] = await sequelize.query(
      `SELECT DATE(COALESCE(ended_at, started_at, created_at)) as date,
              COALESCE(SUM(distance_km), 0) as distance
       FROM trips
       WHERE (ended_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) OR started_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY))
       GROUP BY DATE(COALESCE(ended_at, started_at, created_at))
       ORDER BY date ASC`
    );
    const tripDistanceTrend = tripTrend.map(row => ({
      date: row.date,
      distance: parseFloat(row.distance) || 0
    }));

    res.json({
      data: {
        totalVehicles: vehicleCount[0].total,
        activeTripsToday: activeTrips[0].total,
        totalDistanceToday: parseFloat(distanceToday[0].total) || 0,
        maintenanceOverdue: overdueMaintenance[0].total,
        vehiclesByStatus,
        tripDistanceTrend
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
