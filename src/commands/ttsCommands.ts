import type { Message } from "discord.js";
import { USER_COOLDOWN } from "../config";
import { getAllGuildStates, getGlobalQueuedCount, getState, touchState } from "../state";
import { clearGuildSetting } from "../storage/guildSettings";
import { buildTTSHelpParts } from "../tts/help";
import { normalizeLang } from "../tts/lang";
import { sleep } from "../utils/sleep";
import { ensureVoiceConnection, leaveVoice } from "../voice/connection";
import { enqueueText, saveCurrentGuildState } from "./helpers";

type HandleMessageOptions = {
  userCooldown: Map<string, number>;
};

export async function handleTTSCommands(
  msg: Message,
  options: HandleMessageOptions,
): Promise<void> {
  if (!msg.guild) return;

  const state = getState(msg.guild.id);
  touchState(msg.guild.id);

  const vc = msg.member?.voice?.channel;
  const content = msg.content.trim();

  if (content === "!tts-help") {
    const parts = buildTTSHelpParts(state.lang || "vi");
    for (const part of parts) {
      await msg
        .reply({
          content: part,
          allowedMentions: { repliedUser: false },
        })
        .catch(console.error);
    }
    return;
  }

  if (content === "!tts-ping") {
    const mem = process.memoryUsage();
    await msg
      .reply({
        content:
          `🏓 pong\n` +
          `⏱ uptime: **${Math.round(process.uptime())}s**\n` +
          `💾 rss: **${Math.round(mem.rss / 1024 / 1024)}MB**\n` +
          `📡 guilds: **${getAllGuildStates().size}**\n` +
          `📬 queue: **${getGlobalQueuedCount()}**`,
        allowedMentions: { repliedUser: false },
      })
      .catch(() => {});
    return;
  }

  if (content.startsWith("!tts-lang")) {
    const arg = content.split(/\s+/)[1];
    const lang = normalizeLang(arg);

    if (!lang) {
      await msg
        .reply({
          content: "❌ Invalid language. Use: `!tts-lang vi|en|jp|ko|zh-CN|zh-TW`",
          allowedMentions: { repliedUser: false },
        })
        .catch(() => {});
      return;
    }

    state.lang = lang;
    saveCurrentGuildState(msg.guild.id);

    await msg
      .reply({
        content: `✅ Language changed to: **${lang}**`,
        allowedMentions: { repliedUser: false },
      })
      .catch(() => {});
    return;
  }

  if (content.startsWith("!tts-engine")) {
    saveCurrentGuildState(msg.guild.id);
    await msg
      .reply({
        content: `✅ Engine: **Google Translate TTS**`,
        allowedMentions: { repliedUser: false },
      })
      .catch(() => {});
    return;
  }

  if (content === "!tts-leave") {
    await msg
      .reply({
        content: "👋 See you later!",
        allowedMentions: { repliedUser: false },
      })
      .catch(() => {});
    leaveVoice(msg.guild.id, "command");
    return;
  }

  if (content === "!tts-room") {
    if (!vc) {
      await msg
        .reply({
          content: "❌ You need to join a voice channel first.",
          allowedMentions: { repliedUser: false },
        })
        .catch(() => {});
      return;
    }

    state.preferredVoiceChannelId = vc.id;
    state.preferredTextChannelId = msg.channel.id;
    saveCurrentGuildState(msg.guild.id);

    await msg
      .reply({
        content: `✅ Bot will only read when you are in voice **${vc.name}** and chatting in this channel.`,
        allowedMentions: { repliedUser: false },
      })
      .catch(() => {});
    return;
  }

  if (content === "!tts-room-show") {
    const lines: string[] = ["📋 **Current Settings**"];

    if (state.preferredVoiceChannelId && state.preferredTextChannelId) {
      const voiceChannel = msg.guild.channels.cache.get(state.preferredVoiceChannelId);
      const textChannel = msg.guild.channels.cache.get(state.preferredTextChannelId);
      lines.push(`🎙 Voice room: **${voiceChannel?.name ?? state.preferredVoiceChannelId}**`);
      lines.push(`💬 Text channel: **${textChannel?.name ?? state.preferredTextChannelId}**`);
    } else {
      lines.push("🎙 Room: **not configured** (use `!tts-room` to set)");
    }

    lines.push(`🌐 Language: **${state.lang}**`);
    lines.push(`🔧 Engine: **Google Translate TTS**`);

    await msg
      .reply({
        content: lines.join("\n"),
        allowedMentions: { repliedUser: false },
      })
      .catch(() => {});
    return;
  }

  if (content === "!tts-room-clear") {
    state.preferredVoiceChannelId = null;
    state.preferredTextChannelId = null;
    clearGuildSetting(msg.guild.id);

    await msg
      .reply({
        content: "🗑️ Room configuration cleared.",
        allowedMentions: { repliedUser: false },
      })
      .catch(() => {});
    return;
  }

  if (content.startsWith("!tts ") || content === "!tts") {
    const text = content.slice(5).trim();

    if (!text) {
      await msg
        .reply({
          content: "❓ Usage: `!tts <text>`\nExample: `!tts Hello everyone!`",
          allowedMentions: { repliedUser: false },
        })
        .catch(() => {});
      return;
    }

    if (!vc) {
      await msg
        .reply({
          content: "❌ You need to join a Voice Channel first!",
          allowedMentions: { repliedUser: false },
        })
        .catch(() => {});
      return;
    }

    if (!state.channelId) {
      try {
        await ensureVoiceConnection(msg.member!);
        await sleep(350);
      } catch (err) {
        await msg
          .reply({
            content: "❌ Cannot join Voice Channel. Bot is in another channel or lacks permission.",
            allowedMentions: { repliedUser: false },
          })
          .catch(() => {});
        return;
      }
    }

    const queued = await enqueueText(msg.guild.id, text, msg);
    if (queued) await msg.react("🔊").catch(() => {});
    return;
  }

  if (content === "!tts-skip") {
    if (!state.playing) {
      await msg
        .reply({
          content: "❌ Nothing is currently playing.",
          allowedMentions: { repliedUser: false },
        })
        .catch(() => {});
      return;
    }
    try {
      state.player.stop();
    } catch {}
    await msg
      .reply({
        content: "⏭️ Skipped.",
        allowedMentions: { repliedUser: false },
      })
      .catch(() => {});
    return;
  }

  if (content === "!tts-queue") {
    const len = state.queue.length;
    const playing = state.playing;

    if (!playing && len === 0) {
      await msg
        .reply({
          content: "📭 Queue is empty.",
          allowedMentions: { repliedUser: false },
        })
        .catch(() => {});
      return;
    }

    const lines: string[] = [];
    if (playing) lines.push("🔊 **Now playing:** 1 message");
    if (len > 0) lines.push(`⏳ **Queue:** ${len} message${len > 1 ? "s" : ""}`);

    await msg
      .reply({
        content: lines.join(""),
        allowedMentions: { repliedUser: false },
      })
      .catch(() => {});
    return;
  }

  if (content.startsWith("!")) return;

  if (!vc) return;
  if (state.preferredVoiceChannelId && vc.id !== state.preferredVoiceChannelId) return;
  if (state.preferredTextChannelId && msg.channel.id !== state.preferredTextChannelId) return;

  if (!state.channelId) {
    try {
      await ensureVoiceConnection(msg.member!);
      await sleep(350);
    } catch {
      return;
    }
  }
  if (Date.now() - (options.userCooldown.get(msg.author.id) ?? 0) < USER_COOLDOWN) return;
  options.userCooldown.set(msg.author.id, Date.now());

  await enqueueText(msg.guild.id, msg.content, msg);
}
