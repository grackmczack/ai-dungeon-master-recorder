<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';

  let name = $state('');
  let description = $state('');
  let discordGuildId = $state('');
  let error = $state('');
  let loading = $state(false);

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

<div class="max-w-2xl mx-auto px-6 py-10">
  <a href="/dashboard" class="text-gray-500 hover:text-white text-sm flex items-center gap-2 mb-8 transition">← Zurück</a>
  <h1 class="text-2xl font-bold text-white mb-8">Neue Gruppe erstellen</h1>

  <form onsubmit={create} class="bg-surface-800 rounded-2xl p-8 border border-surface-600 space-y-6">
    {#if error}
      <div class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
    {/if}

    <div class="space-y-2">
      <label class="block text-sm text-gray-400">Gruppenname *</label>
      <input bind:value={name} required
        class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition"
        placeholder="z.B. Die Vergessenen Helden" />
    </div>

    <div class="space-y-2">
      <label class="block text-sm text-gray-400">Beschreibung</label>
      <textarea bind:value={description} rows="3"
        class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition resize-none"
        placeholder="Optional: kurze Beschreibung der Gruppe"></textarea>
    </div>

    <div class="space-y-2">
      <label class="block text-sm text-gray-400">Discord Server ID</label>
      <input bind:value={discordGuildId}
        class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-brand-500 transition"
        placeholder="z.B. 1394755474263375902" />
      <p class="text-xs text-gray-600">Rechtsklick auf deinen Discord-Server → Server-ID kopieren (Developer Mode nötig)</p>
    </div>

    <button type="submit" disabled={loading}
      class="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition">
      {loading ? 'Erstellen...' : 'Gruppe erstellen'}
    </button>
  </form>
</div>
