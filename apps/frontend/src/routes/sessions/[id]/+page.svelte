<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import type { Session, TranscriptSegment, SpeakerMap } from '$lib/types.js';

  let session: Session | null = $state(null);
  let loading = $state(true);
  let error = $state('');
  let activeTab: 'summary' | 'transcript' | 'speakers' = $state('summary');

  // Speaker colors für Transcript
  const SPEAKER_COLORS = [
    'text-blue-400', 'text-green-400', 'text-yellow-400',
    'text-pink-400', 'text-orange-400', 'text-cyan-400'
  ];
  let speakerColorMap: Record<string, string> = $state({});

  // Speaker edit state
  let editingSpeakers = $state(false);
  let speakerEdits = $state<Array<{ discordUserId: string; discordName: string; characterName: string; playerName: string; diarizationLabel: string }>>([]);
  let savingSpeakers = $state(false);
  let diarizationLabels: Array<{ label: string; count: number; sample: string }> = $state([]);

  // Titel-Edit state
  let editingTitle = $state(false);
  let titleEdit = $state('');
  let savingTitle = $state(false);

  onMount(async () => {
    try {
      const loaded = await api.getSession($page.params.id!);
      session = loaded;
      buildSpeakerColorMap();
      initSpeakerEdits();
      if (loaded.transcript) {
        diarizationLabels = await api.getDiarizationLabels($page.params.id!).catch(() => []);
      }
    } catch (e: any) {
      error = e.error ?? 'Session nicht gefunden';
    } finally {
      loading = false;
    }
  });

  function startEditTitle() {
    titleEdit = session?.title ?? '';
    editingTitle = true;
  }

  async function saveTitle() {
    if (!session) return;
    savingTitle = true;
    try {
      await api.updateSessionTitle(session.id, titleEdit);
      session.title = titleEdit;
      editingTitle = false;
    } catch (e: any) {
      alert(e.error ?? 'Fehler beim Speichern des Titels');
    } finally {
      savingTitle = false;
    }
  }

  function recordingUrl(filename: string): string {
    return `/api/uploads/recordings/${filename}`;
  }

  /** Normalisiert rawJson — gibt immer ein flaches segments[] zurück */
  function getSegments(): TranscriptSegment[] {
    if (!session?.transcript) return [];
    const raw = session.transcript.rawJson;
    // Chunked format: { chunks: [{ segments: [], chunkIndex, durationSeconds }] }
    if (raw.chunks && raw.chunks.length > 0) {
      let offset = 0;
      const merged: TranscriptSegment[] = [];
      const sorted = [...raw.chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
      for (const chunk of sorted) {
        for (const seg of (chunk.segments ?? [])) {
          merged.push({ ...seg, start: seg.start + offset, end: seg.end + offset });
        }
        offset += chunk.durationSeconds ?? 0;
      }
      return merged;
    }
    // Flat format: { segments: [] }
    return raw.segments ?? [];
  }

  function buildSpeakerColorMap() {
    if (!session?.transcript) return;
    const speakers = [...new Set(getSegments().map(s => s.speaker))];
    const map: Record<string, string> = {};
    speakers.forEach((spk, i) => {
      map[spk] = SPEAKER_COLORS[i % SPEAKER_COLORS.length]!;
    });
    speakerColorMap = map;
  }

  function initSpeakerEdits() {
    if (!session?.speakerMaps) return;
    speakerEdits = session.speakerMaps.map(sm => ({
      discordUserId: sm.discordUserId,
      discordName: sm.discordName,
      characterName: sm.characterName ?? '',
      playerName: sm.playerName ?? '',
      diarizationLabel: sm.diarizationLabel ?? ''
    }));
  }

  async function saveSpeakers() {
    if (!session) return;
    savingSpeakers = true;
    try {
      await api.updateSpeakers(session.id, speakerEdits);
      editingSpeakers = false;
      session = await api.getSession($page.params.id!);
    } catch (e: any) {
      alert(e.error ?? 'Fehler beim Speichern');
    } finally {
      savingSpeakers = false;
    }
  }

  function getSpeakerName(speakerId: string): string {
    // speakerId ist das anonyme Diarization-Label aus dem Transkript (z.B. "SPEAKER_00").
    // Zuerst gegen diarizationLabel matchen (korrekte Zuordnung), als Fallback gegen
    // discordUserId (Altdaten / Bot-generierte SpeakerMaps ohne Label).
    const sm = session?.speakerMaps?.find(s => s.diarizationLabel === speakerId)
      ?? session?.speakerMaps?.find(s => s.discordUserId === speakerId);
    return sm?.characterName ?? sm?.playerName ?? sm?.discordName ?? speakerId;
  }

  function formatTimestamp(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
</script>

<div class="max-w-5xl mx-auto px-6 py-10">
  <a href="javascript:history.back()" class="text-gray-500 hover:text-white text-sm flex items-center gap-2 mb-6 transition">← Zurück</a>

  {#if loading}
    <div class="animate-pulse space-y-6">
      <div class="h-8 bg-surface-800 rounded w-1/2"></div>
      <div class="h-64 bg-surface-800 rounded-2xl"></div>
    </div>
  {:else if error}
    <div class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400">{error}</div>
  {:else if session}
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          {#if editingTitle}
            <div class="flex items-center gap-2">
              <input bind:value={titleEdit} placeholder="Session-Titel"
                class="text-2xl font-bold bg-surface-800 border border-brand-500/40 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-brand-500 w-full max-w-lg" />
              <button onclick={saveTitle} disabled={savingTitle}
                class="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm px-3 py-2 rounded-lg transition">
                {savingTitle ? '...' : 'Speichern'}
              </button>
              <button onclick={() => editingTitle = false} class="text-gray-500 hover:text-white text-sm px-2 py-2 transition">Abbrechen</button>
            </div>
          {:else}
            <div class="flex items-center gap-2 group">
              <h1 class="text-3xl font-bold text-white">
                {session.title ?? `Session #${session.sessionNumber ?? '?'}`}
              </h1>
              <button onclick={startEditTitle} class="text-gray-600 hover:text-brand-400 opacity-0 group-hover:opacity-100 transition text-lg" title="Titel bearbeiten">
                ✏️
              </button>
            </div>
          {/if}
          <p class="text-gray-500 mt-1">{formatDate(session.startedAt)}</p>
        </div>
        <span class="text-sm px-3 py-1.5 rounded-full shrink-0 {session.status === 'DONE' ? 'bg-green-500/10 text-green-400' : session.status === 'FAILED' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}">
          {session.status}
        </span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 bg-surface-800 rounded-xl p-1 w-fit border border-surface-600">
      {#each [['summary', '✍️ Summary'], ['transcript', '📝 Transkript'], ['speakers', '👤 Sprecher']] as [tab, label]}
        <button
          onclick={() => activeTab = tab as any}
          class="px-4 py-2 rounded-lg text-sm font-medium transition {activeTab === tab ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
          {label}
        </button>
      {/each}
    </div>

    <!-- Summary Tab -->
    {#if activeTab === 'summary'}
      {#if !session.summary}
        <div class="text-center py-16 bg-surface-800 rounded-2xl border border-surface-600 border-dashed">
          <div class="text-4xl mb-3">⏳</div>
          <p class="text-gray-400">
            {session.status === 'DONE' ? 'Keine Summary vorhanden' : `Status: ${session.status} — wird automatisch generiert`}
          </p>
        </div>
      {:else}
        <div class="space-y-6">
          <!-- Narrative -->
          <div class="bg-surface-800 rounded-2xl border border-surface-600 p-7">
            <h2 class="text-sm font-medium text-brand-400 uppercase tracking-wider mb-4">📖 Chronik der Session</h2>
            <div class="text-gray-200 leading-relaxed whitespace-pre-wrap font-serif text-[15px]">
              {session.summary.narrative}
            </div>
            <div class="mt-4 pt-4 border-t border-surface-600 flex items-center gap-2 text-xs text-gray-600">
              <span>Generiert von</span>
              <span class="bg-surface-700 px-2 py-0.5 rounded font-mono">{session.summary.provider}/{session.summary.model}</span>
            </div>

            {#if session.recordings?.length}
              <div class="mt-4 pt-4 border-t border-surface-600">
                <p class="text-xs text-gray-500 mb-2">🎧 Aufnahmen dieser Session</p>
                <div class="flex flex-col gap-3">
                  {#each session.recordings as rec, i}
                    <div class="bg-surface-700/50 rounded-lg p-3 flex flex-col gap-2 border border-surface-600">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                          🔊 Part {i + 1}
                          {#if rec.durationSeconds}<span class="text-gray-500 font-normal">· {Math.round(rec.durationSeconds / 60)} min</span>{/if}
                        </span>
                        <a href={recordingUrl(rec.filename)} download
                          class="text-xs text-brand-400 hover:text-white bg-surface-600 hover:bg-brand-600 px-3 py-1 rounded transition">
                          MP3 Download
                        </a>
                      </div>
                      <!-- Kleine Custom-Styles für den Audio-Player im Darkmode (Webkit) -->
                      <audio controls src={recordingUrl(rec.filename)} preload="none"
                        class="w-full h-8 [&::-webkit-media-controls-panel]:bg-surface-800 [&::-webkit-media-controls-current-time-display]:text-gray-200 [&::-webkit-media-controls-time-remaining-display]:text-gray-200">
                      </audio>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

          <!-- NPCs + Quests + Loot Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- NPCs -->
            {#if session.summary.npcs.length > 0}
              <div class="bg-surface-800 rounded-2xl border border-surface-600 p-6">
                <h3 class="text-sm font-medium text-yellow-400 uppercase tracking-wider mb-4">🧙 NSCs</h3>
                <div class="space-y-3">
                  {#each session.summary.npcs as npc}
                    <div class="border-l-2 border-yellow-500/30 pl-3">
                      <p class="font-medium text-white text-sm">{npc.name}</p>
                      <p class="text-xs text-gray-500 mt-0.5">{npc.description}</p>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Quests -->
            {#if session.summary.quests.length > 0}
              <div class="bg-surface-800 rounded-2xl border border-surface-600 p-6">
                <h3 class="text-sm font-medium text-blue-400 uppercase tracking-wider mb-4">⚔️ Quests</h3>
                <div class="space-y-3">
                  {#each session.summary.quests as quest}
                    <div class="border-l-2 border-blue-500/30 pl-3">
                      <div class="flex items-center gap-2">
                        <p class="font-medium text-white text-sm">{quest.title}</p>
                        <span class="text-xs px-1.5 py-0.5 rounded {quest.status === 'completed' ? 'bg-green-500/20 text-green-400' : quest.status === 'new' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'}">
                          {quest.status}
                        </span>
                      </div>
                      {#if quest.notes}<p class="text-xs text-gray-500 mt-0.5">{quest.notes}</p>{/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Loot -->
            {#if session.summary.loot.length > 0}
              <div class="bg-surface-800 rounded-2xl border border-surface-600 p-6">
                <h3 class="text-sm font-medium text-orange-400 uppercase tracking-wider mb-4">💰 Beute</h3>
                <div class="space-y-2">
                  {#each session.summary.loot as item}
                    <div class="flex items-center gap-2 text-sm">
                      <span class="text-orange-400">•</span>
                      <span class="text-white">{item.item}</span>
                      {#if item.foundBy}<span class="text-gray-600 text-xs">— {item.foundBy}</span>{/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Locations -->
            {#if session.summary.locations.length > 0}
              <div class="bg-surface-800 rounded-2xl border border-surface-600 p-6">
                <h3 class="text-sm font-medium text-green-400 uppercase tracking-wider mb-4">🗺️ Orte</h3>
                <div class="space-y-3">
                  {#each session.summary.locations as loc}
                    <div class="border-l-2 border-green-500/30 pl-3">
                      <p class="font-medium text-white text-sm">{loc.name}</p>
                      {#if loc.description}<p class="text-xs text-gray-500 mt-0.5">{loc.description}</p>{/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

          <!-- Open Threads -->
          {#if session.summary.openThreads.length > 0}
            <div class="bg-surface-800 rounded-2xl border border-surface-600 p-6">
              <h3 class="text-sm font-medium text-purple-400 uppercase tracking-wider mb-4">🔮 Offene Fäden</h3>
              <ul class="space-y-2">
                {#each session.summary.openThreads as thread}
                  <li class="flex items-start gap-2 text-sm text-gray-300">
                    <span class="text-purple-400 mt-0.5">›</span>
                    <span>{thread}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}

    <!-- Transcript Tab -->
    {:else if activeTab === 'transcript'}
      {#if !session.transcript}
        <div class="text-center py-16 bg-surface-800 rounded-2xl border border-surface-600 border-dashed">
          <div class="text-4xl mb-3">📝</div>
          <p class="text-gray-400">Noch kein Transkript vorhanden</p>
        </div>
      {:else}
        <div class="bg-surface-800 rounded-2xl border border-surface-600 p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {#each getSegments() as seg}
            <div class="flex gap-3 group">
              <span class="text-xs text-gray-700 font-mono mt-1 w-10 shrink-0 group-hover:text-gray-500 transition">
                {formatTimestamp(seg.start)}
              </span>
              <div class="flex-1">
                <span class="text-xs font-semibold {speakerColorMap[seg.speaker] ?? 'text-gray-400'} mr-2">
                  {getSpeakerName(seg.speaker)}
                </span>
                <span class="text-gray-300 text-sm">{seg.text}</span>
              </div>
            </div>
          {/each}
        </div>
        <p class="text-xs text-gray-600 mt-2">Provider: {session.transcript.provider} · Sprache: {session.transcript.language}</p>
      {/if}

    <!-- Speakers Tab -->
    {:else if activeTab === 'speakers'}
      <div class="space-y-5">
        {#if diarizationLabels.length > 0}
          <div class="bg-surface-800 rounded-2xl border border-surface-600 p-6">
            <h3 class="font-semibold text-white mb-1">🎙️ Erkannte Sprecher im Transkript</h3>
            <p class="text-xs text-gray-500 mb-4">Die automatische Transkription erkennt anonyme Sprecher-Labels (z.B. "SPEAKER_00") — hier ein Ausschnitt aus dem, was jedes Label gesagt hat. Hilft bei der Zuordnung unten.</p>
            <div class="space-y-2">
              {#each diarizationLabels as dl}
                <div class="flex items-start gap-3 text-sm bg-surface-700/50 rounded-lg px-3 py-2">
                  <span class="font-mono text-xs {speakerColorMap[dl.label] ?? 'text-gray-400'} shrink-0 pt-0.5">{dl.label}</span>
                  <span class="text-gray-400 italic flex-1">„{dl.sample}…“</span>
                  <span class="text-xs text-gray-600 shrink-0">{dl.count} Segmente</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="bg-surface-800 rounded-2xl border border-surface-600 p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="font-semibold text-white">Sprecher zuordnen</h3>
              <p class="text-xs text-gray-500 mt-1">Ordne Discord-Usernamen, Charakternamen und das erkannte Transkript-Label einander zu</p>
            </div>
            {#if !editingSpeakers}
              <button onclick={() => editingSpeakers = true}
                class="text-sm border border-surface-500 hover:border-brand-500 text-gray-400 hover:text-white px-4 py-2 rounded-lg transition">
                Bearbeiten
              </button>
            {/if}
          </div>

          {#if speakerEdits.length === 0}
            <p class="text-gray-600 text-sm">Keine Sprecher erfasst</p>
          {:else}
            <div class="space-y-4">
              {#if editingSpeakers}
                <div class="grid grid-cols-4 gap-3 text-xs text-gray-500 font-medium px-1">
                  <span>Discord-User</span>
                  <span>Transkript-Label</span>
                  <span>Charaktername</span>
                  <span>Spielername</span>
                </div>
              {/if}
              {#each speakerEdits as edit, i}
                <div class="grid grid-cols-4 gap-3 items-center">
                  <div class="text-sm text-gray-400 font-medium truncate">{edit.discordName}</div>
                  {#if editingSpeakers}
                    <select bind:value={speakerEdits[i].diarizationLabel}
                      class="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
                      <option value="">— kein Label —</option>
                      {#each diarizationLabels as dl}
                        <option value={dl.label}>{dl.label}</option>
                      {/each}
                    </select>
                    <input bind:value={speakerEdits[i].characterName}
                      class="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                      placeholder="Charaktername" />
                    <input bind:value={speakerEdits[i].playerName}
                      class="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                      placeholder="Spielername" />
                  {:else}
                    <span class="text-sm font-mono text-gray-400">{edit.diarizationLabel || '—'}</span>
                    <span class="text-sm text-white">{edit.characterName || '—'}</span>
                    <span class="text-sm text-gray-500">{edit.playerName || '—'}</span>
                  {/if}
                </div>
              {/each}
            </div>

            {#if editingSpeakers}
              <div class="flex gap-3 mt-6 pt-6 border-t border-surface-600">
                <button onclick={saveSpeakers} disabled={savingSpeakers}
                  class="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition">
                  {savingSpeakers ? 'Speichern...' : 'Speichern'}
                </button>
                <button onclick={() => { editingSpeakers = false; initSpeakerEdits(); }}
                  class="text-gray-500 hover:text-white px-5 py-2 rounded-lg text-sm transition">
                  Abbrechen
                </button>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>
