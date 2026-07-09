import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import type { TranscriptSegment } from "./whisper.js";

export interface SummaryResult {
  title: string;
  narrative: string;
  npcs: Array<{ name: string; description: string; firstMention: string }>;
  quests: Array<{ title: string; status: "new" | "ongoing" | "completed"; notes: string }>;
  loot: Array<{ item: string; foundBy: string }>;
  locations: Array<{ name: string; description: string }>;
  openThreads: string[];
  model: string;
  provider: string;
}

export interface LLMConfig {
  provider: "anthropic" | "gemini" | "openai" | "siliconflow" | "ollama";
  apiKey?: string | undefined;
  model?: string | undefined;
  endpoint?: string | undefined;
}

const DEFAULT_SYSTEM_PROMPT = `Du bist ein Chronist für eine Pen-&-Paper-Rollenspielgruppe (TTRPG/D&D).

Analysiere das folgende Transkript einer Spielsitzung und erstelle:
1. Einen kurzen, aussagekräftigen Titel für diese Session (max. 8 Wörter, im Stil eines Kapitelnamens, spiegelt das zentrale Ereignis/Highlight der Session wider — kein generisches "Session X")
2. Eine narrative Zusammenfassung der Session (3-5 Absätze, epischer Stil, Vergangenheitsform)
3. Alle neuen oder erwähnten NSCs (NPCs) mit Name und kurzer Beschreibung
4. Quests/Aufgaben mit Status (neu/laufend/abgeschlossen)
5. Beute und gefundene Gegenstände
6. Besuchte/erwähnte Orte
7. Offene Fäden (ungeklärte Dinge, Mysterien, nächste Schritte)

Antworte NUR als valides JSON in diesem Format:
{
  "title": "...",
  "narrative": "...",
  "npcs": [{"name": "...", "description": "...", "firstMention": "..."}],
  "quests": [{"title": "...", "status": "new|ongoing|completed", "notes": "..."}],
  "loot": [{"item": "...", "foundBy": "..."}],
  "locations": [{"name": "...", "description": "..."}],
  "openThreads": ["..."]
}`;

export { DEFAULT_SYSTEM_PROMPT };

function buildPrompt(
  segments: TranscriptSegment[],
  speakerMap: Record<string, string>,
  systemPrompt?: string,
  campaignContext?: string
): string {
  const transcript = segments
    .map(s => {
      const name = speakerMap[s.speaker] ?? s.speaker;
      const ts = `[${Math.floor(s.start / 60)}:${String(Math.floor(s.start % 60)).padStart(2, "0")}]`;
      return `${ts} ${name}: ${s.text}`;
    })
    .join("\n");

  const prompt = systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const contextBlock = campaignContext
    ? `\n\nKAMPAGNEN-KONTEXT (vom Spielleiter bereitgestellt):\n${campaignContext}\n`
    : "";

  return `${prompt}${contextBlock}\n\nTRANSKRIPT:\n${transcript}`;
}

async function summarizeAnthropic(segments: TranscriptSegment[], speakerMap: Record<string, string>, config: LLMConfig, systemPrompt?: string, campaignContext?: string): Promise<SummaryResult> {
  const client = new Anthropic({ apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY });
  const model = config.model ?? "claude-opus-4-8";

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: buildPrompt(segments, speakerMap, systemPrompt, campaignContext) }]
  });

  const block = message.content[0];
  const text = block?.type === "text" ? block.text : "";
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  return { ...json, model, provider: "anthropic" };
}

async function summarizeGemini(segments: TranscriptSegment[], speakerMap: Record<string, string>, config: LLMConfig, systemPrompt?: string, campaignContext?: string): Promise<SummaryResult> {
  const client = new GoogleGenAI({ apiKey: config.apiKey ?? process.env.GEMINI_API_KEY ?? "" });
  const model = config.model ?? "gemini-2.5-flash";

  const result = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: buildPrompt(segments, speakerMap, systemPrompt, campaignContext) }] }]
  });

  const candidate = result.candidates?.[0];
  const part = candidate?.content?.parts?.[0];
  const text = (part && "text" in part ? part.text : undefined) ?? "";
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  return { ...json, model, provider: "gemini" };
}

async function summarizeOpenAI(segments: TranscriptSegment[], speakerMap: Record<string, string>, config: LLMConfig, systemPrompt?: string, campaignContext?: string): Promise<SummaryResult> {
  const client = new OpenAI({ apiKey: config.apiKey ?? process.env.OPENAI_API_KEY });
  const model = config.model ?? "gpt-4o";

  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: buildPrompt(segments, speakerMap, systemPrompt, campaignContext) }],
    response_format: { type: "json_object" }
  });

  const text = completion.choices[0]?.message?.content ?? "{}";
  const json = JSON.parse(text);
  return { ...json, model, provider: "openai" };
}

async function summarizeSiliconFlow(segments: TranscriptSegment[], speakerMap: Record<string, string>, config: LLMConfig, systemPrompt?: string, campaignContext?: string): Promise<SummaryResult> {
  const apiKey = config.apiKey ?? process.env.SILICONFLOW_API_KEY;
  const model = config.model ?? "deepseek-ai/DeepSeek-V3";
  const endpoint = config.endpoint ?? "https://api.siliconflow.cn/v1/chat/completions";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: buildPrompt(segments, speakerMap, systemPrompt, campaignContext) }],
      response_format: { type: "json_object" }
    })
  });

  const data = await res.json() as any;
  const text = data.choices?.[0]?.message?.content ?? "{}";
  const json = JSON.parse(text);
  return { ...json, model, provider: "siliconflow" };
}

async function summarizeOllama(segments: TranscriptSegment[], speakerMap: Record<string, string>, config: LLMConfig, systemPrompt?: string, campaignContext?: string): Promise<SummaryResult> {
  const endpoint = config.endpoint ?? "http://localhost:11434/api/generate";
  const model = config.model ?? "llama3.1";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: buildPrompt(segments, speakerMap, systemPrompt, campaignContext), stream: false, format: "json" })
  });

  const data = await res.json() as any;
  const json = JSON.parse(data.response ?? "{}");
  return { ...json, model, provider: "ollama" };
}

export async function generateSummary(
  segments: TranscriptSegment[],
  speakerMap: Record<string, string>,
  config: LLMConfig,
  systemPrompt?: string,
  campaignContext?: string
): Promise<SummaryResult> {
  switch (config.provider) {
    case "anthropic": return summarizeAnthropic(segments, speakerMap, config, systemPrompt, campaignContext);
    case "gemini": return summarizeGemini(segments, speakerMap, config, systemPrompt, campaignContext);
    case "openai": return summarizeOpenAI(segments, speakerMap, config, systemPrompt, campaignContext);
    case "siliconflow": return summarizeSiliconFlow(segments, speakerMap, config, systemPrompt, campaignContext);
    case "ollama": return summarizeOllama(segments, speakerMap, config, systemPrompt, campaignContext);
    default: throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
