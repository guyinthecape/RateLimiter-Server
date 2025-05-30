const express = require('express');
const cors = require('cors');
require('dotenv').config();

const checkRoute = require('./routes/check');
const healthRoute = require('./routes/health');

// Log environment info for Railway deployment
console.log('🚀 Starting Rate Limiting Service...');
if (process.env.NODE_ENV !== 'production') {
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`PORT: ${process.env.PORT || 5000}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'configured ✓' : 'missing ⚠'}`);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use(checkRoute);
app.use(healthRoute);

// Root route for Railway health checks
app.get('/', (req, res) => {
  res.json({ 
    service: 'rate-limit-service',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      check: '/check'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  console.log(`✅ Server listening on port ${PORT}`);
  console.log(`🚀 Rate limiting microservice ready for Railway deployment`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Host: 0.0.0.0`);
});

module.exports = app;
