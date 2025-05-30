# Rate Limiting Microservice

A production-ready Node.js microservice for rate limiting using Express.js and PostgreSQL. Deploy this service independently and use it across multiple applications to enforce rate limits based on IP addresses and endpoints.

## 🚀 Production Features

- **External PostgreSQL** - Connects to your Railway/external PostgreSQL database
- **Standalone Service** - Deploy independently, reuse across multiple apps
- **Production Security** - SQL injection protection, SSL connections
- **High Performance** - Connection pooling and optimized database queries
- **CORS Enabled** - Ready for cross-origin requests from other services
- **Health Monitoring** - Built-in health check endpoint for uptime monitoring
- **Error Handling** - Comprehensive error responses and logging

## 📋 Database Schema

Your PostgreSQL database should have this table:

```sql
CREATE TABLE rate_limits (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  request_count INT DEFAULT 1,
  window_start TIMESTAMP NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ip_address, endpoint)
);

CREATE INDEX idx_rate_limits_ip_endpoint ON rate_limits(ip_address, endpoint);
```

## 🛠 Setup for Railway Deployment

### 1. Environment Variables

Set these in your Railway project:

```env
PGHOST=your_railway_host
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_railway_password
PGDATABASE=railway
PORT=5000
```

### 2. Local Development

```bash
npm install express pg cors dotenv
node server.js
```

## 🔌 API Endpoints

### POST /check - Rate Limit Validation

**Purpose:** Check if an IP/endpoint combination is within rate limits

**Request:**
```json
{
  "ip": "192.168.1.100",
  "endpoint": "/api/chat/message",
  "max": 10,
  "windowMs": 3600000
}
```

**Responses:**

✅ **Allowed (200):**
```json
{
  "allowed": true
}
```

❌ **Rate Limited (200):**
```json
{
  "allowed": false,
  "retryAfterMs": 240000
}
```

⚠️ **Validation Error (400):**
```json
{
  "error": "Invalid or missing ip address"
}
```

🔥 **Database Error (500):**
```json
{
  "error": "Database unavailable"
}
```

### GET /health - Service Health Check

**Purpose:** Monitor service and database connectivity

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-05-26T06:01:31.000Z",
  "database": "connected",
  "service": "rate-limit-service"
}
```

## 🌐 How Other Services Use This

### From Your Node.js/Express Apps:

```javascript
const axios = require('axios');

async function checkRateLimit(userIP, endpoint, maxRequests, windowMs) {
  try {
    const response = await axios.post('https://your-rate-limiter.railway.app/check', {
      ip: userIP,
      endpoint: endpoint,
      max: maxRequests,
      windowMs: windowMs
    });
    
    return response.data.allowed;
  } catch (error) {
    console.error('Rate limiter unavailable:', error);
    return true; // Allow request if rate limiter is down
  }
}

// Usage in your app routes:
app.post('/api/chat/message', async (req, res) => {
  const userIP = req.ip;
  const isAllowed = await checkRateLimit(userIP, '/api/chat/message', 10, 3600000);
  
  if (!isAllowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  // Process the request...
});
```

### From Python/Flask Apps:

```python
import requests

def check_rate_limit(user_ip, endpoint, max_requests, window_ms):
    try:
        response = requests.post('https://your-rate-limiter.railway.app/check', 
            json={
                'ip': user_ip,
                'endpoint': endpoint,
                'max': max_requests,
                'windowMs': window_ms
            })
        return response.json().get('allowed', True)
    except:
        return True  # Allow if rate limiter is down

@app.route('/api/upload', methods=['POST'])
def upload_file():
    user_ip = request.remote_addr
    if not check_rate_limit(user_ip, '/api/upload', 5, 3600000):
        return {'error': 'Rate limit exceeded'}, 429
    
    # Process upload...
```

## 🚀 Testing Your Service

### 1. Test Health Check:
```bash
curl https://your-rate-limiter.railway.app/health
```

### 2. Test Rate Limiting:
```bash
# First request (should be allowed)
curl -X POST https://your-rate-limiter.railway.app/check \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "192.168.1.100",
    "endpoint": "/api/test",
    "max": 2,
    "windowMs": 60000
  }'

# Second request (should be allowed)
curl -X POST https://your-rate-limiter.railway.app/check \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "192.168.1.100",
    "endpoint": "/api/test",
    "max": 2,
    "windowMs": 60000
  }'

# Third request (should be denied)
curl -X POST https://your-rate-limiter.railway.app/check \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "192.168.1.100",
    "endpoint": "/api/test",
    "max": 2,
    "windowMs": 60000
  }'
```

## 🏗 Production Deployment

### Railway Deployment:
1. Connect your GitHub repo to Railway
2. Set environment variables in Railway dashboard
3. Railway will automatically deploy on port 5000
4. Use the generated URL: `https://your-service.railway.app`

### Usage Patterns:
- **Chat Apps:** 10 messages per hour per IP
- **API Endpoints:** 100 requests per minute per IP  
- **File Uploads:** 5 uploads per hour per IP
- **Authentication:** 5 login attempts per 15 minutes per IP

Your microservice is production-ready and will scale automatically with Railway.

## 🔐 Security Considerations

### Environment Variables
Create a `.env` file based on `.env.example` with your actual values:
```bash
cp .env.example .env
# Edit .env with your Railway PostgreSQL credentials
```

### Production Deployment
- Never commit `.env` files to version control
- Use Railway's environment variable dashboard for production secrets
- Monitor your database connections and set appropriate connection limits
- Consider implementing additional authentication for production use

### Rate Limiting Best Practices
- Set reasonable limits based on your application needs
- Monitor for abuse patterns
- Implement IP whitelisting for trusted sources if needede with Railway's infrastructure!
