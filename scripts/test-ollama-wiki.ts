import { PrismaClient } from "@prisma/client";

/**
 * Test-Script: Ollama Quest-Wiki Extraction
 *
 * Zieht sich eine Session Summary aus der lokalen Datenbank und schickt sie an
 * das lokale Ollama-Modell (z.B. qwen2.5:7b).
 *
 * Ausführung (im dnd-recorder Root-Verzeichnis):
 * npx ts-node scripts/test-ollama-wiki.ts
 */

const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const MODEL = "qwen2.5:7b";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        "postgresql://ai_dungeon:geheim@localhost:5432/ai_dungeon_master_recorder"
    }
  }
});

async function main() {
  console.log("Suche nach einer Session-Summary in der Datenbank...");

  const summaryRecord = await prisma.summary.findFirst({
    where: {
      narrative: { not: "" }
    }
  });

  if (!summaryRecord) {
    console.error("Keine Session-Summary gefunden. Bitte erstelle zuerst eine Session!");
    process.exit(1);
  }

  console.log(`\n✅ Summary gefunden (Session-ID: ${summaryRecord.sessionId})`);
  console.log("Sende Extraktions-Prompt an Ollama...");

  const systemPrompt = `
Du bist ein Dungeons & Dragons Archivar.
Analysiere die folgende Session-Zusammenfassung und extrahiere alle relevanten Entitäten.
Antworte AUSSCHLIESSLICH im folgenden JSON-Format ohne Markdown-Codeblöcke:
{
  "npcs": [{ "name": "...", "description": "...", "firstMention": "Session X" }],
  "locations": [{ "name": "...", "description": "..." }],
  "quests": [{ "title": "...", "status": "discovered|active|completed", "notes": "..." }],
  "loot": [{ "item": "...", "foundBy": "Charaktername" }]
}`;

  // Wir nutzen die erzählerische Zusammenfassung (narrative) als Input-Text
  const userPrompt = `Hier ist die Zusammenfassung der Session:\n\n${summaryRecord.narrative}`;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        stream: false,
        format: "json"
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("\n✅ Antwort von Ollama erhalten:\n");
    console.log(data.message.content);
  } catch (error) {
    console.error("\n❌ Fehler beim Aufruf von Ollama:", error);
    console.log("Läuft Ollama auf 127.0.0.1:11434 und ist das Modell qwen2.5:7b installiert?");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
