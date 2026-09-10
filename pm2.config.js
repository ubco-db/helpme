module.exports = {
  // This file is for production: It sets up two pm2 processes: one for the backend and one for the frontend (previously, we'd run them both with --concurrently and then error logs wouldn't get captured by pm2 properly)
  // See docs: https://pm2.keymetrics.io/docs/usage/application-declaration/
  apps: [
    {
      name: 'helpme-backend',
      script: 'yarn',
      args: 'workspace @koh/server prod:start',
      max_memory_restart: '1GB', // Restarts the app if it exceeds 1 Gigabyte of memory
      time: true, // automatically prepend timestamps to every log line
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--openssl-legacy-provider'
      }
    },
    {
      name: 'helpme-frontend',
      script: 'yarn',
      args: 'workspace @koh/frontend start',
      max_memory_restart: '1GB', 
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--openssl-legacy-provider'
      }
    },
  ],
};
