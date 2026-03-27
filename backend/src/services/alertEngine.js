const sequelize = require('../config/database');

/**
 * Extensible rule-based alert engine.
 * New rules can be added by pushing to the `rules` array
 * without modifying the core engine logic.
 *
 * Each rule is an object with:
 *   - name: string
 *   - severity: 'CRITICAL' | 'WARNING' | 'INFO'
 *   - resourceType: string (e.g. 'VEHICLE', 'DRIVER', 'TRIP', 'MAINTENANCE')
 *   - evaluate(): async function returning array of alert objects
 */

const rules = [];

/**
 * Register a new alert rule.
 */
function registerRule(rule) {
  rules.push(rule);
}

/**
 * Evaluate all registered rules and return alerts.
 * Supports optional filters: severity, resourceType
 */
async function evaluateAlerts(filters = {}) {
  const allAlerts = [];

  for (const rule of rules) {
    // Pre-filter by severity and resourceType to skip unnecessary evaluation
    if (filters.severity && rule.severity !== filters.severity) continue;
    if (filters.resource_type && rule.resourceType !== filters.resource_type) continue;

    try {
      const alerts = await rule.evaluate();
      allAlerts.push(...alerts);
    } catch (err) {
      console.error(`Alert rule "${rule.name}" failed:`, err.message);
    }
  }

  return allAlerts;
}

// ----- Built-in Rules -----

// Rule 1: Vehicle Due for Service (mileage_km > next_service_km)
registerRule({
  name: 'Vehicle Due for Service',
  severity: 'CRITICAL',
  resourceType: 'VEHICLE',
  async evaluate() {
    const [rows] = await sequelize.query(
      `SELECT id, license_plate, mileage_km, next_service_km
       FROM vehicles
       WHERE next_service_km IS NOT NULL
         AND mileage_km > next_service_km
         AND status != 'RETIRED'`
    );
    return rows.map(v => ({
      rule: 'Vehicle Due for Service',
      severity: 'CRITICAL',
      resource_type: 'VEHICLE',
      resource_id: v.id,
      message: `Vehicle ${v.license_plate} has ${v.mileage_km} km, exceeding next service at ${v.next_service_km} km`,
      data: { license_plate: v.license_plate, mileage_km: v.mileage_km, next_service_km: v.next_service_km }
    }));
  }
});

// Rule 2: Overdue Maintenance (SCHEDULED and past 3 days)
registerRule({
  name: 'Overdue Maintenance',
  severity: 'CRITICAL',
  resourceType: 'MAINTENANCE',
  async evaluate() {
    const [rows] = await sequelize.query(
      `SELECT m.id, m.vehicle_id, m.type, m.scheduled_at, v.license_plate
       FROM maintenance m
       JOIN vehicles v ON v.id = m.vehicle_id
       WHERE m.status = 'SCHEDULED'
         AND m.scheduled_at < DATE_SUB(NOW(), INTERVAL 3 DAY)`
    );
    return rows.map(m => ({
      rule: 'Overdue Maintenance',
      severity: 'CRITICAL',
      resource_type: 'MAINTENANCE',
      resource_id: m.id,
      message: `Maintenance ${m.type} for vehicle ${m.license_plate} was scheduled at ${m.scheduled_at} and is overdue`,
      data: { vehicle_id: m.vehicle_id, type: m.type, scheduled_at: m.scheduled_at }
    }));
  }
});

// Rule 3: License Expiring Soon (within 30 days)
registerRule({
  name: 'License Expiring Soon',
  severity: 'WARNING',
  resourceType: 'DRIVER',
  async evaluate() {
    const [rows] = await sequelize.query(
      `SELECT id, name, license_number, license_expires_at
       FROM drivers
       WHERE status = 'ACTIVE'
         AND license_expires_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
    );
    return rows.map(d => ({
      rule: 'License Expiring Soon',
      severity: 'WARNING',
      resource_type: 'DRIVER',
      resource_id: d.id,
      message: `Driver ${d.name}'s license (${d.license_number}) expires on ${d.license_expires_at}`,
      data: { name: d.name, license_number: d.license_number, license_expires_at: d.license_expires_at }
    }));
  }
});

// Rule 4: Trip Delayed (IN_PROGRESS longer than 150% estimated duration)
registerRule({
  name: 'Trip Delayed',
  severity: 'WARNING',
  resourceType: 'TRIP',
  async evaluate() {
    // Estimate expected duration: distance_km / 60 km/h average speed in hours
    const [rows] = await sequelize.query(
      `SELECT t.id, t.vehicle_id, t.origin, t.destination, t.distance_km,
              t.started_at, v.license_plate,
              TIMESTAMPDIFF(MINUTE, t.started_at, NOW()) as elapsed_minutes,
              (t.distance_km / 60) * 60 as estimated_minutes
       FROM trips t
       JOIN vehicles v ON v.id = t.vehicle_id
       WHERE t.status = 'IN_PROGRESS'
         AND t.started_at IS NOT NULL
         AND t.distance_km IS NOT NULL
       HAVING elapsed_minutes > estimated_minutes * 1.5`
    );
    return rows.map(t => ({
      rule: 'Trip Delayed',
      severity: 'WARNING',
      resource_type: 'TRIP',
      resource_id: t.id,
      message: `Trip from ${t.origin} to ${t.destination} (vehicle ${t.license_plate}) has exceeded 150% of estimated duration`,
      data: {
        vehicle_id: t.vehicle_id,
        elapsed_minutes: t.elapsed_minutes,
        estimated_minutes: t.estimated_minutes,
        origin: t.origin,
        destination: t.destination
      }
    }));
  }
});

module.exports = { registerRule, evaluateAlerts, rules };
