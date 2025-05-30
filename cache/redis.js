const { createClient } = require('redis');

// Redis configuration
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return false; // Stop reconnecting after 10 attempts
      return Math.min(retries * 100, 3000); // Exponential backoff
    }
  }
};

// Create Redis client
const redis = createClient(redisConfig);

// Handle Redis connection events
redis.on('error', (err) => {
  console.error('Redis client error:', err);
});

redis.on('connect', () => {
  console.log('✓ Redis connection established');
});

redis.on('ready', () => {
  console.log('✓ Redis client ready for operations');
});

redis.on('end', () => {
  console.log('Redis connection closed');
});

// Connect to Redis
const connectRedis = async () => {
  try {
    if (!redis.isOpen) {
      await redis.connect();
    }
  } catch (err) {
    console.error('Failed to connect to Redis:', err.message);
    throw err;
  }
};

// Redis cache operations for rate limiting
const cacheOperations = {
  // Get rate limit data from cache
  async getRateLimit(ip, endpoint) {
    try {
      const key = `rate_limit:${ip}:${endpoint}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Redis get error:', err);
      return null; // Fallback to database on Redis error
    }
  },

  // Set rate limit data in cache
  async setRateLimit(ip, endpoint, data, ttlSeconds = 3600) {
    try {
      const key = `rate_limit:${ip}:${endpoint}`;
      await redis.setEx(key, ttlSeconds, JSON.stringify(data));
      return true;
    } catch (err) {
      console.error('Redis set error:', err);
      return false;
    }
  },

  // Delete rate limit data from cache
  async deleteRateLimit(ip, endpoint) {
    try {
      const key = `rate_limit:${ip}:${endpoint}`;
      await redis.del(key);
      return true;
    } catch (err) {
      console.error('Redis delete error:', err);
      return false;
    }
  },

  // Get cache statistics
  async getCacheStats() {
    try {
      const info = await redis.info('stats');
      return info;
    } catch (err) {
      console.error('Redis stats error:', err);
      return null;
    }
  }
};

// Initialize Redis connection
(async () => {
  try {
    await connectRedis();
  } catch (err) {
    console.log('⚠ Redis unavailable - rate limiting will use PostgreSQL only');
    // Don't exit - continue without Redis caching
  }
})();

module.exports = {
  redis,
  cacheOperations,
  connectRedis
};