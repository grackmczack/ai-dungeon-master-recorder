import { readFileSync } from "node:fs";

export interface TranscriptSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  language: string;
  provider: string;
}

export interface WhisperConfig {
  provider: "replicate" | "openai" | "selfhosted";
  apiKey?: string | undefined;
  endpoint?: string | undefined;
  huggingfaceToken?: string | undefined;
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
  config: WhisperConfig,
  allowFallback = true
): Promise<TranscriptResult> {
  const apiKey = config.apiKey ?? process.env.REPLICATE_API_KEY;
  if (!apiKey) throw new Error("REPLICATE_API_KEY missing");

  // Upload local file to Replicate storage → get public URL
  const audioUrl = await uploadToReplicate(filePath, apiKey);

  // HuggingFace token für Diarization (optional, nur wenn allowFallback=true bedeutet erster Versuch)
  const hfToken = config.huggingfaceToken ?? process.env.HUGGINGFACE_TOKEN ?? null;
  const useDiarization = !!hfToken && allowFallback;

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
        diarization: useDiarization,
        ...(useDiarization
          ? {
              huggingface_access_token: hfToken,
              min_speakers: 1,
              max_speakers: 6
            }
          : {})
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
    // Diarization-Fehler → nochmal ohne Diarization versuchen
    if (useDiarization && allowFallback && errMsg.includes("GatedRepo")) {
      console.warn(
        "[REPLICATE] Diarization failed (HuggingFace access) — retrying without diarization"
      );
      return transcribeReplicate(filePath, config, false);
    }
    throw new Error(`Replicate WhisperX failed: ${errMsg}`);
  }
  if (result.status !== "succeeded") {
    throw new Error(`Replicate timeout after ${maxAttempts * 5}s`);
  }

  // Parse output — victor-upmeet/whisperx output format
  const output = result.output;
  let segments: TranscriptSegment[] = [];

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
  } else if (typeof output === "string") {
    segments = [{ speaker: "SPEAKER_00", start: 0, end: 0, text: output }];
  } else {
    console.warn("[REPLICATE] Unexpected output format:", JSON.stringify(output).slice(0, 200));
  }

  console.log(`[REPLICATE] Done: ${segments.length} segments`);
  return { segments, language: output?.language ?? "de", provider: "replicate-whisperx" };
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

  return { segments, language: data.language ?? "de", provider: "openai-whisper" };
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

  return { segments, language: data.language ?? "de", provider: "selfhosted-whisper" };
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
