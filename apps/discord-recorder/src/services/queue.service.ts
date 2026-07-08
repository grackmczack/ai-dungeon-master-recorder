import { Queue } from "bullmq";
import { Redis as IORedis } from "ioredis";

export interface TranscriptionJobData {
  sessionId: string;
  guildId: string;
  filePath: string;
  filename: string;
  durationSeconds?: number;
  discordChannelId?: string;
  // Chunked recording
  chunkIndex?: number;
  isLastChunk?: boolean;
  totalChunks?: number;
}

const connection = new IORedis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null
});

export const transcriptionQueue = new Queue<TranscriptionJobData, unknown, "transcribe" | "transcribe-chunk">("transcription", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000
    }
  }
});
