import "dotenv/config";
import { Worker } from "bullmq";
import { promises as fs } from "node:fs";
import { Redis as IORedis } from "ioredis";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { transcribeAudio, type WhisperConfig } from "./providers/whisper.js";
import { generateSummary, type LLMConfig } from "./providers/llm.js";
import { postSummaryToDiscord } from "./discord-notify.js";
import type { TranscriptionJobData, TranscriptSegment, BatchChunkMeta } from "./types.js";
import { createChunkJobs } from "./batch.js";
import { attributeTranscriptSpeakers, type SpeakerActivity } from "./speaker-attribution.js";
import { resolveSummaryChannelId } from "./summary-channel.js";
import { publicUrl } from "./public-url.js";
import {
  applyGrantedKeyProfile,
  buildGrantedKeyProfile,
  resolveLlmApiKey,
  resolveWhisperApiKey
} from "./api-key-resolution.js";

const prisma = new PrismaClient();
const connection = new IORedis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null
});

async function getSettings(campaignId: string | undefined) {
  if (!campaignId) return null;
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      settings: true,
      memberships: {
        where: { role: "GM", leftAt: null, userId: { not: null } },
        select: { userId: true },
        orderBy: { joinedAt: "asc" }
      }
    }
  });

  const settings = campaign?.settings ?? null;
  const dmUserIds = campaign?.memberships.flatMap((membership) =>
    membership.userId ? [membership.userId] : []
  );

  if (!dmUserIds?.length) return settings;

  const grants = await prisma.adminApiKeyGrant.findMany({
    where: {
      dmId: { in: dmUserIds },
      revokedAt: null,
      dm: { isActive: true },
      superAdmin: { role: "SUPER_ADMIN", isActive: true }
    },
    orderBy: { grantedAt: "desc" },
    select: { dmId: true, superAdminId: true }
  });

  for (const grant of grants) {
    const adminSettings = await prisma.campaignSettings.findMany({
      where: {
        campaign: {
          memberships: {
            some: { userId: grant.superAdminId, role: "GM", leftAt: null }
          }
        }
      },
      orderBy: { campaign: { createdAt: "asc" } },
      select: {
        whisperProvider: true,
        whisperApiKey: true,
        whisperEndpoint: true,
        replicateApiKey: true,
        llmProvider: true,
        llmApiKey: true,
        llmModel: true,
        llmEndpoint: true
      }
    });
    const profile = buildGrantedKeyProfile(adminSettings);
    if (profile) {
      console.log(`[WORKER] 🔑 Using complete super-admin credential profile for DM ${grant.dmId}`);
      return applyGrantedKeyProfile(settings, profile);
    }
  }

  return settings;
}

async function findSession(data: TranscriptionJobData) {
  if (data.sessionId && data.sessionId.length > 10 && !data.sessionId.includes("pending")) {
    try {
      const s = await prisma.session.findUnique({ where: { id: data.sessionId } });
      if (s) return s;
    } catch {
      /* fallthrough */
    }
  }
  const rec = await prisma.recording.findFirst({
    where: { filename: data.filename },
    include: { session: true }
  });
  return rec?.session ?? null;
}

// ─── CRASH RECOVERY STATE MACHINE ────────────────────────────────

type RecoveryState = "none" | "has_chunks" | "has_transcript" | "complete";

/**
 * Determines crash recovery state for a session:
 * - none: no work done yet
 * - has_chunks: compressed recording chunks exist
 * - has_transcript: transcription exists but no summary
 * - complete: summary exists
 */
async function getRecoveryState(
  sessionId: string,
  chunks?: BatchChunkMeta[]
): Promise<RecoveryState> {
  // Check if summary exists
  const summary = await prisma.summary.findUnique({ where: { sessionId } });
  if (summary) return "complete";

  // Check if transcript exists
  const transcript = await prisma.transcript.findUnique({ where: { sessionId } });
  if (transcript) return "has_transcript";

  // Check if compressed chunks exist
  if (chunks && chunks.length > 0) {
    for (const chunk of chunks) {
      try {
        await fs.access(chunk.filePath);
        return "has_chunks";
      } catch {
        continue;
      }
    }
  }

  return "none";
}

