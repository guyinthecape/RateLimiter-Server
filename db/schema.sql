-- Rate limiting microservice database schema
-- This file is for reference only; the schema is created automatically by the application

CREATE TABLE IF NOT EXISTS rate_limits (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  request_count INT DEFAULT 1,
  window_start TIMESTAMP NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ip_address, endpoint)
);

-- Create index for better performance on lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint 
ON rate_limits(ip_address, endpoint);

-- Example queries for reference:

-- Insert or update rate limit record
INSERT INTO rate_limits (ip_address, endpoint, request_count, window_start, last_updated)
VALUES ($1, $2, 1, $3, CURRENT_TIMESTAMP)
ON CONFLICT (ip_address, endpoint)
DO UPDATE SET 
  request_count = rate_limits.request_count + 1,
  last_updated = CURRENT_TIMESTAMP;

-- Select existing rate limit record
SELECT id, ip_address, endpoint, request_count, window_start, last_updated
FROM rate_limits 
WHERE ip_address = $1 AND endpoint = $2;

-- Reset rate limit window
UPDATE rate_limits 
SET request_count = 1, window_start = $1, last_updated = CURRENT_TIMESTAMP
WHERE ip_address = $2 AND endpoint = $3;

-- Clean up old records (optional maintenance query)
DELETE FROM rate_limits 
WHERE last_updated < NOW() - INTERVAL '7 days';
