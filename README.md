# DnD Recorder

Ein Discord-first Recording- und Analyse-System für Tabletop-Rollenspiel-Sessions (TTRPG/D&D).

Der Bot nimmt Voice-Sessions auf, transkribiert sie mit WhisperX, generiert epische narrative Zusammenfassungen via LLM und präsentiert alles in einem modernen Web-Panel.

---

## Features

### Discord-Bot
- `/record [kampagne]` — Bot joint den Voice-Channel und startet die Aufnahme; die Kampagnenauswahl ist bei eindeutiger Kanalzuordnung optional
- `/stop` — Stoppt die Aufnahme, konvertiert zu MP3, startet Transkription
- `/kampagne verbinden|aktivieren|deaktivieren|status` — Kampagnen und feste Voice-/Summary-Channels pro Discord-Server verwalten
- `/summary-channel set|status|clear` — Summary-Channel einer Kampagne verwalten
- **Auto-Stop** wenn alle User den Channel verlassen (30s Karenzzeit)
- **Chunked Recording** — alle 30 Minuten wird ein kompakter MP3-Part geschrieben; nach `/stop` werden die Parts nacheinander verarbeitet. Kein einzelner riesiger Upload bei stundenlangen Sessions
- Standardmäßig max. 6 Stunden Failsafe-Timer (über `MAX_RECORDING_HOURS`, 1–8h, konfigurierbar)
- Mandantenfähig: mehrere Discord-Server pro DM und mehrere Kampagnen pro Server

### Transkription
- **Replicate WhisperX** (victor-upmeet/whisperx)
- **OpenAI Whisper** als Alternative
- **Self-hosted** (OpenAI-kompatibler Endpoint)
- Automatische Sprecherzuordnung über Discord-Audioaktivität und Wortzeitstempel; kein HuggingFace-Token nötig
- Legacy-Transkripte mit `SPEAKER_00`, `SPEAKER_01` etc. bleiben manuell zuordenbar
- Chunks werden mit korrektem Zeit-Offset zusammengeführt

### LLM-Zusammenfassung
- **Anthropic** (Claude Opus 4.8, Sonnet 4.6)
- **Google Gemini** (2.5 Flash, 2.5 Pro)
- **OpenAI** (GPT-4o)
- **SiliconFlow** (DeepSeek V3/R1)
- **Ollama** (lokal, beliebiges Modell)
- Extrahiert: Narrative Chronik · NSCs · Quests · Beute · Orte · Offene Fäden
- Konfigurierbarer System-Prompt
- Kampagnen-Kontext vom DM (wird als Hintergrundwissen mitgegeben)

### Web-Panel
- **Login** mit JWT in einem HttpOnly-Session-Cookie
- **Dashboard** — Kampagnen-Übersicht mit 4:3-Hintergrundbild, Sessionanzahl, Laufzeit und verbundenen Discord-Servern
- **Kampagnen** mit Session-Timeline, Tagebuch-Tab und Mitgliederverwaltung
- **Kampagnen-Hintergrundbild** mit Parallax-Scroll-Effekt (Banner über jeder Kampagnen-Karte)
- **Mitgliederverwaltung** — Discordname, Charaktername, freie Rolle (Tank/Healer/…), Avatar-Upload, Charakterbogen-PDF-Upload; volle CRUD-Operationen, kein Login/Account für Mitglieder nötig (nur der DM loggt sich ein)
- **Session-Detail** — 3 Tabs:
  - 📖 Summary (Chronik, NSCs, Quests, Beute, Orte, Offene Fäden, verlinkte MP3-Aufnahmen) — Titel manuell änderbar oder wird vom LLM automatisch mitgeneriert
  - 📝 Transkript (farbig nach Sprecher, mit Timestamps)
  - 👤 Sprecher — automatisch verknüpfte Discord-User sowie editierbare Charakter- und Spielernamen; Legacy-Labels bleiben zuordenbar
- **Live-Status-Widget** (zeigt ob gerade aufgenommen/transkribiert wird)
- **Einstellungen** — API-Keys, Provider-Wahl, System-Prompt, Kampagnen-Kontext