/** Remove temporary WAV/speaker files; compressed MP3 chunks remain playable. */
async function cleanupChunks(chunks: BatchChunkMeta[], sessionId: string): Promise<void> {
  console.log(`[WORKER] Cleaning temporary files for ${chunks.length} chunks (${sessionId})...`);

  for (const chunk of chunks) {
    // Delete WAV
    await fs.unlink(chunk.wavPath).catch(() => {});
    // Delete WAV speaker log
    const speakerPath = chunk.wavPath.replace(".wav", ".speakers.json");
    await fs.unlink(speakerPath).catch(() => {});
  }
}

// ─── WORKER ──────────────────────────────────────────────────────

const worker = new Worker<TranscriptionJobData>(
  "transcription",
  async (job) => {
    const { guildId, filePath, filename, durationSeconds, discordChannelId, batchChunks } =
      job.data;
    const isBatch = batchChunks && batchChunks.length > 0;
    const isChunked = !isBatch && job.data.chunkIndex !== undefined;

    console.log(
      `[WORKER] Job ${job.id}: ${filename}${isBatch ? ` (batch: ${batchChunks!.length} chunks)` : isChunked ? ` (chunk ${job.data.chunkIndex})` : ""}`
    );

    const session = await findSession(job.data);
    const settings = await getSettings(job.data.campaignId ?? session?.campaignId);
    if (job.data.summaryOnly) {
      if (!session) throw new Error(`Session ${job.data.sessionId} not found for summarization`);
      console.log(`[WORKER] Regenerating summary only for session ${session.id}`);
      return await handleSummarization(
        job,
        session.id,
        session,
        settings,
        guildId,
        discordChannelId
      );
    }

    if (session) {
      await prisma.session.update({ where: { id: session.id }, data: { status: "TRANSCRIBING" } });
    }

    // ── Crash Recovery Check ──
    if (isBatch && session) {
      const recoveryState = await getRecoveryState(session.id, batchChunks!);
      console.log(`[WORKER] Recovery state for session ${session.id}: ${recoveryState}`);

      if (recoveryState === "complete") {
        console.log(`[WORKER] Session ${session.id} already complete — skipping`);
        return { sessionId: session.id, segments: 0, recovered: true };
      }

      if (recoveryState === "has_transcript") {
        const merged = await getMergedTranscriptIfComplete(session.id, batchChunks!.length);
        if (merged) {
          console.log(`[WORKER] Session ${session.id} has all chunks — resuming summary`);
          return await handleSummarization(
            job,
            session.id,
            session,
            settings,
            guildId,
            discordChannelId
          );
        }
        console.log(`[WORKER] Session ${session.id} has a partial transcript — resuming chunks`);
      }
    }

    // Every provider receives bounded 30-minute files. This keeps 5–6 hour
    // sessions retryable and prevents a single oversized upload.
    if (isBatch && session) {
      const chunkJobs = createChunkJobs(job.data, batchChunks!);
      const completedChunkIndexes = await getCompletedChunkIndexes(session.id);
      for (const [index, chunkData] of chunkJobs.entries()) {
        if (completedChunkIndexes.has(index)) {
          console.log(
            `[WORKER] Chunk ${index + 1}/${chunkJobs.length} already transcribed — skipping`
          );
          await job.updateProgress(Math.round(((index + 1) / chunkJobs.length) * 60));
          continue;
        }
        const result = await handleSingleTranscription(
          job,
          chunkData,
          settings,
          guildId,
          session,
          chunkData.filePath,
          chunkData.filename,
          chunkData.durationSeconds,
          discordChannelId
        );
        if (index === chunkJobs.length - 1) return result;
      }

      const merged = await getMergedTranscriptIfComplete(session.id, chunkJobs.length);
      if (!merged) throw new Error(`Batch transcript is incomplete after processing all chunks`);
      return await handleSummarization(
        job,
        session.id,
        session,
        settings,
        guildId,
        discordChannelId
      );
    }

    // ── LEGACY: Per-chunk or single-file mode ──
    return await handleSingleTranscription(
      job,
      job.data,
      settings,
      guildId,
      session,
      filePath,
      filename,
      durationSeconds,
      discordChannelId
    );
  },
  { connection, concurrency: 2 }
);

