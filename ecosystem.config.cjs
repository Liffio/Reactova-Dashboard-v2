module.exports = {
  apps: [
    {
      name: "liffio-dashboard",
      script: "./server-start.mjs",
      cwd: "/var/www/reactova-dashboard",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOST: "127.0.0.1",
      },
      error_file: "/root/.pm2/logs/liffio-dashboard-error.log",
      out_file: "/root/.pm2/logs/liffio-dashboard-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
