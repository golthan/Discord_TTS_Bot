import { createAudioPlayer, type AudioPlayer, type VoiceConnection } from "@discordjs/voice";
import { loadGuildSetting } from "./storage/guildSettings";

export interface BotState {
  connection: VoiceConnection | null;
  channelId: string | null;
  textChannelId: string | null;
  preferredVoiceChannelId: string | null;
  preferredTextChannelId: string | null;
  queue: string[];
  playing: boolean;
  processing: boolean;
  idleTimer: NodeJS.Timeout | null;
  player: AudioPlayer;
  lang: string;
  engine: "google";
  playToken: number;
  connectionListenersAttached: boolean;
  reconnectAttempts: number;
  lastActivityAt: number;
  recentlyQueuedText: Map<string, string>; // userId → last queued text
}

const states = new Map<string, BotState>();
let globalQueuedCount = 0;

function createState(guildId: string): BotState {
  const player = createAudioPlayer();
  player.setMaxListeners(0);

  const saved = loadGuildSetting(guildId);

  return {
    connection: null,
    channelId: null,
    textChannelId: null,
    preferredVoiceChannelId: saved.preferredVoiceChannelId,
    preferredTextChannelId: saved.preferredTextChannelId,
    queue: [],
    playing: false,
    processing: false,
    idleTimer: null,
    player,
    lang: saved.lang || "vi",
    engine: "google",
    playToken: 0,
    connectionListenersAttached: false,
    reconnectAttempts: 0,
    lastActivityAt: Date.now(),
    recentlyQueuedText: new Map(),
  };
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [gid, st] of states) {
    const idle =
      !st.connection &&
      !st.playing &&
      !st.processing &&
      st.queue.length === 0 &&
      now - st.lastActivityAt > 30 * 60 * 1000;

    if (idle) {
      states.delete(gid);
    }
  }
}, 10 * 60 * 1000);
cleanupTimer.unref();

export function getState(guildId: string): BotState {
  const key = String(guildId);
  let state = states.get(key);
  if (!state) {
    state = createState(key);
    states.set(key, state);
  }
  return state;
}

export function touchState(guildId: string): void {
  getState(guildId).lastActivityAt = Date.now();
}

export function getAllGuildStates(): Map<string, BotState> {
  return states;
}

export function canEnqueueGlobal(max: number): boolean {
  return globalQueuedCount < max;
}

export function incGlobalQueue(): void {
  globalQueuedCount++;
}

export function decGlobalQueue(): void {
  if (globalQueuedCount > 0) globalQueuedCount--;
}

export function getGlobalQueuedCount(): number {
  return globalQueuedCount;
}

export function enqueueStateText(state: BotState, text: string, maxQueue: number): void {
  if (state.queue.length >= maxQueue) {
    state.queue.shift();
    decGlobalQueue();
  }
  state.queue.push(text);
  incGlobalQueue();
}

export function clearStateQueue(state: BotState): number {
  const removed = state.queue.length;
  state.queue.length = 0;
  for (let i = 0; i < removed; i++) decGlobalQueue();
  return removed;
}