// ─── SINGLE/CHUNK HANDLER ─────────────────────────────────────────

async function handleSingleTranscription(
  job: any,
  data: TranscriptionJobData,
  settings: any,
  guildId: string,
  session: any,
  filePath: string,
  filename: string,
  durationSeconds: number | undefined,
  discordChannelId: string | undefined
): Promise<any> {
  const { chunkIndex, isLastChunk, totalChunks } = data;
  const isChunked = chunkIndex !== undefined;
  const updateTranscriptionProgress = async (chunkFraction: number) => {
    const progress =
      isChunked && totalChunks
        ? Math.round((((chunkIndex ?? 0) + chunkFraction) / totalChunks) * 60)
        : Math.round(chunkFraction * 60);
    await job.updateProgress(Math.max(1, Math.min(60, progress)));
  };
  if (session) {
    if (!isChunked || chunkIndex === 0) {
      await prisma.recording.updateMany({
        where: { sessionId: session.id, filename: { contains: "pending" } },
        data: { filename, filePath, durationSeconds }
      });
    } else {
      const exists = await prisma.recording.findFirst({
        where: { sessionId: session.id, filename }
      });
      if (!exists) {
        await prisma.recording.create({
          data: {
            sessionId: session.id,
            filename,
            filePath,
            durationSeconds,
            format: "mp3"
          }
        });
      }
    }
  }

  await updateTranscriptionProgress(0.05);

  // Transcribe
  const whisperConfig: WhisperConfig = {
    provider: (settings?.whisperProvider as WhisperConfig["provider"]) ?? "replicate",
    apiKey: resolveWhisperApiKey(settings?.whisperProvider ?? "replicate", settings),
    endpoint: settings?.whisperEndpoint ?? undefined
    // Discord already provides a reliable identity for every received stream.
    // External pyannote diarization would only replace those identities with
    // anonymous labels and adds another model/token/failure point.
  };

  const transcript = await transcribeAudio(filePath, whisperConfig);
  console.log(`[WORKER] Chunk transkribiert: ${transcript.segments.length} Segmente`);

  // Speaker mapping from chunk's speakers.json
  const speakersJsonPath = filePath
    .replace(".mp3", ".speakers.json")
    .replace(".wav", ".speakers.json");
  let speakerLogs: SpeakerActivity[] = [];
  try {
    const fileContent = await fs.readFile(speakersJsonPath, "utf8");
    speakerLogs = JSON.parse(fileContent);
  } catch {
    console.log(`[WORKER] Kein speakers.json gefunden unter ${speakersJsonPath}`);
  }

  const attribution = attributeTranscriptSpeakers(transcript, speakerLogs);
  transcript.segments = attribution.segments;
  transcript.speakerAttribution = attribution.strategy;
  // Words are only needed for attribution. Omitting them keeps a six-hour
  // transcript JSON substantially smaller without losing display information.
  delete transcript.words;
  console.log(
    `[WORKER] Sprecherzuordnung: ${attribution.strategy}, ${attribution.usedUserIds.length} Discord-Sprecher`
  );

  if (session && attribution.usedUserIds.length > 0) {
    await backfillDirectSpeakerMaps(
      session.id,
      session.campaignId,
      attribution.usedUserIds,
      speakerLogs
    );
  }

  await updateTranscriptionProgress(0.8);

  // Save chunk transcript
  if (session) {
    if (isChunked) {
      const rawJsonWithMeta = {
        ...transcript,
        chunkIndex: chunkIndex ?? 0,
        durationSeconds: durationSeconds ?? 0
      };

      await prisma.transcript.upsert({
        where: { sessionId: session.id },
        update: {
          rawJson: (await buildChunkTranscriptJson(
            session.id,
            chunkIndex ?? 0,
            rawJsonWithMeta,
            prisma
          )) as any,
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
        create: {
          sessionId: session.id,
          rawJson: transcript as object,
          provider: transcript.provider,
          language: transcript.language
        }
      });
    }
  }

  await updateTranscriptionProgress(1);

  // Summarization for chunked: only if last chunk and all present
  let shouldSummarize = true;

  if (isChunked) {
    if (!isLastChunk || !totalChunks) {
      shouldSummarize = false;
      console.log(`[WORKER] Chunk ${(chunkIndex ?? 0) + 1}/${totalChunks ?? "?"} transcribed`);
    } else if (session) {
      const merged = await getMergedTranscriptIfComplete(session.id, totalChunks);
      if (!merged) throw new Error(`Only part of the ${totalChunks}-chunk transcript is available`);
    }
  }

  if (shouldSummarize && session) {
    return await handleSummarization(job, session.id, session, settings, guildId, discordChannelId);
  }

  console.log(`[WORKER] Chunk ${(chunkIndex ?? 0) + 1} gespeichert; Batch wird fortgesetzt`);
  return { sessionId: session?.id ?? data.sessionId, segments: transcript.segments.length };
}

async function backfillDirectSpeakerMaps(
  sessionId: string,
  campaignId: string,
  discordUserIds: string[],
  speakerActivities: SpeakerActivity[]
): Promise<void> {
  const norm = (value?: string | null) => (value ?? "").trim().toLocaleLowerCase("de");
  const activityByUser = new Map<string, SpeakerActivity>();
  for (const activity of speakerActivities) {
    const existing = activityByUser.get(activity.userId);
    if (!existing || (!existing.discordName && activity.discordName)) {
      activityByUser.set(activity.userId, activity);
    }
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      memberships: {
        where: { leftAt: null },
        select: { discordName: true, discordDisplayName: true, characterName: true }
      }
    }
  });

  for (const discordUserId of discordUserIds) {
    const activity = activityByUser.get(discordUserId);
    const discordName = activity?.discordName ?? discordUserId;
    await prisma.speakerMap.upsert({
      where: { sessionId_discordUserId: { sessionId, discordUserId } },
      update: {
        ...(activity?.discordName ? { discordName: activity.discordName } : {})
      },
      create: {
        sessionId,
        discordUserId,
        discordName,
        playerName: activity?.discordDisplayName ?? activity?.discordName ?? undefined
      }
    });
  }

  const speakerMaps = await prisma.speakerMap.findMany({
    where: { sessionId, discordUserId: { in: discordUserIds } }
  });

  for (const speaker of speakerMaps) {
    const membership = campaign?.memberships.find(
      (candidate) =>
        (candidate.discordName && norm(candidate.discordName) === norm(speaker.discordName)) ||
        (candidate.discordDisplayName &&
          norm(candidate.discordDisplayName) === norm(speaker.discordName))
    );
    const characterName = speaker.characterName ?? membership?.characterName ?? undefined;
    const playerName =
      speaker.playerName ??
      membership?.discordDisplayName ??
      membership?.discordName ??
      speaker.discordName;

    await prisma.speakerMap.update({
      where: { id: speaker.id },
      data: {
        // New transcripts contain the stable Discord ID directly. Clearing a
        // legacy anonymous label makes frontend and summaries use that ID.
        diarizationLabel: null,
        ...(characterName ? { characterName } : {}),
        ...(playerName ? { playerName } : {})
      }
    });
  }
}

