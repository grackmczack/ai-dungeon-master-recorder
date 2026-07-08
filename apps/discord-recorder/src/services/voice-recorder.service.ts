import {
  EndBehaviorType,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  type DiscordGatewayAdapterCreator,
  VoiceConnectionStatus,
  type VoiceConnection
} from "@discordjs/voice";
import { GuildMember } from "discord.js";
import { randomUUID } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prism from "prism-media";
import type { AudioReceiveStream } from "@discordjs/voice";
import type { Collection, Snowflake } from "discord.js";
import type { WriteStream } from "node:fs";
import type { Transform } from "node:stream";

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;
const FRAME_DURATION_MS = 20;
const FRAME_BYTES = (SAMPLE_RATE / (1000 / FRAME_DURATION_MS)) * CHANNELS * BYTES_PER_SAMPLE;
const WAV_HEADER_BYTES = 44;

// Chunk alle 30 Minuten
const CHUNK_INTERVAL_MS = 30 * 60 * 1000;
// Failsafe: max 4h Aufnahme
const MAX_RECORDING_MS = 4 * 60 * 60 * 1000;
// Auto-Stop nach X Sekunden Stille (alle User weg)
const SILENCE_BEFORE_STOP_MS = 30_000;

const DEFAULT_RECORDINGS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../storage/recordings"
);

interface Chunk {
  filename: string;
  filePath: string;
  output: WriteStream;
  pcmBytesWritten: number;
  startedAt: Date;
  index: number;
}

interface ActiveRecording {
  guildId: string;
  sessionId: string;
  connection: VoiceConnection;
  participants: Map<string, ParticipantAudio>;
  mixer: NodeJS.Timeout;
  chunks: Chunk[];
  currentChunk: Chunk;
  chunkTimer: NodeJS.Timeout;
  maxTimer: NodeJS.Timeout;
  silenceTimer: NodeJS.Timeout | null;
  onChunkReady: (chunk: Chunk, isLast: boolean) => Promise<void>;
  onAutoStop: () => Promise<void>;
}

export interface StopResult {
  chunks: Array<{ filename: string; filePath: string; index: number }>;
  participantIds: string[];
}

class ParticipantAudio {
  private pending = Buffer.alloc(0);
  private active = true;

  public constructor(
    public readonly userId: string,
    private readonly opusStream: AudioReceiveStream,
    private readonly decoder: Transform
  ) {
    this.opusStream.once("close", () => { this.active = false; });
    this.opusStream.once("end", () => { this.active = false; });
    this.opusStream.once("error", () => { this.active = false; });
    this.decoder.once("error", () => { this.active = false; });
    this.decoder.on("data", (chunk: Buffer) => {
      this.pending = Buffer.concat([this.pending, chunk]);
    });
    this.opusStream.pipe(this.decoder);
  }

  public get isActive(): boolean { return this.active; }

  public readFrame(): Buffer | null {
    if (this.pending.length < FRAME_BYTES) return null;
    const frame = this.pending.subarray(0, FRAME_BYTES);
    this.pending = this.pending.subarray(FRAME_BYTES);
    return frame;
  }

  public stop(): void {
    this.opusStream.destroy();
    this.decoder.destroy();
  }
}

export class VoiceRecorderService {
  private readonly recordings = new Map<string, ActiveRecording>();

  public constructor(private readonly recordingsDir = DEFAULT_RECORDINGS_DIR) {}


