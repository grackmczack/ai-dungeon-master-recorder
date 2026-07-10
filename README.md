# AI Dungeon Master Recorder

Ein Discord-first Recording- und Analyse-System für Tabletop-Rollenspiel-Sessions (TTRPG/D&D).

Der Bot nimmt Voice-Sessions auf, transkribiert sie mit WhisperX, generiert epische narrative Zusammenfassungen via LLM und präsentiert alles in einem modernen Web-Panel.

---

## Features

### Discord-Bot
- `/record` — Bot joint den Voice-Channel und startet die Aufnahme
- `/stop` — Stoppt die Aufnahme, konvertiert zu MP3, startet Transkription
- **Auto-Stop** wenn alle User den Channel verlassen (30s Karenzzeit)
- **Chunked Recording** — alle 30 Minuten wird ein Part geschrieben und parallel transkribiert, während weiteraufgenommen wird. Kein Speicherproblem bei stundenlangen Sessions
- Max. 4 Stunden Failsafe-Timer
- Multi-Server-fähig

### Transkription
- **Replicate WhisperX** (victor-upmeet/whisperx) mit Speaker-Diarization
- **OpenAI Whisper** als Alternative
- **Self-hosted** (OpenAI-kompatibler Endpoint)
- Speaker-Trennung: `SPEAKER_00`, `SPEAKER_01` etc. → im Web-Panel Charakternamen zuweisbar
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
- **Login** mit JWT-Auth
- **Dashboard** — Gruppen-Übersicht
- **Kampagnen** mit Session-Timeline, Tagebuch-Tab und Mitgliederverwaltung
- **Kampagnen-Hintergrundbild** mit Parallax-Scroll-Effekt (Banner über jeder Kampagnen-Karte)
- **Mitgliederverwaltung** — Discordname, Charaktername, freie Rolle (Tank/Healer/…), Avatar-Upload, Charakterbogen-PDF-Upload; volle CRUD-Operationen, kein Login/Account für Mitglieder nötig (nur der DM loggt sich ein)
- **Session-Detail** — 3 Tabs:
  - 📖 Summary (Chronik, NSCs, Quests, Beute, Orte, Offene Fäden, verlinkte MP3-Aufnahmen) — Titel manuell änderbar oder wird vom LLM automatisch mitgeneriert
  - 📝 Transkript (farbig nach Sprecher, mit Timestamps)
  - 👤 Sprecher — Diarization-Label (`SPEAKER_00` etc.) mit Text-Ausschnitt aus dem Transkript zur Orientierung, Zuordnung zu Discord-User/Charaktername/Spielername
- **Live-Status-Widget** (zeigt ob gerade aufgenommen/transkribiert wird)
- **Einstellungen** — API-Keys, Provider-Wahl, System-Prompt, Kampagnen-Kontext

### Infrastruktur
- Docker Compose (5 Services: Bot, Backend, Transcriber, Frontend, Nginx, Postgres, Redis)
- Git-basiertes Deployment (`git pull && docker compose up -d --build`)
- Subdomain: `dndbot.haffelpaff.de`

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
cd apps/backend && npx prisma db push

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
3. Privileged Gateway Intents aktivieren: **Presence**, **Server Members**, **Message Content**
4. **OAuth2 → URL Generator**: Scopes `bot + applications.commands`, Permissions: Connect, Speak, Use Voice Activity, Send Messages
5. Bot zum Server einladen

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

### Datenbank-Migration (nach Schema-Änderungen)

```bash
# Lokal
docker exec dnd-backend sh -c "npx prisma db push --schema ./prisma/schema.prisma --skip-generate"

# Oder via Docker-Neustart (start.sh führt db push automatisch aus)
docker compose up -d --build
```

**Nach dem ersten Deployment der Multi-User-Features:**
Der erste existierende User muss manuell zum SUPER_ADMIN befördert werden:
```bash
docker exec dnd-postgres psql -U ai_dungeon -d ai_dungeon_master_recorder \
  -c "UPDATE \"User\" SET role='SUPER_ADMIN' WHERE email='deine@email.de';"
```

