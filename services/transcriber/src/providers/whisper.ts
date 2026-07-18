import { readFileSync } from "node:fs";
import type { TranscriptResult, TranscriptSegment, TranscriptWord } from "../types.js";

export interface WhisperConfig {
  provider: "replicate" | "openai" | "selfhosted";
  apiKey?: string | undefined;
  endpoint?: string | undefined;
}

// --- Replicate: File Upload + WhisperX ---
async function uploadToReplicate(filePath: string, apiKey: string): Promise<string> {
  const filename = filePath.split("/").pop() ?? "audio.mp3";
  const mimeType = filename.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
  const fileBuffer = readFileSync(filePath);
  const sizeMB = Math.round((fileBuffer.length / 1024 / 1024) * 10) / 10;

  console.log(`[REPLICATE] Uploading ${filename} (${sizeMB}MB)...`);

  // Native fetch + FormData + Blob (required by Replicate Files API)
  const form = new FormData();
  form.append("content", new Blob([fileBuffer], { type: mimeType }), filename);

  const res = await fetch("https://api.replicate.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Replicate file upload failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { urls: { get: string } };
  console.log(`[REPLICATE] Upload OK: ${data.urls.get}`);
  return data.urls.get;
}

async function transcribeReplicate(
  filePath: string,
  config: WhisperConfig
): Promise<TranscriptResult> {
  const apiKey = config.apiKey ?? process.env.REPLICATE_API_KEY;
  if (!apiKey) throw new Error("REPLICATE_API_KEY missing");

  // Upload local file to Replicate storage → get public URL
  const audioUrl = await uploadToReplicate(filePath, apiKey);

  // Start WhisperX prediction
  const startRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: "wait=60"
    },
    body: JSON.stringify({
      version: "655845d6190ef70573c669245f245892cd039df4b880a1e3a65852c09252f5cc",
      input: {
        audio_file: audioUrl,
        language: "de",
        task: "transcribe",
        align_output: true,
        // Discord provides stable speaker identities and activity timestamps.
        // Anonymous external diarization is deliberately disabled.
        diarization: false
      }
    })
  });

  let result = (await startRes.json()) as any;
  console.log(`[REPLICATE] Prediction ${result.id} status: ${result.status}`);

  // Poll until done (max 10 min)
  const maxAttempts = 120;
  let attempts = 0;
  while (result.status !== "succeeded" && result.status !== "failed" && attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    result = (await pollRes.json()) as any;
    attempts++;
    if (attempts % 6 === 0) {
      console.log(`[REPLICATE] Still processing... (${attempts * 5}s, status: ${result.status})`);
    }
  }

  if (result.status === "failed") {
    const errMsg = JSON.stringify(result.error);
    throw new Error(`Replicate WhisperX failed: ${errMsg}`);
  }
  if (result.status !== "succeeded") {
    throw new Error(`Replicate timeout after ${maxAttempts * 5}s`);
  }

  // Parse output — victor-upmeet/whisperx output format
  const output = result.output;
  let segments: TranscriptSegment[] = [];
  let words: TranscriptWord[] = [];

  // Output kann direkt segments[] sein oder { segments: [] }
  const rawSegments = Array.isArray(output)
    ? output
    : Array.isArray(output?.segments)
      ? output.segments
      : [];

  if (rawSegments.length > 0) {
    segments = rawSegments
      .map((s: any) => ({
        speaker: s.speaker ?? s.speaker_id ?? "SPEAKER_00",
        start: s.start ?? s.timestamp?.[0] ?? 0,
        end: s.end ?? s.timestamp?.[1] ?? 0,
        text: (s.text ?? "").trim()
      }))
      .filter((s: TranscriptSegment) => s.text.length > 0);
    words = rawSegments.flatMap((segment: any) =>
      Array.isArray(segment.words)
        ? segment.words
            .map((word: any) => ({
              word: String(word.word ?? word.text ?? ""),
              start: Number(word.start ?? 0),
              end: Number(word.end ?? word.start ?? 0)
            }))
            .filter(
              (word: TranscriptWord) =>
                word.word.trim().length > 0 &&
                Number.isFinite(word.start) &&
                Number.isFinite(word.end)
            )
        : []
    );
  } else if (typeof output === "string") {
    segments = [{ speaker: "SPEAKER_00", start: 0, end: 0, text: output }];
  } else {
    console.warn("[REPLICATE] Unexpected output format:", JSON.stringify(output).slice(0, 200));
  }

  console.log(`[REPLICATE] Done: ${segments.length} segments`);
  return {
    segments,
    ...(words.length > 0 ? { words } : {}),
    language: output?.language ?? "de",
    provider: "replicate-whisperx"
  };
}

