// apps/ml/ecosystem.config.js — PM2 config for EC2 deployment
module.exports = {
  apps: [
    {
      name: 'leadpulse-ml',
      script: 'uv',
      args: 'run uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2',
      cwd: '/home/ubuntu/leadpulse/apps/ml',
      env_production: { NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
