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
- **Kampagnen** mit Session-Timeline
- **Session-Detail** — 3 Tabs:
  - 📖 Summary (Chronik, NSCs, Quests, Beute, Orte, Offene Fäden)
  - 📝 Transkript (farbig nach Sprecher, mit Timestamps)
  - 👤 Sprecher (Discord-User → Charakternamen zuordnen)
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
  recordings/         ← MP3-Chunks (Docker Volume)
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
| POST | `/internal/sessions` | (intern) Session anlegen via Bot |

---

## Datenmodell

```
Group (Discord-Server / Spielgruppe)
  ├── GroupMembership (Mitglied — braucht KEINEN eigenen Login/Account in v1;
  │     userId optional (nur GM/DM), discordName, characterName, partyRole,
  │     avatarUrl, characterSheetUrl, Rolle GM/PLAYER/OBSERVER, joinedAt/leftAt)
  ├── GroupSettings (API-Keys, Provider, Prompt, Kampagnen-Kontext)
  └── Campaign (Kampagne, z.B. "Vergessene Reiche")
        ├── campaignContext (Hintergrundinfo für LLM)
        └── Session (eine Spielrunde)
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

### v0 — aktuell
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
- [ ] Tagebuch-Tab (alle Session-Summaries chronologisch)
- [ ] Kampagnen umbenennen im Panel

### v1 — geplant
- [ ] Avatar + Gesichtsbild pro Mitglied
- [ ] Epische Session-Bilder via Replicate Seedream
- [ ] Charactersheet als PDF hinterlegen (→ LLM-Kontext)
- [ ] Multi-User mit Admin/User-Rollensystem
- [ ] Kampagnen-Übersicht als Share-Link

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
