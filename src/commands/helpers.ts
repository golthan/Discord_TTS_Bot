import type { Message, TextBasedChannel } from "discord.js";
import { MAX_GLOBAL_QUEUE, MAX_INPUT_LEN, MAX_QUEUE } from "../config";
import { canEnqueueGlobal, enqueueStateText, getState } from "../state";
import { saveGuildSetting, type GuildSetting } from "../storage/guildSettings";
import { type MentionContext, replaceUserMentions, sanitizeForTTS } from "../tts/sanitize";
import { isDuplicateSpam, isGuildFlood } from "../utils/antiSpam";
import { processQueue } from "../voice/queue";

export type { MentionContext };

export function saveCurrentGuildState(guildId: string): void {
  const state = getState(guildId);

  const next: GuildSetting = {
    preferredVoiceChannelId: state.preferredVoiceChannelId,
    preferredTextChannelId: state.preferredTextChannelId,
    lang: state.lang || "vi",
    engine: "google",
  };

  saveGuildSetting(guildId, next);
}

function buildMediaDescription(msg: Message): string {
  const name = msg.member?.displayName ?? msg.author.username;

  let images = 0,
    videos = 0,
    gifs = 0,
    files = 0,
    links = 0;

  for (const att of msg.attachments.values()) {
    const mime = att.contentType ?? "";
    const url = att.url.toLowerCase();
    if (mime.startsWith("image/gif") || /\.gif(\?|$)/.test(url)) gifs++;
    else if (mime.startsWith("image/") || /\.(png|jpe?g|webp|bmp|avif|svg)(\?|$)/.test(url))
      images++;
    else if (mime.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm|gifv)(\?|$)/.test(url)) videos++;
    else files++;
  }

  images += msg.stickers.size;

  const urlRegex = /https?:\/\/[^\s<>]+/gi;
  for (const url of msg.content.matchAll(urlRegex)) {
    const u = url[0].toLowerCase();
    if (/\.(gif)(\?|#|$)/.test(u) || /\b(tenor|giphy)\.com\b/.test(u)) gifs++;
    else if (/\.(png|jpe?g|webp|bmp|avif)(\?|#|$)/.test(u)) images++;
    else if (/\.(mp4|mov|avi|mkv|webm|gifv)(\?|#|$)/.test(u)) videos++;
    else links++;
  }

  const fmt = (n: number, word: string) => (n === 1 ? `1 ${word}` : `${n} ${word}`);
  const parts: string[] = [];

  if (gifs > 0) parts.push(fmt(gifs, "gif"));
  if (images > 0) parts.push(fmt(images, "ảnh"));
  if (videos > 0) parts.push(fmt(videos, "video"));
  if (files > 0) parts.push(fmt(files, "file"));
  if (links > 0) parts.push(fmt(links, "link"));

  if (parts.length === 0) return "";

  return `${name} đã gửi ${parts.join(", ")}`;
}

export async function enqueueText(
  guildId: string,
  rawText: string,
  ctx: MentionContext,
): Promise<boolean> {
  const state = getState(guildId);

  if (isGuildFlood(guildId)) return false;
  if (!canEnqueueGlobal(MAX_GLOBAL_QUEUE)) return false;

  let text = await replaceUserMentions(rawText, ctx);

  if (!("commandName" in ctx)) {
    const msg = ctx as Message;
    const mediaDesc = buildMediaDescription(msg);

    if (mediaDesc) {
      const sanitizedText = sanitizeForTTS(text, state.lang).trim();
      const combined = sanitizedText ? `${sanitizedText}, ${mediaDesc}` : mediaDesc;
      text = sanitizeForTTS(combined, state.lang);
    } else {
      text = sanitizeForTTS(text, state.lang);
    }
  } else {
    text = sanitizeForTTS(text, state.lang);
  }

  if (!text) return false;
  if (isDuplicateSpam(guildId, text)) return false;

  const userId = "author" in ctx ? ctx.author.id : ctx.user.id;
  if (state.recentlyQueuedText.get(userId) === text) return false;

  if (text.length > MAX_INPUT_LEN) text = text.slice(0, MAX_INPUT_LEN);

  enqueueStateText(state, text, MAX_QUEUE);
  state.recentlyQueuedText.set(userId, text);

  if ("channelId" in ctx) {
    state.textChannelId = ctx.channelId;
  } else {
    state.textChannelId = (ctx as Message).channel.id;
  }

  if (!state.processing) {
    const channel = (ctx.channel ?? null) as TextBasedChannel | null;
    void processQueue(guildId, channel).catch((err) => {
      console.error(`[Queue] processQueue error in guild ${guildId}:`, err);
    });
  }

  return true;
}
