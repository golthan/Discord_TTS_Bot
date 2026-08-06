import {
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
} from "discord.js";
import { TOKEN } from "../config";
import { getAllGuildStates, getGlobalQueuedCount, getState, touchState } from "../state";
import { clearGuildSetting } from "../storage/guildSettings";
import { buildTTSHelpParts } from "../tts/help";
import { normalizeLang } from "../tts/lang";
import { ensureVoiceConnection, leaveVoice } from "../voice/connection";
import { sleep } from "../utils/sleep";
import { enqueueText, saveCurrentGuildState } from "./helpers";

export const slashCommandDefs = [
  new SlashCommandBuilder()
    .setName("tts")
    .setDescription("Read text as speech")
    .addStringOption((o) =>
      o.setName("text").setDescription("Text to read").setRequired(true).setMaxLength(350),
    ),

  new SlashCommandBuilder()
    .setName("tts-lang")
    .setDescription("Change TTS language for this server")
    .addStringOption((o) =>
      o
        .setName("lang")
        .setDescription("Language to use")
        .setRequired(true)
        .addChoices(
          { name: "🇻🇳 Vietnamese", value: "vi" },
          { name: "🇺🇸 English", value: "en" },
          { name: "🇯🇵 日本語", value: "ja" },
          { name: "🇰🇷 한국어", value: "ko" },
          { name: "🇨🇳 中文 (简体)", value: "zh-CN" },
          { name: "🇹🇼 中文 (繁體)", value: "zh-TW" },
        ),
    ),

  new SlashCommandBuilder()
    .setName("tts-engine")
    .setDescription("Change TTS engine")
    .addStringOption((o) =>
      o
        .setName("engine")
        .setDescription("TTS engine to use")
        .setRequired(true)
        .addChoices({ name: "Google Translate TTS (default)", value: "google" }),
    ),

  new SlashCommandBuilder()
    .setName("tts-skip")
    .setDescription("Skip the currently playing message"),
  new SlashCommandBuilder().setName("tts-queue").setDescription("View the current queue"),
  new SlashCommandBuilder()
    .setName("tts-room")
    .setDescription("Lock bot to current voice room + text channel"),
  new SlashCommandBuilder()
    .setName("tts-room-show")
    .setDescription("View current room configuration"),
  new SlashCommandBuilder().setName("tts-room-clear").setDescription("Clear room configuration"),
  new SlashCommandBuilder()
    .setName("tts-leave")
    .setDescription("Make the bot leave the voice channel"),
  new SlashCommandBuilder().setName("tts-help").setDescription("View TTS bot help"),
  new SlashCommandBuilder().setName("tts-ping").setDescription("Check if bot is alive"),
].map((cmd) => cmd.toJSON());

export async function registerSlashCommands(clientId: string, guildId?: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: slashCommandDefs,
      });
      console.log(
        `[Slash] Registered ${slashCommandDefs.length} commands → guild ${guildId} (instant)`,
      );
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: slashCommandDefs });
      console.log(
        `[Slash] Registered ${slashCommandDefs.length} global commands (~1h to propagate)`,
      );
    }
  } catch (err) {
    console.error("[Slash] Failed to register commands:", err);
  }
}

