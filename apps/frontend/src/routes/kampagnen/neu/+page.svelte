<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';
  import { track } from '$lib/analytics.js';

  let name = $state('');
  let description = $state('');
  let setting = $state('');
  let error = $state('');
  let loading = $state(false);

  async function create(event: Event) {
    event.preventDefault();
    loading = true;
    error = '';
    try {
      const campaign = await api.createCampaign({
        name,
        description: description || undefined,
        setting: setting || undefined
      });
      track('campaign_created', {
        page_type: 'app',
        journey_stage: 'setup',
        feature_name: 'campaign',
        method: 'web',
        result: 'success'
      });
      await goto(`/kampagnen/${campaign.id}`);
    } catch (e: any) {
      error = e.error ?? 'Kampagne konnte nicht erstellt werden';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Neue Kampagne — DnD Recorder</title></svelte:head>

<div class="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
  <a href="/dashboard" class="text-gray-500 hover:text-white text-sm flex items-center gap-2 mb-8 transition">← Zurück</a>
  <h1 class="text-2xl font-bold text-white mb-8">Neue Kampagne erstellen</h1>

  <form onsubmit={create} class="bg-surface-800 rounded-2xl p-5 sm:p-8 border border-surface-600 space-y-6">
    {#if error}<div role="alert" class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>{/if}

    <div class="space-y-2">
      <label for="campaign-name" class="block text-sm text-gray-400">Kampagnenname *</label>
      <input id="campaign-name" bind:value={name} required maxlength="120"
        class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition"
        placeholder="z. B. Der Fluch von Strahd" />
    </div>
    <div class="space-y-2">
      <label for="campaign-setting" class="block text-sm text-gray-400">Setting</label>
      <input id="campaign-setting" bind:value={setting} maxlength="200"
        class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition"
        placeholder="z. B. Ravenloft" />
    </div>
    <div class="space-y-2">
      <label for="campaign-description" class="block text-sm text-gray-400">Beschreibung</label>
      <textarea id="campaign-description" bind:value={description} rows="4" maxlength="2000"
        class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition resize-y"
        placeholder="Worum geht es in dieser Kampagne?"></textarea>
    </div>

    <div class="rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-sm text-gray-400">
      Sessions werden automatisch durch <code>/record</code> angelegt. Discord-Server und Kanäle kannst du anschließend in der Kampagne oder mit <code>/kampagne verbinden</code> zuordnen.
    </div>

    <button type="submit" disabled={loading}
      class="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition">
      {loading ? 'Erstellen…' : 'Kampagne erstellen'}
    </button>
  </form>
</div>
