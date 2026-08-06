import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import crypto from "crypto";
import QuickLRU from "quick-lru";
import { CACHE_DIR, ENABLE_DISK_CACHE, MEMORY_CACHE_SIZE } from "../config";

if (ENABLE_DISK_CACHE && !existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

const memCache = new QuickLRU<string, Buffer>({
  maxSize: MEMORY_CACHE_SIZE,
});

const inFlight = new Map<string, Promise<Buffer>>();

function key(lang: string, text: string): string {
  return crypto.createHash("sha1").update(`${lang}:${text}`).digest("hex");
}

function filePath(k: string): string {
  return path.join(CACHE_DIR, `${k}.mp3`);
}

export function getCacheKey(lang: string, text: string): string {
  return key(lang, text);
}

export async function getCachedByKey(k: string): Promise<Buffer | null> {
  if (memCache.has(k)) return memCache.get(k) ?? null;
  if (!ENABLE_DISK_CACHE) return null;
  try {
    const buf = await fs.readFile(filePath(k));
    memCache.set(k, buf);
    return buf;
  } catch {
    return null;
  }
}

export function setCache(lang: string, text: string, buffer: Buffer): void {
  const k = key(lang, text);
  memCache.set(k, buffer);

  if (!ENABLE_DISK_CACHE) {
    return;
  }

  fs.writeFile(filePath(k), buffer).catch(() => {});
}

export function getInFlight(k: string): Promise<Buffer> | null {
  return inFlight.get(k) ?? null;
}

export function setInFlight(k: string, promise: Promise<Buffer>): void {
  inFlight.set(k, promise);
}

export function clearInFlight(k: string): void {
  inFlight.delete(k);
}
