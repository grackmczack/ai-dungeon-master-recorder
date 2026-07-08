<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import { auth } from '$lib/auth.js';
  import type { Group } from '$lib/types.js';

  let group: any = $state(null);
  let loading = $state(true);
  let error = $state('');
  let editingContext: string | null = $state(null);
  let contextEdits: Record<string, string> = $state({});

  const STATUS_LABELS: Record<string, string> = {
    RECORDING: '🔴 Aufnahme',
    PROCESSING: '⏳ Verarbeitung',
    TRANSCRIBING: '📝 Transkription',
    SUMMARIZING: '✍️ Zusammenfassung',
    DONE: '✅ Fertig',
    FAILED: '❌ Fehler'
  };
  const STATUS_COLORS: Record<string, string> = {
    RECORDING: 'text-red-400 bg-red-500/10',
    PROCESSING: 'text-yellow-400 bg-yellow-500/10',
    TRANSCRIBING: 'text-blue-400 bg-blue-500/10',
    SUMMARIZING: 'text-purple-400 bg-purple-500/10',
    DONE: 'text-green-400 bg-green-500/10',
    FAILED: 'text-red-400 bg-red-500/10'
  };

  onMount(async () => {
    try {
      group = await api.getGroup($page.params.id!);
    } catch (e: any) {
      error = e.error ?? 'Fehler beim Laden';
    } finally {
      loading = false;
    }
  });

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  async function saveContext(campaignId: string) {
    try {
      await fetch(`/api/campaigns/${campaignId}/context`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.getToken()}` },
        body: JSON.stringify({ campaignContext: contextEdits[campaignId] })
      });
      const c = group?.campaigns.find((c: any) => c.id === campaignId);
      if (c) c.campaignContext = contextEdits[campaignId];
      editingContext = null;
    } catch (e) {
      console.error('Context save failed:', e);
    }
  }
</script>

<div class="max-w-5xl mx-auto px-6 py-10">
  <a href="/dashboard" class="text-gray-500 hover:text-white text-sm flex items-center gap-2 mb-6 transition">← Dashboard</a>

  {#if loading}
    <div class="animate-pulse space-y-4">
      <div class="h-8 bg-surface-800 rounded w-1/3"></div>
      <div class="h-4 bg-surface-800 rounded w-1/2"></div>
    </div>
  {:else if error}
    <div class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400">{error}</div>
  {:else if group}
    <div class="flex items-start justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white">{group.name}</h1>
        {#if group.description}<p class="text-gray-500 mt-1">{group.description}</p>{/if}
        {#if group.discordGuildId}
          <p class="text-xs text-gray-600 mt-1 font-mono">Guild: {group.discordGuildId}</p>
        {/if}
      </div>
      <a href="/settings?groupId={group.id}"
        class="text-gray-500 hover:text-white text-sm border border-surface-600 hover:border-surface-500 px-4 py-2 rounded-lg transition">
        ⚙️ Einstellungen
      </a>
    </div>

    <!-- Kampagnen -->
    {#if group.campaigns.length === 0}
      <div class="text-center py-16 bg-surface-800 rounded-2xl border border-surface-600">
        <div class="text-5xl mb-3">📜</div>
        <h2 class="text-lg font-semibold text-white mb-1">Keine Kampagnen</h2>
        <p class="text-gray-500 text-sm">Sessions werden hier erscheinen sobald der Bot aufnimmt</p>
      </div>
    {:else}
      {#each group.campaigns as campaign}
        <div class="mb-8">
          <div class="flex items-center gap-3 mb-4">
            <h2 class="text-xl font-semibold text-white">{campaign.name}</h2>
            {#if campaign.setting}<span class="text-xs text-gray-500 bg-surface-700 px-2 py-1 rounded">{campaign.setting}</span>{/if}
          </div>

          {#if editingContext === campaign.id}
            <div class="mb-4 bg-surface-700 rounded-xl p-4 border border-brand-500/30">
              <textarea bind:value={contextEdits[campaign.id]} rows="3"
                class="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-none"
                placeholder="Kampagnen-Kontext für die KI-Zusammenfassung..."></textarea>
              <div class="flex gap-2 mt-2">
                <button onclick={() => saveContext(campaign.id)}
                  class="bg-brand-600 hover:bg-brand-500 text-white text-xs px-3 py-1.5 rounded-lg transition">Speichern</button>
                <button onclick={() => editingContext = null}
                  class="text-gray-500 hover:text-white text-xs px-3 py-1.5 transition">Abbrechen</button>
              </div>
            </div>
          {:else}
            <button onclick={() => { editingContext = campaign.id; contextEdits[campaign.id] = campaign.campaignContext ?? ''; }}
              class="text-xs text-gray-600 hover:text-brand-400 transition mb-3 flex items-center gap-1">
              ✏️ {campaign.campaignContext ? 'Kontext bearbeiten' : 'Kampagnen-Kontext hinzufügen'}
            </button>
          {/if}

          {#if !campaign.sessions?.length}
            <p class="text-gray-600 text-sm pl-4 border-l border-surface-700">Noch keine Sessions</p>
          {:else}
            <div class="space-y-3">
              {#each campaign.sessions as session}
                <a href="/sessions/{session.id}"
                  class="flex items-center justify-between bg-surface-800 hover:bg-surface-700 border border-surface-600 hover:border-brand-500/40 rounded-xl px-5 py-4 transition group block">
                  <div class="flex items-center gap-4">
                    <span class="text-gray-600 text-sm w-8">#{session.sessionNumber ?? '?'}</span>
                    <div>
                      <p class="font-medium text-white group-hover:text-brand-400 transition">
                        {session.title ?? `Session vom ${formatDate(session.startedAt)}`}
                      </p>
                      <p class="text-xs text-gray-600 mt-0.5">{formatDate(session.startedAt)}</p>
                    </div>
                  </div>
                  <span class="text-xs px-2.5 py-1 rounded-full {STATUS_COLORS[session.status] ?? 'text-gray-400 bg-gray-500/10'}">
                    {STATUS_LABELS[session.status] ?? session.status}
                  </span>
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    {/if}

    <!-- Mitglieder -->
    <div class="mt-10 bg-surface-800 rounded-2xl border border-surface-600 p-6">
      <h3 class="font-semibold text-white mb-4">Mitglieder</h3>
      <div class="space-y-3">
        {#each group.memberships as m}
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-white">{m.user.displayName}</p>
              <p class="text-xs text-gray-600">{m.user.email}</p>
            </div>
            <span class="text-xs px-2 py-1 rounded-full {m.role === 'GM' ? 'bg-brand-500/20 text-brand-400' : 'bg-gray-700/50 text-gray-400'}">{m.role}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