**Bekannter Gotcha — Prisma `db push` schlägt beim Backend-Start fehl:****
Wenn `docker logs dnd-backend` beim Start `Could not parse schema engine response` zeigt: Prismas
auto-heruntergeladene Schema-Engine-Binary (genutzt von `prisma db push` in `start.sh`) linkt gegen
OpenSSL 1.1 (`libssl.so.1.1`), aktuelle Alpine-Images liefern aber nur OpenSSL 3.x. Der Fix ist
bereits dauerhaft in `apps/backend/Dockerfile` eingebaut (installiert die archivierten Alpine-v3.16-
Compat-Pakete `libssl1.1`/`libcrypto1.1` in der Runner-Stage) — falls das Backend-Base-Image mal
aktualisiert wird, hier zuerst nachsehen, ob der Fix noch greift.

Bei Schema-Änderungen, die alte `@@unique`-Constraints entfernen oder Spalten von required auf
optional umstellen, kann `prisma db push` mit einem Constraint-Konflikt fehlschlagen (z.B.
`cannot drop index ... because constraint ... requires it`). In dem Fall den alten Constraint
einmalig manuell per `docker exec dnd-postgres psql ...` entfernen, dann erneut `db push` laufen
lassen (passiert automatisch beim nächsten Container-Neustart, oder manuell via
`docker exec dnd-backend sh -c "npx prisma db push --schema ./prisma/schema.prisma --skip-generate"`).

---

## Konfiguration

### apps/discord-recorder/.env
```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
REDIS_HOST=redis
REDIS_PORT=6379
DATABASE_URL=postgresql://...
BACKEND_INTERNAL_URL=http://dnd-backend:3001
```

### apps/backend/.env
```env
DATABASE_URL=postgresql://ai_dungeon:PASSWORD@postgres:5432/ai_dungeon_master_recorder
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=
PORT=3001
```

### services/transcriber/.env
```env
DATABASE_URL=postgresql://...
REDIS_HOST=redis
REDIS_PORT=6379
ANTHROPIC_API_KEY=       # Fallback wenn kein Key in DB-Settings
REPLICATE_API_KEY=       # Für WhisperX
HUGGINGFACE_TOKEN=       # Für Speaker-Diarization (pyannote)
DISCORD_TOKEN=           # Für Discord-Notifications
```

### .env.postgres
```env
POSTGRES_DB=ai_dungeon_master_recorder
POSTGRES_USER=ai_dungeon
POSTGRES_PASSWORD=
```

### HuggingFace — Speaker-Diarization freischalten

Für Speaker-Trennung müssen folgende Modelle auf HuggingFace einmalig akzeptiert werden:
- https://huggingface.co/pyannote/speaker-diarization-3.1
- https://huggingface.co/pyannote/segmentation-3.0
- https://huggingface.co/pyannote/speaker-diarization-community-1

---

## API-Endpunkte (Backend)

| Method | Path | Beschreibung |
|--------|------|--------------|
| POST | `/auth/register` | Account erstellen |
| POST | `/auth/login` | Login → JWT |
| GET | `/auth/me` | Aktueller User |
| GET | `/groups` | Eigene Gruppen |
| POST | `/groups` | Gruppe erstellen |
| GET | `/groups/:id` | Gruppe mit Kampagnen + Sessions |
| GET | `/groups/:groupId/members` | Alle Mitglieder (inkl. Historie) |
| POST | `/groups/:groupId/members` | Mitglied direkt anlegen (kein Login nötig) |
| PATCH | `/groups/:groupId/members/:memberId` | Mitglied bearbeiten |
| POST | `/groups/:groupId/members/:memberId/pause` | Mitglied pausieren |
| POST | `/groups/:groupId/members/:memberId/resume` | Pause aufheben |
| DELETE | `/groups/:groupId/members/:memberId` | Mitglied entfernen (soft-delete) |
| POST | `/groups/:groupId/members/:memberId/avatar` | Avatar/Gesichtsbild hochladen |
| POST | `/groups/:groupId/members/:memberId/character-sheet` | Charakterbogen (PDF) hochladen |
| GET | `/groups/:groupId/settings` | Einstellungen lesen |
| PUT | `/groups/:groupId/settings` | Einstellungen speichern |
| GET | `/sessions/:id` | Session-Detail mit Transcript + Summary |
| PATCH | `/sessions/:id` | Session-Titel ändern |
| PUT | `/sessions/:id/speakers` | Speaker-Namen zuordnen (inkl. Diarization-Label) |
| GET | `/sessions/:id/diarization-labels` | Erkannte Sprecher-Labels aus dem Transkript mit Textausschnitt |
| PUT | `/campaigns/:id/context` | Kampagnen-Kontext setzen |
| PATCH | `/campaigns/:id` | Kampagne bearbeiten (Name, Beschreibung, Setting, aktiv) |
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
| GET | `/admin/grants` | Alle aktiven Key-Grants |
| POST | `/admin/users/:id/grant-keys` | Admin-API-Keys für DM freigeben |
| DELETE | `/admin/users/:id/grant-keys` | Key-Grant entziehen |
| GET | `/admin/overview` | DM-Übersicht mit Gruppen & Kampagnen |

