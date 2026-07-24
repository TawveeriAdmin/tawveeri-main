// PM2 config. NOTE (ADR-078): the intelligence scheduler is now started from
// within the web server via src/instrumentation.ts (so it works on Railway, whose
// start command runs only the web process). It is therefore NOT a separate PM2 app
// here anymore — that would double it. A PM2 CLUSTER (instances > 1) would spawn
// one scheduler per web instance; if you deploy under PM2 cluster, either set
// instances: 1 or add a DB advisory lock. Railway runs a single standalone
// instance, so exactly one scheduler runs there.
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
