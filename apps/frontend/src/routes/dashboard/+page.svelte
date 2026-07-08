<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import type { Group } from '$lib/types.js';

  let groups: Group[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  onMount(async () => {
    try {
      groups = await api.getGroups();
    } catch (e: any) {
      error = e.error ?? 'Fehler beim Laden';
    } finally {
      loading = false;
    }
  });
</script>

<div class="max-w-5xl mx-auto px-6 py-10">
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-3xl font-bold text-white">Deine Gruppen</h1>
      <p class="text-gray-500 mt-1">Wähle eine Gruppe oder erstelle eine neue</p>
    </div>
    <a href="/groups/new"
      class="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-lg font-medium transition flex items-center gap-2">
      <span>+</span> Neue Gruppe
    </a>
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
      <p class="text-gray-500 mb-6">Erstelle deine erste Gruppe um loszulegen</p>
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
            <div class="w-10 h-10 bg-brand-600/20 rounded-lg flex items-center justify-center text-xl">🐉</div>
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
