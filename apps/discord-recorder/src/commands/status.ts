import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from "discord.js";
import type { DiscordCommand } from "../services/discord.service.js";
import type { VoiceRecorderService } from "../services/voice-recorder.service.js";
import { getDiscordConnectLink } from "../services/database.service.js";
import { getGuildCampaigns } from "../services/database.service.js";

export function createStatusCommand(voiceRecorderService: VoiceRecorderService): DiscordCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("status")
      .setDescription("Zeigt den Status für diesen Discord-Server."),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.reply({
          content: "Dieser Befehl kann nur auf einem Discord-Server verwendet werden.",
          ephemeral: true
        });
        return;
      }

      // Nur Jobs der aktuellen Guild zählen, damit keine Statusdaten anderer
      // Discord-Server offengelegt werden.
      const { transcriptionQueue } = await import("../services/queue.service.js");
      const [waitingJobs, activeJobs] = await Promise.all([
        transcriptionQueue.getWaiting(),
        transcriptionQueue.getActive()
      ]);
      const waitingForGuild = waitingJobs.filter((job) => job.data.guildId === guildId).length;
      const activeForGuild = activeJobs.filter((job) => job.data.guildId === guildId).length;
      const recording = voiceRecorderService.getRecordingInfo(guildId);
      const campaignConfig = await getGuildCampaigns(guildId).catch(() => null);

      const lines = [
        "**DnD Recorder** — Online",
        `📡 Latenz: ${interaction.client.ws.ping} ms`,
        `🔴 Aufnahme: ${recording ? `läuft in <#${recording.voiceChannelId}>` : "inaktiv"}`,
        `🎙️ Verarbeitung: ${waitingForGuild} wartend, ${activeForGuild} aktiv`
      ];

      if (campaignConfig?.campaigns.length) {
        lines.push("", "**Kampagnen auf diesem Server:**");
        for (const binding of campaignConfig.campaigns) {
          lines.push(
            `${binding.isActive ? "🟢" : "⚫"} ${binding.campaignName}` +
              `${binding.voiceChannelId ? ` · <#${binding.voiceChannelId}>` : " · kein Voice-Channel"}` +
              `${binding.summaryChannelId ? ` → <#${binding.summaryChannelId}>` : ""}`
          );
        }
      }

      if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        try {
          const link = await getDiscordConnectLink(guildId, interaction.guild?.name ?? guildId);
          if (link.connectUrl) {
            lines.push(
              `\n🔗 **Web-Panel noch nicht verbunden:** [Jetzt sicher verbinden](${link.connectUrl})`,
              "Der Link ist 15 Minuten gültig und nur für dich sichtbar."
            );
          }
        } catch (error) {
          console.error(`[STATUS] Web-Verbindungslink für ${guildId} fehlgeschlagen`, error);
        }
      }

      await interaction.reply({ content: lines.join("\n"), flags: MessageFlags.Ephemeral });
    }
  };
}
