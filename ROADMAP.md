# DND Recorder Roadmap

---

## v0 -- aktuell in Arbeit / fertig

### Offen / Geplant
- [ ] Settings: Prompt-Feld (aktuell genutzter System-Prompt fuer LLM eintragbar)
- [ ] Settings: Kampagnen-Kontext-Feld (DM kann allgemeine Kampagnen-Infos hinterlegen -> geht als Kontext an LLM)
- [ ] Struktur: Kampagne ist Oberebene (nicht Gruppe->Kampagne, sondern Kampagne direkt mit Mitglieder-Verwaltung)
- [ ] UI: Status-Widget live (zeigt ob gerade aufgenommen / transkribiert / summarized wird)
- [ ] UI: Tagebuch-Tab in Kampagne (alle Session-Summaries chronologisch untereinander)
- [ ] Mitglieder: Discord-Username <-> Charaktername Zuordnung direkt in Kampagne (nicht nur per Session)

---

## v1 -- Hauptversion (aktuell in Planung)

### Kampagnenansicht -- Mitgliederbereich

- [x] **Kein Login fuer Mitglieder** (v1). Mitglieder sind reine Entitaeten, die vom DM verwaltet werden (`userId` in `GroupMembership` ist optional).
  - Login/Selbstverwaltung fuer Spieler ist v2.
- [x] **CRUD-Operationen** vollstaendig: erstellen (direkt, kein Email-Invite mehr), bearbeiten, pausieren, loeschen (soft-delete via `leftAt`), aktivieren.
- [x] **Mitglieder-Eigenschaften:**
  - `discordName` -- Discord-Handle des Spielers
  - `characterName` -- Name des Charakters in dieser Kampagne
  - `partyRole` -- Rolle (z. B. Tank, Healer, Support, DPS, Scout -- frei definierbar)
  - `avatarUrl` -- Gesichtsbild / Avatar-Upload (pro Mitglied), Endpoint `POST .../members/:id/avatar`
  - `characterSheetUrl` -- PDF-Upload, Endpoint `POST .../members/:id/character-sheet`
- [x] **Hinweis Datenmodell:** Ein `discordName` (realer User) kann in verschiedenen Kampagnen unterschiedliche Charaktere haben. Zuordnung liegt pro `GroupMembership`, nicht global am User.

**Status:** Backend-Routen + Frontend-UI (Mitglieder-Tab mit Formular, Edit-Modal, Avatar-/PDF-Upload) implementiert. Noch offen: Deployment/DB-Migration auf Produktivserver (`prisma db push`), End-to-End-Test mit echten Uploads.

### Kampagnen-Hintergrundbild

- [ ] DM kann ein Bild fuer die Kampagne hinterlegen.
- [ ] Wird als Hintergrundbild im Kampagnen-Dashboard angezeigt.
- [ ] Parallax-Effekt beim Scrollen in der Kampagnen-Detailansicht.
- [ ] Dient auch als gestalterische Grundlage fuer die Session-Uebersicht innerhalb der Kampagne.

### Session-Bild generieren (Replicate)

- [ ] Manueller Button in der Session-Ansicht: "Session-Bild generieren".
- [ ] Nutzt Replicate -> Qwen Image Edit Modell.
- [ ] Statusanzeige waehrend der Generierung (Spinner / Fortschrittsanzeige).
- [ ] Charakter-Zuordnung muss sauber stimmen, damit die Aktionen im Bild die Helden korrekt widerspiegeln.
  - Charakternamen + Rollen + Avatare fliessen in den Bild-Prompt ein.
  - Session-Hoehepunkt aus Summary wird als Bildkontext genutzt.

### Quest-Wiki (neues Feature)

- [ ] Neuer Tab in der Kampagnen-Ansicht: **"Quest-Wiki"** -- zwischen "Tagebuch" und "Mitglieder".
- [ ] Konzept: "Living Lore" -- wachsende Wissensdatenbank der Kampagne.
- [ ] Entitaeten:
  - **Quests** -- Status: entdeckt / aktiv / abgeschlossen / fehlgeschlagen
  - **NSCs** -- waechst mit jeder Session, wird angereichert
  - **Orte** -- verknuepft mit Sessions
  - **Beute & Items** -- wer hat was, noch relevant?
  - **Offene Faeden** -- das Herzstuck (Faden aus Session 3 kann in Session 8 geloest werden)
- [ ] Datenmodell: `CampaignThread`, `CampaignNPC`, `CampaignLocation`, `CampaignQuest` (siehe Datenmodell-Referenz unten)

**Implementierungs-Staffelung (in dieser Reihenfolge):**

