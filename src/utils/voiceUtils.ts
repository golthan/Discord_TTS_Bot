import { VoiceConnectionStatus } from "@discordjs/voice";
import type { BotState } from "../state";

export function isAbortErr(e: unknown): boolean {
  const err = e as { code?: string; name?: string };
  return err?.code === "ABORT_ERR" || err?.name === "AbortError";
}

export function isConnectionReady(state: BotState): boolean {
  return !!state.connection && state.connection.state?.status === VoiceConnectionStatus.Ready;
}