  public async start(
    member: GuildMember,
    onChunkReady: (chunk: Chunk, isLast: boolean) => Promise<void>,
    onAutoStop: () => Promise<void>
  ): Promise<void> {
    const { guild, voice } = member;
    const voiceChannel = voice.channel;

    if (!voiceChannel) throw new Error("USER_NOT_IN_VOICE_CHANNEL");
    if (this.recordings.has(guild.id)) throw new Error("RECORDING_ALREADY_ACTIVE");

    await fs.mkdir(this.recordingsDir, { recursive: true });

    const sessionId = randomUUID();
    const firstChunk = await this.createChunk(guild.id, sessionId, 0);

    const existingConnection = getVoiceConnection(guild.id);
    existingConnection?.destroy();

    console.log(`[RECORDER] Joining ${voiceChannel.id} in guild ${guild.id}`);
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    const recording: ActiveRecording = {
      guildId: guild.id,
      sessionId,
      connection,
      participants: new Map(),
      chunks: [firstChunk],
      currentChunk: firstChunk,
      onChunkReady,
      onAutoStop,
      silenceTimer: null,
      mixer: setInterval(() => this.writeMixedFrame(recording), FRAME_DURATION_MS),
      chunkTimer: setInterval(() => {
        void this.rotateChunk(recording);
      }, CHUNK_INTERVAL_MS),
      maxTimer: setTimeout(() => {
        console.log(`[RECORDER] Max recording time reached for guild ${guild.id} — auto-stopping`);
        void onAutoStop();
      }, MAX_RECORDING_MS)
    };

    // Speaking Events
    connection.receiver.speaking.on("start", (userId) => {
      this.trackParticipant(recording, userId);
      // Silence Timer zurücksetzen wenn jemand spricht
      if (recording.silenceTimer) {
        clearTimeout(recording.silenceTimer);
        recording.silenceTimer = null;
      }
    });

    // Voice State: Auto-Stop wenn alle weg sind
    guild.client.on("voiceStateUpdate", (oldState, newState) => {
      if (oldState.guild.id !== guild.id) return;
      if (newState.member?.user.bot) return;

      const members = voiceChannel.members.filter(m => !m.user.bot);
      if (members.size === 0) {
        console.log(`[RECORDER] All users left voice channel in guild ${guild.id} — starting silence timer`);
        if (!recording.silenceTimer) {
          recording.silenceTimer = setTimeout(() => {
            console.log(`[RECORDER] Silence timeout — auto-stopping guild ${guild.id}`);
            void onAutoStop();
          }, SILENCE_BEFORE_STOP_MS);
        }
      }
    });

    connection.on("stateChange", (_, newState) => {
      console.log(`[VOICE STATE] ${guild.id}: → ${newState.status}`);
    });

    this.trackCurrentMembers(recording, voiceChannel.members, member.client.user.id);
    this.recordings.set(guild.id, recording);
    console.log(`[RECORDER] Session ${sessionId} started for guild ${guild.id}`);

    void entersState(connection, VoiceConnectionStatus.Ready, 15_000)
      .then(() => console.log(`[RECORDER] Voice ready for guild ${guild.id}`))
      .catch((e) => console.warn(`[RECORDER] Voice ready timeout:`, e));
  }

  private async createChunk(guildId: string, sessionId: string, index: number): Promise<Chunk> {
    const filename = `${guildId}-${sessionId}-part${index}.wav`;
    const filePath = path.join(this.recordingsDir, filename);
    const output = createWriteStream(filePath);
    output.write(createWavHeader(0));
    return { filename, filePath, output, pcmBytesWritten: 0, startedAt: new Date(), index };
  }

  private async rotateChunk(recording: ActiveRecording, isLast = false): Promise<void> {
    const oldChunk = recording.currentChunk;
    console.log(`[RECORDER] Rotating chunk ${oldChunk.index} for guild ${recording.guildId}`);

    if (!isLast) {
      // Neuen Chunk anlegen bevor der alte finalisiert wird (kein Gap)
      const newChunk = await this.createChunk(
        recording.guildId,
        recording.sessionId,
        oldChunk.index + 1
      );
      recording.currentChunk = newChunk;
      recording.chunks.push(newChunk);
    }

    // Alten Chunk finalisieren
    await new Promise<void>((resolve, reject) => {
      oldChunk.output.once("error", reject);
      oldChunk.output.end(() => resolve());
    });
    await this.finalizeWavHeader(oldChunk.filePath, oldChunk.pcmBytesWritten);

    console.log(`[RECORDER] Chunk ${oldChunk.index} ready: ${oldChunk.filename} (${oldChunk.pcmBytesWritten} PCM bytes)`);
    await recording.onChunkReady(oldChunk, isLast);
  }

