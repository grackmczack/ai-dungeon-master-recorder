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
  sessionImagePrompt?: string;
  model: string;
  provider: string;
}

export interface LLMConfig {
  provider: "anthropic" | "gemini" | "openai" | "siliconflow" | "ollama";
  apiKey?: string | undefined;
  model?: string | undefined;
  endpoint?: string | undefined;
  summaryLanguage?: "de" | "en" | undefined;
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
8. Einen sessionImagePrompt: EIN englischer Bild-Prompt (1-2 Sätze) für ein Bildgenerierungs-Modell (DALL-E/Flux), der den epischsten / dramatischsten / prägnantesten Moment der Session als visuelle Szene einfängt.
   - Verwende ECHTE Charakternamen aus dem Transkript (NICHT "SPEAKER_00" oder ähnliche Diarisierungs-Labels — nutze stattdessen die aufgelösten Sprechernamen).
   - Erwähne zentrale Orte, die in der Szene vorkommen.
   - Beschreibe das visuell markanteste Highlight (z.B. einen Kampf, eine Enthüllung, einen heldenhaften Moment) konkret und atmosphärisch.
   - Schreibe den Prompt AUSSCHLIESSLICH auf ENGLISCH (Bildmodelle arbeiten am besten mit englischen Prompts).
   - Füge einen Fantasy-Illustrations-Stil-Hinweis an (z.B. "epic fantasy illustration, cinematic lighting, detailed tabletop RPG artwork").
   - KEIN Text, keine UI-Elemente, keine Schriftzüge im Bild.

Antworte NUR als valides JSON in diesem Format:
{
  "title": "...",
  "narrative": "...",
  "npcs": [{"name": "...", "description": "...", "firstMention": "..."}],
  "quests": [{"title": "...", "status": "new|ongoing|completed", "notes": "..."}],
  "loot": [{"item": "...", "foundBy": "..."}],
  "locations": [{"name": "...", "description": "..."}],
  "openThreads": ["..."],
  "sessionImagePrompt": "..."
}`;

export { DEFAULT_SYSTEM_PROMPT };

export function buildPrompt(
  segments: TranscriptSegment[],
  speakerMap: Record<string, string>,
  systemPrompt?: string,
  campaignContext?: string,
  summaryLanguage: "de" | "en" = "de"
): string {
  const transcript = segments
    .map((s) => {
      const name = speakerMap[s.speaker] ?? s.speaker;
      const ts = `[${Math.floor(s.start / 60)}:${String(Math.floor(s.start % 60)).padStart(2, "0")}]`;
      return `${ts} ${name}: ${s.text}`;
    })
    .join("\n");

  const prompt = systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  // Falls ein GM-eigener System-Prompt genutzt wird, der sessionImagePrompt nicht erwähnt,
  // hängen wir die Anforderung an, damit das Feld trotzdem im JSON landet.
  const imagePromptRequirement = prompt.includes("sessionImagePrompt")
    ? ""
    : `\n\nWICHTIG: Gib AUCH ein Feld "sessionImagePrompt" zurück (String, 1-2 englische Sätze) — ein Bild-Prompt für DALL-E/Flux, der den epischsten Moment der Session mit echten Charakternamen, zentralen Orten und einem Fantasy-Illustrations-Stil einfängt. Kein Text im Bild.`;
  const contextBlock = campaignContext
    ? `\n\nKAMPAGNEN-KONTEXT (vom Spielleiter bereitgestellt):\n${campaignContext}\n`
    : "";
  const languageName = summaryLanguage === "en" ? "English" : "German";
  const languageRequirement = `\n\nOUTPUT LANGUAGE: Write the title, narrative, NPC, quest, loot, location, and open-thread fields in ${languageName}. Keep sessionImagePrompt in English.`;

  return `${prompt}${imagePromptRequirement}${languageRequirement}${contextBlock}\n\nTRANSKRIPT:\n${transcript}`;
}

async function summarizeAnthropic(
  segments: TranscriptSegment[],
  speakerMap: Record<string, string>,
  config: LLMConfig,
  systemPrompt?: string,
  campaignContext?: string
): Promise<SummaryResult> {
  const client = new Anthropic({ apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY });
  const model = config.model ?? "claude-opus-4-8";

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: buildPrompt(
          segments,
          speakerMap,
          systemPrompt,
          campaignContext,
          config.summaryLanguage
        )
      }
    ]
  });

  const block = message.content[0];
  const text = block?.type === "text" ? block.text : "";
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  return { ...json, model, provider: "anthropic" };
}

async function summarizeGemini(
  segments: TranscriptSegment[],
  speakerMap: Record<string, string>,
  config: LLMConfig,
  systemPrompt?: string,
  campaignContext?: string
): Promise<SummaryResult> {
  const client = new GoogleGenAI({ apiKey: config.apiKey ?? process.env.GEMINI_API_KEY ?? "" });
  const model = config.model ?? "gemini-2.5-flash";

  const result = await client.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: buildPrompt(
              segments,
              speakerMap,
              systemPrompt,
              campaignContext,
              config.summaryLanguage
            )
          }
        ]
      }
    ]
  });

  const candidate = result.candidates?.[0];
  const part = candidate?.content?.parts?.[0];
  const text = (part && "text" in part ? part.text : undefined) ?? "";
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  return { ...json, model, provider: "gemini" };
}

async function summarizeOpenAI(
  segments: TranscriptSegment[],
  speakerMap: Record<string, string>,
  config: LLMConfig,
  systemPrompt?: string,
  campaignContext?: string
): Promise<SummaryResult> {
  const client = new OpenAI({ apiKey: config.apiKey ?? process.env.OPENAI_API_KEY });
  const model = config.model ?? "gpt-4o";

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: buildPrompt(
          segments,
          speakerMap,
          systemPrompt,
          campaignContext,
          config.summaryLanguage
        )
      }
    ],
    response_format: { type: "json_object" }
  });

  const text = completion.choices[0]?.message?.content ?? "{}";
  const json = JSON.parse(text);
  return { ...json, model, provider: "openai" };
}

async function summarizeSiliconFlow(
  segments: TranscriptSegment[],
  speakerMap: Record<string, string>,
  config: LLMConfig,
  systemPrompt?: string,
  campaignContext?: string
): Promise<SummaryResult> {
  const apiKey = config.apiKey ?? process.env.SILICONFLOW_API_KEY;
  const model = config.model ?? "deepseek-ai/DeepSeek-V3";
  const endpoint = config.endpoint ?? "https://api.siliconflow.com/v1/chat/completions";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: buildPrompt(
            segments,
            speakerMap,
            systemPrompt,
            campaignContext,
            config.summaryLanguage
          )
        }
      ],
      max_tokens: 4096
    })
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`SiliconFlow API error ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as any;
  const raw = data.choices?.[0]?.message?.content ?? "{}";

