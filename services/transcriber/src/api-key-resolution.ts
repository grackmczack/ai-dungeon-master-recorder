export interface SharedKeySettings {
  whisperProvider?: string | null;
  whisperApiKey?: string | null;
  whisperEndpoint?: string | null;
  huggingfaceToken?: string | null;
  replicateApiKey?: string | null;
  llmProvider?: string | null;
  llmApiKey?: string | null;
  llmModel?: string | null;
  llmEndpoint?: string | null;
}

function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function defaultLlmModel(provider: string | null | undefined): string {
  switch (provider) {
    case "gemini":
      return "gemini-2.5-flash";
    case "openai":
      return "gpt-4o-mini";
    case "siliconflow":
      return "deepseek-ai/DeepSeek-V3";
    case "ollama":
      return "llama3.1";
    default:
      return "claude-opus-4-8";
  }
}

export function buildGrantedKeyProfile(sources: SharedKeySettings[]): SharedKeySettings | null {
  const profile: SharedKeySettings = {};

  for (const source of sources) {
    if (!present(profile.whisperApiKey) && present(source.whisperApiKey)) {
      profile.whisperProvider = source.whisperProvider;
      profile.whisperApiKey = source.whisperApiKey.trim();
      profile.whisperEndpoint = source.whisperEndpoint;
    }
    if (!present(profile.replicateApiKey) && present(source.replicateApiKey)) {
      profile.replicateApiKey = source.replicateApiKey.trim();
    }
    if (!present(profile.huggingfaceToken) && present(source.huggingfaceToken)) {
      profile.huggingfaceToken = source.huggingfaceToken.trim();
    }
    if (!present(profile.llmApiKey) && present(source.llmApiKey)) {
      profile.llmProvider = source.llmProvider;
      profile.llmApiKey = source.llmApiKey.trim();
      profile.llmModel = present(source.llmModel)
        ? source.llmModel.trim()
        : defaultLlmModel(source.llmProvider);
      profile.llmEndpoint = source.llmEndpoint;
    }
  }

  return Object.values(profile).some(present) ? profile : null;
}

export function applyGrantedKeyProfile<T extends SharedKeySettings>(
  settings: T | null,
  profile: SharedKeySettings | null
): T & SharedKeySettings {
  const effective = { ...(settings ?? {}) } as T & SharedKeySettings;
  if (!profile) return effective;

  if (present(profile.whisperApiKey)) {
    effective.whisperProvider = profile.whisperProvider;
    effective.whisperApiKey = profile.whisperApiKey;
    effective.whisperEndpoint = profile.whisperEndpoint;
  }
  if (present(profile.replicateApiKey)) effective.replicateApiKey = profile.replicateApiKey;
  if (present(profile.huggingfaceToken)) effective.huggingfaceToken = profile.huggingfaceToken;
  if (present(profile.llmApiKey)) {
    effective.llmProvider = profile.llmProvider;
    effective.llmApiKey = profile.llmApiKey;
    effective.llmModel = profile.llmModel;
    effective.llmEndpoint = profile.llmEndpoint;
  }
  return effective;
}

type KeyEnvironment = Partial<
  Record<
    | "REPLICATE_API_KEY"
    | "OPENAI_API_KEY"
    | "ANTHROPIC_API_KEY"
    | "GEMINI_API_KEY"
    | "SILICONFLOW_API_KEY",
    string
  >
>;

export function resolveWhisperApiKey(
  provider: string,
  settings: SharedKeySettings | null | undefined,
  env: KeyEnvironment = process.env
): string | undefined {
  if (present(settings?.whisperApiKey)) return settings.whisperApiKey.trim();
  if (provider === "replicate") {
    if (present(settings?.replicateApiKey)) return settings.replicateApiKey.trim();
    return env.REPLICATE_API_KEY;
  }
  if (provider === "openai") return env.OPENAI_API_KEY;
  return undefined;
}

export function resolveLlmApiKey(
  provider: string,
  settings: SharedKeySettings | null | undefined,
  env: KeyEnvironment = process.env
): string | undefined {
  if (present(settings?.llmApiKey)) return settings.llmApiKey.trim();
  switch (provider) {
    case "anthropic":
      return env.ANTHROPIC_API_KEY;
    case "gemini":
      return env.GEMINI_API_KEY;
    case "openai":
      return env.OPENAI_API_KEY;
    case "siliconflow":
      return env.SILICONFLOW_API_KEY;
    default:
      return undefined;
  }
}