### Multi-User & Admin-System
- **SUPER_ADMIN** verwaltet alle DMs, kann Accounts anlegen/deaktivieren
- **Key-Grant-System:** Super-Admin kann seine API-Keys an DMs verleihen (Checkbox im Admin-Panel). DM sieht in Settings: "🔑 Du nutzt die Admin-API-Keys". Transcriber löst automatisch die Admin-Settings auf.
- Bei Revoke fällt der DM auf eigene Keys zurück
- Datenmodell: `User.role` (SUPER_ADMIN|DM), `User.isActive`, `AdminApiKeyGrant`-Tabelle

---

## Datenmodell

```
User (SUPER_ADMIN oder DM)
  ├── role: SUPER_ADMIN | DM
  ├── isActive: Boolean
  ├── grantedKeys: AdminApiKeyGrant[] (als Super-Admin verliehene Keys)
  └── receivedKeys: AdminApiKeyGrant[] (als DM erhaltene Keys)

AdminApiKeyGrant
  ├── superAdminId → User
  ├── dmId → User
  ├── grantedAt
  └── revokedAt? (null = aktiv)

Group (Discord-Server / Spielgruppe)
  ├── GroupMembership (Mitglied — braucht KEINEN eigenen Login/Account in v1;
  │     userId optional (nur GM/DM), discordName, characterName, partyRole,
  │     avatarUrl, characterSheetUrl, Rolle GM/PLAYER/OBSERVER, joinedAt/leftAt)
  ├── GroupSettings (API-Keys, Provider, Prompt, Kampagnen-Kontext)
  └── Campaign (Kampagne, z.B. "Vergessene Reiche")
        ├── campaignContext (Hintergrundinfo für LLM)
        ├── backgroundImageUrl (generierbares Hintergrundbild)
        └── Session (eine Spielrunde)
              ├── sessionImageUrl (generierbares Header-Bild)
              ├── Recording (MP3-Chunk, filePath, durationSeconds)
              ├── Transcript (rawJson mit Segmenten, Speaker-Label, Timestamps)
              ├── Summary (narrative, npcs, quests, loot, locations, openThreads)
              └── SpeakerMap (discordUserId ↔ characterName ↔ playerName ↔ diarizationLabel)
```

**Hinweis Mitglieder-Modell:** Ein `discordName` (realer User) kann in verschiedenen
Kampagnen unterschiedliche Charaktere haben — die Zuordnung liegt daher pro
`GroupMembership`, nicht global am User.

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
- [x] Replicate WhisperX mit Speaker-Diarization
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
- [x] Sprecher-Zuordnung mit Diarization-Label + Transkript-Ausschnitt (Zwischenschritt, siehe ROADMAP.md für den geplanten vollautomatischen Fix)
- [x] Session-Bilder via Replicate (Header-Kachel mit Upload/Generate/Remove; automatischer Prompt aus Summary-Daten)
- [x] Session-Seite zeigt Kampagnen-Hintergrundbild (Parallax-Fixed) für konsistenten Look
- [x] Session-Paginierung (10 pro Kampagne, "Mehr laden"-Button)
- [ ] Quest-Wiki (Living Lore: Quests, NSCs, Orte, Beute, offene Fäden)
- [ ] Multi-User mit Super-Admin/DM-Rollensystem, DM-Registrierung
- [ ] Dokumentationsbereich im Panel

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
