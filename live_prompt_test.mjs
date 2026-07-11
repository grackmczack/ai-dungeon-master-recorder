import { PrismaClient } from "@prisma/client";
import { DEFAULT_SYSTEM_PROMPT } from "./dist/providers/llm.js";
import Anthropic from "@anthropic-ai/sdk";

const prisma = new PrismaClient();
const SESSION_ID = "cmrdqna5r0009g6s4r2jqohkw";

function buildTranscript(segments, speakerMap) {
  return segments
    .map(s => {
      const name = speakerMap[s.speaker] ?? s.speaker;
      const ts = `[${Math.floor(s.start / 60)}:${String(Math.floor(s.start % 60)).padStart(2, "0")}]`;
      return `${ts} ${name}: ${s.text}`;
    })
    .join("\n");
}

function robustParse(text) {
  // Strip invalid control chars (0x00-0x1F except \n \r \t) that break JSON.parse
  const cleaned = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no json object found");
  return JSON.parse(m[0]);
}

async function main() {
  const session = await prisma.session.findUnique({ where: { id: SESSION_ID } });
  const group = await prisma.group.findFirst({ where: { discordGuildId: session.discordGuildId } });
  const settings = await prisma.groupSettings.findFirst({ where: { groupId: group.id } });

  const transcript = await prisma.transcript.findUnique({ where: { sessionId: SESSION_ID } });
  const raw = transcript.rawJson;
  const chunks = raw.chunks ?? [];
  let timeOffset = 0;
  const merged = [];
  for (const c of [...chunks].sort((a,b)=>(a.chunkIndex??0)-(b.chunkIndex??0))) {
    for (const seg of c.segments ?? []) merged.push({ ...seg, start: seg.start + timeOffset, end: seg.end + timeOffset });
    timeOffset += c.durationSeconds ?? 0;
  }

  const speakerMaps = await prisma.speakerMap.findMany({ where: { sessionId: SESSION_ID } });
  const speakerMap = {};
  for (const sm of speakerMaps) {
    const key = sm.diarizationLabel ?? sm.discordUserId;
    if (!key) continue;
    speakerMap[key] = sm.characterName ?? sm.playerName ?? sm.discordName;
  }

  const prompt = settings?.llmSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const transcriptText = buildTranscript(merged, speakerMap);
  const userContent = `${prompt}\n\nTRANSKRIPT:\n${transcriptText}`;

  console.log("CALLING:", "anthropic/claude-opus-4-8", "| SPEAKERMAP:", JSON.stringify(speakerMap));

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    messages: [{ role: "user", content: userContent }]
  });
  const block = message.content[0];
  const text = block?.type === "text" ? block.text : "";

  const json = robustParse(text);
  console.log("=== LIVE GENERATED (real claude-opus-4-8 call) ===");
  console.log("TITLE:", json.title);
  console.log("SESSION_IMAGE_PROMPT:", json.sessionImagePrompt);
  console.log("LOCATIONS:", JSON.stringify((json.locations||[]).slice(0,3).map(l=>l.name)));
  console.log("NARRATIVE_FIRST_PARA:", (json.narrative||"").split(/\n\n/)[0]?.slice(0,400));
}

main().catch(e=>{ console.error("ERR", e && e.message ? e.message : e); process.exit(1); }).finally(()=>prisma.$disconnect());