### Session Images
- **Automatischer Prompt:** Nach jeder Session generiert die LLM-Zusammenfassung (DeepSeek V3 via SiliconFlow) einen englischen Bild-Prompt, der den epischen Moment der Sitzung beschreibt
- **Generate-Button:** Der DM kann per Klick ein Session-Illustrationsbild via AI erzeugen lassen
- **Avatar-Referenzen:** Charakter-Avatare der Kampagnen-Mitglieder dienen als Style-Referenz für img2img-Modelle
- **Unterstützte Modelle:** Qwen Image Edit Plus (mit Avatar-Feed), Flux Schnell (reiner Text-Prompt)
- **Settings-UI:** API-Keys und Provider/Model-Auswahl für Bildgenerierung getrennt konfigurierbar (überarbeitete Settings-Seite)

### Infrastruktur
- Docker Compose (7 Services: Bot, Backend, Transcriber, Frontend, Nginx, Postgres, Redis)
- Separate, gehärtete Server-GTM-Compose-Datei für consent-gebundene First-Party-Analyse
- Git-basiertes Deployment (`git pull && docker compose up -d --build`)
- Produktionsdomain: `dnd-recorder.de`
- Öffentliche Pflichtseiten: `/impressum` und `/datenschutz`; Consent-Präferenz ist jederzeit im globalen Footer änderbar

### Produktionsdomain und Plesk

- `https://dnd-recorder.de` ist die kanonische öffentliche URL.
- Der Plesk-vHost leitet mit [`deploy/plesk/dnd-recorder.htaccess`](deploy/plesk/dnd-recorder.htaccess) intern an den Docker-Gateway auf `127.0.0.1:8080` weiter. Datenbank-Volumes und Uploads bleiben dadurch am bestehenden Ort.
- `APP_URL` und `PUBLIC_BASE_URL` müssen beide auf die kanonische URL zeigen. `CORS_ORIGIN` darf während der Übergangszeit zusätzlich die vorherige Domain enthalten.
- Der Docker-nginx leitet die vorherige Domain mit Status 308 auf `https://dnd-recorder.de` um.
- Mailhosts dürfen bei Cloudflare nicht als Proxy betrieben werden; nur der Webhost wird proxied.
- Ausgehende Transaktionsmails werden über die verifizierte Mailgun-Domain `dnd-recorder.de` versendet. Der bestehende Plesk-Mailserver bleibt ausschließlich für eingehende Nachrichten zuständig; die von Mailgun vorgeschlagenen MX-Einträge dürfen deshalb nicht übernommen werden.
- Der SPF-Eintrag muss Plesk und Mailgun in genau einem TXT-Record autorisieren. Mailgun-DKIM verwendet einen eigenen Selector und kann parallel zu den Plesk-DKIM-Selectoren bestehen.
- Compose-Projekt, Netzwerk und persistente Volumes tragen explizite DnD-Recorder-Namen (`dnd-recorder`, `dnd_recorder_network`, `dnd_recorder_postgres_data`, `dnd_recorder_redis_data`). Die beiden Volumes werden einmalig mit `docker volume create dnd_recorder_postgres_data` und `docker volume create dnd_recorder_redis_data` angelegt und sind in Compose als extern markiert. Dadurch bleiben sie von anderen Anwendungen und dem Compose-Lebenszyklus getrennt. Manuelles `docker volume rm` darf für diese Volumes nur im Rahmen einer geplanten Wiederherstellung verwendet werden.

---

## Architektur

```
Discord Voice
    ↓ /record
[discord-recorder]  ←── Node.js + discord.js + @discordjs/voice
    ↓ chunks alle 30 Min (WAV → MP3)
[BullMQ / Redis]    ←── Job Queue
    ↓
[transcriber]       ←── Replicate WhisperX API
    ↓ 20+ Segmente mit Sprecher + Timestamps
[transcriber]       ←── Anthropic/Gemini/OpenAI/SiliconFlow/Ollama
    ↓ JSON: narrative, npcs, quests, loot, locations, openThreads
[PostgreSQL]        ←── Session, Transcript, Summary, SpeakerMap
    ↓
[Discord Notification]  ←── Rich Embed mit Summary + Web-Panel-Link
    ↓
[Web-Panel]         ←── SvelteKit + TailwindCSS v4
```

---

## Monorepo-Struktur

