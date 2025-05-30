const { Pool } = require('pg');

// Railway PostgreSQL database configuration using DATABASE_URL
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Increased timeout for external DB
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit on Railway - let it recover
});

// Initialize database schema (creates table if it doesn't exist)
const initializeDatabase = async () => {
  try {
    const client = await pool.connect();
    
    // Create rate_limits table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        request_count INT DEFAULT 1,
        window_start TIMESTAMP NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ip_address, endpoint)
      );
    `);
    
    // Create index for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint 
      ON rate_limits(ip_address, endpoint);
    `);
    
    console.log('✓ Railway PostgreSQL database initialized successfully');
    console.log('✓ rate_limits table ready for use');
    
    client.release();
  } catch (err) {
    console.error('Failed to initialize database:', err);
    throw err;
  }
};

// Test Railway database connection with retry logic
const testConnection = async () => {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      console.log(`Attempting database connection... (attempt ${retries + 1}/${maxRetries})`);
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      client.release();
      console.log('✓ Railway PostgreSQL connection established successfully');
      console.log(`Database time: ${result.rows[0].current_time}`);
      return; // Success, exit function
    } catch (err) {
      retries++;
      console.error(`✗ Connection attempt ${retries} failed:`, err.message);
      
      if (retries >= maxRetries) {
        console.error('✗ All connection attempts failed. Please check your DATABASE_URL');
        throw err;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

// Initialize on startup (don't crash if DB is temporarily unavailable)
(async () => {
  try {
    await testConnection();
    await initializeDatabase();
  } catch (err) {
    console.error('⚠ Railway database connection failed on startup:', err.message);
    console.log('📝 Service will continue running - database will retry on first request');
    // Don't exit - let service start and retry DB connection on first request
  }
})();

module.exports = {
  pool,
  testConnection,
  initializeDatabase
};
