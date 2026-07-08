import FormData from "form-data";
import { createReadStream } from "node:fs";
import fetch from "node-fetch";

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
}

// --- Replicate WhisperX ---
async function transcribeReplicate(filePath: string, config: WhisperConfig): Promise<TranscriptResult> {
  const apiKey = config.apiKey ?? process.env.REPLICATE_API_KEY;
  if (!apiKey) throw new Error("REPLICATE_API_KEY missing");

  // Upload audio file to get a URL first (via tmpfiles or direct base64 for small files)
  // Replicate victor-upmeet/whisperx needs a public URL
  // For now: use OpenAI as fallback if no public URL available
  // TODO: implement file upload to temp storage

  // Start prediction
  const startRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "victor-upmeet/whisperx:84d2ad2d6194fe98efde5c9d0a398e911dddd314a61f2e8a0b2f13e9d1c3e5d5",
      input: {
        audio: filePath, // needs public URL in production
        language: "de",
        diarize: true,
        min_speakers: 1,
        max_speakers: 6
      }
    })
  });

  const prediction = await startRes.json() as any;
  let result = prediction;

  // Poll until done
  while (result.status !== "succeeded" && result.status !== "failed") {
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
      headers: { Authorization: `Token ${apiKey}` }
    });
    result = await pollRes.json() as any;
  }

  if (result.status === "failed") throw new Error(`Replicate failed: ${result.error}`);

  const segments: TranscriptSegment[] = (result.output?.segments ?? []).map((s: any) => ({
    speaker: s.speaker ?? "SPEAKER_00",
    start: s.start ?? 0,
    end: s.end ?? 0,
    text: s.text?.trim() ?? ""
  }));

  return { segments, language: result.output?.language ?? "de", provider: "replicate-whisperx" };
}

// --- OpenAI Whisper ---
async function transcribeOpenAI(filePath: string, config: WhisperConfig): Promise<TranscriptResult> {
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const form = new FormData();
  form.append("file", createReadStream(filePath));
  form.append("model", "whisper-1");
  form.append("language", "de");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
    body: form
  });

  if (!res.ok) throw new Error(`OpenAI Whisper error: ${res.status} ${await res.text()}`);
  const data = await res.json() as any;

  // OpenAI whisper-1 doesn't do diarization — all segments get SPEAKER_00
  const segments: TranscriptSegment[] = (data.segments ?? []).map((s: any, i: number) => ({
    speaker: "SPEAKER_00",
    start: s.start ?? 0,
    end: s.end ?? 0,
    text: s.text?.trim() ?? ""
  }));

  return { segments, language: data.language ?? "de", provider: "openai-whisper" };
}

// --- Self-hosted (OpenAI-compatible endpoint) ---
async function transcribeSelfhosted(filePath: string, config: WhisperConfig): Promise<TranscriptResult> {
  const endpoint = config.endpoint ?? "http://localhost:9000/v1/audio/transcriptions";
  const apiKey = config.apiKey ?? "local";

  const form = new FormData();
  form.append("file", createReadStream(filePath));
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
    body: form
  });

  if (!res.ok) throw new Error(`Self-hosted Whisper error: ${res.status}`);
  const data = await res.json() as any;

  const segments: TranscriptSegment[] = (data.segments ?? []).map((s: any) => ({
    speaker: s.speaker ?? "SPEAKER_00",
    start: s.start ?? 0,
    end: s.end ?? 0,
    text: s.text?.trim() ?? ""
  }));

  return { segments, language: data.language ?? "de", provider: "selfhosted-whisper" };
}

export async function transcribeAudio(filePath: string, config: WhisperConfig): Promise<TranscriptResult> {
  switch (config.provider) {
    case "replicate": return transcribeReplicate(filePath, config);
    case "openai": return transcribeOpenAI(filePath, config);
    case "selfhosted": return transcribeSelfhosted(filePath, config);
    default: throw new Error(`Unknown whisper provider: ${config.provider}`);
  }
}
