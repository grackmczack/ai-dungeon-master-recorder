export interface TranscriptSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionJobData {
  sessionId: string;
  guildId: string;
  filePath: string;
  filename: string;
  durationSeconds?: number;
  discordChannelId?: string;
  chunkIndex?: number;
  isLastChunk?: boolean;
  totalChunks?: number;
}