// --- OpenAI Whisper ---
async function transcribeOpenAI(
  filePath: string,
  config: WhisperConfig
): Promise<TranscriptResult> {
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const fileBuffer = readFileSync(filePath);
  const filename = filePath.split("/").pop() ?? "audio.mp3";

  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: "audio/mpeg" }), filename);
  form.append("model", "whisper-1");
  form.append("language", "de");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("timestamp_granularities[]", "word");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });

  if (!res.ok) throw new Error(`OpenAI Whisper error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as any;

  const segments: TranscriptSegment[] = (data.segments ?? []).map((s: any) => ({
    speaker: "SPEAKER_00",
    start: s.start ?? 0,
    end: s.end ?? 0,
    text: (s.text ?? "").trim()
  }));

  const words: TranscriptWord[] = (data.words ?? [])
    .map((word: any) => ({
      word: String(word.word ?? ""),
      start: Number(word.start ?? 0),
      end: Number(word.end ?? word.start ?? 0)
    }))
    .filter(
      (word: TranscriptWord) =>
        word.word.trim().length > 0 && Number.isFinite(word.start) && Number.isFinite(word.end)
    );

  return {
    segments,
    ...(words.length > 0 ? { words } : {}),
    language: data.language ?? "de",
    provider: "openai-whisper"
  };
}

// --- Self-hosted (OpenAI-compatible) ---
async function transcribeSelfhosted(
  filePath: string,
  config: WhisperConfig
): Promise<TranscriptResult> {
  const endpoint = config.endpoint ?? "http://localhost:9000/v1/audio/transcriptions";
  const apiKey = config.apiKey ?? "local";
  const fileBuffer = readFileSync(filePath);
  const filename = filePath.split("/").pop() ?? "audio.mp3";

  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: "audio/mpeg" }), filename);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });

  if (!res.ok) throw new Error(`Self-hosted Whisper error: ${res.status}`);
  const data = (await res.json()) as any;

  const segments: TranscriptSegment[] = (data.segments ?? []).map((s: any) => ({
    speaker: s.speaker ?? "SPEAKER_00",
    start: s.start ?? 0,
    end: s.end ?? 0,
    text: (s.text ?? "").trim()
  }));

  const words: TranscriptWord[] = (data.words ?? [])
    .map((word: any) => ({
      word: String(word.word ?? ""),
      start: Number(word.start ?? 0),
      end: Number(word.end ?? word.start ?? 0)
    }))
    .filter(
      (word: TranscriptWord) =>
        word.word.trim().length > 0 && Number.isFinite(word.start) && Number.isFinite(word.end)
    );

  return {
    segments,
    ...(words.length > 0 ? { words } : {}),
    language: data.language ?? "de",
    provider: "selfhosted-whisper"
  };
}

export async function transcribeAudio(
  filePath: string,
  config: WhisperConfig
): Promise<TranscriptResult> {
  switch (config.provider) {
    case "replicate":
      return transcribeReplicate(filePath, config);
    case "openai":
      return transcribeOpenAI(filePath, config);
    case "selfhosted":
      return transcribeSelfhosted(filePath, config);
    default:
      throw new Error(`Unknown whisper provider: ${(config as any).provider}`);
  }
}
