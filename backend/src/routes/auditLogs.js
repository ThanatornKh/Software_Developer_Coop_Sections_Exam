const express = require('express');
const sequelize = require('../config/database');

const router = express.Router();

/**
 * GET /audit-logs
 * List audit logs with filtering.
 * DISPATCHER sees only own logs, ADMIN sees all.
 * Filters: user_id, action, resource_type, start_date, end_date
 */
router.get('/', async (req, res, next) => {
  try {
    let where = [];
    let replacements = [];

    // Role-based filtering: DISPATCHER sees only own logs
    if (req.user.role === 'DISPATCHER') {
      where.push('al.user_id = ?');
      replacements.push(req.user.id);
    } else if (req.query.user_id) {
      where.push('al.user_id = ?');
      replacements.push(req.query.user_id);
    }

    if (req.query.action) {
      where.push('al.action = ?');
      replacements.push(req.query.action);
    }
    if (req.query.resource_type) {
      where.push('al.resource_type = ?');
      replacements.push(req.query.resource_type);
    }
    if (req.query.start_date) {
      where.push('al.created_at >= ?');
      replacements.push(req.query.start_date);
    }
    if (req.query.end_date) {
      where.push('al.created_at <= ?');
      replacements.push(req.query.end_date);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;

    const [logs] = await sequelize.query(
      `SELECT al.*, u.username
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      { replacements: [...replacements, limit, offset] }
    );

    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
      { replacements: [...replacements] }
    );

    res.json({
      data: logs,
      meta: {
        total: countResult[0].total,
        page,
        limit,
        total_pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
