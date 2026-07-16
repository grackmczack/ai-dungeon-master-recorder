import assert from "node:assert/strict";
import test from "node:test";
import { buildPrompt } from "../src/providers/llm.js";

const segments = [{ speaker: "SPEAKER_00", start: 65, end: 70, text: "We enter the keep." }];

test("summary language is included without changing the English image prompt requirement", () => {
  const prompt = buildPrompt(
    segments,
    { SPEAKER_00: "Aria" },
    undefined,
    "The keep is cursed.",
    "en"
  );
  assert.match(prompt, /fields in English/);
  assert.match(prompt, /Keep sessionImagePrompt in English/);
  assert.match(prompt, /\[1:05\] Aria: We enter the keep\./);
  assert.match(prompt, /The keep is cursed/);
});

test("German remains the default summary language", () => {
  assert.match(buildPrompt(segments, {}), /fields in German/);
});
