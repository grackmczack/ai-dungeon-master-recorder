import type { BatchChunkMeta, TranscriptionJobData } from "./types.js";

function inferredIndex(chunk: BatchChunkMeta, fallback: number): number {
  if (Number.isInteger(chunk.index) && (chunk.index ?? -1) >= 0) return chunk.index!;
  const filenameIndex = /(?:part|chunk)[-_]?(\d+)/i.exec(chunk.filename)?.[1];
  return filenameIndex === undefined ? fallback : Number(filenameIndex);
}

export function orderBatchChunks(chunks: BatchChunkMeta[]): BatchChunkMeta[] {
  return chunks
    .map((chunk, position) => ({ chunk, position, index: inferredIndex(chunk, position) }))
    .sort((a, b) => a.index - b.index || a.position - b.position)
    .map(({ chunk, index }) => ({ ...chunk, index }));
}

/** Expand one queued batch into the ordered per-file jobs required by size-limited providers. */
export function createChunkJobs(
  data: TranscriptionJobData,
  chunks: BatchChunkMeta[]
): TranscriptionJobData[] {
  const ordered = orderBatchChunks(chunks);
  return ordered.map((chunk, position) => ({
    ...data,
    filePath: chunk.filePath,
    filename: chunk.filename,
    durationSeconds: chunk.durationSeconds,
    chunkIndex: position,
    isLastChunk: position === ordered.length - 1,
    totalChunks: ordered.length
  }));
}
