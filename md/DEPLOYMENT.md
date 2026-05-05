# Deployment Guide - Flask Scraping Service

## Overview

The application consists of two services:
1. **Next.js App** - Frontend and API routes
2. **Flask Scraping Service** - Python service for real-time scraping

Both services must run simultaneously in production.

---

## Deployment Options

### Option 1: Separate Services (Recommended)

Deploy Next.js and Flask as separate services:

#### Next.js Deployment
- **Vercel** (recommended for Next.js)
- **Netlify**
- **Railway**
- **Any Node.js hosting**

#### Flask Deployment
- **Railway** (supports Python)
- **Render** (supports Python)
- **Fly.io** (supports Python)
- **DigitalOcean App Platform**
- **AWS EC2 / ECS**
- **Google Cloud Run**

**Configuration:**
1. Deploy Flask to a service (e.g., `https://scraping-api.yourdomain.com`)
2. Set `FLASK_API_URL` environment variable in Next.js to point to Flask service
3. Update Flask `ALLOWED_ORIGINS` to include your Next.js domain

---

### Option 2: Docker Compose (Single Server)

Deploy both services on the same server using Docker:

**Create `docker-compose.yml`:**
```yaml
version: '3.8'

services:
  nextjs:
    build: .
    ports:
      - "3000:3000"
    environment:
      - FLASK_API_URL=http://flask:5000
    depends_on:
      - flask

  flask:
    build:
      context: ./scripts/scraping
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      - FLASK_HOST=0.0.0.0
      - FLASK_PORT=5000
      - ALLOWED_ORIGINS=https://yourdomain.com
```

**Deploy:**
```bash
docker-compose up -d
```

---

### Option 3: Process Manager (PM2)

Run both services on the same server using PM2:

**Create `ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [
    {
      name: 'nextjs',
      script: 'npm',
      args: 'start',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        FLASK_API_URL: 'http://localhost:5000'
      }
    },
    {
      name: 'flask',
      script: 'python3',
      args: 'app.py',
      cwd: './scripts/scraping',
      interpreter: 'python3',
      env: {
        FLASK_HOST: '127.0.0.1',
        FLASK_PORT: '5000',
        ALLOWED_ORIGINS: 'https://yourdomain.com'
      }
    }
  ]
};
```

**Deploy:**
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # For auto-start on server reboot
```

---

### Option 4: Systemd Services (Linux)

Create systemd service files for both services:

**`/etc/systemd/system/flask-scraper.service`:**
```ini
[Unit]
Description=Flask Scraping Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/tawveeri/scripts/scraping
Environment="FLASK_HOST=127.0.0.1"
Environment="FLASK_PORT=5000"
Environment="ALLOWED_ORIGINS=https://yourdomain.com"
ExecStart=/usr/bin/python3 app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl enable flask-scraper
sudo systemctl start flask-scraper
```

---

## Environment Variables for Production

### Next.js (.env.production)
```bash
FLASK_API_URL=https://scraping-api.yourdomain.com
# Or if same server: http://localhost:5000
```

### Flask (scripts/scraping/.env)
```bash
FLASK_HOST=0.0.0.0  # Listen on all interfaces
FLASK_PORT=5000
FLASK_DEBUG=false
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## Production Considerations

### 1. Use Production WSGI Server

Flask's built-in server is **NOT** for production. Use:

- **Gunicorn** (recommended)
- **uWSGI**
- **Waitress**

**Example with Gunicorn:**
```bash
cd scripts/scraping
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 2. Reverse Proxy (Nginx)

Use Nginx as reverse proxy:

```nginx
# Flask service
upstream flask {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name scraping-api.yourdomain.com;

    location / {
        proxy_pass http://flask;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. Security

- Use HTTPS (Let's Encrypt)
- Set proper CORS origins
- Use environment variables for secrets
- Rate limiting (consider adding)
- Firewall rules

### 4. Monitoring

- Health check endpoint: `/health`
- Logging (consider structured logging)
- Error tracking (Sentry, etc.)
- Uptime monitoring

---

## Quick Deployment Checklist

- [ ] Deploy Flask service to hosting platform
- [ ] Get Flask service URL
- [ ] Set `FLASK_API_URL` in Next.js environment
- [ ] Update Flask `ALLOWED_ORIGINS` with Next.js domain
- [ ] Use production WSGI server (Gunicorn)
- [ ] Set up reverse proxy (Nginx) if needed
- [ ] Configure HTTPS
- [ ] Test health endpoint
- [ ] Test search functionality
- [ ] Set up monitoring

---

## Platform-Specific Guides

### Vercel (Next.js) + Railway (Flask)

1. **Deploy Flask to Railway:**
   - Connect GitHub repo
   - Set root directory: `scripts/scraping`
   - Add environment variables
   - Railway will auto-detect Python and install dependencies

2. **Deploy Next.js to Vercel:**
   - Connect GitHub repo
   - Add environment variable: `FLASK_API_URL=https://your-railway-app.railway.app`
   - Deploy

### Render

1. **Deploy Flask:**
   - Create new Web Service
   - Build command: `cd scripts/scraping && pip install -r requirements.txt`
   - Start command: `gunicorn -w 4 -b 0.0.0.0:$PORT app:app`

2. **Deploy Next.js:**
   - Create new Web Service
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Add environment variable: `FLASK_API_URL=https://your-flask-service.onrender.com`

---

## Important Notes

1. **The original dev's repo** was a standalone Flask app - it could be deployed as a single service
2. **Your setup** requires two services because Next.js needs to call Flask
3. **In production**, you cannot manually run `npm run flask:start` - it must be a managed service
4. **Consider costs** - running two services may cost more than one

---

## Alternative: Serverless Functions

If you want to avoid managing a Flask service, you could:
- Convert scrapers to serverless functions (Vercel Functions, AWS Lambda)
- Use a serverless Python runtime
- Note: This requires significant refactoring

---

## Recommended Approach

For most deployments, I recommend:

1. **Next.js on Vercel** (free tier available, excellent Next.js support)
2. **Flask on Railway** (free tier available, easy Python deployment)
3. **Set `FLASK_API_URL`** to Railway URL
4. **Use Gunicorn** for Flask in production

This gives you:
- ✅ Automatic deployments
- ✅ HTTPS included
- ✅ Easy scaling
- ✅ Free tier to start


