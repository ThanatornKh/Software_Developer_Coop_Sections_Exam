const jwt = require('jsonwebtoken');
const { createError } = require('./errorHandler');

/**
 * JWT verification middleware.
 * Extracts token from Authorization: Bearer <token> header.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(Object.assign(createError('AUTH_MISSING_TOKEN', 'Authentication token is required'), { statusCode: 401 }));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(Object.assign(createError('AUTH_TOKEN_EXPIRED', 'Token has expired. Please refresh your token.'), { statusCode: 401 }));
    }
    return next(Object.assign(createError('AUTH_INVALID_TOKEN', 'Invalid authentication token'), { statusCode: 401 }));
  }
}

/**
 * Role-based authorization middleware factory.
 * @param  {...string} roles - Allowed roles
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(Object.assign(createError('AUTH_MISSING_TOKEN', 'Authentication required'), { statusCode: 401 }));
    }
    if (!roles.includes(req.user.role)) {
      return next(Object.assign(createError('FORBIDDEN_ROLE', 'You do not have permission to perform this action', { requiredRoles: roles, yourRole: req.user.role }), { statusCode: 403 }));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
