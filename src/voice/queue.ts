import type { Message } from "discord.js";
import { IDLE_TIMEOUT_MS } from "../config";
import { clearStateQueue, decGlobalQueue, getState, touchState } from "../state";
import { withTimeout } from "../utils/promise";
import { sleep } from "../utils/sleep";
import { isAbortErr, isConnectionReady } from "../utils/voiceUtils";
import { speakTTS } from "../tts/speak";
import { leaveVoice } from "./connection";

type QueueChannel = Message["channel"];

export function clearIdleTimer(state: ReturnType<typeof getState>): void {
  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
}

export function startIdleTimer(guildId: string, textChannel?: QueueChannel | null): void {
  const state = getState(guildId);
  clearIdleTimer(state);

  const ms = Math.max(1, IDLE_TIMEOUT_MS);

  state.idleTimer = setTimeout(() => {
    leaveVoice(guildId, "idle-timeout");
  }, ms);
  state.idleTimer.unref();
}

export async function processQueue(
  guildId: string,
  textChannel?: QueueChannel | null,
): Promise<void> {
  const state = getState(guildId);

  if (state.processing) return;

  state.processing = true;
  state.playing = true;
  touchState(guildId);

  clearIdleTimer(state);

  try {
    while (state.queue.length > 0) {
      const text = state.queue.shift();
      if (!text) continue;

      try {
        await withTimeout(speakTTS(guildId, text), 150_000, "speakTTS");
      } catch (e) {
        if ((e as { code?: string })?.code === "VOICE_NOT_READY") {
          console.warn("VOICE_NOT_READY -> stop queue");
          clearStateQueue(state);
          break;
        }

        if (isAbortErr(e)) {
          console.warn("TTS aborted; skip current item");

          try {
            state.player.stop();
          } catch {}

          if (!isConnectionReady(state)) {
            console.warn("Voice not ready after abort -> stop queue");
            clearStateQueue(state);
            break;
          }

          await sleep(100);
          continue;
        }

        console.error("TTS error:", e);

        if (!isConnectionReady(state)) {
          console.warn("Voice not ready after error -> stop queue");
          clearStateQueue(state);
          break;
        }

        await sleep(200);
      } finally {
        decGlobalQueue();
        touchState(guildId);
      }
    }
  } finally {
    state.playing = false;
    state.processing = false;
    state.recentlyQueuedText.clear();
    startIdleTimer(guildId, textChannel);
  }
}
