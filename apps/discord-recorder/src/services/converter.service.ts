import ffmpeg from "fluent-ffmpeg";
import path from "node:path";

export interface ConversionResult {
  mp3Path: string;
  mp3Filename: string;
  durationSeconds: number;
}

export async function convertWavToMp3(wavPath: string): Promise<ConversionResult> {
  const dir = path.dirname(wavPath);
  const base = path.basename(wavPath, ".wav");
  const mp3Path = path.join(dir, `${base}.mp3`);
  const mp3Filename = `${base}.mp3`;

  // Downsample fuer Whisper: 16kHz mono reicht fuer Spracherkennung
  // 64kbps ist mehr als genug fuer Sprache (Podcasts nutzen 64kbps stereo)
  // Reduziert Dateigroesse um ~75% vs 48kHz/128kbps
  await new Promise<void>((resolve, reject) => {
    ffmpeg(wavPath)
      .audioCodec("libmp3lame")
      .audioBitrate(64)
      .audioChannels(1)
      .audioFrequency(16000)
      .format("mp3")
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(mp3Path);
  });

  // Get duration via ffprobe
  const durationSeconds = await new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(mp3Path, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration ?? 0);
    });
  });

  // WAV NICHT loeschen — wird erst nach erfolgreicher Transkription+Summary bereinigt
  // Dies ermoeglicht Crash-Recovery

  return { mp3Path, mp3Filename, durationSeconds };
}
