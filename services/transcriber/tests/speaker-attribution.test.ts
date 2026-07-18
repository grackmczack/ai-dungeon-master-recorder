import assert from "node:assert/strict";
import test from "node:test";
import { attributeTranscriptSpeakers, speakerAtTime } from "../src/speaker-attribution.js";
import type { TranscriptResult } from "../src/types.js";

test("maps Whisper words directly to Discord users and splits at speaker changes", () => {
  const transcript: TranscriptResult = {
    provider: "openai-whisper",
    language: "de",
    segments: [{ speaker: "SPEAKER_00", start: 0, end: 2, text: "Hallo ja gerne" }],
    words: [
      { word: "Hallo", start: 0.1, end: 0.5 },
      { word: "ja", start: 0.8, end: 1.0 },
      { word: "gerne", start: 1.1, end: 1.5 }
    ]
  };

  const result = attributeTranscriptSpeakers(transcript, [
    { userId: "discord-a", start: 0, end: 650 },
    { userId: "discord-b", start: 700, end: 1700 }
  ]);

  assert.equal(result.strategy, "discord-word-timestamps");
  assert.deepEqual(result.usedUserIds, ["discord-a", "discord-b"]);
  assert.deepEqual(result.segments, [
    { speaker: "discord-a", start: 0.1, end: 0.5, text: "Hallo" },
    { speaker: "discord-b", start: 0.8, end: 1.5, text: "ja gerne" }
  ]);
});

test("uses the largest overlap when two users talk at the same time", () => {
  assert.equal(
    speakerAtTime(1, 1.6, [
      { userId: "short", start: 1000, end: 1150 },
      { userId: "long", start: 1050, end: 1700 }
    ]),
    "long"
  );
});

test("compensates for small timestamp drift but not long silent gaps", () => {
  const activity = [{ userId: "discord-a", start: 1000, end: 2000 }];
  assert.equal(speakerAtTime(0.7, 0.8, activity), "discord-a");
  assert.equal(speakerAtTime(0.1, 0.2, activity), null);
});

test("falls back to dominant segment overlap when words are unavailable", () => {
  const transcript: TranscriptResult = {
    provider: "selfhosted-whisper",
    language: "de",
    segments: [
      { speaker: "SPEAKER_00", start: 0, end: 1, text: "Erster Satz" },
      { speaker: "SPEAKER_00", start: 2, end: 3, text: "Zweiter Satz" }
    ]
  };
  const result = attributeTranscriptSpeakers(transcript, [
    { userId: "discord-a", start: 0, end: 1100 },
    { userId: "discord-b", start: 1900, end: 3100 }
  ]);

  assert.equal(result.strategy, "discord-segment-overlap");
  assert.deepEqual(
    result.segments.map((segment) => segment.speaker),
    ["discord-a", "discord-b"]
  );
});

test("preserves provider labels if no Discord activity exists", () => {
  const transcript: TranscriptResult = {
    provider: "replicate-whisperx",
    language: "de",
    segments: [{ speaker: "SPEAKER_03", start: 0, end: 1, text: "Test" }]
  };
  const result = attributeTranscriptSpeakers(transcript, []);
  assert.equal(result.strategy, "provider");
  assert.equal(result.segments[0]?.speaker, "SPEAKER_03");
});
