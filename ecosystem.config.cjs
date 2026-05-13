/**
 * PM2: static dashboard via `serve` (Vite build in ./dist).
 * Nginx terminates TLS and reverse-proxies to 127.0.0.1:3000.
 *
 *   pm2 startOrReload ecosystem.config.cjs --env production --update-env
 *   pm2 save
 *   pm2 startup   # once, then run the printed sudo command
 */

const path = require("node:path");

const clientDir = __dirname;
const logsDir = path.join(clientDir, "logs");
const serveMain = path.join(clientDir, "node_modules", "serve", "build", "main.js");

const common = {
  cwd: clientDir,
  exec_mode: "fork",
  instances: 1,
  autorestart: true,
  watch: false,
  time: true,
  merge_logs: true,
  min_uptime: "10s",
  max_restarts: 15,
  exp_backoff_restart_delay: 2000,
  kill_timeout: 5000,
};

module.exports = {
  apps: [
    {
      ...common,
      name: "reactova-dashboard",
      interpreter: "node",
      script: serveMain,
      args: "-s dist -l tcp://127.0.0.1:3000",
      max_memory_restart: "400M",
      error_file: path.join(logsDir, "dashboard.error.log"),
      out_file: path.join(logsDir, "dashboard.out.log"),
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
