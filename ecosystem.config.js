module.exports = {
  apps: [
    {
      name: "discord-tts-bot",
      script: "dist/index.js",
      cwd: "/home/ubuntu/discord-bot",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      restart_delay: 5000,
      min_uptime: "20s",
      max_restarts: 20,
      env: {
        NODE_ENV: "production",
      },
      out_file: "/home/ubuntu/discord-bot/data/logs/out.log",
      error_file: "/home/ubuntu/discord-bot/data/logs/error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
