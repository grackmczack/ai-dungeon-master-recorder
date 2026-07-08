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
const DEFAULT_RECORDINGS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../storage/recordings"
);

interface ActiveRecording {
  filename: string;
  filePath: string;
  connection: VoiceConnection;
  output: WriteStream;
  participants: Map<string, ParticipantAudio>;
  mixer: NodeJS.Timeout;
  pcmBytesWritten: number;
}

interface StopResult {
  filename: string;
  filePath: string;
  participantIds: string[];
}

class ParticipantAudio {
  private pending = Buffer.alloc(0);
  private opusBytesReceived = 0;
  private pcmBytesDecoded = 0;
  private active = true;

  public constructor(
    public readonly userId: string,
    private readonly opusStream: AudioReceiveStream,
    private readonly decoder: Transform
  ) {
    console.log(`[PARTICIPANT AUDIO] Constructor called for user ${userId}`);

    this.opusStream.on("data", (chunk: Buffer) => {
      this.opusBytesReceived += chunk.length;
      if (this.opusBytesReceived % 1000 < chunk.length) {
        console.log(`[OPUS DATA] User ${userId}: received ${chunk.length} bytes (total: ${this.opusBytesReceived})`);
      }
    });

    this.opusStream.once("close", () => {
      console.log(`[OPUS STREAM] User ${userId}: stream closed`);
      this.active = false;
    });

    this.opusStream.once("end", () => {
      console.log(`[OPUS STREAM] User ${userId}: stream ended`);
      this.active = false;
    });

    this.opusStream.once("error", (error) => {
      console.error(`[OPUS ERROR] Audio receive stream failed for user ${this.userId}`, error);
      this.active = false;
    });

    this.decoder.on("data", (chunk: Buffer) => {
      this.pcmBytesDecoded += chunk.length;
      this.pending = Buffer.concat([this.pending, chunk]);
      if (this.pcmBytesDecoded % 5000 < chunk.length) {
        console.log(`[PCM DATA] User ${userId}: decoded ${chunk.length} bytes (total: ${this.pcmBytesDecoded})`);
      }
    });

    this.decoder.once("error", (error) => {
      console.error(`[DECODER ERROR] Opus decoder failed for user ${this.userId}`, error);
      this.active = false;
    });

    this.opusStream.pipe(this.decoder);
    console.log(`[PARTICIPANT AUDIO] Piped opus stream to decoder for user ${userId}`);
  }

  public get isActive(): boolean {
    return this.active;
  }

  public get stats(): string {
    return `${this.userId}: opus=${this.opusBytesReceived} bytes, pcm=${this.pcmBytesDecoded} bytes, pending=${this.pending.length} bytes`;
  }

  public readFrame(): Buffer | null {
    if (this.pending.length < FRAME_BYTES) {
      return null;
    }

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

  public async start(member: GuildMember): Promise<void> {
    const { guild, voice } = member;
    const voiceChannel = voice.channel;

    if (!voiceChannel) {
      throw new Error("USER_NOT_IN_VOICE_CHANNEL");
    }

    if (this.recordings.has(guild.id)) {
      throw new Error("RECORDING_ALREADY_ACTIVE");
    }

    await fs.mkdir(this.recordingsDir, { recursive: true });

    const sessionId = randomUUID();
    const filename = `${guild.id}-${sessionId}.wav`;
    const filePath = path.join(this.recordingsDir, filename);
    const output = createWriteStream(filePath);

    output.write(createWavHeader(0));

    const existingConnection = getVoiceConnection(guild.id);
    existingConnection?.destroy();

    console.log(`[VOICE CONNECT] Joining voice channel ${voiceChannel.id} in guild ${guild.id}`);
    console.log(`[VOICE CONNECT] Adapter creator available: ${!!voiceChannel.guild.voiceAdapterCreator}`);

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    console.log(`[VOICE CONNECT] Connection created, current state: ${connection.state.status}`);

    const recording: ActiveRecording = {
      filename,
      filePath,
      connection,
      output,
      participants: new Map(),
      mixer: setInterval(() => {
        this.writeMixedFrame(recording);
      }, FRAME_DURATION_MS),
      pcmBytesWritten: 0
    };

    connection.receiver.speaking.on("start", (userId) => {
      console.log(`[SPEAKING START] User ${userId} started speaking`);
      this.trackParticipant(recording, userId);
    });

    connection.receiver.speaking.on("end", (userId) => {
      console.log(`[SPEAKING END] User ${userId} stopped speaking`);
    });

    connection.on("stateChange", (oldState, newState) => {
      console.log(
        `[VOICE STATE] Guild ${guild.id}: ${oldState.status} -> ${newState.status}`
      );
      
      if (newState.status === VoiceConnectionStatus.Ready) {
        console.log(`[VOICE READY] UDP connection established for guild ${guild.id}`);
      }
      
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        console.log(`[VOICE DISCONNECTED] Reason: ${newState.reason || 'unknown'}`);
      }
    });

    this.trackCurrentMembers(recording, voiceChannel.members, member.client.user.id);
    this.recordings.set(guild.id, recording);
    console.log(`Recording session started for guild ${guild.id} in channel ${voiceChannel.id}`);
    void this.logVoiceReadyState(connection, guild.id);
  }

