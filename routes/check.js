const express = require('express');
const { pool } = require('../db/connection');

const router = express.Router();

// Input validation middleware
const validateCheckRequest = (req, res, next) => {
  const { ip, endpoint, max, windowMs } = req.body;
  
  if (!ip || typeof ip !== 'string' || ip.trim() === '') {
    return res.status(400).json({ error: 'Invalid or missing ip address' });
  }
  
  if (!endpoint || typeof endpoint !== 'string' || endpoint.trim() === '') {
    return res.status(400).json({ error: 'Invalid or missing endpoint' });
  }
  
  if (!max || typeof max !== 'number' || max < 1) {
    return res.status(400).json({ error: 'Invalid max value - must be a positive number' });
  }
  
  if (!windowMs || typeof windowMs !== 'number' || windowMs < 1000) {
    return res.status(400).json({ error: 'Invalid windowMs value - must be at least 1000ms' });
  }
  
  next();
};

// Rate limiting check endpoint
router.post('/check', validateCheckRequest, async (req, res) => {
  const { ip, endpoint, max, windowMs } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get current time and calculate window start
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    
    // Check if a record exists for this IP and endpoint
    const selectQuery = `
      SELECT id, request_count, window_start, last_updated
      FROM rate_limits 
      WHERE ip_address = $1 AND endpoint = $2
      FOR UPDATE;
    `;
    
    const result = await client.query(selectQuery, [ip, endpoint]);
    
    if (result.rows.length === 0) {
      // No existing record - create new one
      const insertQuery = `
        INSERT INTO rate_limits (ip_address, endpoint, request_count, window_start, last_updated)
        VALUES ($1, $2, 1, $3, $4);
      `;
      
      await client.query(insertQuery, [ip, endpoint, now, now]);
      await client.query('COMMIT');
      
      return res.json({ allowed: true });
    }
    
    const record = result.rows[0];
    const recordWindowStart = new Date(record.window_start);
    
    // Check if the current window has expired
    if (recordWindowStart <= windowStart) {
      // Window has expired - reset the count
      const resetQuery = `
        UPDATE rate_limits 
        SET request_count = 1, window_start = $1, last_updated = $2
        WHERE ip_address = $3 AND endpoint = $4;
      `;
      
      await client.query(resetQuery, [now, now, ip, endpoint]);
      await client.query('COMMIT');
      
      return res.json({ allowed: true });
    }
    
    // Window is still active - check if under limit
    if (record.request_count < max) {
      // Under limit - increment count and allow
      const incrementQuery = `
        UPDATE rate_limits 
        SET request_count = request_count + 1, last_updated = $1
        WHERE ip_address = $2 AND endpoint = $3;
      `;
      
      await client.query(incrementQuery, [now, ip, endpoint]);
      await client.query('COMMIT');
      
      return res.json({ allowed: true });
    }
    
    // Over limit - calculate retry time
    const windowEndTime = new Date(recordWindowStart.getTime() + windowMs);
    const retryAfterMs = windowEndTime.getTime() - now.getTime();
    
    await client.query('COMMIT');
    
    return res.json({ 
      allowed: false, 
      retryAfterMs: Math.max(0, retryAfterMs)
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Rate limit check error:', error);
    
    res.status(500).json({ 
      error: 'Database unavailable'
    });
  } finally {
    client.release();
  }
});

module.exports = router;
