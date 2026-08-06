import fs from "fs";
import path from "path";

export interface GuildSetting {
  preferredVoiceChannelId: string | null;
  preferredTextChannelId: string | null;
  lang: string | null;
  engine: "google" | null;
}

type GuildSettingsMap = Record<string, GuildSetting>;

const DATA_DIR = path.resolve(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "guild-settings.json");
let cachedSettings: GuildSettingsMap | null = null;

function ensureDataFile(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_FILE))
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}, null, 2), "utf8");
}

function readAllSettings(): GuildSettingsMap {
  if (cachedSettings) return cachedSettings;
  ensureDataFile();

  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw) as GuildSettingsMap;
    cachedSettings = parsed && typeof parsed === "object" ? parsed : {};
    return cachedSettings;
  } catch {
    cachedSettings = {};
    return cachedSettings;
  }
}

let writePending = false;
let writeQueued = false;

function writeAllSettings(data: GuildSettingsMap): void {
  ensureDataFile();
  cachedSettings = data;

  if (writePending) {
    writeQueued = true;
    return;
  }

  writePending = true;
  const tmpFile = `${SETTINGS_FILE}.tmp`;
  const payload = JSON.stringify(data, null, 2);

  fs.promises
    .writeFile(tmpFile, payload, "utf8")
    .then(() => fs.promises.rename(tmpFile, SETTINGS_FILE))
    .catch((err) => console.error("[settings] write failed:", err))
    .finally(() => {
      writePending = false;
      if (writeQueued) {
        writeQueued = false;
        if (cachedSettings) writeAllSettings(cachedSettings);
      }
    });
}

export function loadGuildSetting(guildId: string): GuildSetting {
  const all = readAllSettings();
  const current = all[String(guildId)];

  return {
    preferredVoiceChannelId: current?.preferredVoiceChannelId ?? null,
    preferredTextChannelId: current?.preferredTextChannelId ?? null,
    lang: current?.lang ?? "vi",
    engine: current?.engine === "google" ? "google" : null,
  };
}

export function saveGuildSetting(guildId: string, setting: GuildSetting): void {
  const all = readAllSettings();
  all[String(guildId)] = setting;
  writeAllSettings(all);
}

export function clearGuildSetting(guildId: string): void {
  const all = readAllSettings();
  delete all[String(guildId)];
  writeAllSettings(all);
}
