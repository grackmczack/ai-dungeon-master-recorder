<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import type { AggregatedWiki, WikiNPC, WikiQuest, WikiLocation, WikiThread, WikiLoot } from '$lib/types.js';

  let { campaignId, campaignName }: { campaignId: string; campaignName: string } = $props();

  let wiki: AggregatedWiki | null = $state(null);
  let loading = $state(true);
  let error = $state('');
  let activeCategory: 'npcs' | 'quests' | 'locations' | 'threads' | 'loot' = $state('npcs');

  // Search filter
  let searchQuery = $state('');

  onMount(async () => {
    await loadWiki();
  });

  async function loadWiki() {
    loading = true;
    error = '';
    try {
      wiki = await api.getWiki(campaignId);
    } catch (e: any) {
      error = e.error ?? 'Wiki konnte nicht geladen werden';
    } finally {
      loading = false;
    }
  }

  function filtered<T extends { name?: string; title?: string; text?: string; item?: string }>(items: T[]): T[] {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item =>
      (item.name ?? item.title ?? item.text ?? item.item ?? '').toLowerCase().includes(q)
    );
  }

  const QUEST_STATUS_LABELS: Record<string, string> = {
    discovered: '🆕 Entdeckt',
    active: '⚔️ Aktiv',
    completed: '✅ Abgeschlossen',
    failed: '❌ Fehlgeschlagen',
    unknown: '❓ Unbekannt'
  };

  const QUEST_STATUS_COLORS: Record<string, string> = {
    discovered: 'text-blue-400 bg-blue-500/10',
    active: 'text-green-400 bg-green-500/10',
    completed: 'text-emerald-400 bg-emerald-500/10',
    failed: 'text-red-400 bg-red-500/10',
    unknown: 'text-gray-400 bg-gray-500/10'
  };

  const CATEGORY_LABELS: Record<string, string> = {
    npcs: '👤 NSCs',
    quests: '⚔️ Quests',
    locations: '🗺️ Orte',
    threads: '🔮 Offene Fäden',
    loot: '💎 Beute'
  };

  function categoryCount(cat: string): number {
    if (!wiki) return 0;
    switch (cat) {
      case 'npcs': return wiki.npcs.length;
      case 'quests': return wiki.quests.length;
      case 'locations': return wiki.locations.length;
      case 'threads': return wiki.threads.length;
      case 'loot': return wiki.loot.length;
      default: return 0;
    }
  }
</script>