1. **Stufe 1 -- Aggregation (kein neuer LLM-Call):**
   - NSC/Quest/Ort-Browser entsteht automatisch aus vorhandenen Session-Summaries
   - Nur Parsing + Aggregation, keine neue LLM-Arbeit
   - Sofort nuetzlich, minimaler Aufwand

2. **Stufe 2 -- Manuelle Faeden (UI-first):**
   - DM kann offene Faeden manuell anlegen und mit Sessions verknuepfen
   - Faden als "geloest durch Session X" markierbar per Dropdown
   - Kein LLM noetig, pure UI-Arbeit

3. **Stufe 3 -- LLM-Reconciliation (automatisch):**
   - Zweiter LLM-Pass nach jeder Session
   - Input: aktuelle Kampagnen-Wissensbasis (JSON) + neue Session-Summary
   - Output: strukturierte Deltas (neue Entitaeten, Status-Updates, Faden-Verknuepfungen)
   - LLM schlaegt vor, DM bestaetigt oder korrigiert
   - pgvector (PostgreSQL Extension) fuer Embeddings pro Faden
     -> loest das Skalierungsproblem bei langen Kampagnen (50+ Sessions)
     -> semantische Aehnlichkeitssuche statt gesamten Kontext laden

### Discord Bot -- Erweiterungen

- [ ] Nach der Uebersetzungs-Post: auch Beute, NSCs, Orte, etc. posten (strukturierter Output pro Kategorie).
- [ ] Inhalte kommen aus dem Quest-Wiki / Reconciliation-Pass der jeweiligen Session.

### Session-Ansicht -- Verbesserungen

- [x] **Titel aenderbar** -- DM kann Titel manuell bearbeiten (`PATCH /sessions/:id`, Edit-UI im Header).
- [ ] **Titel wird mitgeneriert** -- beim LLM-Call wird direkt ein aussagekraeftiger Titel mit generiert, der die Session widerspiegelt (kein generischer Default-Name). *(noch offen: Prompt-Erweiterung im transcriber-Service)*
- [x] **MP3-Dateien verlinken** im Summary-Bereich -- direkte Links zu den Audio-Aufnahmen der Session (`/uploads/recordings/:filename` statisch ausgeliefert).
- [x] **Sprecher-Tab:**
  - Manuelle Zuordnung: Diarization-Label (z.B. SPEAKER_00) aus dem Transkript werden mit Namen versehen.
  - Felder: `diarizationLabel`, `discordName`, `characterName`, `playerName`.
  - Beruecksichtigung: Ein Discord-User kann in verschiedenen Kampagnen unterschiedliche Charaktere haben.
  - Ziel erreicht: Zuordnung zeigt jetzt Transkript-Ausschnitt pro Label zur Orientierung.

### Sprecher-Zuordnung -- Problem geloest (Zwischenschritt)

**Problem:** Im Transkript stehen nur `SPEAKER_00`, `SPEAKER_01` etc. -- keine Namen. Manuelle Zuordnung war fehleranfaellig, weil es gar keine UI-Verbindung zwischen Label und Zuordnung gab (Bug: `getSpeakerName()` matchte fälschlich gegen `discordUserId` statt gegen das Label).

**Umgesetzt (Zwischenschritt / Option C erweitert):**
- [x] Neues Feld `SpeakerMap.diarizationLabel` -- verknüpft das anonyme Label mit der echten Zuordnung.
- [x] Neuer Endpoint `GET /sessions/:id/diarization-labels` -- listet alle im Transkript vorkommenden Labels + Text-Ausschnitt + Segment-Anzahl.
- [x] Sprecher-Tab zeigt jetzt: Ausschnitt aus dem, was jedes Label gesagt hat, direkt über der Zuordnungstabelle + Dropdown zur Label-Auswahl je Discord-User.
- [x] Bugfix: Transkript-Anzeige nutzt jetzt korrekt `diarizationLabel` zum Auflösen der Sprechernamen (vorher lief das ins Leere, weil Label und `discordUserId` nie identisch sind).

