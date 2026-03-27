const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

/**
 * Log an audit event (append-only).
 * Can be called directly from route handlers.
 */
async function logAudit({ userId, action, resourceType, resourceId = null, ipAddress = null, result = 'SUCCESS', detail = null }) {
  try {
    await sequelize.query(
      `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, ip_address, result, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      {
        replacements: [
          uuidv4(),
          userId,
          action,
          resourceType,
          resourceId,
          ipAddress,
          result,
          detail ? JSON.stringify(detail) : null
        ]
      }
    );
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

/**
 * Express middleware that attaches audit helper to req.
 */
function auditMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  req.audit = ({ action, resourceType, resourceId, result, detail }) => {
    const userId = req.user ? req.user.id : 'anonymous';
    return logAudit({ userId, action, resourceType, resourceId, ipAddress: ip, result, detail });
  };
  next();
}

module.exports = { auditMiddleware, logAudit };
