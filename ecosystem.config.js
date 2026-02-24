module.exports = {
  apps: [
    {
      name: 'nextjs',
      script: 'npm',
      args: 'start',
      cwd: './',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
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
  ],
};
