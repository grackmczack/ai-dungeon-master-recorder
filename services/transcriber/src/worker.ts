import "dotenv/config";
import { Worker } from "bullmq";
import { Redis as IORedis } from "ioredis";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { transcribeAudio, type WhisperConfig } from "./providers/whisper.js";
import { generateSummary, type LLMConfig } from "./providers/llm.js";
import { postSummaryToDiscord } from "./discord-notify.js";
import type { TranscriptionJobData, TranscriptSegment } from "./types.js";

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
  // Zuerst direkte Session-ID
  if (data.sessionId && data.sessionId.length > 10 && !data.sessionId.includes("pending")) {
    try {
      const s = await prisma.session.findUnique({ where: { id: data.sessionId } });
      if (s) return s;
    } catch { /* fallthrough */ }
  }
  // Fallback: Filename
  const rec = await prisma.recording.findFirst({
    where: { filename: data.filename },
    include: { session: true }
  });
  return rec?.session ?? null;
}

/**
 * Prüft ob alle Chunks einer Session transkribiert sind.
 * Gibt das zusammengeführte Transcript zurück wenn ja.
 */
async function getMergedTranscriptIfComplete(
  sessionId: string,
  totalChunks: number
): Promise<TranscriptSegment[] | null> {
  const transcript = await prisma.transcript.findUnique({ where: { sessionId } });
  if (!transcript) return null;

  const raw = transcript.rawJson as any;

  // Format: { chunks: [{ chunkIndex, durationSeconds, segments: [...] }] }
  const chunks: any[] = raw.chunks ?? [];

  // Prüfen ob alle Chunks da sind
  const presentIndexes = new Set(chunks.map((c: any) => c.chunkIndex ?? 0));
  const allPresent = Array.from({ length: totalChunks }, (_, i) => i).every(i => presentIndexes.has(i));

  if (!allPresent) {
    console.log(`[WORKER] Session ${sessionId}: ${chunks.length}/${totalChunks} chunks in transcript — waiting`);
    return null;
  }

  // Nach chunkIndex sortieren + Segmente mit Zeit-Offset zusammenführen
  const sorted = [...chunks].sort((a: any, b: any) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));

  let timeOffset = 0;
  const merged: TranscriptSegment[] = [];

  for (const chunk of sorted) {
    const segments: TranscriptSegment[] = chunk.segments ?? [];
    const duration = chunk.durationSeconds ?? 0;

    for (const seg of segments) {
      merged.push({ ...seg, start: seg.start + timeOffset, end: seg.end + timeOffset });
    }
    timeOffset += duration;
  }

  console.log(`[WORKER] All ${totalChunks} chunks merged: ${merged.length} total segments (timespan: ${Math.round(timeOffset)}s)`);
  return merged;
}

