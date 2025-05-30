const express = require('express');
const { pool } = require('../db/connection');

const router = express.Router();

// Simple in-memory rate limiting for health endpoint
const healthRequests = new Map();

// Health check endpoint - Railway compatible
router.get('/health', async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 60; // 60 requests per minute
  
  // Clean old entries
  const cutoff = now - windowMs;
  const clientRequests = healthRequests.get(clientIP) || [];
  const recentRequests = clientRequests.filter(time => time > cutoff);
  
  if (recentRequests.length >= maxRequests) {
    return res.status(429).json({ error: 'Too many health check requests' });
  }
  
  recentRequests.push(now);
  healthRequests.set(clientIP, recentRequests);
  
  // Always return 200 for Railway health checks
  res.status(200).json({ 
    status: 'ok',
    db: 'connected',
    timestamp: new Date().toISOString(),
    service: 'rate-limit-service'
  });
});

module.exports = router;
