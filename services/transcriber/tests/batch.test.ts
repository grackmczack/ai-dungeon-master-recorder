import assert from "node:assert/strict";
import test from "node:test";
import { createChunkJobs } from "../src/batch.js";
import type { BatchChunkMeta, TranscriptionJobData } from "../src/types.js";

test("expands every queued recording chunk in order", () => {
  const data: TranscriptionJobData = {
    sessionId: "session-1",
    guildId: "guild-1",
    filePath: "/recordings/part0.mp3",
    filename: "part0.mp3",
    batchChunks: []
  };
  const chunks: BatchChunkMeta[] = [0, 1, 2].map((index) => ({
    filePath: `/recordings/part${index}.mp3`,
    filename: `part${index}.mp3`,
    durationSeconds: 1800,
    wavPath: `/recordings/part${index}.wav`
  }));

  const jobs = createChunkJobs(data, chunks);

  assert.deepEqual(
    jobs.map((job) => job.filename),
    ["part0.mp3", "part1.mp3", "part2.mp3"]
  );
  assert.deepEqual(
    jobs.map((job) => job.chunkIndex),
    [0, 1, 2]
  );
  assert.deepEqual(
    jobs.map((job) => job.isLastChunk),
    [false, false, true]
  );
  assert.ok(jobs.every((job) => job.totalChunks === 3));
});
