/**
 * Unified error response helper
 */
function createError(code, message, details = {}) {
  const err = new Error(message);
  err.errorCode = code;
  err.details = details;
  return err;
}

/**
 * Map HTTP status from error code prefix
 */
function getStatusFromCode(code) {
  if (!code) return 500;
  if (code.startsWith('AUTH_')) return 401;
  if (code.startsWith('FORBIDDEN') || code.startsWith('ACCESS_')) return 403;
  if (code.startsWith('NOT_FOUND')) return 404;
  if (code.startsWith('CONFLICT') || code.startsWith('BUSINESS_')) return 409;
  if (code.startsWith('VALIDATION_')) return 422;
  return 500;
}

/**
 * Express error handling middleware
 */
function errorHandler(err, req, res, _next) {
  const code = err.errorCode || 'INTERNAL_ERROR';
  const status = err.statusCode || getStatusFromCode(code);
  const message = err.message || 'An unexpected error occurred';
  const details = err.details || {};

  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', { code, message, stack: err.stack });
  }

  res.status(status).json({
    error: {
      code,
      message,
      details
    }
  });
}

module.exports = { errorHandler, createError };
