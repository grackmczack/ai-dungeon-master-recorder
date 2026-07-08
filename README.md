# AI Dungeon Master Recorder

AI Dungeon Master Recorder is a Discord-first recording pipeline for tabletop roleplaying sessions. The project starts with a Discord bot that can join a voice channel, record a session, and store the resulting WAV file locally. The planned direction is a full session memory workflow: record, transcribe, summarize, extract campaign facts, and hand the result to automation workflows.

## Current Status

The repository currently contains the monorepo foundation and the first application:

- `apps/discord-recorder`: Discord bot with slash commands and voice recording service.
- `services/transcriber`: reserved for the future transcription service.
- `workflows/n8n`: reserved for future n8n workflow exports.
- `shared`: reserved for shared TypeScript types and helpers.
- `storage`: local runtime storage, including `storage/recordings`.

Implemented Discord commands:

- `/record`: checks whether the user is in a voice channel, joins that channel, and starts recording.
- `/stop`: stops the active recording and writes a WAV file to `storage/recordings`.
- `/status`: replies with `Bot online`.

No transcription, database usage, or n8n automation is active yet.

## Stack

- Node.js
- TypeScript with strict mode
- pnpm workspaces
- discord.js v14
- @discordjs/voice
- prism-media
- opusscript
- tweetnacl / libsodium-wrappers for Discord voice encryption support
- Docker Compose
- PostgreSQL container prepared for later use
- Redis container prepared for later use
- ESLint
- Prettier

## Repository Layout

```text
apps/
  discord-recorder/
    src/
      commands/
      services/
      types/

services/
  transcriber/

workflows/
  n8n/

shared/

storage/
  recordings/
```

## Planned Flow (extended from original)

The intended end-to-end flow is:

1. A user starts a Discord voice session.
2. The user runs `/record`.
3. The bot joins the user's voice channel.
4. The bot records the session audio.
5. The user runs `/stop`.
6. The bot saves a WAV file under `storage/recordings`.
7. WAV file have to be transformed into mp3 for storage reasons
8. A transcriber whisperX via API service picks up the recording. time and speakers have to be transcripted
9. The transcript is processed into summaries, scenes, NPC notes, quests, and campaign memory.
10. The bot posts the summary from the adventure into a chosen discord channel
11. to be discussed: n8n workflows automate follow-up steps, exports, notifications, or publishing.

The current implementation covers steps 1 through 6.

## Setup

Install dependencies from the repository root:

```powershell
pnpm install
```

Create an environment file for the Discord bot:

```powershell
Copy-Item apps/discord-recorder/.env.example apps/discord-recorder/.env
```

Fill in:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
```

The bot needs a Discord application with a bot token and application command permissions. It also needs voice channel permissions to view, connect, and receive voice data.

## Running The Discord Recorder

Start the bot in development mode:

```powershell
pnpm --filter @ai-dungeon-master-recorder/discord-recorder dev
```

Build and run the compiled app:

```powershell
pnpm --filter @ai-dungeon-master-recorder/discord-recorder build
pnpm --filter @ai-dungeon-master-recorder/discord-recorder start
```

When the bot starts, it registers the slash commands for the configured guild automatically.

## Docker Compose

Docker Compose currently prepares infrastructure only:

```powershell
docker compose up -d postgres redis
```

The application container is intentionally not started by Compose yet. PostgreSQL and Redis are included for later phases, but the current recorder does not use a database or queue.

## Storage

Recordings are written to:

```text
storage/recordings/
```

The filename format is:

```text
guildId-sessionId.wav
```

Runtime recordings are ignored by Git. The directory itself is kept through `.gitkeep`.

## Development Commands

```powershell
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm --filter @ai-dungeon-master-recorder/discord-recorder typecheck
```

## Roadmap

### Phase 1: Discord Recording

- [x] Monorepo setup
- [x] Discord bot bootstrap
- [x] Slash command registration
- [x] Voice channel join
- [x] WAV file output
- [ ] Stabilize multi-user audio capture across Discord voice states
- [ ] Add recording diagnostics and health reporting
- [ ] Add integration tests around WAV generation

### Phase 2: Transcription

- [ ] Implement `services/transcriber`
- [ ] Watch or consume new recordings
- [ ] Generate transcripts from WAV files
- [ ] Store transcript artifacts in a predictable format
- [ ] Add retry and failure handling

### Phase 3: Campaign Intelligence

- [ ] Extract session summaries
- [ ] Extract NPCs, places, quests, items, and open threads
- [ ] Create structured shared types in `shared`
- [ ] Prepare data for search and later retrieval

### Phase 4: Automation

- [ ] Add n8n workflow definitions under `workflows/n8n`
- [ ] Trigger workflows after transcription
- [ ] Send summaries to Discord
- [ ] Export campaign notes to external tools

### Phase 5: Persistence And Operations

- [ ] Introduce PostgreSQL for structured session metadata
- [ ] Introduce Redis for jobs and coordination
- [ ] Add Docker Compose app services
- [ ] Add production-ready environment configuration
- [ ] Add logging, metrics, and error reporting

## Notes

This project is intentionally incremental. The first milestone is a reliable Discord recorder. Transcription, databases, and workflow automation are planned but deliberately kept out of the initial recording surface.

### Adaption, Thoughts to implemented in reworked version
- i need a backend where i can implement and edit campaign details or create new campaigns. first iteration v0 would be single user with login, v1 multiuser with admin-user rolesystem
- database to store campaigns and adventures (the round which are to summerise)
- whisper via Api for transcription planned, need of a settings section for flexibel api key or endpoint to choose maybe another transcription service
- model selection for the narrative part which translates the dialogue into an nice summary which happend, quests are solved, monsters are slayed and so on.
- the technical backend have to be styled afterwards in a nice and intuitive modern way and layout 
