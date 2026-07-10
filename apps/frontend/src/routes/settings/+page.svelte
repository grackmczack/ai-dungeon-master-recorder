<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';

  let groups: any[] = $state([]);
  let selectedGroupId = $state('');
  let settings: any = $state(null);
  let usingAdminKeys = $state(false);
  let form: any = $state({});
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state('');

  const WHISPER_PROVIDERS = [
    { value: 'openai', label: 'OpenAI Whisper' },
    { value: 'replicate', label: 'Replicate WhisperX' },
    { value: 'selfhosted', label: 'Self-Hosted (OpenAI-kompatibel)' }
  ];
  const LLM_PROVIDERS = [
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'openai', label: 'OpenAI (GPT)' },
    { value: 'siliconflow', label: 'SiliconFlow (DeepSeek)' },
    { value: 'ollama', label: 'Ollama (Lokal)' }
  ];
  const LLM_MODELS: Record<string, Array<{value: string, label: string}>> = {
    anthropic: [
      { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
      { value: 'claude-sonnet-4-6-20251101', label: 'Claude Sonnet 4.6' }
    ],
    gemini: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }
    ],
    openai: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' }
    ],
    siliconflow: [
      { value: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3' },
      { value: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1' }
    ],
    ollama: []
  };

  onMount(async () => {
    try {
      groups = await api.getGroups();
      const qGroupId = $page.url.searchParams.get('groupId');
      selectedGroupId = qGroupId ?? groups[0]?.id ?? '';
      if (selectedGroupId) await loadSettings();
    } catch (e: any) {
      error = e.error ?? 'Fehler';
    } finally {
      loading = false;
    }
  });

  async function loadSettings() {
    if (!selectedGroupId) return;
    try {
      settings = await api.getSettings(selectedGroupId);
      usingAdminKeys = settings?.usingAdminKeys ?? false;
      form = settings ? { ...settings } : {
        whisperProvider: 'openai', llmProvider: 'anthropic',
        summaryLanguage: 'de', llmModel: 'claude-opus-4-8',
        replicateApiKey: '',
        imageGenModel: 'black-forest-labs/flux-schnell',
        huggingfaceToken: '',
        llmSystemPrompt: '', llmCampaignContext: ''
      };
    } catch {
      form = {
        whisperProvider: 'openai',
        llmProvider: 'anthropic',
        summaryLanguage: 'de',
        replicateApiKey: '',
        imageGenModel: 'black-forest-labs/flux-schnell',
        huggingfaceToken: '',
        llmSystemPrompt: '',
        llmCampaignContext: ''
      };
    }
  }

  async function save(e: Event) {
    e.preventDefault();
    saving = true;
    saved = false;
    error = '';
    try {
      // Don't send masked keys back
      const payload = { ...form };
      if (payload.whisperApiKey === '***') delete payload.whisperApiKey;
      if (payload.replicateApiKey === '***') delete payload.replicateApiKey;
      if (!payload.replicateApiKey?.trim()) delete payload.replicateApiKey;
      if (!payload.imageGenModel?.trim()) delete payload.imageGenModel;
      if (payload.huggingfaceToken === '***') delete payload.huggingfaceToken;
      if (!payload.huggingfaceToken?.trim()) delete payload.huggingfaceToken;
      if (payload.llmApiKey === '***') delete payload.llmApiKey;
      await api.updateSettings(selectedGroupId, payload);
      saved = true;
      setTimeout(() => saved = false, 3000);
    } catch (e: any) {
      error = e.error ?? 'Fehler beim Speichern';
    } finally {
      saving = false;
    }
  }

  function onGroupChange() {
    loadSettings();
  }
</script>

<div class="max-w-3xl mx-auto px-6 py-10">
  <a href="/dashboard" class="text-gray-500 hover:text-white text-sm flex items-center gap-2 mb-8 transition">← Dashboard</a>
  <h1 class="text-2xl font-bold text-white mb-2">Einstellungen</h1>
  <p class="text-gray-500 text-sm mb-8">API-Keys und Provider-Konfiguration pro Gruppe</p>

  {#if usingAdminKeys}
    <div class="mb-6 bg-brand-500/10 border border-brand-500/30 rounded-2xl p-5">
      <div class="flex items-start gap-3">
        <span class="text-2xl shrink-0">🔑</span>
        <div>
          <h3 class="font-semibold text-brand-400">Admin-API-Keys aktiv</h3>
          <p class="text-sm text-gray-400 mt-1 leading-relaxed">Du nutzt die API-Keys des Super-Admins. Alle Kosten für Transkription, Zusammenfassung und Bildgenerierung werden über den Admin-Account abgerechnet. Die Felder unten sind schreibgeschützt — du brauchst keine eigenen Keys zu hinterlegen.</p>
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="animate-pulse h-96 bg-surface-800 rounded-2xl"></div>
  {:else}
    <!-- Gruppenauswahl -->
    {#if groups.length > 1}
      <div class="mb-6">
        <label class="block text-sm text-gray-400 mb-2">Gruppe</label>
        <select bind:value={selectedGroupId} onchange={onGroupChange}
          class="bg-surface-800 border border-surface-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition">
          {#each groups as g}<option value={g.id}>{g.name}</option>{/each}
        </select>
      </div>
    {/if}

    <form onsubmit={save} class="space-y-8">
      {#if error}
        <div class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
      {/if}
      {#if saved}
        <div class="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-400 text-sm">✅ Gespeichert</div>
      {/if}

      <!-- Transkription -->
      <div class="bg-surface-800 rounded-2xl border border-surface-600 p-7 space-y-5">
        <h2 class="font-semibold text-white flex items-center gap-2">🎙️ Transkription</h2>

        <div class="space-y-2">
          <label class="text-sm text-gray-400">Provider</label>
          <select bind:value={form.whisperProvider}
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500">
            {#each WHISPER_PROVIDERS as p}<option value={p.value}>{p.label}</option>{/each}
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-sm text-gray-400">API Key {form.whisperProvider === 'openai' ? '(OpenAI)' : form.whisperProvider === 'replicate' ? '(Replicate)' : ''}</label>
          <input bind:value={form.whisperApiKey} type="text" autocomplete="off"
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-brand-500"
            placeholder="sk-..." />
        </div>

        {#if form.whisperProvider === 'selfhosted'}
          <div class="space-y-2">
            <label class="text-sm text-gray-400">Endpoint URL</label>
            <input bind:value={form.whisperEndpoint}
              class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-brand-500"
              placeholder="http://your-server:9000/v1/audio/transcriptions" />
          </div>
        {/if}
      </div>

      <!-- Bildgenerierung -->
      <div class="bg-surface-800 rounded-2xl border border-surface-600 p-7 space-y-5">
        <h2 class="font-semibold text-white flex items-center gap-2">🎨 Bildgenerierung</h2>

        <div class="space-y-2">
          <label class="text-sm text-gray-400">Replicate API Key</label>
          <input bind:value={form.replicateApiKey} type="text" autocomplete="off"
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-brand-500"
            placeholder="r8_..." />
        </div>

        <div class="space-y-2">
          <label class="text-sm text-gray-400">Bildmodell</label>
          <input bind:value={form.imageGenModel}
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-brand-500"
            placeholder="black-forest-labs/flux-schnell" />
          <p class="text-xs text-gray-600">Standard: `black-forest-labs/flux-schnell`. Andere öffentliche Replicate-Modelle funktionieren ebenfalls.</p>
        </div>
      </div>

      <!-- HuggingFace / Speaker Diarization -->
      <div class="bg-surface-800 rounded-2xl border border-surface-600 p-7 space-y-5">
        <h2 class="font-semibold text-white flex items-center gap-2">🔊 Sprecher-Erkennung (HuggingFace)</h2>

        <div class="space-y-2">
          <label class="text-sm text-gray-400">HuggingFace Token</label>
          <input bind:value={form.huggingfaceToken} type="text" autocomplete="off"
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-brand-500"
            placeholder="hf_..." />
          <p class="text-xs text-gray-600">Wird für Speaker-Diarization via pyannote benötigt. Auf huggingface.co/settings/tokens erstellen.</p>
        </div>

        <div class="pt-2 border-t border-surface-600">
          <p class="text-xs text-gray-500 mb-3">Folgende Modelle müssen mit deinem Account freigeschaltet sein:</p>
          <div class="space-y-2">
            <a href="https://huggingface.co/pyannote/speaker-diarization-3.1" target="_blank" rel="noopener noreferrer"
              class="flex items-center justify-between bg-surface-700 hover:bg-surface-600 border border-surface-600 hover:border-brand-500/40 rounded-lg px-4 py-3 transition group">
              <div>
                <p class="text-sm text-white font-medium">pyannote/speaker-diarization-3.1</p>
                <p class="text-xs text-gray-500">Speaker-Diarization Modell</p>
              </div>
              <span class="text-xs text-brand-400 group-hover:text-brand-300 transition">Modell freischalten →</span>
            </a>
            <a href="https://huggingface.co/pyannote/segmentation-3.0" target="_blank" rel="noopener noreferrer"
              class="flex items-center justify-between bg-surface-700 hover:bg-surface-600 border border-surface-600 hover:border-brand-500/40 rounded-lg px-4 py-3 transition group">
              <div>
                <p class="text-sm text-white font-medium">pyannote/segmentation-3.0</p>
                <p class="text-xs text-gray-500">Segmentation Modell (Voraussetzung für Diarization)</p>
              </div>
              <span class="text-xs text-brand-400 group-hover:text-brand-300 transition">Modell freischalten →</span>
            </a>
            <a href="https://huggingface.co/pyannote/speaker-diarization-community-1" target="_blank" rel="noopener noreferrer"
              class="flex items-center justify-between bg-surface-700 hover:bg-surface-600 border border-surface-600 hover:border-brand-500/40 rounded-lg px-4 py-3 transition group">
              <div>
                <p class="text-sm text-white font-medium">pyannote/speaker-diarization-community-1</p>
                <p class="text-xs text-gray-500">Community Speaker-Diarization (Alternative)</p>
              </div>
              <span class="text-xs text-brand-400 group-hover:text-brand-300 transition">Modell freischalten →</span>
            </a>
          </div>
        </div>
      </div>

      <!-- LLM -->
      <div class="bg-surface-800 rounded-2xl border border-surface-600 p-7 space-y-5">
        <h2 class="font-semibold text-white flex items-center gap-2">✍️ KI-Zusammenfassung</h2>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-sm text-gray-400">Provider</label>
            <select bind:value={form.llmProvider}
              class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500">
              {#each LLM_PROVIDERS as p}<option value={p.value}>{p.label}</option>{/each}
            </select>
          </div>
          <div class="space-y-2">
            <label class="text-sm text-gray-400">Modell</label>
            {#if LLM_MODELS[form.llmProvider]?.length}
              <select bind:value={form.llmModel}
                class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500">
                {#each LLM_MODELS[form.llmProvider] as m}<option value={m.value}>{m.label}</option>{/each}
              </select>
            {:else}
              <input bind:value={form.llmModel}
                class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-500"
                placeholder="Modellname" />
            {/if}
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-sm text-gray-400">API Key</label>
          <input bind:value={form.llmApiKey} type="text" autocomplete="off"
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-brand-500"
            placeholder="sk-ant-..." />
        </div>

        {#if form.llmProvider === 'ollama' || form.llmProvider === 'siliconflow'}
          <div class="space-y-2">
            <label class="text-sm text-gray-400">Endpoint URL</label>
            <input bind:value={form.llmEndpoint}
              class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-brand-500"
              placeholder={form.llmProvider === 'ollama' ? 'http://localhost:11434/api/generate' : 'https://api.siliconflow.cn/v1/chat/completions'} />
          </div>
        {/if}

        <div class="space-y-2">
          <label class="text-sm text-gray-400">Zusammenfassungssprache</label>
          <select bind:value={form.summaryLanguage}
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500">
            <option value="de">Deutsch</option>
            <option value="en">Englisch</option>
          </select>
        </div>

        <div class="space-y-2">
          <label class="text-sm text-gray-400">Discord Channel ID für Summary-Posts</label>
          <input bind:value={form.postSummaryChannelId}
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-brand-500"
            placeholder="Discord Channel ID" />
        </div>

        <div class="space-y-2">
          <label class="block text-sm text-gray-400">System-Prompt <span class="text-gray-600 text-xs">(leer = Standard)</span></label>
          <textarea bind:value={form.llmSystemPrompt} rows="6"
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-brand-500 transition resize-y"
            placeholder="Du bist ein Chronist für eine Pen-&-Paper-Rollenspielgruppe..."></textarea>
          <p class="text-xs text-gray-600">Überschreibt den Standard-Prompt. Muss valides JSON als Antwort verlangen (narrative, npcs, quests, loot, locations, openThreads).</p>
        </div>

        <div class="space-y-2">
          <label class="block text-sm text-gray-400">Kampagnen-Kontext <span class="text-gray-600 text-xs">(für alle Sessions dieser Gruppe)</span></label>
          <textarea bind:value={form.llmCampaignContext} rows="4"
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-500 transition resize-y"
            placeholder="z.B.: Wir spielen D&D 5e. Die Kampagne heißt 'Vergessene Reiche'. Spieler: Arkeles (Magier), Neston (Krieger), Akuma (Schurke). Der DM ist Grack. Das aktuelle Setting ist..."></textarea>
          <p class="text-xs text-gray-600">Dieser Text wird beim LLM als Kontext mitgesendet. Beschreibe Kampagne, Setting, Charaktere und wichtige Hintergrundinfos.</p>
        </div>
      </div>

      <button type="submit" disabled={saving}
        class="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition">
        {saving ? 'Speichern...' : 'Einstellungen speichern'}
      </button>
    </form>
  {/if}
</div>
