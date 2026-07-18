# DnD Recorder Roadmap

---

## v0 -- aktuell in Arbeit / fertig

### Offen / Geplant
- [x] Settings: Prompt-Feld (aktuell genutzter System-Prompt fuer LLM eintragbar)
- [x] Settings: Kampagnen-Kontext-Feld (DM kann allgemeine Kampagnen-Infos hinterlegen -> geht als Kontext an LLM)
- [x] Struktur: Kampagne ist Oberebene mit direkter Mitglieder-, Session- und Serververwaltung
- [ ] UI: Status-Widget live (zeigt ob gerade aufgenommen / transkribiert / summarized wird)
- [ ] UI: Tagebuch-Tab in Kampagne (alle Session-Summaries chronologisch untereinander)
- [ ] Mitglieder: Discord-Username <-> Charaktername Zuordnung direkt in Kampagne (nicht nur per Session)

---

## v1 -- Hauptversion (aktuell in Planung)

### Kampagnenansicht -- Mitgliederbereich

- [x] **Kein Login fuer Mitglieder** (v1). Mitglieder sind reine Entitaeten, die vom DM verwaltet werden (`userId` in `CampaignMembership` ist optional).
  - Login/Selbstverwaltung fuer Spieler ist v2.
- [x] **CRUD-Operationen** vollstaendig: erstellen (direkt, kein Email-Invite mehr), bearbeiten, pausieren, loeschen (soft-delete via `leftAt`), aktivieren.
- [x] **Mitglieder-Eigenschaften:**
  - `discordName` -- Discord-Handle des Spielers
  - `characterName` -- Name des Charakters in dieser Kampagne
  - `partyRole` -- Rolle (z. B. Tank, Healer, Support, DPS, Scout -- frei definierbar)
  - `avatarUrl` -- Gesichtsbild / Avatar-Upload (pro Mitglied), Endpoint `POST .../members/:id/avatar`
  - `characterSheetUrl` -- PDF-Upload, Endpoint `POST .../members/:id/character-sheet`
- [x] **Hinweis Datenmodell:** Ein `discordName` (realer User) kann in verschiedenen Kampagnen unterschiedliche Charaktere haben. Zuordnung liegt pro `CampaignMembership`, nicht global am User.

**Status:** Backend-Routen + Frontend-UI (Mitglieder-Tab mit Formular, Edit-Modal, Avatar-/PDF-Upload) implementiert **und live deployed** (Stand 09.07.2026). Noch offen: End-to-End-Test mit echten Uploads durch den DM direkt im Browser.

### Kampagnen-Hintergrundbild

- [x] DM kann ein Bild fuer die Kampagne hinterlegen (`Campaign.backgroundImageUrl`, Upload-Endpoint `POST /campaigns/:id/background`, Generate-Endpoint `POST /campaigns/:id/generate-background`, Entfernen via `DELETE`).
- [x] Wird als Hintergrundbild im Kampagnen-Dashboard angezeigt (Header-Banner ueber jeder Kampagnen-Karte in der Sessions-Ansicht).
- [x] Parallax-Effekt beim Scrollen -- eigene Svelte-Actions `$lib/actions/parallax.ts` (`parallax` fuer Kachel-Hintergruende, `parallaxFixed` fuer seitenweite fixed Hintergruende).
- [x] Durchgaengiger Seiten-Hintergrund: Kampagnen-Hintergrundbild erscheint auch auf der Session-Detailseite als seitenweiter Parallax-Hintergrund (konsistentes Raumerlebnis).

### Session-Bild-Generierung — teilweise umgesetzt 🚧 (v1, 10.07.2026)

- [x] `sessionImagePrompt`-Feld: LLM-Summarizer (DeepSeek V3 via SiliconFlow) generiert englischen Image-Prompt aus der Session-Erzählung — gespeichert in `Summary.sessionImagePrompt`
- [x] `sessionImageModel` / `sessionImageProvider` in `CampaignSettings` — konfigurierbar vom DM
- [x] Settings-UI überarbeitet: API-Keys von Provider/Model-Selectoren getrennt, eigene Sektionen
- [x] DB-Migrationen für neue Felder (`sessionImagePrompt`, `sessionImageModel`, `sessionImageProvider`)
- [x] Avatar-Bild-Feed: Charakter-Avatare als img2img-Referenz an Modelle wie `qwen-image-edit-plus` übergeben
- [x] Frontend: Session-Bild generieren und neu generieren; Einstellungen platzsparend aufklappbar
- [x] Modell-spezifische Input-Schemata (Qwen mit Avatar-Referenzen, Flux Schnell nur Text-Prompt)
- [x] Kampagnen- und Sessionbilder durchgehend im 4:3-Format

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

