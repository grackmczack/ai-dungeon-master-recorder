<script lang="ts">
  import { onMount } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';

  let campaigns: any[] = $state([]);
  let selectedCampaignId = $state('');
  let settings: any = $state(null);
  let usingAdminKeys = $state(false);
  let adminKeyProviderName = $state('');
  let adminKeyAvailability = $state({
    whisper: false,
    replicate: false,
    llm: false
  });
  let form: any = $state({});
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state('');
  let loadedCampaignId = $state('');
  let savedSnapshot = $state('');
  let dirty = $derived(!!savedSnapshot && JSON.stringify(form) !== savedSnapshot);

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
  const SESSION_IMAGE_PROVIDERS = [
    { value: 'replicate', label: 'Replicate' }
  ];
  const SESSION_IMAGE_MODELS = [
    { value: 'qwen/qwen-image-edit-plus', label: 'Qwen Image Edit Plus (mit Avatar-Referenzen)' },
    { value: 'black-forest-labs/flux-schnell', label: 'Flux Schnell (nur Text, kein Avatar-Input)' }
  ];
  const IMAGE_GEN_MODELS = [
    { value: 'black-forest-labs/flux-schnell', label: 'Flux Schnell' },
    { value: 'stability-ai/sdxl', label: 'Stable Diffusion XL' },
    { value: 'black-forest-labs/flux-pro', label: 'Flux Pro' },
    { value: 'black-forest-labs/flux-dev', label: 'Flux Dev' }
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

  // Dynamic labels for API key fields based on current provider selections
  let llmKeyLabel = $derived(
    ({ anthropic: 'Anthropic (Claude) API Key', openai: 'OpenAI (GPT) API Key', gemini: 'Google Gemini API Key', siliconflow: 'SiliconFlow (DeepSeek) API Key', ollama: 'LLM API Key' } as Record<string, string>)[form.llmProvider] ?? 'LLM API Key'
  );
  let llmKeyPlaceholder = $derived(
    ({ anthropic: 'sk-ant-...', openai: 'sk-...', gemini: 'AI...', siliconflow: 'sk-...', ollama: '(lokal, kein Key nötig)' } as Record<string, string>)[form.llmProvider] ?? 'API-Key...'
  );
  let whisperKeyLabel = $derived(
    ({ openai: 'OpenAI API Key', replicate: 'Replicate API Key', selfhosted: 'Whisper API Key' } as Record<string, string>)[form.whisperProvider] ?? 'Whisper API Key'
  );
  let whisperKeyPlaceholder = $derived(
    ({ openai: 'sk-...', replicate: 'r8_...', selfhosted: '(self-hosted, kein Key nötig)' } as Record<string, string>)[form.whisperProvider] ?? 'API-Key...'
  );

  function isMaskedKey(value: unknown): boolean {
    return typeof value === 'string' && value.includes('***');
  }

  onMount(async () => {
    try {
      campaigns = await api.getCampaigns();
      const queryCampaignId = $page.url.searchParams.get('campaignId') ?? $page.url.searchParams.get('groupId');
      selectedCampaignId = queryCampaignId ?? campaigns[0]?.id ?? '';
      if (selectedCampaignId) await loadSettings();
    } catch (e: any) {
      error = e.error ?? 'Fehler';
    } finally {
      loading = false;
    }
  });

  async function loadSettings() {
    if (!selectedCampaignId) return;
    try {
      settings = await api.getSettings(selectedCampaignId);
      usingAdminKeys = settings?.usingAdminKeys ?? false;
      adminKeyProviderName = settings?.adminKeyProviderName ?? '';
      adminKeyAvailability = settings?.adminKeyAvailability ?? {
        whisper: false, replicate: false, llm: false
      };
      form = settings ? { ...settings, summaryLanguage: 'de' } : {
        whisperProvider: 'openai',
        whisperApiKey: '',
        whisperEndpoint: '',
        llmProvider: 'anthropic',
        llmModel: 'claude-opus-4-8',
        llmApiKey: '',
        llmEndpoint: '',
        llmSystemPrompt: '',
        llmCampaignContext: '',
        replicateApiKey: '',
        imageGenModel: 'black-forest-labs/flux-schnell',
        sessionImageProvider: 'replicate',
        sessionImageModel: 'qwen/qwen-image-edit-plus',
        summaryLanguage: 'de',
        postSummaryChannelId: ''
      };
      savedSnapshot = JSON.stringify(form);
      loadedCampaignId = selectedCampaignId;
    } catch {
      form = {
        whisperProvider: 'openai', whisperApiKey: '', whisperEndpoint: '',
        llmProvider: 'anthropic', llmModel: 'claude-opus-4-8', llmApiKey: '', llmEndpoint: '',
        llmSystemPrompt: '', llmCampaignContext: '',
        replicateApiKey: '', imageGenModel: 'black-forest-labs/flux-schnell',
        sessionImageProvider: 'replicate', sessionImageModel: 'qwen/qwen-image-edit-plus',
        summaryLanguage: 'de', postSummaryChannelId: ''
      };
      savedSnapshot = JSON.stringify(form);
      loadedCampaignId = selectedCampaignId;
    }
  }

  async function save(e: Event) {
    e.preventDefault();
    saving = true;
    saved = false;
    error = '';
    try {
      const payload = { ...form };
      // Don't send masked keys back
      if (isMaskedKey(payload.whisperApiKey)) delete payload.whisperApiKey;
      if (isMaskedKey(payload.replicateApiKey)) delete payload.replicateApiKey;
      if (!payload.replicateApiKey?.trim()) delete payload.replicateApiKey;
      if (!payload.imageGenModel?.trim()) delete payload.imageGenModel;
      // Legacy pyannote tokens are no longer user-configurable. Discord supplies
      // the speaker identity directly and the worker ignores this old field.
      delete payload.huggingfaceToken;
      if (isMaskedKey(payload.llmApiKey)) delete payload.llmApiKey;
      // Clean optional fields — empty strings → null
      if (!payload.sessionImageProvider?.trim()) { payload.sessionImageProvider = null; }
      if (!payload.sessionImageModel?.trim()) { payload.sessionImageModel = null; }
      if (!payload.llmEndpoint?.trim()) { payload.llmEndpoint = null; }
      if (!payload.whisperEndpoint?.trim()) { payload.whisperEndpoint = null; }
      if (!payload.postSummaryChannelId?.trim()) { payload.postSummaryChannelId = null; }
      await api.updateSettings(selectedCampaignId, payload);
      savedSnapshot = JSON.stringify(form);
      saved = true;
      setTimeout(() => saved = false, 3000);
    } catch (e: any) {
      error = e.error ?? 'Fehler beim Speichern';
    } finally {
      saving = false;
    }
  }

  function onCampaignChange() {
    if (dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) {
      selectedCampaignId = loadedCampaignId;
      return;
    }
    loadSettings();
  }

  beforeNavigate(({ cancel }) => {
    if (dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) cancel();
  });

  function warnBeforeUnload(event: BeforeUnloadEvent) {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  }
</script>

<svelte:window onbeforeunload={warnBeforeUnload} />

<svelte:head><title>Einstellungen — DnD Recorder</title></svelte:head>

<div class="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
  <a href="/dashboard" class="text-gray-500 hover:text-white text-sm flex items-center gap-2 mb-8 transition">← Dashboard</a>
  <h1 class="text-2xl font-bold text-white mb-2">Einstellungen</h1>
  <p class="text-gray-500 text-sm mb-8">API-Keys und Provider-Konfiguration pro Kampagne</p>

  {#if usingAdminKeys}
    <div class="mb-6 bg-brand-500/10 border border-brand-500/30 rounded-2xl p-5">
      <div class="flex items-start gap-3">
        <span class="text-2xl shrink-0">🔑</span>
        <div>
          <h3 class="font-semibold text-brand-400">Admin-API-Keys aktiv</h3>
          <p class="text-sm text-gray-400 mt-1 leading-relaxed">
            Du nutzt die freigegebenen Zugangsdaten{adminKeyProviderName ? ` von ${adminKeyProviderName}` : ''}.
            Provider, Modell und Endpoint werden passend zum jeweiligen Key übernommen. Nicht freigegebene Felder kannst du weiterhin selbst konfigurieren.
          </p>
          <div class="mt-3 flex flex-wrap gap-2 text-xs">
            <span class={adminKeyAvailability.whisper ? 'text-green-400' : 'text-gray-600'}>● Transkription</span>
            <span class={adminKeyAvailability.replicate ? 'text-green-400' : 'text-gray-600'}>● Bildgenerierung</span>
            <span class={adminKeyAvailability.llm ? 'text-green-400' : 'text-gray-600'}>● Zusammenfassung</span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="animate-pulse h-96 bg-surface-800 rounded-2xl"></div>
  {:else}
    <!-- Kampagnenauswahl -->
    {#if campaigns.length > 1}
      <div class="mb-6">
        <label for="settings-group" class="block text-sm text-gray-400 mb-2">Kampagne</label>
        <select id="settings-group" bind:value={selectedCampaignId} onchange={onCampaignChange}
          class="bg-surface-800 border border-surface-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition">
          {#each campaigns as campaign}<option value={campaign.id}>{campaign.name}</option>{/each}
        </select>
      </div>
    {/if}

    <form onsubmit={save} class="space-y-8">
      {#if error}
        <div role="alert" class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
      {/if}
      {#if saved}
        <div role="status" class="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-200 text-sm">✅ Gespeichert</div>
      {/if}

      <!-- ─────────── API Keys ─────────── -->
      <div class="bg-surface-800 rounded-2xl border border-surface-600 p-5 sm:p-7 space-y-5">
        <h2 class="font-semibold text-white flex items-center gap-2">🔑 API Keys</h2>
        <p class="text-xs text-gray-500">Zentrale Verwaltung aller API-Keys. Die Feature-Sektionen unten wählen nur noch Provider + Modell — der zugehörige Key wird automatisch aus dieser Sektion verwendet.</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Whisper/Transcription key — label changes with whisper provider -->
          <div class="space-y-2">
            <label for="whisper-api-key" class="text-sm text-gray-400">{whisperKeyLabel}</label>
            <input id="whisper-api-key" bind:value={form.whisperApiKey} readonly={adminKeyAvailability.whisper} type={isMaskedKey(form.whisperApiKey) ? 'text' : 'password'} autocomplete="new-password"
              class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-brand-500"
              placeholder={whisperKeyPlaceholder} />
            {#if form.whisperProvider === 'openai'}
              <p class="text-xs text-gray-600">Genutzt für OpenAI Whisper Transkription.</p>
            {:else if form.whisperProvider === 'replicate'}
              <p class="text-xs text-gray-600">Genutzt für Replicate WhisperX Transkription. Geteilt mit Bildgenerierung (gleicher Replicate Key).</p>
            {:else}
              <p class="text-xs text-gray-600">Genutzt für Self-Hosted Whisper. Leer lassen falls kein Key benötigt.</p>
            {/if}
          </div>

          <!-- LLM key — label changes with LLM provider -->
          <div class="space-y-2">
            <label for="llm-api-key" class="text-sm text-gray-400">{llmKeyLabel}</label>
            <input id="llm-api-key" bind:value={form.llmApiKey} readonly={adminKeyAvailability.llm} type={isMaskedKey(form.llmApiKey) ? 'text' : 'password'} autocomplete="new-password"
              class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-brand-500"
              placeholder={llmKeyPlaceholder} />
            <p class="text-xs text-gray-600">
              Genutzt für KI-Zusammenfassungen.
              {form.llmProvider === 'ollama' ? ' Lokaler Ollama-Server — kein Key nötig.' : ''}
            </p>
          </div>

          <!-- Replicate key -->
          <div class="space-y-2">
            <label for="replicate-api-key" class="text-sm text-gray-400">Replicate API Key</label>
            <input id="replicate-api-key" bind:value={form.replicateApiKey} readonly={adminKeyAvailability.replicate} type={isMaskedKey(form.replicateApiKey) ? 'text' : 'password'} autocomplete="new-password"
              class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-brand-500"
              placeholder="r8_..." />
            <p class="text-xs text-gray-600">Genutzt für Bildgenerierung (Hintergründe, Session-Bilder, NPC-Portraits). Wird auch für Replicate WhisperX verwendet falls als Whisper-Provider gewählt.</p>
          </div>

        </div>
      </div>

      <!-- ─────────── Transkription ─────────── -->
      <div class="bg-surface-800 rounded-2xl border border-surface-600 p-5 sm:p-7 space-y-5">
        <h2 class="font-semibold text-white flex items-center gap-2">🎙️ Transkription</h2>
        <p class="text-xs text-gray-500">Provider für die Sprach-zu-Text-Transkription. Der API-Key wird aus der »API Keys«-Sektion oben verwendet.</p>

        <div class="space-y-2">
          <label for="whisper-provider" class="text-sm text-gray-400">Provider</label>
          <select id="whisper-provider" bind:value={form.whisperProvider} disabled={adminKeyAvailability.whisper}
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500">
            {#each WHISPER_PROVIDERS as p}<option value={p.value}>{p.label}</option>{/each}
          </select>
        </div>

        {#if form.whisperProvider === 'selfhosted'}
          <div class="space-y-2">
            <label for="whisper-endpoint" class="text-sm text-gray-400">Endpoint URL</label>
            <input id="whisper-endpoint" bind:value={form.whisperEndpoint} readonly={adminKeyAvailability.whisper}
              class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-brand-500"
              placeholder="http://your-server:9000/v1/audio/transcriptions" />
          </div>
        {/if}
      </div>

      <!-- ─────────── Bildgenerierung ─────────── -->
      <div class="bg-surface-800 rounded-2xl border border-surface-600 p-5 sm:p-7 space-y-5">
        <h2 class="font-semibold text-white flex items-center gap-2">🎨 Bildgenerierung</h2>
        <p class="text-xs text-gray-500">Hintergründe & NPC-Portraits für Kampagnen. Läuft immer über Replicate — der API-Key wird aus der »API Keys«-Sektion oben verwendet.</p>

        <div class="space-y-2">
          <p class="text-sm text-gray-400">Provider</p>
          <div class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-gray-400 text-sm">
            Replicate
          </div>
        </div>

        <div class="space-y-2">
          <label for="image-model" class="text-sm text-gray-400">Modell</label>
          <select id="image-model" bind:value={form.imageGenModel}
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500">
            {#each IMAGE_GEN_MODELS as m}<option value={m.value}>{m.label}</option>{/each}
          </select>
          <p class="text-xs text-gray-600">Modell für Kampagnen-Hintergründe und NPC-Portraits.</p>
        </div>
      </div>

      <!-- ─────────── Session-Bild ─────────── -->
      <div class="bg-surface-800 rounded-2xl border border-surface-600 p-5 sm:p-7 space-y-5">
        <h2 class="font-semibold text-white flex items-center gap-2">🖼️ Session-Bild</h2>
        <p class="text-xs text-gray-500">Modell für die Generierung des Session-Header-Bildes. Der Replicate API-Key wird aus der »API Keys«-Sektion oben verwendet.</p>

        <div class="space-y-2">
          <label for="session-image-provider" class="text-sm text-gray-400">Provider</label>
          <select id="session-image-provider" bind:value={form.sessionImageProvider}
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500">
            <option value="">— Standard (Replicate) —</option>
            {#each SESSION_IMAGE_PROVIDERS as p}<option value={p.value}>{p.label}</option>{/each}
          </select>
        </div>

        <div class="space-y-2">
          <label for="session-image-model" class="text-sm text-gray-400">Modell</label>
          <select id="session-image-model" bind:value={form.sessionImageModel}
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500">
            <option value="">— Standard (Qwen Image Edit Plus) —</option>
            {#each SESSION_IMAGE_MODELS as m}<option value={m.value}>{m.label}</option>{/each}
          </select>
        </div>
        <p class="text-xs text-gray-600">
          <strong>Qwen Image Edit Plus</strong>: Nutzt Charakter-Avatare als Bild-Referenz → Charaktere bleiben visuell konsistent.<br>
          <strong>Flux Schnell</strong>: Reiner Text→Bild — schnell, aber ohne Avatar-Bezug.
        </p>
      </div>

      <!-- ─────────── Sprecher-Erkennung ─────────── -->
      <div class="bg-surface-800 rounded-2xl border border-surface-600 p-5 sm:p-7 space-y-5">
        <h2 class="font-semibold text-white flex items-center gap-2">🔊 Automatische Sprecherzuordnung</h2>
        <p class="text-sm text-gray-400 leading-relaxed">
          DnD Recorder erkennt die Sprecher direkt über ihre Discord-Audiospur und gleicht diese mit den Wortzeitstempeln des Transkripts ab. Es ist kein HuggingFace-Token und keine manuelle Modellfreigabe nötig.
        </p>
        <div class="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-xs text-green-300">
          Aktiv · Discord-Namen und hinterlegte Charaktere werden automatisch verknüpft.
        </div>
      </div>

      <!-- ─────────── KI-Zusammenfassung ─────────── -->
      <div class="bg-surface-800 rounded-2xl border border-surface-600 p-5 sm:p-7 space-y-5">
        <h2 class="font-semibold text-white flex items-center gap-2">✍️ KI-Zusammenfassung</h2>
        <p class="text-xs text-gray-500">Provider & Modell für Session-Zusammenfassungen. Der API-Key wird aus der »API Keys«-Sektion oben verwendet (je nach gewähltem Provider).</p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-2">
            <label for="llm-provider" class="text-sm text-gray-400">Provider</label>
            <select id="llm-provider" bind:value={form.llmProvider} disabled={adminKeyAvailability.llm}
              class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500">
              {#each LLM_PROVIDERS as p}<option value={p.value}>{p.label}</option>{/each}
            </select>
          </div>
          <div class="space-y-2">
            <label for="llm-model" class="text-sm text-gray-400">Modell</label>
            {#if LLM_MODELS[form.llmProvider]?.length}
              <select id="llm-model" bind:value={form.llmModel} disabled={adminKeyAvailability.llm}
                class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500">
                {#each LLM_MODELS[form.llmProvider] as m}<option value={m.value}>{m.label}</option>{/each}
              </select>
            {:else}
              <input id="llm-model" bind:value={form.llmModel} readonly={adminKeyAvailability.llm}
                class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-500"
                placeholder="Modellname" />
            {/if}
          </div>
        </div>

        {#if form.llmProvider === 'ollama' || form.llmProvider === 'siliconflow'}
          <div class="space-y-2">
            <label for="llm-endpoint" class="text-sm text-gray-400">Endpoint URL</label>
            <input id="llm-endpoint" bind:value={form.llmEndpoint} readonly={adminKeyAvailability.llm}
              class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-brand-500"
              placeholder={form.llmProvider === 'ollama' ? 'http://localhost:11434/api/generate' : 'https://api.siliconflow.com/v1/chat/completions'} />
          </div>
        {/if}

        <div class="space-y-2">
          <label for="summary-language" class="text-sm text-gray-400">Zusammenfassungssprache</label>
          <input id="summary-language" value="Deutsch" readonly
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-gray-300 cursor-not-allowed" />
          <p class="text-xs text-gray-600">Zusammenfassungen werden immer auf Deutsch erstellt. Nur der getrennte Sessionbild-Prompt bleibt für die Bildgenerierung auf Englisch.</p>
        </div>

        <div class="space-y-2">
          <label for="summary-channel" class="text-sm text-gray-400">Fester Discord-Kanal für Zusammenfassungen</label>
          <input id="summary-channel" bind:value={form.postSummaryChannelId}
            inputmode="numeric" pattern={'[0-9]{17,20}'}
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-brand-500"
            placeholder="Discord Channel ID, z. B. 1394755474263375902" />
          <p class="text-xs text-gray-600">Dieser Kanal hat Vorrang vor dem Kanal, in dem <code>/record</code> gestartet wurde. Einfacher geht es direkt in Discord mit <code>/summary-channel set</code>.</p>
        </div>

        <div class="space-y-2">
          <label for="system-prompt" class="block text-sm text-gray-400">System-Prompt <span class="text-gray-600 text-xs">(leer = Standard)</span></label>
          <textarea id="system-prompt" bind:value={form.llmSystemPrompt} rows="6"
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-brand-500 transition resize-y"
            placeholder="Du bist ein Chronist für eine Pen-&-Paper-Rollenspielgruppe..."></textarea>
          <p class="text-xs text-gray-600">Überschreibt den Standard-Prompt. Muss valides JSON als Antwort verlangen (narrative, npcs, quests, loot, locations, openThreads).</p>
        </div>

        <div class="space-y-2">
          <label for="campaign-context" class="block text-sm text-gray-400">Kampagnen-Kontext <span class="text-gray-600 text-xs">(für alle Sessions dieser Kampagne)</span></label>
          <textarea id="campaign-context" bind:value={form.llmCampaignContext} rows="4"
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
