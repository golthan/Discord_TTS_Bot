import type { Message, ChatInputCommandInteraction } from "discord.js";
import { replaceEmoji } from "./emoji";

export type MentionContext = Message | ChatInputCommandInteraction;

const MENTION_REGEX = /<@!?(\d+)>/g;

export async function replaceUserMentions(text: string, ctx: MentionContext): Promise<string> {
  const guild = ctx.guild;
  if (!guild) return text;

  const mentionRegex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);
  const matches = [...text.matchAll(mentionRegex)];
  if (!matches.length) return text;

  const uniqueUserIds = [...new Set(matches.map(([, userId]) => userId))];

  const replacements = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const cachedMember = guild.members.cache.get(userId);
      const fetchedMember = cachedMember ?? (await guild.members.fetch(userId).catch(() => null));
      return {
        userId,
        displayName: fetchedMember?.displayName ?? userId,
      };
    }),
  );

  const nameMap = new Map(replacements.map(({ userId, displayName }) => [userId, displayName]));
  text = text.replace(
    new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags),
    (_, id) => ` ${nameMap.get(id) ?? id} `,
  );

  return text;
}

export function applyVietnameseRules(text: string): string {
  return text
    .replace(/\b(dm|dcm|dmm)(?:\1)*\b/gi, " địt mẹ mày ")
    .replace(/(?:=>|->)/g, " suy ra ")
    .replace(/\.{3,}/g, " ý tui là ")
    .replace(/,{3,}/g, " thực ra là ")
    .replace(/:\/+/g, " khó nói ")
    .replace(/(^|\s)#+(\s|$)/g, "$1bạn sợ à?$2")
    .replace(/[:=]\)+/g, " mặt cười ")
    .replace(/=]+\]+/g, " mặt cười ")
    .replace(/:<+/g, " mặt mếu ")
    .replace(/:\(+/g, " mặt buồn ")
    .replace(/:\[+/g, " mặt buồn ")
    .replace(/\._\./g, " khúm núm ")
    .replace(/(^|\s)d:(?=\s|$|\)+|\(+|\]+|[a-zA-Z0-9_])/gi, "$1 âu nâu ")
    .replace(/(^|\s)c:(?=\s|$|\)+|\(+|\]+|[a-zA-Z0-9_])/gi, "$1 âu dia ")
    .replace(/(^|\s)k{2,}(\s|$)/gi, "$1keke$2")
    .replace(/(^|\s)\?+(\s|$)/g, " hả ")
    .replace(/(^|\s)\!+(\s|$)/g, " nói lại xem nào ")
    .replace(/(^|\s)\^{2,}(\s|$)/g, " hihi ")
    .replace(/(^|\s)@{2,}(\s|$)/g, " hoảng loạn ")
    .replace(/(^|\s)dz(\s|$)/gi, "$1đẹp trai$2")
    .replace(/(^|\s)hqua(\s|$)/gi, "$1hôm qua$2")
    .replace(/(^|\s)hqa(\s|$)/gi, "$1hôm qua$2")
    .replace(/(^|\s)hnay(\s|$)/gi, "$1hôm nay$2")
    .replace(/(^|\s)gg(\s|$)/gi, "$1google$2")
    .replace(/(^|\s)qq(\s|$)/gi, "$1quần què$2")
    .replace(/(^|\s)dc(\s|$)/gi, "$1được$2")
    .replace(/(^|\s)ko(\s|$)/gi, "$1không$2")
    .replace(/(^|\s)k(\s|$)/gi, "$1không$2")
    .replace(/(^|\s)vs(\s|$)/gi, "$1với$2")
    .replace(/(^|\s)zs(\s|$)/gi, "$1với$2")
    .replace(/(^|\s)mn(\s|$)/gi, "$1mọi người$2")
    .replace(/(^|\s)ae(\s|$)/gi, "$1anh em$2")
    .replace(/(^|\s)ce(\s|$)/gi, "$1chị em$2")
    .replace(/(^|\s)r(\s|$)/gi, "$1rồi$2")
    .replace(/(^|\s)a(\s|$)/gi, "$1anh$2")
    .replace(/(^|\s)e(\s|$)/gi, "$1em$2")
    .replace(/(^|\s)c(\s|$)/gi, "$1chị$2")
    .replace(/(^|\s)m(\s|$)/gi, "$1mày$2")
    .replace(/(^|\s)t(\s|$)/gi, "$1tao$2")
    .replace(/(^|\s)h(\s|$)/gi, "$1giờ$2");
}

export function sanitizeForTTS(input: string, lang = "vi"): string {
  let text = String(input ?? "");

  text = replaceEmoji(text);
  text = text.replace(/[*_~`]/g, " ");
  text = text.replace(/https?:\/\/\S+|\bwww\.\S+|\b(?:tenor|giphy)\.com\/\S+/gi, " ");
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, " $1 ");
  text = text.replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, " $1 ");
  text = text.replace(/:([a-zA-Z0-9_-]+)~\d+:/g, " $1 ");
  text = text.replace(/\d{8,}/g, " một dãy số ");

  if (lang.toLowerCase() === "vi") {
    text = applyVietnameseRules(text);
  }

  text = text.replace(/[:=][^\s]{1,32}/g, " ");

  return text.replace(/\s+/g, " ").trim();
}