  public async stop(guildId: string): Promise<StopResult> {
    const recording = this.recordings.get(guildId);
    if (!recording) throw new Error("NO_RECORDING_ACTIVE");

    this.recordings.delete(guildId);
    clearInterval(recording.mixer);
    clearInterval(recording.chunkTimer);
    clearTimeout(recording.maxTimer);
    if (recording.silenceTimer) clearTimeout(recording.silenceTimer);

    console.log(`[RECORDER] Stopping recording for guild ${guildId} — ${recording.chunks.length} chunk(s) total`);

    for (const participant of recording.participants.values()) {
      participant.stop();
    }

    recording.connection.destroy();

    // Letzten Chunk finalisieren
    await this.rotateChunk(recording, true);

    return {
      chunks: recording.chunks.map(c => ({ filename: c.filename, filePath: c.filePath, index: c.index })),
      participantIds: [...recording.participants.keys()]
    };
  }

  public isRecording(guildId: string): boolean {
    return this.recordings.has(guildId);
  }

  public getRecordingInfo(guildId: string): { chunkCount: number; startedAt: Date } | null {
    const r = this.recordings.get(guildId);
    if (!r) return null;
    return { chunkCount: r.chunks.length, startedAt: r.chunks[0]!.startedAt };
  }

  private trackParticipant(recording: ActiveRecording, userId: string): void {
    const existing = recording.participants.get(userId);
    if (existing?.isActive) return;
    existing?.stop();

    const opusStream = recording.connection.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.Manual }
    });
    const decoder = new prism.opus.Decoder({
      rate: SAMPLE_RATE,
      channels: CHANNELS,
      frameSize: SAMPLE_RATE / (1000 / FRAME_DURATION_MS)
    });
    recording.participants.set(userId, new ParticipantAudio(userId, opusStream, decoder));
    console.log(`[RECORDER] Tracking user ${userId}`);
  }

  private trackCurrentMembers(
    recording: ActiveRecording,
    members: Collection<Snowflake, GuildMember>,
    botUserId: string
  ): void {
    for (const m of members.values()) {
      if (m.user.id === botUserId || m.user.bot) continue;
      this.trackParticipant(recording, m.user.id);
    }
  }

  private writeMixedFrame(recording: ActiveRecording): void {
    const frames = [...recording.participants.values()]
      .map(p => p.readFrame())
      .filter((f): f is Buffer => f !== null);
    const mixed = mixFrames(frames);
    recording.currentChunk.output.write(mixed);
    recording.currentChunk.pcmBytesWritten += mixed.length;
  }

  private async finalizeWavHeader(filePath: string, pcmBytesWritten: number): Promise<void> {
    const handle = await fs.open(filePath, "r+");
    try {
      await handle.write(createWavHeader(pcmBytesWritten), 0, WAV_HEADER_BYTES, 0);
    } finally {
      await handle.close();
    }
  }
}

function mixFrames(frames: Buffer[]): Buffer {
  if (frames.length === 0) return Buffer.alloc(FRAME_BYTES);
  if (frames.length === 1) return Buffer.from(frames[0]!);
  const mixed = Buffer.alloc(FRAME_BYTES);
  for (let i = 0; i < FRAME_BYTES; i += BYTES_PER_SAMPLE) {
    let s = 0;
    for (const f of frames) s += f.readInt16LE(i);
    mixed.writeInt16LE(Math.max(-32768, Math.min(32767, s)), i);
  }
  return mixed;
}

function createWavHeader(pcmBytes: number): Buffer {
  const h = Buffer.alloc(WAV_HEADER_BYTES);
  const byteRate = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcmBytes, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(CHANNELS, 22); h.writeUInt32LE(SAMPLE_RATE, 24);
  h.writeUInt32LE(byteRate, 28); h.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32);
  h.writeUInt16LE(BYTES_PER_SAMPLE * 8, 34); h.write("data", 36);
  h.writeUInt32LE(pcmBytes, 40);
  return h;
}
