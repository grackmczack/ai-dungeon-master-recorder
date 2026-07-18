<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import type { Group } from '$lib/types.js';

  let groups: Group[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let discordInviteUrl = $state('');
  let connectedGroups = $derived(groups.filter((group) => group.discordGuildId));
  let discordConnectionHealthy = $derived(
    connectedGroups.length > 0 && connectedGroups.every((group) => group.discordBotActive)
  );

  onMount(async () => {
    api.getDiscordConfig()
      .then((config) => { discordInviteUrl = config.inviteUrl ?? ''; })
      .catch(() => { discordInviteUrl = ''; });
    try {
      groups = await api.getGroups();
    } catch (e: any) {
      error = e.error ?? 'Fehler beim Laden';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head><title>Dashboard — DnD Recorder</title></svelte:head>

<div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
    <div>
      <h1 class="text-3xl font-bold text-white">Deine Gruppen</h1>
      <p class="text-gray-500 mt-1">Wähle eine Spielgruppe oder erstelle eine neue</p>
    </div>
    <div class="flex flex-wrap gap-2">
      {#if connectedGroups.length > 0}
        <div role="status" class="flex min-h-12 items-center gap-3 rounded-xl border px-4 py-2 {discordConnectionHealthy ? 'border-green-500/30 bg-green-500/10' : 'border-amber-500/30 bg-amber-500/10'}">
          <span class="relative flex h-3 w-3" aria-hidden="true">
            {#if discordConnectionHealthy}<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50"></span>{/if}
            <span class="relative inline-flex h-3 w-3 rounded-full {discordConnectionHealthy ? 'bg-green-500' : 'bg-amber-500'}"></span>
          </span>
          <span>
            <span class="block text-xs {discordConnectionHealthy ? 'text-green-300' : 'text-amber-300'}">{discordConnectionHealthy ? 'Discord verbunden' : 'Bot nicht aktiv'}</span>
            <span class="block max-w-52 truncate text-sm font-medium text-white">
              {connectedGroups.length === 1 ? (connectedGroups[0].discordGuildName ?? connectedGroups[0].name) : `${connectedGroups.length} Server`}
            </span>
          </span>
        </div>
      {:else if discordInviteUrl}
        <div class="flex flex-col items-start">
          <a href={discordInviteUrl} target="_blank" rel="noreferrer"
            class="border border-brand-500/40 bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 px-5 py-2.5 rounded-lg font-medium transition flex items-center gap-2">
            <span aria-hidden="true">🤖</span> Bot einladen
          </a>
          <span class="mt-1 px-1 text-xs text-gray-600">Danach in Discord <code>/status</code> ausführen</span>
        </div>
      {/if}
      <a href="/groups/new"
        class="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-lg font-medium transition flex items-center gap-2">
        <span>+</span> Neue Gruppe
      </a>
    </div>
  </div>

  {#if loading}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each [1,2,3] as _}
        <div class="bg-surface-800 rounded-xl h-36 animate-pulse border border-surface-700"></div>
      {/each}
    </div>
  {:else if error}
    <div class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400">{error}</div>
  {:else if groups.length === 0}
    <div class="text-center py-20">
      <div class="text-6xl mb-4">🗺️</div>
      <h2 class="text-xl font-semibold text-white mb-2">Noch keine Gruppe</h2>
      <p class="text-gray-500 mb-6">Erstelle deine erste Spielgruppe, um loszulegen</p>
      <a href="/groups/new" class="bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-lg font-medium transition">
        Erste Gruppe erstellen
      </a>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each groups as group}
        <a href="/groups/{group.id}"
          class="bg-surface-800 hover:bg-surface-700 border border-surface-600 hover:border-brand-500/50 rounded-xl p-6 transition group cursor-pointer block">
          <div class="flex items-start justify-between mb-3">
            <div class="w-10 h-10 bg-brand-600/20 rounded-lg flex items-center justify-center text-xl">🗺️</div>
            <span class="text-xs px-2 py-1 rounded-full {group.role === 'GM' ? 'bg-brand-500/20 text-brand-400' : 'bg-gray-700 text-gray-400'}">
              {group.role ?? 'PLAYER'}
            </span>
          </div>
          <h3 class="font-semibold text-white group-hover:text-brand-400 transition">{group.name}</h3>
          {#if group.description}
            <p class="text-sm text-gray-500 mt-1 line-clamp-2">{group.description}</p>
          {/if}
          <div class="flex gap-4 mt-4 text-xs text-gray-600">
            <span>{group._count?.campaigns ?? 0} Kampagnen</span>
            <span>{group._count?.memberships ?? 0} Mitglieder</span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
