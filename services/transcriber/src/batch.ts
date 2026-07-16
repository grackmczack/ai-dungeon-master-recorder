import type { BatchChunkMeta, TranscriptionJobData } from "./types.js";

/** Expand one queued batch into the ordered per-file jobs required by size-limited providers. */
export function createChunkJobs(
  data: TranscriptionJobData,
  chunks: BatchChunkMeta[]
): TranscriptionJobData[] {
  return chunks.map((chunk, index) => ({
    ...data,
    filePath: chunk.filePath,
    filename: chunk.filename,
    durationSeconds: chunk.durationSeconds,
    chunkIndex: index,
    isLastChunk: index === chunks.length - 1,
    totalChunks: chunks.length
  }));
}
