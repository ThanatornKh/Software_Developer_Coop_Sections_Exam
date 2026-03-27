const express = require('express');
const { evaluateAlerts } = require('../services/alertEngine');

const router = express.Router();

/**
 * GET /alerts
 * Returns alerts from the extensible alert engine.
 * Optional query params: severity (CRITICAL, WARNING), resource_type (VEHICLE, DRIVER, etc.)
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.severity) filters.severity = req.query.severity;
    if (req.query.resource_type) filters.resource_type = req.query.resource_type;

    const alerts = await evaluateAlerts(filters);

    res.json({
      data: alerts,
      meta: {
        total: alerts.length,
        filters_applied: filters
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
