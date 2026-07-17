<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';

  let name = $state('');
  let description = $state('');
  let discordGuildId = $state('');
  let error = $state('');
  let loading = $state(false);
  let discordInviteUrl = $state('');

  onMount(() => {
    api.getDiscordConfig()
      .then((config) => { discordInviteUrl = config.inviteUrl ?? ''; })
      .catch(() => { discordInviteUrl = ''; });
  });

  async function create(e: Event) {
    e.preventDefault();
    loading = true;
    error = '';
    try {
      const group = await api.createGroup({ name, description: description || undefined, discordGuildId: discordGuildId || undefined });
      goto(`/groups/${group.id}`);
    } catch (e: any) {
      error = e.error ?? 'Fehler beim Erstellen';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Neue Gruppe — DM Recorder</title></svelte:head>

<div class="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
  <a href="/dashboard" class="text-gray-500 hover:text-white text-sm flex items-center gap-2 mb-8 transition">← Zurück</a>
  <h1 class="text-2xl font-bold text-white mb-8">Neue Gruppe erstellen</h1>

  <form onsubmit={create} class="bg-surface-800 rounded-2xl p-5 sm:p-8 border border-surface-600 space-y-6">
    {#if error}
      <div class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
    {/if}

    <div class="space-y-2">
      <label for="group-name" class="block text-sm text-gray-400">Gruppenname *</label>
      <input id="group-name" bind:value={name} required
        class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition"
        placeholder="z.B. Vergessene Reiche" />
    </div>

    <div class="space-y-2">
      <label for="group-description" class="block text-sm text-gray-400">Beschreibung</label>
      <textarea id="group-description" bind:value={description} rows="3"
        class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition resize-none"
        placeholder="Optional: kurze Beschreibung der Gruppe"></textarea>
    </div>

    <div class="space-y-2">
      <label for="discord-guild-id" class="block text-sm text-gray-400">Discord Server ID</label>
      <input id="discord-guild-id" bind:value={discordGuildId}
        inputmode="numeric" pattern={'[0-9]{17,20}'}
        class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-brand-500 transition"
        placeholder="z.B. 1394755474263375902" />
      <p class="text-xs text-gray-600">Damit Bot-Aufnahmen sicher dieser Gruppe zugeordnet werden: Rechtsklick auf deinen Discord-Server → Server-ID kopieren (Entwicklermodus nötig).</p>
      {#if discordInviteUrl}
        <a href={discordInviteUrl} target="_blank" rel="noreferrer"
          class="inline-flex text-xs text-brand-400 hover:text-brand-300">
          Bot noch nicht installiert? Jetzt zum Discord-Server hinzufügen →
        </a>
      {/if}
    </div>

    <button type="submit" disabled={loading}
      class="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition">
      {loading ? 'Erstellen...' : 'Gruppe erstellen'}
    </button>
  </form>
</div>
