import { PrismaClient } from "@prisma/client";
import { DEFAULT_SYSTEM_PROMPT } from "./dist/providers/llm.js";

const prisma = new PrismaClient();
const SESSION_ID = "cmrdqna5r0009g6s4r2jqohkw";

function reconstructBuildPrompt(segments, speakerMap, systemPrompt, campaignContext) {
  const transcript = segments
    .map(s => {
      const name = speakerMap[s.speaker] ?? s.speaker;
      const ts = `[${Math.floor(s.start / 60)}:${String(Math.floor(s.start % 60)).padStart(2, "0")}]`;
      return `${ts} ${name}: ${s.text}`;
    })
    .join("\n");

  const prompt = systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const imagePromptRequirement = prompt.includes("sessionImagePrompt")
    ? ""
    : `\n\nWICHTIG: Gib AUCH ein Feld "sessionImagePrompt" zurück (String, 1-2 englische Sätze) — ein Bild-Prompt für DALL-E/Flux, der den epischsten Moment der Session mit echten Charakternamen, zentralen Orten und einem Fantasy-Illustrations-Stil einfängt. Kein Text im Bild.`;
  const contextBlock = campaignContext
    ? `\n\nKAMPAGNEN-KONTEXT (vom Spielleiter bereitgestellt):\n${campaignContext}\n`
    : "";

  return `${prompt}${imagePromptRequirement}${contextBlock}\n\nTRANSKRIPT:\n${transcript}`;
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

  let campaignContext;
  if (session.campaignId) {
    const camp = await prisma.campaign.findUnique({ where: { id: session.campaignId } });
    campaignContext = camp?.campaignContext ?? undefined;
  }

  const fullPrompt = reconstructBuildPrompt(merged, speakerMap, settings?.llmSystemPrompt ?? undefined, campaignContext);

  console.log("================ FULL PROMPT SENT TO gpt-4o ================");
  console.log(fullPrompt);
  console.log("================ END PROMPT ================");
  console.log("\n[meta] segments:", merged.length, "| speakerMap:", JSON.stringify(speakerMap), "| hasCampaignContext:", !!campaignContext);
}

main().catch(e=>{ console.error("ERR", e && e.message ? e.message : e); process.exit(1); }).finally(()=>prisma.$disconnect());
