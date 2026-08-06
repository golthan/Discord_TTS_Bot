import { entersState, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import type { Guild, GuildMember, VoiceBasedChannel } from "discord.js";
import { clearStateQueue, getState, touchState } from "../state";
import { sleep } from "../utils/sleep";
import { isAbortErr } from "../utils/voiceUtils";

function attachConnectionListeners(guild: Guild): void {
  const state = getState(guild.id);
  if (!state.connection || state.connectionListenersAttached) return;

  state.connectionListenersAttached = true;
  const thisConn = state.connection;

  state.connection.on("stateChange", async (_, newState) => {
    if (state.connection !== thisConn) return;
    touchState(guild.id);

    if (newState.status === VoiceConnectionStatus.Disconnected) {
      console.warn(`[Voice][${guild.name}] Disconnected → attempting reconnect`);

      try {
        state.connection?.destroy();
      } catch {}

      state.connection = null;
      state.channelId = null;
      state.connectionListenersAttached = false;

      if (state.reconnectAttempts >= 3) {
        console.warn(`[Voice][${guild.name}] Max reconnect attempts reached, giving up`);
        state.reconnectAttempts = 0;
        return;
      }

      state.reconnectAttempts++;
      await sleep(1000 * state.reconnectAttempts);

      await reconnectVoiceByGuild(guild);
      return;
    }

    if (newState.status === VoiceConnectionStatus.Ready) {
      state.reconnectAttempts = 0;
      console.log(`[Voice][${guild.name}] Ready`);
    }

    if (newState.status === VoiceConnectionStatus.Destroyed) {
      try {
        state.connection?.destroy();
      } catch {}
      state.connection = null;
      state.channelId = null;
      state.connectionListenersAttached = false;
      console.log(`[Voice][${guild.name}] Destroyed → cleaned up`);
    }
  });
}

async function reconnectVoiceByGuild(guild: Guild): Promise<void> {
  const state = getState(guild.id);
  const voiceChannelId = state.preferredVoiceChannelId ?? state.channelId;

  if (!voiceChannelId) return;

  const channel = guild.channels.cache.get(voiceChannelId);
  if (!channel || !channel.isVoiceBased()) {
    state.preferredVoiceChannelId = null;
    return;
  }

  try {
    state.connection = joinVoiceChannel({
      channelId: voiceChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    state.channelId = voiceChannelId;
    state.connection.subscribe(state.player);

    await entersState(state.connection, VoiceConnectionStatus.Ready, 15_000);
    attachConnectionListeners(guild);

    console.log(`[Voice][${guild.name}] Reconnected to ${channel.name}`);
  } catch (err) {
    try {
      state.connection?.destroy();
    } catch {}
    state.connection = null;
    state.channelId = null;
    state.connectionListenersAttached = false;
    console.warn(`[Voice][${guild.name}] Reconnect failed:`, err);
  }
}

export async function ensureVoiceConnection(
  member: GuildMember,
): Promise<ReturnType<typeof getState>> {
  const vc = member.voice.channel as VoiceBasedChannel | null;

  if (!vc) throw new Error("You need to join a voice channel first.");

  const state = getState(vc.guild.id);
  touchState(vc.guild.id);

  if (state.preferredVoiceChannelId && vc.id !== state.preferredVoiceChannelId) {
    throw new Error("This server is locked to another voice channel.");
  }

  if (state.connection && state.channelId === vc.id) {
    if (state.connection.state?.status === VoiceConnectionStatus.Ready) {
      return state;
    }

    try {
      state.connection.destroy();
    } catch {}
    state.connection = null;
    state.channelId = null;
    state.connectionListenersAttached = false;
  }

  if (state.connection && state.channelId !== vc.id) {
    throw new Error("The bot is currently in another voice room and won't switch automatically.");
  }

  state.connection = joinVoiceChannel({
    channelId: vc.id,
    guildId: vc.guild.id,
    adapterCreator: vc.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
  });

  state.channelId = vc.id;
  state.connection.subscribe(state.player);

  try {
    await entersState(state.connection, VoiceConnectionStatus.Ready, 20_000);
    attachConnectionListeners(vc.guild);
  } catch (err) {
    try {
      state.connection.destroy();
    } catch {}
    state.connection = null;
    state.channelId = null;
    state.connectionListenersAttached = false;

    if (isAbortErr(err)) {
      const e = new Error("Voice connection ready timeout") as Error & { code?: string };
      e.code = "VOICE_CONNECT_TIMEOUT";
      throw e;
    }

    throw err;
  }

  return state;
}

export function leaveVoice(guildId: string, reason = "manual"): void {
  const state = getState(guildId);
  touchState(guildId);

  state.playToken++;
  state.reconnectAttempts = 0;

  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }

  clearStateQueue(state);
  state.playing = false;
  state.processing = false;
  state.recentlyQueuedText.clear();

  try {
    state.player.stop(true);
  } catch {}

  if (state.connection) {
    try {
      state.connection.destroy();
    } catch {}
  }

  state.connection = null;
  state.channelId = null;
  state.textChannelId = null;
  state.connectionListenersAttached = false;

  console.log(`[Voice] Left (reason: ${reason})`);
}
