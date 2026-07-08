export interface TranscriptionJobData {
  sessionId: string;
  guildId: string;
  filePath: string;
  filename: string;
  durationSeconds?: number;
  discordChannelId?: string;
}
