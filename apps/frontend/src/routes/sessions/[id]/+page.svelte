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
  let speakerEdits = $state<Array<{ discordUserId: string; discordName: string; characterName: string; playerName: string }>>([]);
  let savingSpeakers = $state(false);

  onMount(async () => {
    try {
      session = await api.getSession($page.params.id!);
      buildSpeakerColorMap();
      initSpeakerEdits();
    } catch (e: any) {
      error = e.error ?? 'Session nicht gefunden';
    } finally {
      loading = false;
    }
  });

  function buildSpeakerColorMap() {
    if (!session?.transcript) return;
    const speakers = [...new Set(session.transcript.rawJson.segments.map(s => s.speaker))];
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
      playerName: sm.playerName ?? ''
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
    const sm = session?.speakerMaps?.find(s => s.discordUserId === speakerId);
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
        <div>
          <h1 class="text-3xl font-bold text-white">
            {session.title ?? `Session #${session.sessionNumber ?? '?'}`}
          </h1>
          <p class="text-gray-500 mt-1">{formatDate(session.startedAt)}</p>
        </div>
        <span class="text-sm px-3 py-1.5 rounded-full {session.status === 'DONE' ? 'bg-green-500/10 text-green-400' : session.status === 'FAILED' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}">
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
          {#each session.transcript.rawJson.segments as seg}
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
      <div class="bg-surface-800 rounded-2xl border border-surface-600 p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="font-semibold text-white">Sprecher zuordnen</h3>
            <p class="text-xs text-gray-500 mt-1">Ordne Discord-Usernamen den Charakternamen zu</p>
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
            {#each speakerEdits as edit, i}
              <div class="grid grid-cols-3 gap-3 items-center">
                <div class="text-sm text-gray-400 font-medium truncate">{edit.discordName}</div>
                {#if editingSpeakers}
                  <input bind:value={speakerEdits[i].characterName}
                    class="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    placeholder="Charaktername" />
                  <input bind:value={speakerEdits[i].playerName}
                    class="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    placeholder="Spielername" />
                {:else}
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
    {/if}
  {/if}
</div>
