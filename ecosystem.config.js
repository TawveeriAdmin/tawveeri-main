module.exports = {
  apps: [
    {
      name: 'nextjs',
      script: 'npm',
      args: 'start',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        FLASK_API_URL: 'http://localhost:5000'
      },
      error_file: './logs/nextjs-error.log',
      out_file: './logs/nextjs-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G'
    },
    {
      name: 'flask-scraper',
      script: 'python3',
      args: 'app.py',
      cwd: './scripts/scraping',
      interpreter: 'python3',
      instances: 1,
      exec_mode: 'fork',
      env: {
        FLASK_HOST: '127.0.0.1',
        FLASK_PORT: '5000',
        FLASK_DEBUG: 'false',
        ALLOWED_ORIGINS: 'http://localhost:3000'
      },
      error_file: './logs/flask-error.log',
      out_file: './logs/flask-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '512M'
    }
  ]
};

