export type VoiceGender = "female" | "male";

export interface VoiceEntry {
  female: string;
  male: string;
}

export const VOICE_MAP: Record<string, VoiceEntry> = {
  vi: {
    female: "vi-VN-HoaiMyNeural", // Hoai My
    male: "vi-VN-NamMinhNeural", // Nam Minh
  },
  en: {
    female: "en-US-JennyNeural",
    male: "en-US-GuyNeural",
  },
  ja: {
    female: "ja-JP-NanamiNeural",
    male: "ja-JP-KeitaNeural",
  },
  ko: {
    female: "ko-KR-SunHiNeural",
    male: "ko-KR-InJoonNeural",
  },
  "zh-CN": {
    female: "zh-CN-XiaoxiaoNeural",
    male: "zh-CN-YunxiNeural",
  },
  "zh-TW": {
    female: "zh-TW-HsiaoChenNeural",
    male: "zh-TW-YunJheNeural",
  },
};
