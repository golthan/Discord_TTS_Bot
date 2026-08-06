export const LANG_ALIASES: Record<string, string> = {
  vi: "vi",
  vn: "vi",
  en: "en",
  jp: "ja",
  ja: "ja",
  kr: "ko",
  ko: "ko",
  cn: "zh-CN",
  zh: "zh-CN",
  "zh-cn": "zh-CN",
  "zh-tw": "zh-TW",
};

export function normalizeLang(input: string): string | null {
  const key = String(input || "")
    .trim()
    .toLowerCase();

  return LANG_ALIASES[key] || null;
}
