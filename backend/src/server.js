require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');
const { auditMiddleware } = require('./middleware/auditLog');

// Route imports
const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const driverRoutes = require('./routes/drivers');
const tripRoutes = require('./routes/trips');
const checkpointRoutes = require('./routes/checkpoints');
const maintenanceRoutes = require('./routes/maintenance');
const alertRoutes = require('./routes/alerts');
const auditLogRoutes = require('./routes/auditLogs');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 4000;

// Global middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Audit middleware on all routes (attaches req.audit helper)
app.use(auditMiddleware);

// Health check (no auth needed)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes (no JWT)
app.use('/api/auth', authRoutes);

// Protected routes (JWT required)
app.use('/api/vehicles', authenticate, vehicleRoutes);
app.use('/api/drivers', authenticate, driverRoutes);
app.use('/api/trips', authenticate, tripRoutes);
app.use('/api/checkpoints', authenticate, checkpointRoutes);
app.use('/api/maintenance', authenticate, maintenanceRoutes);
app.use('/api/alerts', authenticate, alertRoutes);
app.use('/api/audit-logs', authenticate, auditLogRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);

// --- Production static file serving ---
const publicDir = path.join(__dirname, '..', 'public');

if (process.env.NODE_ENV === 'production' || fs.existsSync(publicDir)) {
  // Serve static assets (JS, CSS, images, etc.)
  app.use(express.static(publicDir));

  // SPA fallback: any non-API route serves index.html
  app.get('*', (req, res, next) => {
    // Don't intercept /api routes — let them fall through to the 404 handler
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// 404 handler (only hits for unmatched /api routes)
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND_ROUTE',
      message: `Route ${req.method} ${req.path} not found`,
      details: {}
    }
  });
});

// Global error handler
app.use(errorHandler);

// Database connection and server start
async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Auto-initialize schema and seed data
    const { initDatabase } = require('./initDb');
    await initDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Fleet Management API server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    // Retry connection after delay (useful in Docker)
    console.log('Retrying database connection in 5 seconds...');
    setTimeout(start, 5000);
  }
}

start();

module.exports = app;
