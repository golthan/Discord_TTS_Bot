const EMOJI_MAP = new Map<string, string>([
  ["😂", " cười lớn "], ["🤣", " cười lớn "],
  ["😊", " cười nhẹ "], ["🙂", " cười nhẹ "],
  ["😀", " cười "],
  ["😭", " khóc "],
  ["😢", " buồn "],
  ["😡", " tức giận "], ["😠", " tức giận "],
  ["😍", " yêu quá "],
  ["🥰", " dễ thương "],
  ["👍", " đồng ý "],
  ["🙏", " cảm ơn "],
  ["🔥", " cháy "],
  ["💀", " chết cười "],
  ["🤡", " hề "],
  ["😎", " ngầu "],
  ["🤔", " suy nghĩ "],
]);

export function replaceEmoji(text: string): string {
  if (!text) return "";
  return text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, (e) => EMOJI_MAP.get(e) ?? " ");
}
