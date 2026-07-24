module.exports = {
  apps: [
    {
      name: 'nextjs',
      // Run the standalone server DIRECTLY (not `npm start`). `npm start` is now the
      // production launcher (scripts/start-production.js) which itself starts the
      // scheduler — under PM2 that would double the scheduler, since PM2 also runs
      // the `scheduler` app below. This keeps exactly one scheduler on either path
      // (PM2: web app + scheduler app; Railway `npm start`: launcher runs both). ADR-078.
      script: 'node',
      args: '.next/standalone/server.js',
      cwd: './',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        HOSTNAME: '0.0.0.0',
      },
      error_file: './logs/nextjs-error.log',
      out_file: './logs/nextjs-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
      exp_backoff_restart_delay: 100,
      wait_ready: true,
      listen_timeout: 10000,
    },
    {
      name: 'scheduler',
      script: './scripts/scheduler.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/scheduler-error.log',
      out_file: './logs/scheduler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '256M',
      exp_backoff_restart_delay: 500,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