// ─── SHARED SUMMARIZATION ─────────────────────────────────────────

async function handleSummarization(
  job: any,
  sessionId: string,
  session: any,
  settings: any,
  guildId: string,
  discordChannelId: string | undefined
): Promise<any> {
  // Crash recovery: if summary already exists, skip
  const existingSummary = await prisma.summary.findUnique({ where: { sessionId } });
  if (existingSummary) {
    console.log(`[WORKER] Summary already exists for session ${sessionId} — skipping`);
    await job.updateProgress(100);
    return { sessionId, segments: 0, recovered: true };
  }

  await prisma.session.update({ where: { id: sessionId }, data: { status: "SUMMARIZING" } });

  // Get transcript
  const transcriptRecord = await prisma.transcript.findUnique({ where: { sessionId } });
  if (!transcriptRecord) throw new Error(`No transcript found for session ${sessionId}`);

  const raw = transcriptRecord.rawJson as any;
  let segments: TranscriptSegment[];

  if (raw.chunks) {
    // Chunked transcript — merge with time offsets
    const sorted = [...raw.chunks].sort(
      (a: any, b: any) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0)
    );
    let timeOffset = 0;
    const merged: TranscriptSegment[] = [];
    for (const chunk of sorted) {
      const chunkSegments: TranscriptSegment[] = chunk.segments ?? [];
      for (const seg of chunkSegments) {
        merged.push({ ...seg, start: seg.start + timeOffset, end: seg.end + timeOffset });
      }
      timeOffset += chunk.durationSeconds ?? 0;
    }
    segments = merged;
    console.log(
      `[WORKER] Merged ${sorted.length} chunk transcripts: ${merged.length} total segments`
    );
  } else {
    segments = (raw.segments ?? []) as TranscriptSegment[];
  }

  // Speaker maps
  const speakerMaps = await prisma.speakerMap.findMany({ where: { sessionId } });
  const speakerMap: Record<string, string> = {};
  for (const sm of speakerMaps) {
    const displayName = sm.characterName ?? sm.playerName ?? sm.discordName;
    speakerMap[sm.discordUserId] = displayName;
    if (sm.diarizationLabel) speakerMap[sm.diarizationLabel] = displayName;
  }

  const llmConfig: LLMConfig = {
    provider: (settings?.llmProvider as LLMConfig["provider"]) ?? "anthropic",
    apiKey: resolveLlmApiKey(settings?.llmProvider ?? "anthropic", settings),
    model: settings?.llmModel ?? "claude-opus-4-8",
    endpoint: settings?.llmEndpoint ?? undefined,
    // Session-Zusammenfassungen sind produktweit Deutsch. Der Bildprompt wird
    // innerhalb des LLM-Prompts separat und ausdrücklich auf Englisch angefordert.
    summaryLanguage: "de"
  };

  let campaignContext: string | undefined;
  if (session.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: session.campaignId } });
    campaignContext = campaign?.campaignContext ?? undefined;
  }

  const summary = await generateSummary(
    segments,
    speakerMap,
    llmConfig,
    settings?.llmSystemPrompt ?? undefined,
    campaignContext
  );
  console.log(`[WORKER] Summary: ${summary.provider}/${summary.model}`);
  await job.updateProgress(90);

  if (!session.title && summary.title) {
    await prisma.session.update({ where: { id: sessionId }, data: { title: summary.title } });
  }

  await prisma.summary.upsert({
    where: { sessionId },
    update: {
      narrative: summary.narrative,
      npcs: summary.npcs,
      quests: summary.quests,
      loot: summary.loot,
      locations: summary.locations,
      openThreads: summary.openThreads,
      sessionImagePrompt: summary.sessionImagePrompt ?? null,
      model: summary.model,
      provider: summary.provider
    },
    create: {
      sessionId,
      narrative: summary.narrative,
      npcs: summary.npcs,
      quests: summary.quests,
      loot: summary.loot,
      locations: summary.locations,
      openThreads: summary.openThreads,
      sessionImagePrompt: summary.sessionImagePrompt ?? null,
      model: summary.model,
      provider: summary.provider
    }
  });

  await prisma.session.update({ where: { id: sessionId }, data: { status: "DONE" } });

  // Cleanup chunks after success
  const jobData = job.data as TranscriptionJobData;
  if (jobData.batchChunks && jobData.batchChunks.length > 0) {
    await cleanupChunks(jobData.batchChunks, sessionId);
  }

  // Discord Notification
  const notifyChannelId = resolveSummaryChannelId(
    (job.data as TranscriptionJobData).summaryChannelId ?? settings?.postSummaryChannelId,
    discordChannelId
  );
  const discordToken = process.env.DISCORD_TOKEN;
  const skipNotification = (job.data as TranscriptionJobData).skipNotification === true;
  if (!skipNotification && notifyChannelId && discordToken) {
    await postSummaryToDiscord({
      channelId: notifyChannelId,
      token: discordToken,
      summary,
      sessionNumber: session.sessionNumber ?? undefined,
      webPanelUrl: publicUrl(`/sessions/${encodeURIComponent(sessionId)}`)
    });
  } else if (skipNotification) {
    console.log(`[WORKER] Discord notification skipped for regenerated summary ${sessionId}`);
  }

  await job.updateProgress(100);
  console.log(`[WORKER] ✅ Job ${job.id} abgeschlossen`);
  return { sessionId, segments: segments.length };
}

