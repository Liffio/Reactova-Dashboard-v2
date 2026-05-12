module.exports = {
  apps: [
    {
      name: "reactova-marketing",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/reactova-marketing",
      instances: 2,
      exec_mode: "cluster",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env_production: {
        NODE_ENV: "production",
        PORT: "3002",
      },
      error_file: "/var/log/reactova/marketing-error.log",
      out_file: "/var/log/reactova/marketing-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      max_memory_restart: "512M",
      kill_timeout: 5000,
      listen_timeout: 10000,
      exp_backoff_restart_delay: 100,
    },
  ],
};