  // Tolerant JSON extraction: try direct parse, then regex extraction
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        json = JSON.parse(match[0]);
      } catch {
        console.warn(
          `[SUMMARY] SiliconFlow returned non-JSON output (first 300 chars): ${raw.slice(0, 300)}`
        );
        json = {};
      }
    } else {
      console.warn(
        `[SUMMARY] SiliconFlow returned no JSON block (first 300 chars): ${raw.slice(0, 300)}`
      );
      json = {};
    }
  }

  return { ...json, model, provider: "siliconflow" };
}

async function summarizeOllama(
  segments: TranscriptSegment[],
  speakerMap: Record<string, string>,
  config: LLMConfig,
  systemPrompt?: string,
  campaignContext?: string
): Promise<SummaryResult> {
  const endpoint = config.endpoint ?? "http://localhost:11434/api/generate";
  const model = config.model ?? "llama3.1";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: buildPrompt(
        segments,
        speakerMap,
        systemPrompt,
        campaignContext,
        config.summaryLanguage
      ),
      stream: false,
      format: "json"
    })
  });

  const data = (await res.json()) as any;
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
  let result: SummaryResult;
  switch (config.provider) {
    case "anthropic":
      result = await summarizeAnthropic(
        segments,
        speakerMap,
        config,
        systemPrompt,
        campaignContext
      );
      break;
    case "gemini":
      result = await summarizeGemini(segments, speakerMap, config, systemPrompt, campaignContext);
      break;
    case "openai":
      result = await summarizeOpenAI(segments, speakerMap, config, systemPrompt, campaignContext);
      break;
    case "siliconflow":
      result = await summarizeSiliconFlow(
        segments,
        speakerMap,
        config,
        systemPrompt,
        campaignContext
      );
      break;
    case "ollama":
      result = await summarizeOllama(segments, speakerMap, config, systemPrompt, campaignContext);
      break;
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }

  // The LLM is now asked to generate sessionImagePrompt directly (capturing the
  // epic highlight). Only fall back to a programmatic prompt if the model omitted it.
  const llmPrompt = result.sessionImagePrompt?.trim();
  if (llmPrompt) {
    result.sessionImagePrompt = llmPrompt.slice(0, 1000);
  } else {
    console.log(`[SUMMARY] ⚠️ LLM did not return sessionImagePrompt — using programmatic fallback`);
    const chars = Object.values(speakerMap).filter(Boolean);
    const charList = chars.length > 0 ? chars.slice(0, 6).join(", ") : "unknown adventurers";
    const locations = (result.locations ?? [])
      .slice(0, 3)
      .map((l) => l.name)
      .filter(Boolean);
    const firstParagraph = (result.narrative ?? "").split("\n\n")[0]?.slice(0, 300) ?? "";

    result.sessionImagePrompt = [
      `Epic fantasy illustration for a D&D session scene.`,
      `Characters present: ${charList}.`,
      locations.length > 0
        ? `Location${locations.length > 1 ? "s" : ""}: ${locations.join(", ")}.`
        : "",
      `Scene: ${firstParagraph}`,
      `Style: Cinematic, dramatic lighting, richly detailed tabletop RPG artwork, wide horizontal composition. No text or UI elements.`
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 1000);
  }

  return result;
}
