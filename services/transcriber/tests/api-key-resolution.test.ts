import assert from "node:assert/strict";
import test from "node:test";
import {
  applyGrantedKeyProfile,
  buildGrantedKeyProfile,
  resolveLlmApiKey,
  resolveWhisperApiKey
} from "../src/api-key-resolution.js";

test("a granted profile overrides credential providers atomically", () => {
  const profile = buildGrantedKeyProfile([
    {
      whisperProvider: "replicate",
      whisperApiKey: "r8_admin",
      replicateApiKey: "r8_images",
      llmProvider: "siliconflow",
      llmApiKey: "sk-admin",
      llmModel: "deepseek-ai/DeepSeek-V3",
      llmEndpoint: "https://api.siliconflow.com/v1/chat/completions"
    }
  ]);
  const effective = applyGrantedKeyProfile(
    { whisperProvider: "openai", llmProvider: "anthropic" },
    profile
  );

  assert.equal(effective.whisperProvider, "replicate");
  assert.equal(resolveWhisperApiKey("replicate", effective, {}), "r8_admin");
  assert.equal(effective.llmProvider, "siliconflow");
  assert.equal(resolveLlmApiKey("siliconflow", effective, {}), "sk-admin");
});

test("environment fallbacks are selected for the actual provider", () => {
  const env = {
    REPLICATE_API_KEY: "replicate-env",
    OPENAI_API_KEY: "openai-env",
    ANTHROPIC_API_KEY: "anthropic-env",
    GEMINI_API_KEY: "gemini-env",
    SILICONFLOW_API_KEY: "siliconflow-env"
  };

  assert.equal(resolveWhisperApiKey("replicate", null, env), "replicate-env");
  assert.equal(resolveWhisperApiKey("openai", null, env), "openai-env");
  assert.equal(resolveLlmApiKey("anthropic", null, env), "anthropic-env");
  assert.equal(resolveLlmApiKey("gemini", null, env), "gemini-env");
  assert.equal(resolveLlmApiKey("openai", null, env), "openai-env");
  assert.equal(resolveLlmApiKey("siliconflow", null, env), "siliconflow-env");
});

test("revoking a grant falls back to the DM's own profile", () => {
  const own = { whisperProvider: "openai", whisperApiKey: "own-openai" };
  const effective = applyGrantedKeyProfile(own, null);
  assert.equal(effective.whisperProvider, "openai");
  assert.equal(resolveWhisperApiKey("openai", effective, {}), "own-openai");
});

test("shared LLM keys without a model receive a provider-compatible model", () => {
  const profile = buildGrantedKeyProfile([
    { llmProvider: "gemini", llmApiKey: "gemini-key", llmModel: null }
  ]);
  assert.equal(profile?.llmModel, "gemini-2.5-flash");
});
