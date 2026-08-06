import "./utils/watchdog";
import { Client, Events, GatewayIntentBits, type Message, Interaction } from "discord.js";
import { TOKEN, CLIENT_ID, DEV_GUILD_ID } from "./config";
import { handleTTSCommands } from "./commands/ttsCommands";
import { handleSlashCommand, registerSlashCommands } from "./commands/slashCommands";
import { getAllGuildStates } from "./state";
import { isAbortErr } from "./utils/voiceUtils";
import { leaveVoice } from "./voice/connection";

const USER_COOLDOWN_RETENTION_MS = 30 * 60 * 1000;
const userCooldown = new Map<string, number>();
let shuttingDown = false;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const userCooldownCleanupTimer = setInterval(
  () => {
    const now = Date.now();
    for (const [userId, lastSeenAt] of userCooldown) {
      if (now - lastSeenAt > USER_COOLDOWN_RETENTION_MS) {
        userCooldown.delete(userId);
      }
    }
  },
  10 * 60 * 1000,
);
userCooldownCleanupTimer.unref();

client.on("messageCreate", async (msg: Message) => {
  try {
    if (msg.author.bot) return;
    if (!msg.guild) return;

    await handleTTSCommands(msg, { userCooldown });
  } catch (err) {
    const e = err as Error & { code?: string };

    if (e.code === "VOICE_CONNECT_TIMEOUT") {
      console.warn("Voice connect timeout");
      return;
    }

    if (isAbortErr(err)) {
      console.warn("messageCreate aborted");
      return;
    }

    console.error("messageCreate error:", err);
  }
});

client.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await handleSlashCommand(interaction);
  } catch (err) {
    console.error("interactionCreate error:", err);

    const reply = {
      content: "❌ An error occurred while processing the command.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

// ── Ready ─────────────────────────────────────────────────────
client.once(Events.ClientReady, async (c) => {
  console.log(`Bot ready: ${c.user.tag} (${c.user.id})`);

  await registerSlashCommands(CLIENT_ID, DEV_GUILD_ID);
});

// ── Shutdown ──────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[shutdown] received ${signal}`);

  try {
    const states = getAllGuildStates();
    for (const [guildId] of states) {
      try {
        leaveVoice(guildId, `shutdown:${signal}`);
      } catch (err) {
        console.error(`[shutdown] leaveVoice failed for guild ${guildId}`, err);
      }
    }

    userCooldown.clear();
    client.destroy();
  } catch (err) {
    console.error("[shutdown] error", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void client.login(TOKEN);
