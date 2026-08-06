import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

export const TOKEN = requireEnv("DISCORD_TOKEN");
export const CLIENT_ID = requireEnv("CLIENT_ID");
export const DEV_GUILD_ID = process.env.DEV_GUILD_ID?.trim() || undefined;
export const IDLE_TIMEOUT_MS = numberEnv("IDLE_TIMEOUT_MS", 5 * 60 * 1000);
export const MAX_QUEUE = numberEnv("MAX_QUEUE", 30);
export const MAX_GLOBAL_QUEUE = numberEnv("MAX_GLOBAL_QUEUE", 200);
export const MAX_INPUT_LEN = numberEnv("MAX_INPUT_LEN", 350);
export const USER_COOLDOWN = numberEnv("USER_COOLDOWN", 900);
export const CACHE_DIR = process.env.CACHE_DIR?.trim() || "./tts_cache";
export const ENABLE_DISK_CACHE = booleanEnv("ENABLE_DISK_CACHE", false);
export const MEMORY_CACHE_SIZE = numberEnv("MEMORY_CACHE_SIZE", 1_000);
export const TTS_FETCH_TIMEOUT_MS = numberEnv("TTS_FETCH_TIMEOUT_MS", 10_000);
export const TTS_MAX_CONCURRENT_FETCHES = numberEnv("TTS_MAX_CONCURRENT_FETCHES", 8);
export const TTS_HTTP_CONNECTIONS = numberEnv("TTS_HTTP_CONNECTIONS", 12);
export const MAX_GUILD_TEXTS_TRACKED = numberEnv("MAX_GUILD_TEXTS_TRACKED", 200);