// ─── HELPERS ──────────────────────────────────────────────────────

async function getCompletedChunkIndexes(sessionId: string): Promise<Set<number>> {
  const transcript = await prisma.transcript.findUnique({ where: { sessionId } });
  const chunks: any[] = (transcript?.rawJson as any)?.chunks ?? [];
  return new Set(
    chunks
      .map((chunk) => Number(chunk.chunkIndex))
      .filter((index) => Number.isInteger(index) && index >= 0)
  );
}

/** Prüft ob alle Chunks einer Session transkribiert sind */
async function getMergedTranscriptIfComplete(
  sessionId: string,
  totalChunks: number
): Promise<TranscriptSegment[] | null> {
  const transcript = await prisma.transcript.findUnique({ where: { sessionId } });
  if (!transcript) return null;

  const raw = transcript.rawJson as any;
  const chunks: any[] = raw.chunks ?? [];

  const presentIndexes = new Set(chunks.map((c: any) => c.chunkIndex ?? 0));
  const allPresent = Array.from({ length: totalChunks }, (_, i) => i).every((i) =>
    presentIndexes.has(i)
  );

  if (!allPresent) {
    console.log(
      `[WORKER] Session ${sessionId}: ${chunks.length}/${totalChunks} chunks in transcript — waiting`
    );
    return null;
  }

  const sorted = [...chunks].sort((a: any, b: any) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));
  let timeOffset = 0;
  const merged: TranscriptSegment[] = [];

  for (const chunk of sorted) {
    const segments: TranscriptSegment[] = chunk.segments ?? [];
    for (const seg of segments) {
      merged.push({ ...seg, start: seg.start + timeOffset, end: seg.end + timeOffset });
    }
    timeOffset += chunk.durationSeconds ?? 0;
  }

  console.log(
    `[WORKER] All ${totalChunks} chunks merged: ${merged.length} total segments (timespan: ${Math.round(timeOffset)}s)`
  );
  return merged;
}

