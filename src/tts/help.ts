const TTS_RULES = {
  commands: [
    "`!tts <text>` → Read text as speech",
    "`!tts-skip` → Skip the currently playing message",
    "`!tts-queue` → View the current queue",
    "`!tts-lang <code>` → Change language",
    "`!tts-engine google` → Change TTS engine",
    "`!tts-room` → Set voice room + text channel",
    "`!tts-room-show` → View current configuration",
    "`!tts-room-clear` → Clear room configuration",
    "`!tts-leave` → Make bot leave voice channel",
    "`!tts-ping` → Check if bot is alive",
    "`!tts-help` → This help message",
  ],

  emoticon: [
    ":)) =)) → mặt cười",
    ":( :[ → mặt buồn",
    ":< → mặt mếu",
    "._. → khúm núm",
    "d: → âu nâu  |  c: → âu dia",
    ":/// → khó nói",
  ],

  slang: [
    "dc → được  |  r → rồi  |  k/ko → không",
    "vs/zs → với  |  mn → mọi người",
    "ae → anh em  |  ce → chị em",
    "dz → đẹp trai  |  gg → google",
    "hqua/hqa → hôm qua  |  hnay → hôm nay",
  ],

  shortWord: ["a→anh  e→em  c→chị  m→mày  t→tao  h→giờ"],

  logic: ["=>/-> → suy ra  |  ... → ý tui là  |  ,,, → thực ra là"],

  punctuation: [
    "?? → hả  |  !! → nói lại xem nào",
    "^^ → hihi  |  @@ → hoảng loạn",
    "kk/kkk → keke  |  # → bạn sợ à?",
  ],

  language: [
    "`vi` Vietnamese  |  `en` English",
    "`jp`/`ja` 日本語  |  `ko` 한국어",
    "`zh-CN` 中文(简体)  |  `zh-TW` 中文(繁體)",
  ],

  engine: ["`google` → Google Translate TTS (default, không giới hạn)"],

  room: [
    "Bot only reads when you are in the configured voice room",
    "and sending messages in the configured text channel",
  ],
};

export function buildTTSHelpParts(lang = "vi", maxLen = 1900): string[] {
  const lines: string[] = [];

  lines.push("📢 **TTS – HELP**");
  lines.push(`🌐 Current language: **${lang}**`);
  lines.push("");
  lines.push("⚙️ **Commands**");
  for (const r of TTS_RULES.commands) lines.push(`• ${r}`);

  if (lang.toLowerCase() === "vi") {
    lines.push("");
    lines.push("🙂 **Emoticons & Slang**");
    for (const r of TTS_RULES.emoticon) lines.push(`• ${r}`);
    for (const r of TTS_RULES.slang) lines.push(`• ${r}`);
    for (const r of TTS_RULES.shortWord) lines.push(`• ${r}`);
    for (const r of TTS_RULES.logic) lines.push(`• ${r}`);
    for (const r of TTS_RULES.punctuation) lines.push(`• ${r}`);
  }

  lines.push("");
  lines.push("🌐 **Language**  `!tts-lang <code>`");
  for (const r of TTS_RULES.language) lines.push(`• ${r}`);

  lines.push("");
  lines.push("🔧 **Engine**  `!tts-engine <engine>`");
  for (const r of TTS_RULES.engine) lines.push(`• ${r}`);

  lines.push("");
  lines.push("🎙 **Room**  `!tts-room`");
  for (const r of TTS_RULES.room) lines.push(`• ${r}`);

  const full = lines.join("\n");
  const parts: string[] = [];
  let remaining = full;

  while (remaining.length > maxLen) {
    const slice = remaining.slice(0, maxLen);
    const cut = slice.lastIndexOf("\n\n");
    const pos = cut > maxLen / 2 ? cut : slice.lastIndexOf("\n");
    parts.push(remaining.slice(0, pos).trim());
    remaining = remaining.slice(pos).trim();
  }

  if (remaining) parts.push(remaining);
  return parts;
}

export function buildTTSHelpMessage(lang = "vi"): string {
  return buildTTSHelpParts(lang)[0];
}

export { TTS_RULES };