export async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.member) return;

  const guildId = interaction.guild.id;
  const state = getState(guildId);
  touchState(guildId);

  const member = interaction.member as GuildMember;
  const vc = member.voice?.channel;

  switch (interaction.commandName) {
    case "tts": {
      const rawText = interaction.options.getString("text", true);

      if (!vc) {
        await interaction.reply({
          content: "❌ You need to join a **Voice Channel** first!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!state.channelId) {
        try {
          await ensureVoiceConnection(member);
          await sleep(350);
        } catch {
          await interaction.editReply(
            "❌ Cannot join Voice Channel. Bot is in another channel or lacks permission.",
          );
          return;
        }
      }

      const queued = await enqueueText(guildId, rawText, interaction);
      await interaction.editReply(
        queued ? "🔊 Added to queue!" : "⏳ Could not add to queue (spam / full).",
      );
      break;
    }

    case "tts-lang": {
      const lang = normalizeLang(interaction.options.getString("lang", true));
      if (!lang) {
        await interaction.reply({ content: "❌ Invalid language.", flags: MessageFlags.Ephemeral });
        return;
      }

      state.lang = lang;
      saveCurrentGuildState(guildId);

      await interaction.reply({ content: `✅ Language changed to **${lang}**` });
      break;
    }

    case "tts-engine": {
      saveCurrentGuildState(guildId);
      await interaction.reply({ content: `✅ Engine: **Google Translate TTS**` });
      break;
    }

    case "tts-room": {
      if (!vc) {
        await interaction.reply({
          content: "❌ You need to join a Voice Channel first.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      state.preferredVoiceChannelId = vc.id;
      state.preferredTextChannelId = interaction.channelId;
      saveCurrentGuildState(guildId);

      await interaction.reply({
        content: `✅ Bot will only read when you are in voice **${vc.name}** and chatting in this channel.`,
      });
      break;
    }

    case "tts-room-show": {
      const lines: string[] = ["📋 **Current Settings**"];

      if (state.preferredVoiceChannelId && state.preferredTextChannelId) {
        const voiceChannel = interaction.guild.channels.cache.get(state.preferredVoiceChannelId);
        const textChannel = interaction.guild.channels.cache.get(state.preferredTextChannelId);
        lines.push(`🎙 Voice room: **${voiceChannel?.name ?? state.preferredVoiceChannelId}**`);
        lines.push(`💬 Text channel: **${textChannel?.name ?? state.preferredTextChannelId}**`);
      } else {
        lines.push("🎙 Room: **not configured** (use `/tts-room` to set)");
      }

      lines.push(`🌐 Language: **${state.lang}**`);
      lines.push(`🔧 Engine: **Google Translate TTS**`);

      await interaction.reply({ content: lines.join("\n") });
      break;
    }

    case "tts-room-clear": {
      state.preferredVoiceChannelId = null;
      state.preferredTextChannelId = null;
      clearGuildSetting(guildId);

      await interaction.reply({ content: "🗑️ Room configuration cleared." });
      break;
    }

    case "tts-skip": {
      if (!state.playing) {
        await interaction.reply({
          content: "❌ Nothing is currently playing.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      try {
        state.player.stop();
      } catch {}
      await interaction.reply({ content: "⏭️ Skipped." });
      break;
    }

    case "tts-queue": {
      const len = state.queue.length;
      const playing = state.playing;

      if (!playing && len === 0) {
        await interaction.reply({ content: "📭 Queue is empty.", flags: MessageFlags.Ephemeral });
        return;
      }

      const lines: string[] = [];
      if (playing) lines.push("🔊 **Now playing:** 1 message");
      if (len > 0) lines.push(`⏳ **Queue:** ${len} message${len > 1 ? "s" : ""}`);

      await interaction.reply({ content: lines.join(""), flags: MessageFlags.Ephemeral });
      break;
    }

    case "tts-leave": {
      await interaction.reply({ content: "👋 See you later!" });
      leaveVoice(guildId, "slash-command");
      break;
    }

    case "tts-help": {
      const parts = buildTTSHelpParts(state.lang || "vi");
      await interaction.reply({
        content: parts[0],
        flags: MessageFlags.Ephemeral,
      });
      for (let i = 1; i < parts.length; i++) {
        await interaction.followUp({
          content: parts[i],
          flags: MessageFlags.Ephemeral,
        });
      }
      break;
    }

    case "tts-ping": {
      const mem = process.memoryUsage();
      await interaction.reply({
        content:
          `🏓 pong\n` +
          `⏱ uptime: **${Math.round(process.uptime())}s**\n` +
          `💾 rss: **${Math.round(mem.rss / 1024 / 1024)}MB**\n` +
          `📡 guilds: **${getAllGuildStates().size}**\n` +
          `📬 queue: **${getGlobalQueuedCount()}**`,
        flags: MessageFlags.Ephemeral,
      });
      break;
    }
  }
}
