import { request, Agent } from "undici";
import { createAudioResource, entersState, AudioPlayerStatus, StreamType } from "@discordjs/voice";
import { Readable } from "stream";

import { TTS_FETCH_TIMEOUT_MS, TTS_HTTP_CONNECTIONS, TTS_MAX_CONCURRENT_FETCHES } from "../config";
import { getState } from "../state";
import { recordError, recordTTS } from "../utils/metrics";
import { sleep } from "../utils/sleep";
import { isAbortErr, isConnectionReady } from "../utils/voiceUtils";
import {
  clearInFlight,
  getCacheKey,
  getCachedByKey,
  getInFlight,
  setCache,
  setInFlight,
} from "./cache";
import { chunkText } from "./chunk";

const httpAgent = new Agent({
  connections: TTS_HTTP_CONNECTIONS,
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
});

let activeFetches = 0;
const waiters: Array<() => void> = [];

async function acquireFetchSlot(): Promise<void> {
  if (activeFetches < TTS_MAX_CONCURRENT_FETCHES) {
    activeFetches++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
}

function releaseFetchSlot(): void {
  const next = waiters.shift();
  if (next) {
    next();
  } else {
    activeFetches = Math.max(0, activeFetches - 1);
  }
}

function googleURL(text: string, lang: string): string {
  return (
    `https://translate.google.com/translate_tts?ie=UTF-8` +
    `&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(lang)}&client=tw-ob`
  );
}

async function fetchGoogleUncached(lang: string, text: string): Promise<Buffer> {
  await acquireFetchSlot();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TTS_FETCH_TIMEOUT_MS);
    timer.unref();
    try {
      const res = await request(googleURL(text, lang), {
        dispatcher: httpAgent,
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (res.statusCode !== 200) {
        const raw = await res.body.text().catch(() => "");
        throw new Error(`Google TTS failed: ${res.statusCode} ${raw.slice(0, 200)}`);
      }
      const ab = await res.body.arrayBuffer();
      const buf = Buffer.from(ab);
      if (!buf.length) throw new Error("Google TTS returned empty audio");
      return buf;
    } finally {
      clearTimeout(timer);
    }
  } finally {
    releaseFetchSlot();
  }
}

async function fetchGoogle(lang: string, text: string): Promise<Buffer> {
  const cacheKey = `google:${lang}`;
  const k = getCacheKey(cacheKey, text);
  const cached = await getCachedByKey(k);
  if (cached) return cached;

  const existing = getInFlight(k);
  if (existing) return await existing;

  const promise = fetchGoogleUncached(lang, text)
    .then((buf) => {
      setCache(cacheKey, text, buf);
      return buf;
    })
    .finally(() => clearInFlight(k));

  setInFlight(k, promise);
  return await promise;
}

export async function speakTTS(guildId: string, text: string): Promise<void> {
  const state = getState(guildId);
  const token = state.playToken;

  recordTTS(guildId);

  if (!isConnectionReady(state)) {
    const err = new Error("Voice connection not ready") as Error & { code?: string };
    err.code = "VOICE_NOT_READY";
    throw err;
  }

  const parts = chunkText(text, 220);
  if (!parts.length) return;

  const fetchPart = (part: string) => fetchGoogle(state.lang, part);

  try {
    let prefetch = fetchPart(parts[0]);

    for (let i = 0; i < parts.length; i++) {
      if (state.playToken !== token) return;

      const buf = await prefetch;
      if (i + 1 < parts.length && state.playToken === token) prefetch = fetchPart(parts[i + 1]);

      if (!isConnectionReady(state)) {
        const err = new Error("Voice connection not ready") as Error & { code?: string };
        err.code = "VOICE_NOT_READY";
        throw err;
      }

      const stream = Readable.from(buf);
      const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });

      state.player.play(resource);

      try {
        await entersState(state.player, AudioPlayerStatus.Playing, 7_000);
      } catch (err) {
        if (isAbortErr(err)) return;
        throw err;
      }

      try {
        await entersState(state.player, AudioPlayerStatus.Idle, 40_000);
      } catch (err) {
        if (isAbortErr(err)) return;
        throw err;
      }

      await sleep(10);
    }
  } catch (err) {
    if (isAbortErr(err)) throw err;
    recordError();
    throw err;
  }
}
