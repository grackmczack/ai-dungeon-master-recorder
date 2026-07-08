import "dotenv/config";
import { Worker } from "bullmq";
import { Redis as IORedis } from "ioredis";
import { PrismaClient } from "@prisma/client";
import { transcribeAudio, type WhisperConfig } from "./providers/whisper.js";
import { generateSummary, type LLMConfig } from "./providers/llm.js";
import type { TranscriptionJobData } from "./types.js";

const prisma = new PrismaClient();

const connection = new IORedis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null
});

async function getSettings(guildId: string) {
  const group = await prisma.group.findFirst({ where: { discordGuildId: guildId }, include: { settings: true } });
  return group?.settings ?? null;
}

async function findOrCreateSessionForJob(data: TranscriptionJobData) {
  // Try to find session by guildId + recent recording
  const recording = await prisma.recording.findFirst({
    where: { filename: data.filename },
    include: { session: true }
  });
  return recording?.session ?? null;
}

const worker = new Worker<TranscriptionJobData>(
  "transcription",
  async (job) => {
    const { sessionId, guildId, filePath, filename, durationSeconds } = job.data;
    console.log(`[WORKER] Processing job ${job.id}: ${filename}`);

    // Update session status to TRANSCRIBING
    const session = await findOrCreateSessionForJob(job.data);
    if (session) {
      await prisma.session.update({ where: { id: session.id }, data: { status: "TRANSCRIBING" } });
    }

    // Get settings from DB (falls back to env vars)
    const settings = await getSettings(guildId);

    // --- Step 1: Transcription ---
    await job.updateProgress(10);
    const whisperConfig: WhisperConfig = {
      provider: (settings?.whisperProvider as WhisperConfig["provider"]) ?? "openai",
      apiKey: settings?.whisperApiKey ?? undefined,
      endpoint: settings?.whisperEndpoint ?? undefined
    };

    const transcript = await transcribeAudio(filePath, whisperConfig);
    console.log(`[WORKER] Transcription done: ${transcript.segments.length} segments`);
    await job.updateProgress(50);

    // Store transcript in DB
    if (session) {
      await prisma.transcript.upsert({
        where: { sessionId: session.id },
        update: { rawJson: transcript as any, provider: transcript.provider },
        create: { sessionId: session.id, rawJson: transcript as any, provider: transcript.provider, language: transcript.language }
      });
      await prisma.session.update({ where: { id: session.id }, data: { status: "SUMMARIZING" } });
    }

    // --- Step 2: Build speaker map from DB ---
    const speakerMaps = session
      ? await prisma.speakerMap.findMany({ where: { sessionId: session.id } })
      : [];

    const speakerMap: Record<string, string> = {};
    for (const sm of speakerMaps) {
      // Map SPEAKER_XX to character/player name
      speakerMap[sm.discordUserId] = sm.characterName ?? sm.playerName ?? sm.discordName;
    }

    // --- Step 3: LLM Summary ---
    await job.updateProgress(60);
    const llmConfig: LLMConfig = {
      provider: (settings?.llmProvider as LLMConfig["provider"]) ?? "anthropic",
      apiKey: settings?.llmApiKey ?? process.env.ANTHROPIC_API_KEY,
      model: settings?.llmModel ?? "claude-opus-4-8-20251101",
      endpoint: settings?.llmEndpoint ?? undefined
    };

    const summary = await generateSummary(transcript.segments, speakerMap, llmConfig);
    console.log(`[WORKER] Summary done by ${summary.provider}/${summary.model}`);
    await job.updateProgress(90);

    // Store summary in DB
    if (session) {
      await prisma.summary.upsert({
        where: { sessionId: session.id },
        update: { ...summary },
        create: { sessionId: session.id, ...summary }
      });
      await prisma.session.update({ where: { id: session.id }, data: { status: "DONE" } });
    }

    await job.updateProgress(100);
    console.log(`[WORKER] Job ${job.id} complete`);

    return { sessionId, provider: transcript.provider, segments: transcript.segments.length };
  },
  { connection, concurrency: 1 }
);

worker.on("completed", (job, result) => {
  console.log(`[WORKER] ✅ Job ${job.id} completed:`, result);
});

worker.on("failed", async (job, err) => {
  console.error(`[WORKER] ❌ Job ${job?.id} failed:`, err.message);
  if (job?.data?.guildId) {
    const session = await findOrCreateSessionForJob(job.data);
    if (session) {
      await prisma.session.update({ where: { id: session.id }, data: { status: "FAILED" } });
    }
  }
});

console.log("[WORKER] Transcription worker started, waiting for jobs...");
