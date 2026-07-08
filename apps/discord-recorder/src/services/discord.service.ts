import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder
} from "discord.js";

export interface DiscordCommand {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

interface DiscordServiceOptions {
  token: string;
  clientId: string;
  guildId: string;
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

    await rest.put(Routes.applicationGuildCommands(this.options.clientId, this.options.guildId), {
      body: commandPayload
    });
  }

  private registerInteractionHandler(): void {
    this.client.once(Events.ClientReady, (client) => {
      console.log(`Discord bot online as ${client.user.tag}`);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) {
        return;
      }

      const command = this.commands.get(interaction.commandName);

      if (!command) {
        await interaction.reply({
          content: "Unknown command",
          ephemeral: true
        });
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Command failed: ${interaction.commandName}`, error);

        const response = {
          content: "Command failed",
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
