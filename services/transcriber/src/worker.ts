import "dotenv/config";
import { Worker } from "bullmq";
import { Redis as IORedis } from "ioredis";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { transcribeAudio, type WhisperConfig } from "./providers/whisper.js";
import { generateSummary, type LLMConfig } from "./providers/llm.js";
import { postSummaryToDiscord } from "./discord-notify.js";
import type { TranscriptionJobData } from "./types.js";

const prisma = new PrismaClient();

const connection = new IORedis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null
});

async function getSettings(guildId: string) {
  const group = await prisma.group.findFirst({
    where: { discordGuildId: guildId },
    include: { settings: true }
  });
  return group?.settings ?? null;
}

async function findSession(data: TranscriptionJobData) {
  // Zuerst: suche direkt über Session-ID (wenn DB-Link funktioniert hat)
  if (data.sessionId && !data.sessionId.includes("-") === false && data.sessionId.length < 40) {
    try {
      const session = await prisma.session.findUnique({ where: { id: data.sessionId } });
      if (session) return session;
    } catch { /* fallthrough */ }
  }

  // Fallback: suche über Recording-Filename
  const recording = await prisma.recording.findFirst({
    where: { filename: data.filename },
    include: { session: true }
  });
  return recording?.session ?? null;
}

const worker = new Worker<TranscriptionJobData>(
  "transcription",
  async (job) => {
    const { sessionId, guildId, filePath, filename, durationSeconds, discordChannelId } = job.data;
    console.log(`[WORKER] Processing job ${job.id}: ${filename}`);

    const session = await findSession(job.data);
    if (session) {
      await prisma.session.update({ where: { id: session.id }, data: { status: "TRANSCRIBING" } });
    } else {
      console.warn(`[WORKER] Keine Session gefunden für ${filename} — fahre ohne DB-Update fort`);
    }

    const settings = await getSettings(guildId);
    await job.updateProgress(10);

    // --- Schritt 1: Transkription ---
    const whisperConfig: WhisperConfig = {
      provider: (settings?.whisperProvider as WhisperConfig["provider"] | undefined) ?? "openai",
      apiKey: settings?.whisperApiKey ?? undefined,
      endpoint: settings?.whisperEndpoint ?? undefined
    };

    const transcript = await transcribeAudio(filePath, whisperConfig);
    console.log(`[WORKER] Transkription fertig: ${transcript.segments.length} Segmente`);
    await job.updateProgress(50);

    if (session) {
      await prisma.transcript.upsert({
        where: { sessionId: session.id },
        update: { rawJson: transcript as object, provider: transcript.provider, language: transcript.language },
        create: { sessionId: session.id, rawJson: transcript as object, provider: transcript.provider, language: transcript.language }
      });
      await prisma.session.update({ where: { id: session.id }, data: { status: "SUMMARIZING" } });
    }

    // --- Schritt 2: Speaker-Map aufbauen ---
    const speakerMaps = session
      ? await prisma.speakerMap.findMany({ where: { sessionId: session.id } })
      : [];

    const speakerMap: Record<string, string> = {};
    for (const sm of speakerMaps) {
      speakerMap[sm.discordUserId] = sm.characterName ?? sm.playerName ?? sm.discordName;
    }

    // --- Schritt 3: LLM Summary ---
    await job.updateProgress(60);
    const llmConfig: LLMConfig = {
      provider: (settings?.llmProvider as LLMConfig["provider"] | undefined) ?? "anthropic",
      apiKey: settings?.llmApiKey ?? process.env.ANTHROPIC_API_KEY,
      model: settings?.llmModel ?? "claude-opus-4-8",
      endpoint: settings?.llmEndpoint ?? undefined
    };

    const summary = await generateSummary(transcript.segments, speakerMap, llmConfig);
    console.log(`[WORKER] Summary fertig: ${summary.provider}/${summary.model}`);
    await job.updateProgress(90);

    if (session) {
      await prisma.summary.upsert({
        where: { sessionId: session.id },
        update: {
          narrative: summary.narrative,
          npcs: summary.npcs,
          quests: summary.quests,
          loot: summary.loot,
          locations: summary.locations,
          openThreads: summary.openThreads,
          model: summary.model,
          provider: summary.provider
        },
        create: {
          sessionId: session.id,
          narrative: summary.narrative,
          npcs: summary.npcs,
          quests: summary.quests,
          loot: summary.loot,
          locations: summary.locations,
          openThreads: summary.openThreads,
          model: summary.model,
          provider: summary.provider
        }
      });
      await prisma.session.update({ where: { id: session.id }, data: { status: "DONE" } });
    }

    // --- Schritt 4: Discord-Notification ---
    const notifyChannelId = discordChannelId ?? settings?.postSummaryChannelId ?? null;
    const discordToken = process.env.DISCORD_TOKEN;

    if (notifyChannelId && discordToken) {
      const webUrl = session ? `https://dndbot.haffelpaff.de/sessions/${session.id}` : undefined;
      await postSummaryToDiscord({
        channelId: notifyChannelId,
        token: discordToken,
        summary,
        sessionNumber: session?.sessionNumber ?? undefined,
        webPanelUrl: webUrl
      });
    }

    await job.updateProgress(100);
    console.log(`[WORKER] Job ${job.id} abgeschlossen`);
    return { sessionId: session?.id ?? sessionId, provider: transcript.provider, segments: transcript.segments.length };
  },
  { connection, concurrency: 1 }
);

worker.on("completed", (job, result) => {
  console.log(`[WORKER] ✅ Job ${job.id} fertig:`, result);
});

worker.on("failed", async (job, err) => {
  console.error(`[WORKER] ❌ Job ${job?.id} fehlgeschlagen:`, err.message);
  if (job?.data) {
    const session = await findSession(job.data);
    if (session) {
      await prisma.session.update({ where: { id: session.id }, data: { status: "FAILED" } }).catch(() => {});
    }
  }
});

console.log("[WORKER] Transcription Worker gestartet — warte auf Jobs...");