<div class="space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h2 class="text-lg font-semibold text-white flex items-center gap-2">
        📜 Quest-Wiki
        <span class="text-xs text-gray-500 font-normal">— {campaignName}</span>
      </h2>
      {#if wiki}
        <p class="text-xs text-gray-500 mt-0.5">Aggregiert aus {wiki.sessionCount} Session{wiki.sessionCount === 1 ? '' : 's'}</p>
      {/if}
    </div>
    <button onclick={loadWiki}
      class="text-xs text-gray-500 hover:text-white border border-surface-600 hover:border-surface-500 px-3 py-1.5 rounded-lg transition">
      ↻ Aktualisieren
    </button>
  </div>

  {#if loading}
    <div class="animate-pulse space-y-4">
      {#each [1,2,3] as _}
        <div class="h-20 bg-surface-800 rounded-2xl border border-surface-600"></div>
      {/each}
    </div>
  {:else if error}
    <div class="bg-red-900/20 border border-red-700/40 rounded-2xl p-6 text-center">
      <p class="text-red-400 text-sm">{error}</p>
    </div>
  {:else if wiki}
    <!-- Category Tabs -->
    <div class="flex gap-1 bg-surface-800 rounded-xl p-1 border border-surface-600 overflow-x-auto">
      {#each Object.entries(CATEGORY_LABELS) as [key, label]}
        <button onclick={() => activeCategory = key as typeof activeCategory}
          class="px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap {activeCategory === key ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
          {label}
          <span class="ml-1 text-xs opacity-60">{categoryCount(key)}</span>
        </button>
      {/each}
    </div>

    <!-- Search -->
    <div class="relative">
      <input bind:value={searchQuery} placeholder="Suchen..."
        class="w-full bg-surface-800 border border-surface-600 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500" />
      {#if searchQuery}
        <button onclick={() => searchQuery = ''}
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white text-sm">✕</button>
      {/if}
    </div>

    <!-- Content -->
    <div class="space-y-3">
      {#if activeCategory === 'npcs'}
        <!-- NPCs -->
        {#if filtered(wiki.npcs).length === 0}
          <div class="text-center py-8 text-gray-600 text-sm">Keine NSCs gefunden</div>
        {:else}
          {#each filtered(wiki.npcs) as npc}
            <div class="bg-surface-800 border border-surface-600 rounded-xl p-4 hover:border-brand-500/30 transition">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-white">{npc.name}</h3>
                  {#if npc.description}
                    <p class="text-sm text-gray-400 mt-1 leading-relaxed">{npc.description}</p>
                  {/if}
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0">
                  <span class="text-xs text-gray-600 bg-surface-700 px-2 py-0.5 rounded-full">
                    👁️ {npc.sessionCount}× gesehen
                  </span>
                  {#if npc.firstSeenSessionNumber !== null}
                    <span class="text-xs text-gray-600">
                      Session #{npc.firstSeenSessionNumber}{#if npc.lastSeenSessionNumber !== null && npc.lastSeenSessionNumber !== npc.firstSeenSessionNumber}–#{npc.lastSeenSessionNumber}{/if}
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        {/if}

      {:else if activeCategory === 'quests'}
        <!-- Quests -->
        {#if filtered(wiki.quests).length === 0}
          <div class="text-center py-8 text-gray-600 text-sm">Keine Quests gefunden</div>
        {:else}
          {#each filtered(wiki.quests) as quest}
            <div class="bg-surface-800 border border-surface-600 rounded-xl p-4 hover:border-brand-500/30 transition">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <h3 class="font-medium text-white">{quest.title}</h3>
                    <span class="text-xs px-2 py-0.5 rounded-full {QUEST_STATUS_COLORS[quest.status?.toLowerCase()] ?? QUEST_STATUS_COLORS.unknown}">
                      {QUEST_STATUS_LABELS[quest.status?.toLowerCase()] ?? quest.status}
                    </span>
                  </div>
                  {#if quest.allNotes.length > 0}
                    <div class="mt-2 space-y-1">
                      {#each quest.allNotes as note}
                        <p class="text-sm text-gray-400 leading-relaxed border-l border-brand-500/20 pl-2">{note}</p>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        {/if}

      {:else if activeCategory === 'locations'}
        <!-- Locations -->
        {#if filtered(wiki.locations).length === 0}
          <div class="text-center py-8 text-gray-600 text-sm">Keine Orte gefunden</div>
        {:else}
          {#each filtered(wiki.locations) as loc}
            <div class="bg-surface-800 border border-surface-600 rounded-xl p-4 hover:border-brand-500/30 transition">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-white flex items-center gap-2">
                    🗺️ {loc.name}
                  </h3>
                  {#if loc.description}
                    <p class="text-sm text-gray-400 mt-1 leading-relaxed">{loc.description}</p>
                  {/if}
                </div>
                <span class="text-xs text-gray-600 bg-surface-700 px-2 py-0.5 rounded-full shrink-0">
                  {loc.sessionCount}× besucht
                </span>
              </div>
            </div>
          {/each}
        {/if}

      {:else if activeCategory === 'threads'}
        <!-- Open Threads -->
        {#if filtered(wiki.threads).length === 0}
          <div class="text-center py-8 text-gray-600 text-sm">Keine offenen Fäden gefunden</div>
        {:else}
          {#each filtered(wiki.threads) as thread}
            <div class="bg-surface-800 border border-surface-600 rounded-xl p-4 hover:border-purple-500/30 transition">
              <div class="flex items-start gap-3">
                <span class="text-purple-400 mt-0.5 shrink-0">🔮</span>
                <div class="flex-1">
                  <p class="text-sm text-gray-300 leading-relaxed">{thread.text}</p>
                </div>
                {#if thread.sessionNumber !== null}
                  <a href="/sessions/{thread.sessionId}"
                    class="text-xs text-gray-600 hover:text-purple-400 transition border border-surface-600 hover:border-purple-500/40 px-2 py-1 rounded-lg shrink-0">
                    Session #{thread.sessionNumber}
                  </a>
                {/if}
              </div>
            </div>
          {/each}
        {/if}

      {:else if activeCategory === 'loot'}
        <!-- Loot -->
        {#if filtered(wiki.loot).length === 0}
          <div class="text-center py-8 text-gray-600 text-sm">Keine Beute gefunden</div>
        {:else}
          <div class="bg-surface-800 border border-surface-600 rounded-xl overflow-hidden">
            <table class="w-full text-sm">
              <tbody>
                {#each filtered(wiki.loot) as item}
                  <tr class="border-b border-surface-700 last:border-0 hover:bg-surface-700/50 transition">
                    <td class="px-4 py-3 text-white">💎 {item.item}</td>
                    <td class="px-4 py-3 text-gray-400">{item.foundBy || '—'}</td>
                    <td class="px-4 py-3 text-right">
                      {#if item.sessionNumber !== null}
                        <a href="/sessions/{item.sessionId}"
                          class="text-xs text-gray-600 hover:text-brand-400 transition">#{item.sessionNumber}</a>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Stufe-1 Hinweis -->
    <div class="text-center pt-4">
      <p class="text-xs text-gray-700">
        📊 Stufe 1 — Automatisch aggregiert aus Session-Summaries. Keine KI-Zusatzverarbeitung.
      </p>
    </div>
  {:else}
    <div class="text-center py-8 text-gray-600 text-sm">Keine Daten verfügbar</div>
  {/if}
</div>
