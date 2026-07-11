import { PrismaClient } from "@prisma/client";
import { generateSummary } from "./dist/providers/llm.js";

const prisma = new PrismaClient();
const SESSION_ID = "cmrdqna5r0009g6s4r2jqohkw";

function B(v){ return v ? "yes" : "no"; }

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

  const llmConfig = {
    provider: (process.env.LLM_PROVIDER_OVERRIDE ?? settings?.llmProvider ?? "openai"),
    apiKey: process.env.LLM_PROVIDER_OVERRIDE ? (process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY) : (settings?.llmApiKey ?? process.env.OPENAI_API_KEY),
    model: process.env.LLM_MODEL_OVERRIDE ?? settings?.llmModel ?? "gpt-4o",
    endpoint: settings?.llmEndpoint ?? undefined
  };

  let campaignContext;
  if (session.campaignId) {
    const camp = await prisma.campaign.findUnique({ where: { id: session.campaignId } });
    campaignContext = camp?.campaignContext ?? undefined;
  }

  console.log("PROVIDER:", llmConfig.provider, "| MODEL:", llmConfig.model, "| HAS_API_KEY:", B(llmConfig.apiKey), "| SYSTEM_PROMPT_SET:", B(settings?.llmSystemPrompt), "| OVERRIDE:", B(process.env.LLM_PROVIDER_OVERRIDE));
  console.log("SEGMENTS:", merged.length, "| SPEAKERMAP:", JSON.stringify(speakerMap));

  const summary = await generateSummary(merged, speakerMap, llmConfig, settings?.llmSystemPrompt ?? undefined, campaignContext);

  console.log("=== RESULT ===");
  console.log("TITLE:", summary.title);
  console.log("SESSION_IMAGE_PROMPT:", summary.sessionImagePrompt);
  console.log("LOCATIONS:", JSON.stringify((summary.locations||[]).slice(0,3).map(l=>l.name)));
  console.log("FIRST_PARAGRAPH:", (summary.narrative || "").split(String.fromCharCode(10,10))[0]?.slice(0,300));
}

main().catch(e=>{ console.error("ERR", e && e.message ? e.message : e); process.exit(1); }).finally(()=>prisma.$disconnect());
