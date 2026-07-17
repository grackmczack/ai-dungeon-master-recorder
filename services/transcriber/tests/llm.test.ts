import assert from "node:assert/strict";
import test from "node:test";
import { buildPrompt, LANGUAGE_SYSTEM_INSTRUCTION } from "../src/providers/llm.js";

const segments = [{ speaker: "SPEAKER_00", start: 65, end: 70, text: "We enter the keep." }];

test("summary stays German while the image prompt stays English", () => {
  const prompt = buildPrompt(
    segments,
    { SPEAKER_00: "Aria" },
    undefined,
    "The keep is cursed.",
    "en"
  );
  assert.match(prompt, /alle Inhalte der Zusammenfassung auf Deutsch/);
  assert.match(prompt, /Ausschließlich der Wert von sessionImagePrompt wird auf Englisch/);
  assert.doesNotMatch(prompt, /fields in English/);
  assert.match(prompt, /\[1:05\] Aria: We enter the keep\./);
  assert.match(prompt, /The keep is cursed/);
  assert.ok(prompt.lastIndexOf(LANGUAGE_SYSTEM_INSTRUCTION) > prompt.lastIndexOf("TRANSKRIPT:"));
});

test("a custom prompt cannot remove the binding language split", () => {
  const prompt = buildPrompt(segments, {}, "Return a concise JSON summary in English.");
  assert.match(prompt, /Return a concise JSON summary in English/);
  assert.ok(prompt.endsWith(LANGUAGE_SYSTEM_INSTRUCTION));
  assert.match(prompt, /sessionImagePrompt wird auf Englisch/);
});