```
apps/
  discord-recorder/   ← Discord-Bot (Node.js + TypeScript)
  backend/            ← REST-API (Fastify + Prisma + PostgreSQL)
  frontend/           ← Web-Panel (SvelteKit + TailwindCSS v4)

services/
  transcriber/        ← BullMQ Worker (WhisperX + LLM)

shared/               ← Gemeinsame TypeScript-Types (reserved)
storage/
  recordings/            ← MP3-Chunks (Docker Volume)
  avatars/               ← Mitglieder-Avatare (Docker Volume)
  character-sheets/      ← Charakterbögen als PDF (Docker Volume)
  campaign-backgrounds/  ← Kampagnen-Hintergrundbilder (Docker Volume)
  session-images/        ← Session-Bilder (Docker Volume)
```

---

## Setup

### Voraussetzungen
- Node.js 22+
- pnpm 10+
- Docker + Docker Compose
- Discord-Bot-Token ([Discord Developer Portal](https://discord.com/developers/applications))

### Lokale Entwicklung

```bash
git clone https://github.com/grackmczack/ai-dungeon-master-recorder.git
cd ai-dungeon-master-recorder
pnpm install

# Environment-Dateien anlegen
cp apps/discord-recorder/.env.example apps/discord-recorder/.env
cp apps/backend/.env.example apps/backend/.env
cp services/transcriber/.env.example services/transcriber/.env
cp .env.postgres.example .env.postgres

# .env Dateien befüllen (siehe Abschnitt Konfiguration)

# Infrastruktur starten
docker compose up -d postgres redis

# DB-Schema
cd apps/backend && npx prisma migrate deploy

# Bot starten
pnpm --filter @ai-dungeon-master-recorder/discord-recorder dev

# Backend starten
pnpm --filter @ai-dungeon-master-recorder/backend dev

# Transcriber starten
pnpm --filter @ai-dungeon-master-recorder/transcriber dev

# Frontend starten
pnpm --filter @ai-dungeon-master-recorder/frontend dev
```

### Discord-Bot einrichten

1. [Discord Developer Portal](https://discord.com/developers/applications) → App öffnen
2. **Bot** → Token kopieren (Reset Token)
3. **Installation** → Guild Install aktivieren und den Bot als **Public Bot** freigeben
4. Default Install Scopes: `bot + applications.commands`
5. Berechtigungen: View Channels, Send Messages, Embed Links, Connect, Speak, Use Voice Activity
6. `DISCORD_CLIENT_ID` im Bot **und** Backend eintragen; das Web-Panel erzeugt daraus den Einladungslink

Die Slash-Commands werden global registriert und funktionieren damit auf allen Servern, auf denen
der Bot installiert ist. Optional kann `DISCORD_DEV_GUILD_ID` gesetzt werden, um Commands in einer
Test-Guild sofort bereitzustellen, während Discord die globalen Commands verteilt.

Die Web-Zuordnung benötigt keine manuell kopierte Server-ID: `/status` und `/record` erkennen die
Guild automatisch. Ist sie noch nicht verbunden, erhält ein Mitglied mit `Manage Guild` einen
privaten, 15 Minuten gültigen Einmal-Link. Im angemeldeten Web-Panel wird damit eine vorhandene
Kampagne ausgewählt oder eine neue angelegt. Discord-Benutzer-IDs werden nicht zur
Kontoverfolgung gespeichert; sie bleiben ausschließlich als Sprecher-Snapshot an einer Session.

Mit `/kampagne verbinden` wird eine Kampagne einem Voice-Channel und optional einem festen
Summary-Channel zugeordnet. `/record` löst die Kampagne in dieser Reihenfolge auf: explizite
Auswahl, Voice-Channel-Bindung, einzige aktive Kampagne; mehrdeutige Fälle erfordern eine Auswahl.
Ein freier Voice-Channel wird bei eindeutiger Kampagne automatisch gebunden.

### Produktions-Deployment (Strato)

```bash
# Einmalig auf dem Server
git clone https://github.com/grackmczack/ai-dungeon-master-recorder.git /path/to/app
cd /path/to/app

# .env Dateien anlegen (nie in Git!)
# apps/discord-recorder/.env
# apps/backend/.env
# services/transcriber/.env
# .env.postgres

# Build + Start
docker compose up -d --build

# Update
git pull && docker compose up -d --build
```

### Datenbank-Migrationen

```bash
# Lokal/CI
pnpm --filter @ai-dungeon-master-recorder/backend db:migrate

# Produktion: start.sh führt `prisma migrate deploy` automatisch aus
docker compose up -d --build
```

Die Migration `20260718000200_campaign_multitenancy` wandelt die frühere
Gruppe→Kampagne-Hülle verlustfrei in direkte Kampagnen um. Bei einer bestehenden, noch mit
`prisma db push` angelegten Datenbank erkennt `start.sh` den Legacy-Stand, markiert einmalig die
Baseline als angewendet und spielt danach die echte Migration ein. Vor Produktiv-Deployments
sollte trotzdem ein Datenbank-Backup erstellt werden.

Eine anschließende Datenmigration markiert ausschließlich nicht-terminale Sessions als
`FAILED`, die seit mehr als 24 Stunden unverändert sind. Dadurch blockieren verwaiste Alt-Jobs
keine Löschvorgänge; laufende Aufnahmen und aktuelle Queue-Jobs bleiben unberührt.

**Nach dem ersten Deployment der Multi-User-Features:**
Der erste existierende User muss manuell zum SUPER_ADMIN befördert werden:
```bash
docker exec dnd-postgres psql -U ai_dungeon -d ai_dungeon_master_recorder \
  -c "UPDATE \"User\" SET role='SUPER_ADMIN' WHERE email='deine@email.de';"
```

**Bekannter Gotcha — Prisma-Migration schlägt beim Backend-Start fehl:**
Wenn `docker logs dnd-backend` beim Start `Could not parse schema engine response` zeigt: Prismas
auto-heruntergeladene Schema-Engine-Binary (genutzt von `prisma migrate deploy` in `start.sh`) linkt gegen
OpenSSL 1.1 (`libssl.so.1.1`), aktuelle Alpine-Images liefern aber nur OpenSSL 3.x. Der Fix ist
bereits dauerhaft in `apps/backend/Dockerfile` eingebaut (installiert die archivierten Alpine-v3.16-
Compat-Pakete `libssl1.1`/`libcrypto1.1` in der Runner-Stage) — falls das Backend-Base-Image mal
aktualisiert wird, hier zuerst nachsehen, ob der Fix noch greift.

Schemaänderungen werden nicht mehr per `db push`, sondern ausschließlich als eingecheckte,
reviewbare Migrationen ausgerollt. Dadurch werden Datenübernahmen und unterschiedliche
Constraint-Varianten ausdrücklich behandelt und sind vorab auf einem Produktionsklon testbar.

---

## Konfiguration

### apps/discord-recorder/.env
```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_DEV_GUILD_ID=     # optional: sofortige Command-Registrierung in einer Test-Guild
REDIS_HOST=redis
REDIS_PORT=6379
DATABASE_URL=postgresql://...
BACKEND_INTERNAL_URL=http://dnd-backend:3001
INTERNAL_TOKEN=         # Gleiches langes Zufallsgeheimnis wie im Backend
```

### apps/backend/.env
```env
DATABASE_URL=postgresql://ai_dungeon:PASSWORD@postgres:5432/ai_dungeon_master_recorder
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=
INTERNAL_TOKEN=         # Langes Zufallsgeheimnis für Bot → Backend
PORT=3001
APP_URL=https://dnd-recorder.de
PUBLIC_BASE_URL=https://dnd-recorder.de
TRUST_PROXY=true        # Für korrekte Client-IP hinter Nginx/Cloudflare
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false       # STARTTLS auf Port 587
SMTP_TLS_SERVERNAME=smtp.mailgun.org
SMTP_USER=postmaster@dnd-recorder.de
SMTP_PASSWORD=
SMTP_FROM=Artificer · DnD Recorder <Artificer@dnd-recorder.de>
DISCORD_CLIENT_ID=        # identisch zur Discord-App; erzeugt den öffentlichen Invite-Link
GA_MEASUREMENT_ID=        # Measurement-ID des GA4-Webstreams
GA_API_SECRET=            # geheim; nur für consent-gebundene Backend-Lifecycle-Events
```

### Root `.env` (optionales Analytics-Build)

```env
VITE_GTM_CONTAINER_ID=GTM-W7N7J7JR
VITE_GTM_SERVER_URL=https://analytics.dnd-recorder.de
VITE_GTM_SERVING_PATH=/CCo2D
```

Ohne alle drei Werte bleibt Analytics vollständig deaktiviert. Consent, Rechtstexte und alle App-Funktionen arbeiten trotzdem. Einrichtung, Event-Allowlist und Prüfablauf stehen in [`docs/analytics-betrieb.md`](docs/analytics-betrieb.md); das Dateninventar in [`docs/datenschutz-inventar.md`](docs/datenschutz-inventar.md).

### services/transcriber/.env
```env
DATABASE_URL=postgresql://...
REDIS_HOST=redis
REDIS_PORT=6379
PUBLIC_BASE_URL=https://dnd-recorder.de
ANTHROPIC_API_KEY=       # Fallback wenn kein Key in DB-Settings
REPLICATE_API_KEY=       # Für WhisperX
DISCORD_TOKEN=           # Für Discord-Notifications
```

### .env.postgres
```env
POSTGRES_DB=ai_dungeon_master_recorder
POSTGRES_USER=ai_dungeon
POSTGRES_PASSWORD=
```

## API-Endpunkte (Backend)

| Method | Path | Beschreibung |
|--------|------|--------------|
| POST | `/auth/register` | Account erstellen und 24-Stunden-Bestätigungslink versenden |
| POST | `/auth/login` | Login → HttpOnly-Session-Cookie |
| POST | `/auth/verify-email` | E-Mail mit einmaligem Token bestätigen und Aktivierungsmail versenden |
| POST | `/auth/resend-verification` | Neuen Bestätigungslink anfordern (neutrale Antwort) |
| POST | `/auth/forgot-password` | Passwort-Reset-Link anfordern (neutrale Antwort) |
| POST | `/auth/reset-password` | Passwort mit einmaligem 30-Minuten-Token zurücksetzen |
| POST | `/auth/change-password` | Eigenes Passwort ändern und andere Sitzungen widerrufen |
| PATCH | `/auth/profile` | Eigenen Anzeigenamen ändern |
| GET | `/auth/me` | Aktueller User |
| POST | `/analytics/consent` | Eingeloggte, versionierte Analytics-Einwilligung pseudonym hinterlegen |
| POST | `/analytics/consent/revoke` | Einwilligung mit lokalem Widerrufsgeheimnis zurückziehen |
| GET | `/campaigns` | Eigene Kampagnen mit Session- und Serverstatus |
| POST | `/campaigns` | Kampagne erstellen |
| GET | `/campaigns/:id` | Kampagne mit Mitgliedern, Bindings und Sessions |
| PATCH | `/campaigns/:id` | Kampagne bearbeiten oder global aktiv/inaktiv setzen |
| DELETE | `/campaigns/:id` | Kampagne samt abgeschlossenen Sessions und Uploads löschen |
| GET | `/campaigns/:campaignId/members` | Alle Mitglieder (inkl. Historie) |
| POST | `/campaigns/:campaignId/members` | Mitglied direkt anlegen (kein Login nötig) |
| PATCH | `/campaigns/:campaignId/members/:memberId` | Mitglied bearbeiten |
| POST | `/campaigns/:campaignId/members/:memberId/pause` | Mitglied pausieren |
| POST | `/campaigns/:campaignId/members/:memberId/resume` | Pause aufheben |
| DELETE | `/campaigns/:campaignId/members/:memberId` | Mitglied entfernen (soft-delete) |
| POST | `/campaigns/:campaignId/members/:memberId/avatar` | Avatar/Gesichtsbild hochladen |
| POST | `/campaigns/:campaignId/members/:memberId/character-sheet` | Charakterbogen (PDF) hochladen |
| GET | `/campaigns/:campaignId/settings` | Kampagneneinstellungen lesen |
| PUT | `/campaigns/:campaignId/settings` | Kampagneneinstellungen speichern |
| GET | `/discord-installations` | Für den DM verfügbare Discord-Server |
| POST | `/campaigns/:campaignId/discord-bindings` | Kampagne einem weiteren Server zuordnen |
| PATCH | `/campaigns/:campaignId/discord-bindings/:bindingId` | Server-/Channel-Bindung aktivieren oder ändern |
| DELETE | `/campaigns/:campaignId/discord-bindings/:bindingId` | Serverbindung trennen |
| GET | `/sessions/:id` | Session-Detail mit Transcript + Summary |
| PATCH | `/sessions/:id` | Session-Titel ändern |
| PUT | `/sessions/:id/speakers` | Speaker-Namen zuordnen (inkl. Diarization-Label) |
| GET | `/sessions/:id/diarization-labels` | Erkannte Sprecher-Labels aus dem Transkript mit Textausschnitt |
| PUT | `/campaigns/:id/context` | Kampagnen-Kontext setzen |
| POST | `/campaigns/:id/background` | Kampagnen-Hintergrundbild hochladen (GM-only) |
| POST | `/campaigns/:id/generate-background` | Kampagnen-Hintergrundbild via Replicate generieren (GM-only) |
| DELETE | `/campaigns/:id/background` | Kampagnen-Hintergrundbild entfernen (GM-only) |
| POST | `/sessions/:id/image` | Session-Bild hochladen (GM-only) |
| POST | `/sessions/:id/generate-image` | Session-Bild via Replicate generieren (GM-only) |
| DELETE | `/sessions/:id/image` | Session-Bild entfernen (GM-only) |
| GET | `/campaigns/:id/sessions` | Paginierte Sessions einer Kampagne (?skip=N&take=N) |
| GET | `/campaigns/:id/wiki` | Quest-Wiki Aggregation (Stufe 1) |
| GET | `/wiki/:campaignId/npcs` | Nur NSCs aus dem Wiki |
| POST | `/internal/sessions` | (intern) Session anlegen via Bot |

### Admin (nur SUPER_ADMIN)
| Method | Path | Beschreibung |
|--------|------|--------------|
| GET | `/admin/users` | Alle DMs auflisten |
| POST | `/admin/users` | Neuen DM anlegen |
| PATCH | `/admin/users/:id` | DM bearbeiten (Name, Email, aktiv/deaktiv) |
| GET | `/admin/users/:id/deletion-impact` | Auswirkungen einer vollständigen Account-Löschung |
| DELETE | `/admin/users/:id` | DM löschen; allein verwaltete Kampagnen/Daten mitlöschen |
| GET | `/admin/grants` | Alle aktiven Key-Grants |
| POST | `/admin/users/:id/grant-keys` | Admin-API-Keys für DM freigeben |
| DELETE | `/admin/users/:id/grant-keys` | Key-Grant entziehen |
| GET | `/admin/overview` | DM-Übersicht mit Kampagnen und Discord-Bindings |
| GET | `/admin/installations` | Discord-Installationen mit getrenntem Bot- und Web-Zugriffsstatus |

### Multi-User & Admin-System
- **SUPER_ADMIN** verwaltet alle DMs, gibt öffentlich registrierte Accounts während der Beta nach bestätigter E-Mail manuell frei und kann Accounts später sperren, reaktivieren oder endgültig löschen. Eine Sperre widerruft sofort alle Sessions, lässt die Daten aber bestehen.
- **Double-Opt-in:** Öffentlich registrierte Accounts können sich erst nach Bestätigung der E-Mail-Adresse anmelden. Links sind 24 Stunden und einmalig gültig; anschließend folgt eine Aktivierungsbestätigung. Bestehende und administrativ angelegte Accounts gelten als bestätigt.
- **Vollständige Löschung:** Account, Grants und Memberships werden entfernt. Allein verwaltete Kampagnen werden inklusive Sessions, Aufnahmen und Uploads gelöscht; gemeinsame Kampagnen bleiben erhalten.
- **Key-Grant-System:** Der Superadmin kann vorhandene API-Key-Profile an DMs verleihen. Key, Provider, Modell und Endpoint werden atomar übernommen; Settings zeigen die verfügbaren Key-Typen sowie sechs Präfix-Zeichen zur Kontrolle.
- Transcriber, Kampagnenbilder und Sessionbilder lösen Grants bei jeder neuen Operation auf. Nach einem Revoke fällt der DM sofort auf seine zuvor gespeicherten eigenen Keys zurück.
- Datenmodell: `User.role` (SUPER_ADMIN|DM), `User.isActive`, `AdminApiKeyGrant`-Tabelle

---

## Datenmodell

```
User (SUPER_ADMIN oder DM)
  ├── role: SUPER_ADMIN | DM
  ├── isActive: Boolean
  ├── emailVerifiedAt + gehashter, kurzlebiger Bestätigungstoken
  ├── grantedKeys: AdminApiKeyGrant[] (als Super-Admin verliehene Keys)
  └── receivedKeys: AdminApiKeyGrant[] (als DM erhaltene Keys)

AdminApiKeyGrant
  ├── superAdminId → User
  ├── dmId → User
  ├── grantedAt
  └── revokedAt? (null = aktiv)

Campaign (oberste fachliche Ebene)
  ├── CampaignMembership (Mitglied — braucht KEINEN eigenen Login/Account in v1;
  │     userId optional (nur GM/DM), discordName, characterName, partyRole,
  │     avatarUrl, characterSheetUrl, Rolle GM/PLAYER/OBSERVER, joinedAt/leftAt)
  ├── CampaignSettings (API-Keys, Provider, Prompt)
  ├── CampaignDiscordBinding[]
  │     └── DiscordInstallation (Server) + Voice-/Summary-Channel + aktiv/inaktiv
  ├── campaignContext (Hintergrundinfo für LLM)
  ├── backgroundImageUrl (generierbares 4:3-Hintergrundbild)
  └── Session (wird ausschließlich durch den Bot angelegt)
        ├── discordBindingId + Voice-/Text-Channel-Snapshot
        ├── sessionImageUrl (generierbares 4:3-Header-Bild)
        ├── Recording (MP3-Chunk, filePath, durationSeconds)
        ├── Transcript (rawJson mit Segmenten, Speaker-Label, Timestamps)
        ├── Summary (deutsch; englischer sessionImagePrompt)
        └── SpeakerMap (Discord-Snapshot ↔ characterName ↔ playerName ↔ diarizationLabel)
```

**Hinweis Mitglieder-Modell:** Ein `discordName` (realer User) kann in verschiedenen
Kampagnen unterschiedliche Charaktere haben — die Zuordnung liegt daher pro
`CampaignMembership`, nicht global am User.

---

## Roadmap

Die vollständige, laufend gepflegte Roadmap mit Details, Implementierungs-Staffelung und
Deployment-Notizen steht in [`ROADMAP.md`](./ROADMAP.md). Kurzüberblick:

### v0 — abgeschlossen
- [x] Discord-Bot mit /record, /stop, /status
- [x] WAV → MP3 Konvertierung (FFmpeg)
- [x] Chunked Recording (30-Min-Parts)
- [x] Auto-Stop wenn alle User weg sind
- [x] BullMQ Job-Queue (Redis)
- [x] Replicate WhisperX und OpenAI Whisper mit direkter Discord-Sprecherzuordnung
- [x] Multi-Provider LLM (Anthropic/Gemini/OpenAI/SiliconFlow/Ollama)
- [x] Web-Panel (Login, Dashboard, Sessions, Transcript, Summary)
- [x] Live-Status-Widget
- [x] Konfigurierbarer System-Prompt
- [x] Kampagnen-Kontext für LLM
- [x] Docker Compose Deployment
- [x] Tagebuch-Tab (alle Session-Summaries chronologisch)

### v1 — in Arbeit
- [x] Mitgliederverwaltung ohne Login-Zwang (Discordname, Charaktername, freie Rolle, Avatar, Charakterbogen-PDF)
- [x] Kampagnen-Hintergrundbild mit Parallax-Effekt (Upload + Replicate-Generierung, GM-only)
- [x] Session-Titel manuell änderbar + automatisch vom LLM mitgeneriert
- [x] MP3-Aufnahmen im Summary verlinkt
- [x] Vollautomatische Sprecher-Zuordnung über Discord-Audioaktivität + Wortzeitstempel; manueller Legacy-Fallback
- [x] Session-Bilder via Replicate (Header-Kachel mit Upload/Generate/Remove; automatischer Prompt aus Summary-Daten)
- [x] Session-Seite zeigt Kampagnen-Hintergrundbild (Parallax-Fixed) für konsistenten Look
- [x] Session-Paginierung (10 pro Kampagne, "Mehr laden"-Button)
- [ ] Quest-Wiki (Living Lore: Quests, NSCs, Orte, Beute, offene Fäden)
- [x] Multi-User mit Super-Admin/DM-Rollensystem, DM-Registrierung und Double-Opt-in
- [x] Dokumentationsbereich im Panel

---

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| Bot | Node.js 22, TypeScript, discord.js v14, @discordjs/voice |
| Audio | prism-media, opusscript, fluent-ffmpeg |
| Backend | Fastify v4, Prisma v5, PostgreSQL 16, Redis 7 |
| Queue | BullMQ v5, IORedis |
| Transcription | Replicate API (WhisperX), OpenAI Whisper API |
| LLM | Anthropic SDK, Google GenAI, OpenAI SDK |
| Frontend | SvelteKit 2, Svelte 5, TailwindCSS v4 |
| Infra | Docker Compose, Nginx (Reverse Proxy + SPA) |
| Deployment | Strato VPS, Plesk, Git-based |

---

## Lizenz

Privates Projekt. Alle Rechte vorbehalten.