async function buildChunkTranscriptJson(
  sessionId: string,
  chunkIndex: number,
  newChunkData: object,
  db: typeof prisma
): Promise<object> {
  const existing = await db.transcript.findUnique({ where: { sessionId } });
  const chunks: object[] = (existing?.rawJson as any)?.chunks ?? [];
  const idx = chunks.findIndex((c: any) => c.chunkIndex === chunkIndex);
  if (idx >= 0) chunks[idx] = newChunkData;
  else chunks.push(newChunkData);
  chunks.sort((a: any, b: any) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));
  return { chunks };
}

// ─── LIFECYCLE ────────────────────────────────────────────────────

worker.on("completed", (job, result) => {
  console.log(`[WORKER] ✅ Job ${job.id}:`, result);
});

worker.on("failed", async (job, err) => {
  console.error(`[WORKER] ❌ Job ${job?.id} failed:`, err.message);
  if (job?.data) {
    const session = await findSession(job.data);
    if (session) {
      await prisma.session
        .update({ where: { id: session.id }, data: { status: "FAILED" } })
        .catch(() => {});
    }
  }
});

console.log("[WORKER] Transcription Worker gestartet — bounded chunk batches + Crash Recovery");
console.log(
  "[WORKER] Provider routing: all providers → sequential 30-minute chunks + Discord speaker timing"
);
