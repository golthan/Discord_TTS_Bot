process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  process.exit(1);
});

process.on("warning", (warning) => {
  console.warn("[warning]", warning.name, warning.message, warning.stack);
});

const watchdogTimer = setInterval(() => {
  const mem = process.memoryUsage();
  const rssMb = Math.round(mem.rss / 1024 / 1024);

  if (rssMb > 800) {
    console.warn("High memory usage:", rssMb, "MB");
  }

  console.log("[health]", {
    rssMB: rssMb,
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    uptimeSec: Math.round(process.uptime()),
  });
}, 10 * 60 * 1000);
watchdogTimer.unref();