const worker = new Worker<TranscriptionJobData>(
  "transcription",
  async (job) => {
    const { sessionId, guildId, filePath, filename, durationSeconds, discordChannelId, chunkIndex, isLastChunk, totalChunks } = job.data;
    const isChunked = chunkIndex !== undefined;
    console.log(`[WORKER] Job ${job.id}: ${filename}${isChunked ? ` (chunk ${chunkIndex}, last: ${isLastChunk})` : ""}`);

    const session = await findSession(job.data);
    if (session) {
      await prisma.session.update({ where: { id: session.id }, data: { status: "TRANSCRIBING" } });
    }

    const settings = await getSettings(guildId);
    await job.updateProgress(10);

    // --- Transkription ---
    const whisperConfig: WhisperConfig = {
      provider: (settings?.whisperProvider as WhisperConfig["provider"]) ?? "replicate",
      apiKey: settings?.whisperApiKey ?? process.env.REPLICATE_API_KEY,
      endpoint: settings?.whisperEndpoint ?? undefined
    };

    const transcript = await transcribeAudio(filePath, whisperConfig);
    console.log(`[WORKER] Chunk transkribiert: ${transcript.segments.length} Segmente`);
    await job.updateProgress(50);

    // Chunk-Transcript in DB speichern (mit chunkIndex + durationSeconds für Merge)
    if (session) {
      // Bei Chunks: mehrere Transcripts pro Session → nutze chunk-spezifischen Key
      const transcriptKey = isChunked ? `${session.id}_chunk_${chunkIndex}` : session.id;

      // Transcript mit Chunk-Metadaten speichern
      const rawJsonWithMeta = {
        ...transcript,
        chunkIndex: chunkIndex ?? 0,
        durationSeconds: durationSeconds ?? 0
      };

      if (isChunked) {
        // Für Chunks: als separate Einträge in einem JSON-Array im rawJson-Feld
        // Wir nutzen einen Trick: sessionId + "_chunk_N" als fake sessionId existiert nicht
        // Stattdessen: alle Chunk-Transcripts im ersten Transcript als Array
        await prisma.transcript.upsert({
          where: { sessionId: session.id },
          update: {
            rawJson: (await buildChunkTranscriptJson(session.id, chunkIndex ?? 0, rawJsonWithMeta, prisma)) as any,
            provider: transcript.provider,
            language: transcript.language,
            updatedAt: new Date()
          },
          create: {
            sessionId: session.id,
            rawJson: { chunks: [rawJsonWithMeta] } as any,
            provider: transcript.provider,
            language: transcript.language
          }
        });
      } else {
        await prisma.transcript.upsert({
          where: { sessionId: session.id },
          update: { rawJson: transcript as object, provider: transcript.provider },
          create: { sessionId: session.id, rawJson: transcript as object, provider: transcript.provider, language: transcript.language }
        });
      }
    }

    await job.updateProgress(60);

    // --- LLM Summary ---
    // Bei Chunks: nur wenn letzter Chunk und alle anderen auch fertig
    let segmentsForSummary = transcript.segments;
    let shouldSummarize = true;

    if (isChunked) {
      if (!isLastChunk || !totalChunks) {
        // Nicht der letzte Chunk → kein Summary
        shouldSummarize = false;
        console.log(`[WORKER] Chunk ${chunkIndex} done — waiting for remaining chunks`);
      } else {
        // Letzter Chunk → warte kurz und merge alle
        await new Promise(r => setTimeout(r, 5000)); // 5s warten damit andere Jobs fertig werden
        if (session) {
          const merged = await getMergedTranscriptIfComplete(session.id, totalChunks);
          if (merged) {
            segmentsForSummary = merged;
          } else {
            // Noch nicht alle Chunks da → trotzdem mit vorhandenen fortfahren
            segmentsForSummary = transcript.segments;
          }
        }
      }
    }

    if (shouldSummarize && session) {
      await prisma.session.update({ where: { id: session.id }, data: { status: "SUMMARIZING" } });

      const speakerMaps = await prisma.speakerMap.findMany({ where: { sessionId: session.id } });
      const speakerMap: Record<string, string> = {};
      for (const sm of speakerMaps) {
        speakerMap[sm.discordUserId] = sm.characterName ?? sm.playerName ?? sm.discordName;
      }

      const llmConfig: LLMConfig = {
        provider: (settings?.llmProvider as LLMConfig["provider"]) ?? "anthropic",
        apiKey: settings?.llmApiKey ?? process.env.ANTHROPIC_API_KEY,
        model: settings?.llmModel ?? "claude-opus-4-8",
        endpoint: settings?.llmEndpoint ?? undefined
      };

      // Kampagnen-Kontext aus Campaign holen falls vorhanden
      let campaignContext: string | undefined;
      if (session.campaignId) {
        const campaign = await prisma.campaign.findUnique({ where: { id: session.campaignId } });
        campaignContext = campaign?.campaignContext ?? undefined;
      }

      const summary = await generateSummary(
        segmentsForSummary,
        speakerMap,
        llmConfig,
        settings?.llmSystemPrompt ?? undefined,
        campaignContext
      );
      console.log(`[WORKER] Summary: ${summary.provider}/${summary.model}`);
      await job.updateProgress(90);

      // Titel nur setzen, wenn der DM noch keinen eigenen Titel vergeben hat —
      // ein manuell gesetzter Titel (PATCH /sessions/:id) darf nicht überschrieben werden.
      if (!session.title && summary.title) {
        await prisma.session.update({ where: { id: session.id }, data: { title: summary.title } });
      }

      await prisma.summary.upsert({
        where: { sessionId: session.id },
        update: {
          narrative: summary.narrative, npcs: summary.npcs, quests: summary.quests,
          loot: summary.loot, locations: summary.locations, openThreads: summary.openThreads,
          model: summary.model, provider: summary.provider
        },
        create: {
          sessionId: session.id, narrative: summary.narrative, npcs: summary.npcs,
          quests: summary.quests, loot: summary.loot, locations: summary.locations,
          openThreads: summary.openThreads, model: summary.model, provider: summary.provider
        }
      });

      await prisma.session.update({ where: { id: session.id }, data: { status: "DONE" } });

      // Discord Notification
      const notifyChannelId = discordChannelId ?? settings?.postSummaryChannelId ?? null;
      const discordToken = process.env.DISCORD_TOKEN;
      if (notifyChannelId && discordToken) {
        await postSummaryToDiscord({
          channelId: notifyChannelId,
          token: discordToken,
          summary,
          sessionNumber: session.sessionNumber ?? undefined,
          webPanelUrl: `https://dndbot.haffelpaff.de/sessions/${session.id}`
        });
      }
    }

    await job.updateProgress(100);
    console.log(`[WORKER] ✅ Job ${job.id} abgeschlossen`);
    return { sessionId: session?.id ?? sessionId, segments: transcript.segments.length };
  },
  { connection, concurrency: 2 }
);

/** Fügt einen neuen Chunk zum bestehenden Transcript-JSON hinzu */
async function buildChunkTranscriptJson(
  sessionId: string,
  chunkIndex: number,
  newChunkData: object,
  db: typeof prisma
): Promise<object> {
  const existing = await db.transcript.findUnique({ where: { sessionId } });
  const chunks: object[] = (existing?.rawJson as any)?.chunks ?? [];

  // Chunk ersetzen oder hinzufügen
  const idx = chunks.findIndex((c: any) => c.chunkIndex === chunkIndex);
  if (idx >= 0) chunks[idx] = newChunkData;
  else chunks.push(newChunkData);

  chunks.sort((a: any, b: any) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));
  return { chunks };
}

worker.on("completed", (job, result) => {
  console.log(`[WORKER] ✅ Job ${job.id}:`, result);
});

worker.on("failed", async (job, err) => {
  console.error(`[WORKER] ❌ Job ${job?.id} failed:`, err.message);
  if (job?.data) {
    const session = await findSession(job.data);
    if (session) {
      await prisma.session.update({ where: { id: session.id }, data: { status: "FAILED" } }).catch(() => {});
    }
  }
});

console.log("[WORKER] Transcription Worker gestartet — warte auf Jobs...");
