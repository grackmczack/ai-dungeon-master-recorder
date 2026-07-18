import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAdminKeyProfile,
  buildAdminKeyProfile,
  stripGrantedFields
} from "../src/lib/admin-api-keys.js";

const source = {
  whisperProvider: "replicate",
  whisperApiKey: "r8_whisper",
  whisperEndpoint: null,
  replicateApiKey: "r8_images",
  llmProvider: "siliconflow",
  llmApiKey: "sk-siliconflow",
  llmModel: "deepseek-ai/DeepSeek-V3",
  llmEndpoint: "https://api.siliconflow.com/v1/chat/completions"
};

test("admin grants keep provider, model, endpoint and key together", () => {
  const profile = buildAdminKeyProfile([source]);
  assert.ok(profile);
  assert.deepEqual(profile.availability, {
    whisper: true,
    replicate: true,
    llm: true
  });

  const effective = applyAdminKeyProfile(
    {
      whisperProvider: "openai",
      llmProvider: "anthropic",
      llmSystemPrompt: "tenant prompt",
      postSummaryChannelId: "12345678901234567"
    },
    profile
  );
  assert.equal(effective.whisperProvider, "replicate");
  assert.equal(effective.whisperApiKey, "r8_whisper");
  assert.equal(effective.replicateApiKey, "r8_images");
  assert.equal(effective.llmProvider, "siliconflow");
  assert.equal(effective.llmModel, "deepseek-ai/DeepSeek-V3");
  assert.equal(effective.llmSystemPrompt, "tenant prompt");
  assert.equal(effective.postSummaryChannelId, "12345678901234567");
});

test("granted fields cannot be overwritten while unrelated tenant settings remain writable", () => {
  const profile = buildAdminKeyProfile([source]);
  const stripped = stripGrantedFields(
    {
      whisperProvider: "openai",
      whisperApiKey: "own-whisper",
      replicateApiKey: "own-replicate",
      llmProvider: "anthropic",
      llmApiKey: "own-llm",
      llmSystemPrompt: "custom prompt",
      imageGenModel: "custom/image-model"
    },
    profile
  );

  assert.equal(stripped.whisperProvider, undefined);
  assert.equal(stripped.whisperApiKey, undefined);
  assert.equal(stripped.replicateApiKey, undefined);
  assert.equal(stripped.llmProvider, undefined);
  assert.equal(stripped.llmApiKey, undefined);
  assert.equal(stripped.llmSystemPrompt, "custom prompt");
  assert.equal(stripped.imageGenModel, "custom/image-model");
});

test("without an active profile the DM's own settings are used unchanged", () => {
  assert.equal(buildAdminKeyProfile([]), null);
  assert.deepEqual(applyAdminKeyProfile({ llmApiKey: "own-key" }, null), {
    llmApiKey: "own-key"
  });
});

test("a missing shared model gets a provider-compatible default", () => {
  const profile = buildAdminKeyProfile([{ ...source, llmModel: null }]);
  assert.equal(profile?.llmProvider, "siliconflow");
  assert.equal(profile?.llmModel, "deepseek-ai/DeepSeek-V3");
});
