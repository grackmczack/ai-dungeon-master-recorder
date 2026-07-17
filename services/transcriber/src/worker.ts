import "dotenv/config";
import { Worker } from "bullmq";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execSync } from "node:child_process";
import { Redis as IORedis } from "ioredis";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { transcribeAudio, type WhisperConfig } from "./providers/whisper.js";
import { generateSummary, type LLMConfig } from "./providers/llm.js";
import { postSummaryToDiscord } from "./discord-notify.js";
import type { TranscriptionJobData, TranscriptSegment, BatchChunkMeta } from "./types.js";
import { createChunkJobs } from "./batch.js";

const prisma = new PrismaClient();
const connection = new IORedis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null
});

// Dir for concatenated MP3s
const STORAGE_DIR = path.resolve(
  process.env.STORAGE_DIR ?? path.join(process.cwd(), "..", "..", "storage", "recordings")
);

async function getSettings(guildId: string) {
  const group = await prisma.group.findFirst({
    where: { discordGuildId: guildId },
    include: {
      settings: true,
      memberships: {
        where: { role: "GM", leftAt: null },
        select: { userId: true },
        orderBy: { joinedAt: "asc" },
        take: 1
      }
    }
  });

  const settings = group?.settings ?? null;
  const dmUserId = group?.memberships[0]?.userId;

  if (dmUserId) {
    const adminGrant = await prisma.adminApiKeyGrant.findFirst({
      where: { dmId: dmUserId, revokedAt: null },
      orderBy: { grantedAt: "desc" },
      select: { superAdminId: true, superAdmin: { select: { role: true } } }
    });

    if (adminGrant && adminGrant.superAdmin.role === "SUPER_ADMIN") {
      const adminSettings = await prisma.groupSettings.findFirst({
        where: {
          group: {
            memberships: {
              some: { userId: adminGrant.superAdminId, role: "GM", leftAt: null }
            }
          }
        },
        orderBy: { group: { createdAt: "asc" } },
        select: {
          whisperApiKey: true,
          huggingfaceToken: true,
          replicateApiKey: true,
          llmApiKey: true
        }
      });

      if (adminSettings) {
        console.log(
          `[WORKER] 🔑 Using super-admin API keys for DM ${dmUserId} (granted by ${adminGrant.superAdminId})`
        );
        const sharedKeys = Object.fromEntries(
          Object.entries(adminSettings).filter(
            ([, value]) => typeof value === "string" && value.trim().length > 0
          )
        );
        return { ...(settings ?? {}), ...sharedKeys };
      }
      console.log(
        `[WORKER] ⚠️ Admin key grant active but no super-admin settings found — using DM's own settings`
      );
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

// ─── BATCH CONCAT + TRANSCRIBE ────────────────────────────────────

/**
 * Concatenates multiple MP3 chunks into a single MP3 file using ffmpeg concat demuxer.
 * Returns the path to the concatenated file.
 */
async function concatenateMp3s(
  chunks: BatchChunkMeta[],
  sessionId: string
): Promise<{ concatPath: string; totalDuration: number }> {
  // Create concat list file
  const listPath = path.join(STORAGE_DIR, `${sessionId}-concat.txt`);
  const concatPath = path.join(STORAGE_DIR, `${sessionId}-concat.mp3`);

  // Check if concat already exists (crash recovery)
  try {
    await fs.access(concatPath);
    const existing = chunks.reduce((sum, c) => sum + c.durationSeconds, 0);
    console.log(`[WORKER] Concatenated MP3 already exists: ${concatPath} — skipping re-concat`);
    return { concatPath, totalDuration: existing };
  } catch {
    // doesn't exist, proceed
  }

  const lines = chunks.map((c) => `file '${c.filePath}'`).join("\n");
  await fs.writeFile(listPath, lines, "utf8");

  console.log(`[WORKER] Concatenating ${chunks.length} MP3 chunks via ffmpeg...`);
  const totalDuration = chunks.reduce((sum, c) => sum + c.durationSeconds, 0);
  console.log(
    `[WORKER] Total duration: ${Math.round(totalDuration)}s, estimated size: ~${Math.round(totalDuration * 8)}KB`
  );

  try {
    execSync(`ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${concatPath}" -y`, {
      stdio: "pipe",
      timeout: 60_000
    });
  } catch (e: any) {
    // If -c copy fails (different codecs), re-encode
    console.warn(
      `[WORKER] Stream copy concat failed, falling back to re-encode:`,
      e.stderr?.toString().slice(0, 200)
    );
    execSync(
      `ffmpeg -f concat -safe 0 -i "${listPath}" -acodec libmp3lame -ar 16000 -ac 1 -b:a 64k "${concatPath}" -y`,
      { stdio: "pipe", timeout: 120_000 }
    );
  }

  // Clean up list file
  await fs.unlink(listPath).catch(() => {});

  const stat = await fs.stat(concatPath);
  console.log(
    `[WORKER] Concatenated MP3: ${stat.size} bytes (${Math.round((stat.size / 1024 / 1024) * 10) / 10}MB)`
  );

  return { concatPath, totalDuration };
}

/**
 * Merge speaker logs from all chunks into a single speakers.json for the concatenated audio.
 * Offsets timestamps based on cumulative duration of preceding chunks.
 */
async function mergeSpeakerLogs(
  chunks: BatchChunkMeta[],
  sessionId: string
): Promise<Array<{ userId: string; start: number; end: number }>> {
  const merged: Array<{ userId: string; start: number; end: number }> = [];
  let timeOffset = 0;

  for (const chunk of chunks) {
    const speakerPath = chunk.wavPath.replace(".wav", ".speakers.json");
    try {
      const content = await fs.readFile(speakerPath, "utf8");
      const entries: Array<{ userId: string; start: number; end: number }> = JSON.parse(content);
      for (const e of entries) {
        merged.push({
          userId: e.userId,
          start: e.start + timeOffset,
          end: e.end + timeOffset
        });
      }
    } catch {
      // No speaker log for this chunk — fine
    }
    timeOffset += chunk.durationSeconds * 1000;
  }

  // Write merged speaker log for crash recovery reference
  const mergedPath = path.join(STORAGE_DIR, `${sessionId}-concat.speakers.json`);
  await fs.writeFile(mergedPath, JSON.stringify(merged, null, 2), "utf8");

  return merged;
}

/**
 * Maps transcription segments to speakers using overlapped speaker logs.
 */
async function mapSpeakersToLabels(
  segments: TranscriptSegment[],
  speakerLogs: Array<{ userId: string; start: number; end: number }>,
  sessionId: string,
  _guildId: string
): Promise<void> {
  if (speakerLogs.length === 0 || segments.length === 0) return;

  const scores: Record<string, Record<string, number>> = {};

  for (const seg of segments) {
    const label = seg.speaker;
    if (!label) continue;
    if (!scores[label]) scores[label] = {};

    const segStartMs = seg.start * 1000;
    const segEndMs = seg.end * 1000;

    for (const log of speakerLogs) {
      const overlapStart = Math.max(segStartMs, log.start);
      const overlapEnd = Math.min(segEndMs, log.end);
      if (overlapEnd > overlapStart) {
        scores[label][log.userId] = (scores[label][log.userId] || 0) + (overlapEnd - overlapStart);
      }
    }
  }

  for (const [label, userScores] of Object.entries(scores)) {
    let bestUser: string | null = null;
    let maxScore = 0;
    for (const [userId, score] of Object.entries(userScores)) {
      if (score > maxScore) {
        maxScore = score;
        bestUser = userId;
      }
    }

    if (bestUser) {
      console.log(
        `[WORKER] -> ${label} ist Discord-User ${bestUser} (Score: ${Math.round(maxScore)}ms)`
      );
      await prisma.speakerMap.updateMany({
        where: { sessionId, discordUserId: bestUser },
        data: { diarizationLabel: label }
      });
    }
  }
}

// ─── CRASH RECOVERY STATE MACHINE ────────────────────────────────

type RecoveryState = "none" | "has_chunks" | "has_mp3" | "has_transcript" | "complete";

/**
 * Determines crash recovery state for a session:
 * - none: no work done yet
 * - has_chunks: WAV chunks exist but not concatenated
 * - has_mp3: concatenated MP3 exists but not transcribed
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

  // Check if concatenated MP3 exists
  if (chunks && chunks.length > 0) {
    const concatPath = path.join(STORAGE_DIR, `${sessionId}-concat.mp3`);
    try {
      await fs.access(concatPath);
      return "has_mp3";
    } catch {
      // No concat MP3
    }
  }

  // Check if WAV chunks exist
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

/** Cleanup WAV and MP3 chunks after successful transcription+summary */
async function cleanupChunks(chunks: BatchChunkMeta[], sessionId: string): Promise<void> {
  console.log(`[WORKER] Cleaning up ${chunks.length} chunks for session ${sessionId}...`);

  for (const chunk of chunks) {
    // Delete WAV
    await fs.unlink(chunk.wavPath).catch(() => {});
    // Delete WAV speaker log
    const speakerPath = chunk.wavPath.replace(".wav", ".speakers.json");
    await fs.unlink(speakerPath).catch(() => {});
    // Delete individual MP3 (keep concat for now, could be archived)
    await fs.unlink(chunk.filePath).catch(() => {});
  }

  // Delete merged speaker log
  const mergedSpeakerPath = path.join(STORAGE_DIR, `${sessionId}-concat.speakers.json`);
  await fs.unlink(mergedSpeakerPath).catch(() => {});

  // Keep concat MP3 — might be useful for re-processing
  // If we really want to save space, uncomment:
  // const concatPath = path.join(STORAGE_DIR, `${sessionId}-concat.mp3`);
  // await fs.unlink(concatPath).catch(() => {});
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

    const settings = await getSettings(guildId);
    const provider = (settings?.whisperProvider as WhisperConfig["provider"]) ?? "replicate";

    // ── Determine if provider supports single-file approach ──
    const supportsLargeFiles = provider === "replicate" || provider === "selfhosted";
    // OpenAI: 25 MB hard limit → MUST use per-chunk approach
    // Replicate: 100 MB file upload limit, plus whisperx handles "a couple 100 MB" files

    const session = await findSession(job.data);
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
        console.log(`[WORKER] Session ${session.id} has transcript — resuming at summarization`);
        // Fall through to summarization below
      }
    }

    // ── BATCH MODE: Concatenate & transcribe single MP3 ──
    if (isBatch && session && supportsLargeFiles) {
      return await handleBatchTranscription(
        job,
        session,
        batchChunks!,
        settings,
        guildId,
        discordChannelId,
        provider
      );
    }

    if (isBatch && session) {
      const chunkJobs = createChunkJobs(job.data, batchChunks!);
      for (const [index, chunkData] of chunkJobs.entries()) {
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

// ─── BATCH HANDLER ────────────────────────────────────────────────

async function handleBatchTranscription(
  job: any,
  session: any,
  batchChunks: BatchChunkMeta[],
  settings: any,
  guildId: string,
  discordChannelId: string | undefined,
  provider: string
): Promise<any> {
  const sessionId = session.id;

  // Update recordings in DB
  await prisma.recording.updateMany({
    where: { sessionId, filename: { contains: "pending" } },
    data: { filename: batchChunks[0]!.filename, filePath: batchChunks[0]!.filePath, format: "mp3" }
  });

  // Check crash recovery: skip concat if already done
  const recoveryState = await getRecoveryState(sessionId, batchChunks);

  let concatPath: string;
  let totalDuration: number;

  if (recoveryState === "has_transcript") {
    // Already transcribed — skip to summarization
    console.log(`[WORKER] Skipping transcription for ${sessionId} — already has transcript`);
    await job.updateProgress(60);
    return await handleSummarization(job, sessionId, session, settings, guildId, discordChannelId);
  }

  // Concatenate MP3s (or use cached if has_mp3)
  if (recoveryState === "has_mp3") {
    concatPath = path.join(STORAGE_DIR, `${sessionId}-concat.mp3`);
    totalDuration = batchChunks.reduce((sum, c) => sum + c.durationSeconds, 0);
    console.log(`[WORKER] Using existing concat MP3: ${concatPath}`);
  } else {
    const result = await concatenateMp3s(batchChunks, sessionId);
    concatPath = result.concatPath;
    totalDuration = result.totalDuration;
  }

  // Check provider file size limits
  const stat = await fs.stat(concatPath);
  const sizeMB = stat.size / 1024 / 1024;

  if (provider === "replicate" && sizeMB > 90) {
    console.warn(
      `[WORKER] ⚠️ Concatenated MP3 is ${Math.round(sizeMB)}MB — near Replicate 100MB limit!`
    );
    console.warn(
      `[WORKER] Consider switching to victor-upmeet/whisperx-a40-large for larger files`
    );
  }

  await job.updateProgress(30);

  // Merge speaker logs for the concatenated audio
  const mergedSpeakerLogs = await mergeSpeakerLogs(batchChunks, sessionId);

  // Transcribe concatenated MP3
  const whisperConfig: WhisperConfig = {
    provider: provider as WhisperConfig["provider"],
    apiKey: settings?.whisperApiKey ?? process.env.REPLICATE_API_KEY,
    endpoint: settings?.whisperEndpoint ?? undefined,
    huggingfaceToken: settings?.huggingfaceToken ?? undefined
  };

  console.log(
    `[WORKER] Transcribing ${Math.round(sizeMB)}MB concatenated MP3 (${Math.round(totalDuration)}s) via ${provider}...`
  );
  const transcript = await transcribeAudio(concatPath, whisperConfig);
  console.log(`[WORKER] Transcription done: ${transcript.segments.length} segments`);

  // Map speakers using merged speaker logs
  await mapSpeakersToLabels(transcript.segments, mergedSpeakerLogs, sessionId, guildId);

  await job.updateProgress(50);

  // Save transcript to DB
  await prisma.transcript.upsert({
    where: { sessionId },
    update: {
      rawJson: transcript as any,
      provider: transcript.provider,
      language: transcript.language
    },
    create: {
      sessionId,
      rawJson: transcript as any,
      provider: transcript.provider,
      language: transcript.language
    }
  });

  await job.updateProgress(60);

  return await handleSummarization(job, sessionId, session, settings, guildId, discordChannelId);
}

// ─── SINGLE/CHUNK HANDLER (OpenAI fallback + legacy) ──────────────

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

  await job.updateProgress(10);

  // Transcribe
  const whisperConfig: WhisperConfig = {
    provider: (settings?.whisperProvider as WhisperConfig["provider"]) ?? "replicate",
    apiKey: settings?.whisperApiKey ?? process.env.REPLICATE_API_KEY,
    endpoint: settings?.whisperEndpoint ?? undefined,
    huggingfaceToken: settings?.huggingfaceToken ?? undefined
  };

  const transcript = await transcribeAudio(filePath, whisperConfig);
  console.log(`[WORKER] Chunk transkribiert: ${transcript.segments.length} Segmente`);

  // Speaker mapping from chunk's speakers.json
  const speakersJsonPath = filePath
    .replace(".mp3", ".speakers.json")
    .replace(".wav", ".speakers.json");
  let speakerLogs: Array<{ userId: string; start: number; end: number }> = [];
  try {
    const fileContent = await fs.readFile(speakersJsonPath, "utf8");
    speakerLogs = JSON.parse(fileContent);
  } catch {
    console.log(`[WORKER] Kein speakers.json gefunden unter ${speakersJsonPath}`);
  }

  if (speakerLogs.length > 0 && session) {
    console.log(`[WORKER] Gleiche Transkript-Segmente mit ${speakerLogs.length} Voice-Logs ab...`);

    const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
    let memberships: Array<{
      discordName: string | null;
      discordDisplayName: string | null;
      characterName: string | null;
    }> = [];
    try {
      const grp = await prisma.group.findFirst({
        where: { discordGuildId: session.discordGuildId ?? guildId },
        include: {
          memberships: {
            where: { leftAt: null },
            select: { discordName: true, discordDisplayName: true, characterName: true }
          }
        }
      });
      memberships = grp?.memberships ?? [];
    } catch {
      console.log(`[WORKER] Konnte GroupMemberships für Backfill nicht laden`);
    }

    const scores: Record<string, Record<string, number>> = {};

    for (const seg of transcript.segments) {
      const label = seg.speaker;
      if (!label) continue;
      if (!scores[label]) scores[label] = {};

      const segStartMs = seg.start * 1000;
      const segEndMs = seg.end * 1000;

      for (const log of speakerLogs) {
        const overlapStart = Math.max(segStartMs, log.start);
        const overlapEnd = Math.min(segEndMs, log.end);
        if (overlapEnd > overlapStart) {
          scores[label][log.userId] =
            (scores[label][log.userId] || 0) + (overlapEnd - overlapStart);
        }
      }
    }

    for (const [label, userScores] of Object.entries(scores)) {
      let bestUser: string | null = null;
      let maxScore = 0;
      for (const [userId, score] of Object.entries(userScores)) {
        if (score > maxScore) {
          maxScore = score;
          bestUser = userId;
        }
      }

      if (bestUser) {
        console.log(
          `[WORKER] -> ${label} ist Discord-User ${bestUser} (Score: ${Math.round(maxScore)}ms)`
        );

        const existing = await prisma.speakerMap.findUnique({
          where: { sessionId_discordUserId: { sessionId: session.id, discordUserId: bestUser } }
        });

        const updateData: {
          diarizationLabel: string;
          characterName?: string;
          playerName?: string;
        } = { diarizationLabel: label };
        if (existing && !existing.characterName && existing.discordName) {
          const m = memberships.find(
            (mm) =>
              (mm.discordName && norm(mm.discordName) === norm(existing.discordName)) ||
              (mm.discordDisplayName && norm(mm.discordDisplayName) === norm(existing.discordName))
          );
          if (m?.characterName) {
            updateData.characterName = m.characterName;
            if (!existing.playerName)
              updateData.playerName = m.discordDisplayName ?? m.discordName ?? undefined;
            console.log(
              `[WORKER]    + characterName '${m.characterName}' aus GroupMembership nachgetragen`
            );
          }
        }

        await prisma.speakerMap.updateMany({
          where: { sessionId: session.id, discordUserId: bestUser },
          data: updateData
        });
      }
    }
  }

  await job.updateProgress(50);

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

  await job.updateProgress(60);

  // Summarization for chunked: only if last chunk and all present
  let shouldSummarize = true;

  if (isChunked) {
    if (!isLastChunk || !totalChunks) {
      shouldSummarize = false;
      console.log(`[WORKER] Chunk ${chunkIndex} done — waiting for remaining chunks`);
    } else if (session) {
      await new Promise((r) => setTimeout(r, 5000));
      const merged = await getMergedTranscriptIfComplete(session.id, totalChunks);
      if (!merged) throw new Error(`Only part of the ${totalChunks}-chunk transcript is available`);
    }
  }

  if (shouldSummarize && session) {
    return await handleSummarization(job, session.id, session, settings, guildId, discordChannelId);
  }

  await job.updateProgress(100);
  console.log(`[WORKER] ✅ Job ${job.id} abgeschlossen (no summary yet)`);
  return { sessionId: session?.id ?? data.sessionId, segments: transcript.segments.length };
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
    const key = sm.diarizationLabel ?? sm.discordUserId;
    if (!key) continue;
    speakerMap[key] = sm.characterName ?? sm.playerName ?? sm.discordName;
  }

  const llmConfig: LLMConfig = {
    provider: (settings?.llmProvider as LLMConfig["provider"]) ?? "anthropic",
    apiKey: settings?.llmApiKey ?? process.env.ANTHROPIC_API_KEY,
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
  const notifyChannelId = discordChannelId ?? settings?.postSummaryChannelId ?? null;
  const discordToken = process.env.DISCORD_TOKEN;
  const skipNotification = (job.data as TranscriptionJobData).skipNotification === true;
  if (!skipNotification && notifyChannelId && discordToken) {
    await postSummaryToDiscord({
      channelId: notifyChannelId,
      token: discordToken,
      summary,
      sessionNumber: session.sessionNumber ?? undefined,
      webPanelUrl: `https://dndbot.haffelpaff.de/sessions/${sessionId}`
    });
  } else if (skipNotification) {
    console.log(`[WORKER] Discord notification skipped for regenerated summary ${sessionId}`);
  }

  await job.updateProgress(100);
  console.log(`[WORKER] ✅ Job ${job.id} abgeschlossen`);
  return { sessionId, segments: segments.length };
}

// ─── HELPERS ──────────────────────────────────────────────────────

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

console.log(
  "[WORKER] Transcription Worker gestartet — Batch-Mode (concat at end) + Crash Recovery"
);
console.log(
  "[WORKER] Provider routing: Replicate/selfhosted → single concat MP3, OpenAI → per-chunk"
);