  private async logVoiceReadyState(connection: VoiceConnection, guildId: string): Promise<void> {
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
      console.log(`[VOICE READY STATE] Voice connection ready for guild ${guildId}`);
    } catch (error) {
      console.warn(
        `[VOICE READY STATE] Voice connection did not report ready within 15 seconds for guild ${guildId}; recording remains active.`,
        error
      );
      console.log(`[VOICE READY STATE] Current state: ${connection.state.status}`);
    }
  }

  public async stop(guildId: string): Promise<StopResult> {
    console.log(`[RECORDING STOP] Stopping recording for guild ${guildId}`);
    const recording = this.recordings.get(guildId);

    if (!recording) {
      throw new Error("NO_RECORDING_ACTIVE");
    }

    this.recordings.delete(guildId);
    clearInterval(recording.mixer);

    console.log(`[RECORDING STOP] Stopping ${recording.participants.size} participants`);
    for (const participant of recording.participants.values()) {
      participant.stop();
    }

    console.log(`[RECORDING STOP] Destroying voice connection`);
    recording.connection.destroy();

    await new Promise<void>((resolve, reject) => {
      recording.output.once("error", reject);
      recording.output.end(() => resolve());
    });

    await this.finalizeWavHeader(recording.filePath, recording.pcmBytesWritten);
    this.logRecordingStats(recording);

    return {
      filename: recording.filename,
      filePath: recording.filePath,
      participantIds: [...recording.participants.keys()]
    };
  }

  private trackParticipant(recording: ActiveRecording, userId: string): void {
    const existingParticipant = recording.participants.get(userId);

    if (existingParticipant?.isActive) {
      console.log(`[PARTICIPANT] User ${userId} already tracked and active`);
      return;
    }

    existingParticipant?.stop();
    console.log(`[PARTICIPANT] Starting to track user ${userId}`);

    const opusStream = recording.connection.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.Manual
      }
    });

    console.log(`[PARTICIPANT] Created Opus stream for user ${userId}`);

    const decoder = new prism.opus.Decoder({
      rate: SAMPLE_RATE,
      channels: CHANNELS,
      frameSize: SAMPLE_RATE / (1000 / FRAME_DURATION_MS)
    });

    const participant = new ParticipantAudio(userId, opusStream, decoder);
    recording.participants.set(userId, participant);
    console.log(`[PARTICIPANT] User ${userId} now tracked with decoder`);
  }

  private trackCurrentMembers(
    recording: ActiveRecording,
    members: Collection<Snowflake, GuildMember>,
    botUserId: string
  ): void {
    console.log(`[TRACK MEMBERS] Found ${members.size} members in voice channel`);
    for (const channelMember of members.values()) {
      if (channelMember.user.id === botUserId || channelMember.user.bot) {
        console.log(`[TRACK MEMBERS] Skipping bot ${channelMember.user.id}`);
        continue;
      }

      console.log(`[TRACK MEMBERS] Subscribing to current voice member ${channelMember.user.id}`);
      this.trackParticipant(recording, channelMember.user.id);
    }
  }

  private writeMixedFrame(recording: ActiveRecording): void {
    const frames = [...recording.participants.values()]
      .map((participant) => participant.readFrame())
      .filter((frame): frame is Buffer => frame !== null);

    if (frames.length > 0) {
      console.log(`[MIXER] Mixing ${frames.length} audio frames`);
    }

    const mixedFrame = mixFrames(frames);
    recording.output.write(mixedFrame);
    recording.pcmBytesWritten += mixedFrame.length;
  }

  private async finalizeWavHeader(filePath: string, pcmBytesWritten: number): Promise<void> {
    const handle = await fs.open(filePath, "r+");

    try {
      await handle.write(createWavHeader(pcmBytesWritten), 0, WAV_HEADER_BYTES, 0);
    } finally {
      await handle.close();
    }
  }

  private logRecordingStats(recording: ActiveRecording): void {
    const participantStats =
      recording.participants.size === 0
        ? "no participants received"
        : [...recording.participants.values()].map((participant) => participant.stats).join("; ");

    console.log(
      `Recording saved to ${recording.filePath} (${recording.pcmBytesWritten} PCM bytes). Participants: ${participantStats}`
    );
  }
}

function mixFrames(frames: Buffer[]): Buffer {
  if (frames.length === 0) {
    return Buffer.alloc(FRAME_BYTES);
  }

  const firstFrame = frames[0];

  if (!firstFrame) {
    return Buffer.alloc(FRAME_BYTES);
  }

  if (frames.length === 1) {
    return Buffer.from(firstFrame);
  }

  const mixed = Buffer.alloc(FRAME_BYTES);

  for (let offset = 0; offset < FRAME_BYTES; offset += BYTES_PER_SAMPLE) {
    let sample = 0;

    for (const frame of frames) {
      sample += frame.readInt16LE(offset);
    }

    mixed.writeInt16LE(clampInt16(sample), offset);
  }

  return mixed;
}

function clampInt16(value: number): number {
  return Math.max(-32768, Math.min(32767, value));
}

function createWavHeader(pcmBytes: number): Buffer {
  const header = Buffer.alloc(WAV_HEADER_BYTES);
  const byteRate = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;
  const blockAlign = CHANNELS * BYTES_PER_SAMPLE;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBytes, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BYTES_PER_SAMPLE * 8, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBytes, 40);

  return header;
}