**Noch offen (langfristiger Fix):**
- **Option A -- Discord-Audio-Stream:** Beim Aufnehmen ueber den Discord-Bot den Audio-Stream pro User getrennt aufnehmen (Discord sendet pro User einen eigenen Audio-Stream). Dann ist die Zuordnung trivial: User-ID -> Charaktername, kein manuelles Raten mehr nötig.
  - **Wichtiger Fund beim Code-Review:** `apps/discord-recorder/src/services/voice-recorder.service.ts` empfängt technisch bereits pro-User-Audio-Streams (Klasse `ParticipantAudio`, ein Stream je `userId`) -- diese werden aber aktuell in `writeMixedFrame()` zu einer einzigen Mono-Datei zusammengemischt, bevor sie auf die Platte geschrieben werden. Das heisst: Die Rohdaten pro Sprecher sind zum Aufnahmezeitpunkt schon da, sie werden nur verworfen.
  - **Konkreter Implementierungsweg fuer Option A:** Statt (oder zusaetzlich zu) `writeMixedFrame()` pro `ParticipantAudio` einen eigenen Chunk-Stream mit userId-Tag schreiben, oder zumindest Zeitfenster protokollieren, wann welcher userId aktiv Audio gesendet hat (Start/Stop-Timestamps). Diese Timeline dann im transcriber mit den WhisperX-Diarization-Segmenten abgleichen (Zeit-Overlap-Match) -> automatische Label-zu-User-Zuordnung statt manuellem Raten.
  - Aufwand dadurch geringer als urspruenglich angenommen -- kein Bot-Rewrite noetig, nur Erweiterung der bestehenden Aufnahme-Pipeline.
  - Das ist weiterhin der eigentliche Root-Fix -- die jetzige Loesung (Diarization-Label + Transkript-Ausschnitt anzeigen) ist ein deutlich verbesserter Workaround, kein Ersatz.

---

## Multi-User / Admin (v1-Vorbereitung)

- [ ] **Super-Admin (DM-Verwaltung):**
  - Userverwaltung fuer alle DMs
  - Uebersicht: welcher DM hat welche Kampagnen
  - DM-Accounts anlegen / deaktivieren
- [ ] **DM-Registrierung:**
  - DMs koennen sich registrieren
  - DM kann Discord-Bot in seinen Server einladen (OAuth-Flow oder Invite-Link)
- [ ] **Profilbereich fuer DMs:**
  - Eigenes Profil verwalten (Name, Discord-Verbindung, Avatar)
  - Bot-Einstellungen pro Server/Kampagne

---

## Dokumentationsbereich (v1 -- Geruest)

Neuer Bereich im Top-Menue verlinkt. Technisch einfaches Erklaerungslevel, dezente D&D-Metaphern, kein Fachjargon.
Noch nicht ausformuliert -- nur Struktur anlegen.

```
Dokumentation/
+-- Erste Schritte (Installationsanleitung)
+-- Das Abenteuer beginnt -- Benutzerhandbuch
|   +-- Dashboard-Uebersicht
|   +-- Kampagne anlegen & verwalten
|   +-- Mitglieder verwalten
|   +-- Sessions & Aufnahmen
|   +-- Tagebuch & Summaries
|   +-- Quest-Wiki
+-- Der Bot -- Dein Bote
|   +-- Bot einladen
|   +-- Bot-Befehle & Funktionen
|   +-- Was postet der Bot wann?
+-- Der Workflow -- Von der Aufnahme zur Summary
|   +-- Schritt 1: Aufnahme starten
|   +-- Schritt 2: Transkription
|   +-- Schritt 3: Summary & Titel generieren
|   +-- Schritt 4: Sprecher zuordnen
|   +-- Schritt 5: Im Discord posten
+-- Felder & ihre Wirkung
|   +-- Kampagnen-Kontext
|   +-- System-Prompt
|   +-- Charakter-Sheet
+-- Haeufige Fragen (FAQ)
```

---

## v2 -- Ausblick

- [ ] Spieler koennen sich selbst einloggen und eigenen Charakter-Bereich einsehen
- [ ] Oeffentlich teilbare Kampagnen-Uebersicht (Share-Link)
- [ ] Kampagnen-Wiki-Export (PDF / Markdown)
- [ ] Pgvector / semantische Aehnlichkeitssuche fuer offene Faeden bei langen Kampagnen
- [ ] Mobile-optimierte Ansicht fuer Spieler

---

## Datenmodell-Referenz (v1)

```
CampaignMember
  id, campaignId
  discordName       // realer User-Handle
  characterName     // Charakter in dieser Kampagne
  role              // z.B. "Tank", "Healer", frei definierbar
  avatarUrl
  characterSheetUrl // PDF
  status: active / paused / deleted

CampaignThread (offener Faden)
  id, campaignId, title, description
  status: open / resolved / abandoned
  openedInSessionId, resolvedInSessionId
  linkedThreadIds[]

CampaignNPC
  id, campaignId, name, description
  firstSeenSessionId, lastSeenSessionId
  status: active / dead / unknown / ally / enemy
  sessionIds[]

CampaignLocation
  id, campaignId, name, description
  sessionIds[]

CampaignQuest
  id, campaignId, title, description
  status: discovered / active / completed / failed
  openedInSessionId, resolvedInSessionId
  rewardItems[]
```
