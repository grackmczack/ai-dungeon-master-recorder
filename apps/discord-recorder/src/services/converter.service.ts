import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "node:fs";
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

  await new Promise<void>((resolve, reject) => {
    ffmpeg(wavPath)
      .audioCodec("libmp3lame")
      .audioBitrate(128)
      .audioChannels(2)
      .audioFrequency(48000)
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

  // Remove original WAV to save space
  await fs.unlink(wavPath);

  return { mp3Path, mp3Filename, durationSeconds };
}