- [x] Nach der Uebersetzungs-Post: auch Beute, NSCs, Orte, etc. posten (strukturierter Output pro Kategorie) -- bereits vorhanden in `discord-notify.ts` (`buildSummaryEmbed`, Felder fuer NSCs/Quests/Beute/Orte/Offene Faeden). Session-Titel wird jetzt zusaetzlich im Embed-Titel angezeigt.
- [x] Mandantenfaehige `CampaignDiscordBinding`: mehrere Server je DM, mehrere Kampagnen je Server sowie feste Voice-/Summary-Channels.
- [x] `/kampagne verbinden|aktivieren|deaktivieren|status` und Kampagnen-Autocomplete in `/record`.
- [x] Eindeutiges Routing: explizite Kampagne → Voice-Bindung → einzige aktive Kampagne; kein stiller "neueste Kampagne"-Fallback.
- [x] Session wird beim Aufnahmestart als `RECORDING` angelegt und beim Stoppen atomar in `PROCESSING` ueberfuehrt.
- [ ] Inhalte kuenftig aus dem Quest-Wiki / Reconciliation-Pass ziehen statt nur aus der Einzel-Session-Summary (sobald Quest-Wiki existiert).

### Session-Ansicht -- Verbesserungen

- [x] **Titel aenderbar** -- DM kann Titel manuell bearbeiten (`PATCH /sessions/:id`, Edit-UI im Header).
- [x] **Titel wird mitgeneriert** -- beim LLM-Call wird direkt ein aussagekraeftiger Titel mit generiert (`SummaryResult.title`, max. 8 Woerter, Kapitelname-Stil). Wird nur gesetzt, wenn der DM noch keinen eigenen Titel per `PATCH /sessions/:id` vergeben hat (manuelle Aenderung hat immer Vorrang). Titel erscheint jetzt auch im Discord-Embed statt "Session #N -- Chronik".
- [x] **MP3-Dateien verlinken** im Summary-Bereich -- authentifizierte Streams und Downloads über die Session-API.
- [x] **Sprecher-Tab:**
  - Manuelle Zuordnung: Diarization-Label (z.B. SPEAKER_00) aus dem Transkript werden mit Namen versehen.
  - Felder: `diarizationLabel`, `discordName`, `characterName`, `playerName`.
  - Beruecksichtigung: Ein Discord-User kann in verschiedenen Kampagnen unterschiedliche Charaktere haben.
  - Ziel erreicht: Zuordnung zeigt jetzt Transkript-Ausschnitt pro Label zur Orientierung.

## Deployment-Historie / Betriebs-Notizen

**09.07.2026 -- Erstes Deployment der v1-Mitglieder-/Hintergrundbild-/Titel-Features:**
- Lokale Commits waren zunaechst nur im Workspace-Git, nie zu GitHub gepusht -- Server lief noch auf altem Stand. Gefixt: `git push` + `git pull` auf dem Server.
- **Fehlende Volume-Mounts:** `docker-compose.yml` kannte nur den `recordings`-Mount. Die drei neuen Storage-Ordner (`avatars`, `character-sheets`, `campaign-backgrounds`) fehlten komplett -- Backend crashte beim Start mit `"root" path ... must exist`. Gefixt: drei neue named volumes in `docker-compose.yml` ergaenzt.
- **Prisma/Alpine OpenSSL-Bug (der eigentliche Blocker):** Der Alpine-Container hat nur OpenSSL 3.x, Prismas auto-heruntergeladene Schema-Engine-Binary (genutzt von `prisma db push` in `start.sh`) braucht aber OpenSSL 1.1 (`libssl.so.1.1`). `db push` ist deshalb bei **jedem** Container-Start seit langem stillschweigend fehlgeschlagen (`Could not parse schema engine response`) -- ohne dass es je aufgefallen ist, weil das Backend trotzdem hochfuhr. Gefixt dauerhaft im `apps/backend/Dockerfile`: `apk add --repository=.../v3.16/main libssl1.1 libcrypto1.1` in der Runner-Stage.
  - **Wichtig fuer zukuenftige Schema-Aenderungen:** Wenn `docker logs dnd-backend` beim Start `"Could not parse schema engine response"` zeigt, ist das genau dieser Bug -- pruefen ob das Dockerfile noch die OpenSSL-1.1-Compat-Pakete installiert (koennte bei einem Base-Image-Update wieder verschwinden).
  - Ein alter `@@unique([userId, groupId])`-Constraint aus der Zeit vor "userId optional" musste zusaetzlich manuell per SQL entfernt werden, bevor `db push` durchlief.
