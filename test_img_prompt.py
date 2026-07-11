#!/usr/bin/env python3
import json, os, sys

api_key = os.environ.get("SILICONFLOW_API_KEY", "")
if not api_key:
    print("ERROR: No API key")
    sys.exit(1)

# EXACT system prompt from deployed code
SYSTEM_PROMPT = """Du bist ein Chronist für eine Pen-&-Paper-Rollenspielgruppe (TTRPG/D&D).

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
}"""

# Transcript resolved with character names (exactly as buildPrompt would do)
TRANSCRIPT = """[0:00] Arkele: Und damit starten wir unsere erste aufgenommene Runde.
[0:03] Arkele: So, schauen wir mal.
[0:05] Gute Fee: Ich bin Akele und habe meinen Zauberstab bei mir, einen Waldelfenstab, den ich bekommen habe beim letzten Monsterkampf.
[0:14] Gute Fee: Und bei mir ist die gute Fee.
[0:17] Arkele: Die stellt sich jetzt mal selber vor.
[0:23] Gute Fee: Hallo, ich bin die gute Fee und möchte sagen, ich habe tolle Zaubersprüche.
[0:30] Gute Fee: Ich bin immer an der Seite und meine Miezekatze, die hier gerade bei mir ist, nervt mich ohne Ende und will rumschmusen.
[0:39] Gute Fee: Aber das geht nicht, weil ich einen auf dem Technik-Kabel.
[0:44] Gute Fee: Dann leg dich doch hin, Katze.
[0:48] Gute Fee: Oder sei meine Begleiterin.
[0:52] Gute Fee: Eine Herausforderung des Schicksals.
[0:56] Arkele: Ich komme aus dem hohen Norden und bin bereit für neue Abenteuer. Und ich bin außerdem bereit für viele neue Abenteuer.
[1:09] Gute Fee: Das freut mich zu hören.
[1:11] Gute Fee: Und wo wollen wir hingehen?
[1:13] Gute Fee: Vielleicht in den Süden und einen großen Drachen bekämpfen? Was hältst du davon?
[1:19] Gute Fee: Oh ja, Drachen bekämpfen ist toll. Da bin ich auf jeden Fall dabei.
[1:24] Arkele: Lasst uns loslegen.
[1:26] Arkele: Wir können auf meinen Besen dorthin fliegen.
[1:29] Arkele: Ich steige mit auf und wir können losfliegen.
[1:33] Arkele: Dann aufgesessen und abracadabra, wir steigen in die Lüfte und fliegen zu den großen Drachen.
[1:40] Arkele: Oh, der Drache.
[1:42] Arkele: Moment, ich schieße ihn aus der Luft ab.
[1:46] Gute Fee: Sesam verschwinde und ein großer Ball kommt empor und fliegt auf den Drachen, der direkt zu Boden geht.
[1:56] Gute Fee: Oh, wir haben den Drachen schon besiegt. Wie toll. Dann ist das Abenteuer ja schon fast zu Ende.
[2:05] Gute Fee: Lass uns runterfliegen zum Drachen und noch ein bisschen Beute machen.
[2:10] Arkele: Ich lande mal.
[2:12] Arkele: Ja, das war einfach. Manchmal geht es halt schnell.
[2:16] Gute Fee: Dann lass uns ein paar Drachenschuppen nehmen und dann fliegen wir wieder zurück.
[2:22] Arkele: Bis zum nächsten Abenteuer.
[2:24] Arkele: Ja, ich habe auch ein paar Drachenschuppen eingesteckt.
[2:29] Arkele: Danke, Akele. Das war echt super mit dir."""

# The user message = system prompt + transcript (EXACTLY what buildPrompt does)
USER_MESSAGE = SYSTEM_PROMPT + "\n\nTRANSKRIPT:\n" + TRANSCRIPT

import urllib.request

body = json.dumps({
    "model": "deepseek-ai/DeepSeek-V3",
    "messages": [
        {"role": "user", "content": USER_MESSAGE}
    ],
    "response_format": {"type": "json_object"}
}).encode("utf-8")

req = urllib.request.Request(
    "https://api.siliconflow.cn/v1/chat/completions",
    data=body,
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
)

resp = urllib.request.urlopen(req, timeout=120)
data = json.loads(resp.read().decode("utf-8"))

print("=== RAW RESPONSE ===")
print(json.dumps(data, indent=2, ensure_ascii=False))
print()

choice = data.get("choices", [{}])[0]
content = choice.get("message", {}).get("content", "{}")
print("=== CONTENT ===")
print(content)
print()

try:
    parsed = json.loads(content)
    print("=== PARSED JSON ===")
    print(json.dumps(parsed, indent=2, ensure_ascii=False))
    print()
    
    img_prompt = parsed.get("sessionImagePrompt", "MISSING")
    print("=== sessionImagePrompt ===")
    print(img_prompt)
    
    # Validation checks
    print()
    print("=== VALIDATION ===")
    has_speaker_labels = any(tag in img_prompt for tag in ["SPEAKER_00", "SPEAKER_01", "SPEAKER"])
    print(f"Contains SPEAKER labels? {has_speaker_labels} {'❌ BAD' if has_speaker_labels else '✅ OK'}")
    has_real_names = "Arkele" in img_prompt or "Akele" in img_prompt or "Fee" in img_prompt
    print(f"Contains real character names? {has_real_names} {'✅ OK' if has_real_names else '❌ BAD'}")
    is_english = not any(word in img_prompt.lower() for word in ["der", "die", "das", "und", "ein", "eine", "mit", "auf", "von"])
    print(f"Likely English? {is_english} {'✅ OK' if is_english else '⚠️ CHECK'}")
    has_style = any(term in img_prompt.lower() for term in ["fantasy", "illustration", "artwork", "cinematic", "epic", "rpg"])
    print(f"Has style hint? {has_style} {'✅ OK' if has_style else '❌ BAD'}")
    
except json.JSONDecodeError as e:
    print(f"JSON parse error: {e}")