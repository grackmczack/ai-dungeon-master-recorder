<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';

  let loading = $state(true);
  let connecting = $state(false);
  let error = $state('');
  let preview: Awaited<ReturnType<typeof api.previewDiscordConnection>> | null = $state(null);
  let mode: 'existing' | 'new' = $state('new');
  let selectedCampaignId = $state('');
  let newCampaignName = $state('');
  let token = $state('');

  onMount(async () => {
    token = new URLSearchParams($page.url.hash.slice(1)).get('token')
      ?? $page.url.searchParams.get('token')
      ?? '';
    if (token) {
      // Der Token bleibt aus Server-/Referrer-Logs heraus. Die Rücksprungadresse
      // wird lokal bewahrt, falls die Web-Sitzung während des Vorgangs abläuft.
      sessionStorage.setItem(
        'postLoginReturnTo',
        `${$page.url.pathname}${$page.url.search}${$page.url.hash}`
      );
      window.history.replaceState(window.history.state, '', '/connect-discord');
    }
    if (!token) {
      error = 'Der Verbindungslink ist unvollständig.';
      loading = false;
      return;
    }
    try {
      preview = await api.previewDiscordConnection(token);
      newCampaignName = preview.guildName;
      if (preview.campaigns.length > 0) {
        mode = 'existing';
        selectedCampaignId = preview.campaigns[0].id;
      }
    } catch (e: any) {
      error = e.error ?? 'Der Discord-Server konnte nicht geladen werden.';
    } finally {
      loading = false;
    }
  });

  async function connect() {
    if (!preview) return;
    connecting = true;
    error = '';
    try {
      const result = await api.claimDiscordConnection(
        token,
        mode === 'existing'
          ? { targetCampaignId: selectedCampaignId }
          : { newCampaignName: newCampaignName.trim() || preview.guildName }
      );
      sessionStorage.removeItem('postLoginReturnTo');
      await goto(`/kampagnen/${result.campaignId}?discord=connected`);
    } catch (e: any) {
      error = e.error ?? 'Der Discord-Server konnte nicht verbunden werden.';
    } finally {
      connecting = false;
    }
  }
</script>

<svelte:head><title>Discord verbinden — DnD Recorder</title></svelte:head>

<div class="mx-auto max-w-2xl px-4 py-10 sm:px-6">
  <a href="/dashboard" class="mb-8 inline-flex text-sm text-gray-500 hover:text-white">← Dashboard</a>

  {#if loading}
    <div class="animate-pulse space-y-4">
      <div class="h-9 w-2/3 rounded bg-surface-800"></div>
      <div class="h-64 rounded-2xl bg-surface-800"></div>
    </div>
  {:else if !preview}
    <div class="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
      <h1 class="text-xl font-semibold text-white">Verbindung nicht möglich</h1>
      <p role="alert" class="mt-2 text-sm text-red-300">{error}</p>
      <p class="mt-4 text-sm text-gray-400">Führe als Server-Admin in Discord erneut <code>/status</code> aus und öffne den neuen privaten Link.</p>
    </div>
  {:else}
    <div class="mb-6">
      <p class="text-sm font-medium text-brand-400">Discord-Server erkannt</p>
      <h1 class="mt-1 text-3xl font-bold text-white">{preview.guildName} verbinden</h1>
      <p class="mt-2 text-gray-400">Die Server-ID wurde automatisch vom Bot übermittelt.</p>
    </div>

    <form onsubmit={(event) => { event.preventDefault(); connect(); }}
      class="space-y-5 rounded-2xl border border-surface-600 bg-surface-800 p-5 sm:p-7">
      {#if preview.existingSessions > 0}
        <div class="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {preview.existingSessions} bereits aufgezeichnete Session{preview.existingSessions === 1 ? '' : 's'} {preview.existingSessions === 1 ? 'wird' : 'werden'} beim Verbinden übernommen.
        </div>
      {/if}

      {#if preview.campaigns.length > 0}
        <fieldset class="space-y-3">
          <legend class="text-sm font-medium text-gray-300">Mit welcher Kampagne verbinden?</legend>
          {#each preview.campaigns as candidate}
            <label class="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 transition {mode === 'existing' && selectedCampaignId === candidate.id ? 'border-brand-500/60 bg-brand-500/10' : 'border-surface-600 hover:border-surface-500'}">
              <input type="radio" name="target-campaign" value={candidate.id}
                checked={mode === 'existing' && selectedCampaignId === candidate.id}
                onchange={() => { mode = 'existing'; selectedCampaignId = candidate.id; }}
                class="mt-1 accent-brand-500" />
              <span>
                <span class="block font-medium text-white">{candidate.name}</span>
                {#if candidate.description}<span class="mt-0.5 block text-xs text-gray-500">{candidate.description}</span>{/if}
              </span>
            </label>
          {/each}

          <label class="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 transition {mode === 'new' ? 'border-brand-500/60 bg-brand-500/10' : 'border-surface-600 hover:border-surface-500'}">
            <input type="radio" name="target-group" checked={mode === 'new'} onchange={() => mode = 'new'}
              class="mt-1 accent-brand-500" />
            <span class="font-medium text-white">Als neue Kampagne hinzufügen</span>
          </label>
        </fieldset>
      {/if}

      {#if mode === 'new'}
        <div class="space-y-2">
          <label for="new-campaign-name" class="text-sm text-gray-300">Name der neuen Kampagne</label>
          <input id="new-campaign-name" bind:value={newCampaignName} required maxlength="100"
            class="w-full rounded-lg border border-surface-600 bg-surface-700 px-4 py-3 text-white focus:border-brand-500 focus:outline-none" />
        </div>
      {/if}

      {#if error}<p role="alert" class="text-sm text-red-300">{error}</p>{/if}

      <button type="submit" disabled={connecting || (mode === 'existing' && !selectedCampaignId)}
        class="min-h-12 w-full rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition">
        {connecting ? 'Verbinde…' : 'Discord-Server verbinden'}
      </button>
      <p class="text-center text-xs text-gray-600">Der Link ist einmalig und läuft nach 15 Minuten ab. Es wird keine Discord-Benutzer-ID gespeichert.</p>
    </form>
  {/if}
</div>
