require('dotenv').config();

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
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes (no JWT)
app.use('/auth', authRoutes);

// Protected routes (JWT required)
app.use('/vehicles', authenticate, vehicleRoutes);
app.use('/drivers', authenticate, driverRoutes);
app.use('/trips', authenticate, tripRoutes);
app.use('/checkpoints', authenticate, checkpointRoutes);
app.use('/maintenance', authenticate, maintenanceRoutes);
app.use('/alerts', authenticate, alertRoutes);
app.use('/audit-logs', authenticate, auditLogRoutes);
app.use('/dashboard', authenticate, dashboardRoutes);

// 404 handler
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
