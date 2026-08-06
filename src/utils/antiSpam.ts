import { MAX_GUILD_TEXTS_TRACKED } from "../config";

type GuildSpamState = {
  lastTexts: Map<string, number>;
  lastMessageAt: number;
};

const guildSpamMap = new Map<string, GuildSpamState>();

function getGuildSpamState(guildId: string): GuildSpamState {
  let s = guildSpamMap.get(guildId);
  if (!s) {
    s = { lastTexts: new Map(), lastMessageAt: 0 };
    guildSpamMap.set(guildId, s);
  }
  return s;
}

export function isDuplicateSpam(guildId: string, text: string, windowMs = 3000): boolean {
  const state = getGuildSpamState(guildId);
  const key = text.trim().toLowerCase();
  const now = Date.now();
  const last = state.lastTexts.get(key) ?? 0;

  state.lastTexts.set(key, now);

  if (state.lastTexts.size > MAX_GUILD_TEXTS_TRACKED) {
    const firstKey = state.lastTexts.keys().next().value;
    if (firstKey) {
      state.lastTexts.delete(firstKey);
    }
  }

  return now - last < windowMs;
}

export function isGuildFlood(guildId: string, minIntervalMs = 250): boolean {
  const state = getGuildSpamState(guildId);
  const now = Date.now();
  const diff = now - state.lastMessageAt;

  state.lastMessageAt = now;

  return diff < minIntervalMs;
}

const antiSpamCleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [guildId, state] of guildSpamMap) {
    for (const [text, ts] of state.lastTexts) {
      if (now - ts > 60_000) {
        state.lastTexts.delete(text);
      }
    }

    if (state.lastTexts.size === 0 && now - state.lastMessageAt > 30 * 60 * 1000) {
      guildSpamMap.delete(guildId);
    }
  }
}, 60_000);
antiSpamCleanupTimer.unref();
