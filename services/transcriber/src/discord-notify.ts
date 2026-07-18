/**
 * Postet die fertige Summary als Discord-Message via REST API.
 * Kein discord.js nötig — reines fetch.
 */
import type { SummaryResult } from "./providers/llm.js";

const DISCORD_API = "https://discord.com/api/v10";

function buildSummaryEmbed(summary: SummaryResult, sessionNumber?: number): object {
  const chapterTitle = summary.title?.trim();
  const title = chapterTitle
    ? sessionNumber
      ? `📖 Session #${sessionNumber}: ${chapterTitle}`
      : `📖 ${chapterTitle}`
    : sessionNumber
      ? `📖 Session #${sessionNumber} — Chronik`
      : "📖 Session abgeschlossen";

  const fields: object[] = [];

  if (summary.npcs.length > 0) {
    fields.push({
      name: "🧙 NSCs",
      value: summary.npcs
        .slice(0, 5)
        .map((n) => `**${n.name}** — ${n.description}`)
        .join("\n")
        .slice(0, 1024),
      inline: false
    });
  }

  if (summary.quests.length > 0) {
    const questMap: Record<string, string> = { new: "🆕", ongoing: "⚔️", completed: "✅" };
    fields.push({
      name: "⚔️ Quests",
      value: summary.quests
        .slice(0, 5)
        .map((q) => `${questMap[q.status] ?? "•"} **${q.title}**${q.notes ? ` — ${q.notes}` : ""}`)
        .join("\n")
        .slice(0, 1024),
      inline: false
    });
  }

  if (summary.loot.length > 0) {
    fields.push({
      name: "💰 Beute",
      value: summary.loot
        .slice(0, 8)
        .map((l) => `• ${l.item}${l.foundBy ? ` *(${l.foundBy})*` : ""}`)
        .join("\n")
        .slice(0, 1024),
      inline: true
    });
  }

  if (summary.locations.length > 0) {
    fields.push({
      name: "🗺️ Orte",
      value: summary.locations
        .slice(0, 5)
        .map((l) => `• **${l.name}**`)
        .join("\n")
        .slice(0, 1024),
      inline: true
    });
  }

  if (summary.openThreads.length > 0) {
    fields.push({
      name: "🔮 Offene Fäden",
      value: summary.openThreads
        .slice(0, 5)
        .map((t) => `› ${t}`)
        .join("\n")
        .slice(0, 1024),
      inline: false
    });
  }

  return {
    title,
    description: summary.narrative.slice(0, 4096),
    color: 0x7c3aed, // brand purple
    fields,
    footer: {
      text: `Generiert von ${summary.provider}/${summary.model} · DnD Recorder`,
      icon_url: "https://dndbot.haffelpaff.de/logo-d20.png"
    },
    timestamp: new Date().toISOString()
  };
}

export async function postSummaryToDiscord(params: {
  channelId: string;
  token: string;
  summary: SummaryResult;
  sessionNumber?: number;
  webPanelUrl?: string;
}): Promise<void> {
  const { channelId, token, summary, sessionNumber, webPanelUrl } = params;

  const embed = buildSummaryEmbed(summary, sessionNumber);
  const content = webPanelUrl
    ? `✅ **Session abgeschlossen!** Vollständige Aufzeichnung: ${webPanelUrl}`
    : "✅ **Session abgeschlossen!** Zusammenfassung folgt:";

  const body = JSON.stringify({
    content,
    embeds: [embed]
  });

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[DISCORD NOTIFY] Failed to post to channel ${channelId}: ${res.status} ${text}`);
  } else {
    console.log(`[DISCORD NOTIFY] Summary posted to channel ${channelId}`);
  }
}
