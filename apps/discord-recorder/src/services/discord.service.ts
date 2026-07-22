import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
  type SlashCommandSubcommandsOnlyBuilder
} from "discord.js";
import {
  markDiscordInstallationRemoved,
  syncDiscordInstallation,
  syncDiscordInstallations
} from "./database.service.js";

export interface DiscordCommand {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

interface DiscordServiceOptions {
  token: string;
  clientId: string;
  commandGuildId?: string | undefined;
  commands: DiscordCommand[];
}

export class DiscordService {
  private readonly client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
  });

  private readonly commands: Map<string, DiscordCommand>;

  public constructor(private readonly options: DiscordServiceOptions) {
    this.commands = new Map(options.commands.map((command) => [command.data.name, command]));
  }

  public async start(): Promise<void> {
    this.registerInteractionHandler();
    await this.registerSlashCommands();
    await this.client.login(this.options.token);
  }

  private async registerSlashCommands(): Promise<void> {
    const rest = new REST({ version: "10" }).setToken(this.options.token);
    const commandPayload = [...this.commands.values()].map((command) => command.data.toJSON());

    await rest.put(Routes.applicationCommands(this.options.clientId), {
      body: commandPayload
    });
    console.log(`[DISCORD] ${commandPayload.length} globale Slash-Commands registriert`);

    // Optional zusätzlich in einer Test-/Bootstrap-Guild registrieren. Guild-Commands
    // sind sofort sichtbar, globale Commands können bei Discord etwas Zeit benötigen.
    if (this.options.commandGuildId) {
      await rest.put(
        Routes.applicationGuildCommands(this.options.clientId, this.options.commandGuildId),
        { body: commandPayload }
      );
      console.log(
        `[DISCORD] Slash-Commands zusätzlich für Guild ${this.options.commandGuildId} registriert`
      );
    }
  }

  private registerInteractionHandler(): void {
    this.client.once(Events.ClientReady, async (client) => {
      console.log(`Discord bot online as ${client.user.tag}`);
      const syncAll = async () => {
        try {
          const guilds = await Promise.all(
            client.guilds.cache.map(async (guild) => {
              // Der REST-Fetch stellt sicher, dass auch nach einem frischen Bot-Start
              // alle Kanalnamen vorliegen. Das Backend gleicht damit bestehende
              // Kampagnenbindungen ab, ohne Discord-User zu speichern.
              await guild.channels.fetch().catch((error) => {
                console.warn(
                  `[DISCORD] Kanäle von ${guild.name} (${guild.id}) konnten nicht vollständig geladen werden`,
                  error
                );
              });
              const channels: Array<{
                channelId: string;
                channelName: string;
                kind: "VOICE" | "TEXT";
              }> = [];
              for (const channel of guild.channels.cache.values()) {
                if (
                  channel.type === ChannelType.GuildVoice ||
                  channel.type === ChannelType.GuildStageVoice
                ) {
                  channels.push({
                    channelId: channel.id,
                    channelName: channel.name,
                    kind: "VOICE"
                  });
                }
                if (
                  channel.type === ChannelType.GuildText ||
                  channel.type === ChannelType.GuildAnnouncement
                ) {
                  channels.push({
                    channelId: channel.id,
                    channelName: channel.name,
                    kind: "TEXT"
                  });
                }
              }
              return { guildId: guild.id, guildName: guild.name, channels };
            })
          );
          await syncDiscordInstallations(guilds);
          console.log(`[DISCORD] ${client.guilds.cache.size} Server-Installationen synchronisiert`);
        } catch (error) {
          console.error(
            "[DISCORD] Server-Installationen konnten nicht synchronisiert werden",
            error
          );
        }
      };
      await syncAll();
      setInterval(() => void syncAll(), 15 * 60 * 1000).unref();
    });

    this.client.on(Events.GuildCreate, async (guild) => {
      try {
        await syncDiscordInstallation(guild.id, guild.name);
        console.log(`[DISCORD] Bot zu Server hinzugefügt: ${guild.name} (${guild.id})`);
      } catch (error) {
        console.error(`[DISCORD] Installation ${guild.id} konnte nicht gespeichert werden`, error);
      }
    });

    this.client.on(Events.GuildDelete, async (guild) => {
      try {
        await markDiscordInstallationRemoved(guild.id);
        console.log(`[DISCORD] Bot von Server entfernt: ${guild.name} (${guild.id})`);
      } catch (error) {
        console.error(`[DISCORD] Entfernung ${guild.id} konnte nicht gespeichert werden`, error);
      }
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isAutocomplete()) {
        const command = this.commands.get(interaction.commandName);
        if (!command?.autocomplete) {
          await interaction.respond([]);
          return;
        }
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error(`Autocomplete failed: ${interaction.commandName}`, error);
          await interaction.respond([]).catch(() => undefined);
        }
        return;
      }

      if (!interaction.isChatInputCommand()) {
        return;
      }

      const command = this.commands.get(interaction.commandName);

      if (!command) {
        await interaction.reply({
          content: "Unbekannter Befehl.",
          ephemeral: true
        });
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Command failed: ${interaction.commandName}`, error);

        const response = {
          content: "Der Befehl konnte nicht ausgeführt werden. Bitte versuche es erneut.",
          ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(response);
        } else {
          await interaction.reply(response);
        }
      }
    });
  }
}