- Nach allen Fixes: alle 7 Container laufen, `/campaigns` liefert 200, Storage-Verzeichnisse existieren im Container. Live verifiziert unter `https://dnd-recorder.de/`.

### Sprecher-Zuordnung -- vollstaendig geloest ✅ (v0.2.0, 09.07.2026)

**Umgesetzt:**
- [x] **Per-User Speaker-Tracking im Recorder:** `voice-recorder.service.ts` loggt pro Discord-User-ID, wann jemand spricht (Start/Stop-Timestamps mit 200ms Silence-Threshold). Logs werden als `.speakers.json` neben jedem WAV-Chunk gespeichert.
- [x] **Automatisches Mapping im Transcriber:** Der Worker matched die Zeitfenster aus `.speakers.json` gegen WhisperX-Diarization-Segmente (`SPEAKER_00` etc.) via Time-Overlap. Bestes Match pro Label wird automatisch in `SpeakerMap.diarizationLabel` geschrieben.
- [x] **Manuelle Nachbearbeitung bleibt moeglich:** Speaker-Tab mit Diarization-Label + Transkript-Ausschnitt + Dropdown-Zuordnung existiert weiterhin als Fallback/Optimierung.
- [x] Neues Feld `SpeakerMap.diarizationLabel` + Endpoint `GET /sessions/:id/diarization-labels`.
- [x] Transkript-Anzeige nutzt `diarizationLabel` zum Aufloesen der Sprechernamen.

**Ergebnis:** Speaker werden jetzt vollautomatisch zugeordnet -- kein manuelles Raten mehr noetig.

---

## Multi-User / Admin (v1 -- in Arbeit)

- [x] **Super-Admin (DM-Verwaltung):**
  - Userverwaltung fuer alle DMs
  - Uebersicht: welcher DM hat welche Kampagnen
  - DM-Accounts anlegen / deaktivieren
- [x] **Admin-API-Key-Grant:**
  - Super-Admin kann seine API-Keys an DMs verleihen (Checkbox pro DM)
  - DM sieht "🔑 Du nutzt die Admin-API-Keys" in Settings
  - Bei Revoke faellt DM auf eigene Keys zurueck
  - Datenmodell: `AdminApiKeyGrant` Tabelle
- [x] **DM-Registrierung:**
  - DMs koennen sich registrieren (bestehend, `/register`)
  - DM kann Discord-Bot in seinen Server einladen (OAuth-Flow oder Invite-Link)
- [x] **Profilbereich fuer DMs:**
  - Eigenes Profil verwalten (Name, Discord-Verbindung, Avatar)
  - Bot-Einstellungen pro Server/Kampagne

### Kampagnen-Mandantenfaehigkeit -- erledigt ✅ (18.07.2026)

- [x] `Campaign` ist die oberste fachliche Ebene; die alte `Group`-Huelle wird per getesteter Datenmigration entfernt.
- [x] Kampagnen koennen manuell geloescht werden; laufende/verarbeitete Sessions schuetzen vor versehentlicher Loeschung.
- [x] Dashboard zeigt Kampagnenbild, Sessionanzahl, Laufzeit und Serverstatus.
- [x] Web-URLs verwenden `/kampagnen`; alte `/groups`-Links werden permanent umgeleitet.
- [x] Ein DM kann mehrere Kampagnen und mehrere Discord-Server verwalten.
- [x] Eine Kampagne kann mehrere Server-/Channel-Bindings besitzen; Bindings sind separat aktivierbar.
- [x] Sessions werden nur vom Bot angelegt. Session-Inhalte und Wiki-Objekte behalten ihre CRUD-Operationen.

---

## Dokumentationsbereich (v1 -- erledigt ✅)

Der Dokumentationsbereich ist vollstaendig implementiert und im Top-Menue (`/docs`) verlinkt.

- [x] 7 Sektionen mit vollstaendigem Inhalt: Erste Schritte, Bot-Befehle, Workflow, Kampagnen & Sessions, Mitglieder, Einstellungen & API-Keys, FAQ.
- [x] Mobile-Dropdown fuer Kategorie-Auswahl.
- [x] Styling mit eigenen CSS-Klassen (Tabellen, Code-Blocks, Listen).

---

## v2 -- Ausblick

- [ ] Offline-Session als Audiodatei hochladen und anschließend wie eine Discord-Aufnahme transkribieren, zusammenfassen und einer Kampagne zuordnen
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
