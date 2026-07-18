import { Queue } from "bullmq";
import { Redis as IORedis } from "ioredis";

export interface BatchChunkMeta {
  filePath: string;
  filename: string;
  durationSeconds: number;
  wavPath: string;
}

export interface TranscriptionJobData {
  sessionId: string;
  guildId: string;
  campaignId?: string;
  bindingId?: string;
  voiceChannelId?: string;
  summaryChannelId?: string;
  filePath: string;
  filename: string;
  durationSeconds?: number;
  discordChannelId?: string;
  // Interne Optionen für eine manuelle Summary-Neugenerierung.
  summaryOnly?: boolean;
  skipNotification?: boolean;
  // Per-chunk recording (legacy/OpenAI fallback)
  chunkIndex?: number;
  isLastChunk?: boolean;
  totalChunks?: number;
  // Batch mode: all chunks in one job (for Replicate/selfhosted concat)
  batchChunks?: BatchChunkMeta[];
}

const connection = new IORedis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null
});

export const transcriptionQueue = new Queue<
  TranscriptionJobData,
  unknown,
  "transcribe" | "transcribe-chunk" | "transcribe-batch"
>("transcription", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000
    }
  }
});
