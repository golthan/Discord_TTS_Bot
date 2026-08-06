import { getAllGuildStates, getGlobalQueuedCount } from "../state";

const GUILD_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;

const metrics = {
  ttsRequests: 0,
  errors: 0,
  guildLastSeenAt: new Map<string, number>(),
};

export function recordTTS(guildId: string): void {
  metrics.ttsRequests++;
  metrics.guildLastSeenAt.set(String(guildId), Date.now());
}

export function recordError(): void {
  metrics.errors++;
}

function cleanupGuildMetrics(now = Date.now()): void {
  for (const [guildId, lastSeenAt] of metrics.guildLastSeenAt) {
    if (now - lastSeenAt > GUILD_ACTIVITY_WINDOW_MS) {
      metrics.guildLastSeenAt.delete(guildId);
    }
  }
}

export function printMetrics(): void {
  cleanupGuildMetrics();

  const mem = process.memoryUsage();
  console.log("===== BOT METRICS =====");
  console.log("TTS Requests:", metrics.ttsRequests);
  console.log("Servers active in 24h:", metrics.guildLastSeenAt.size);
  console.log("Active guild states:", getAllGuildStates().size);
  console.log("Global queued:", getGlobalQueuedCount());
  console.log("Errors:", metrics.errors);
  console.log("RSS MB:", Math.round(mem.rss / 1024 / 1024));
  console.log("Heap Used MB:", Math.round(mem.heapUsed / 1024 / 1024));
  console.log("Uptime Sec:", Math.round(process.uptime()));
  console.log("=======================");
}

const metricsTimer = setInterval(printMetrics, 5 * 60 * 1000);
metricsTimer.unref();
