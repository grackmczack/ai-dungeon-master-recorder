<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import type { Campaign, DiscordCampaignBinding } from '$lib/types.js';

  let campaigns: Campaign[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let discordInviteUrl = $state('');
  let installations = $derived.by(() => {
    const unique = new Map<string, DiscordCampaignBinding['installation']>();
    for (const campaign of campaigns) {
      for (const binding of campaign.bindings ?? []) {
        unique.set(binding.installation.id, binding.installation);
      }
    }
    return [...unique.values()];
  });

  function runningSince(campaign: Campaign): string {
    const value = campaign.firstSessionAt ?? campaign.createdAt;
    return value
      ? new Intl.DateTimeFormat('de-DE', { month: 'short', year: 'numeric' }).format(new Date(value))
      : 'noch nicht gestartet';
  }

  onMount(async () => {
    api.getDiscordConfig()
      .then((config) => { discordInviteUrl = config.inviteUrl ?? ''; })
      .catch(() => { discordInviteUrl = ''; });
    try {
      campaigns = await api.getCampaigns();
    } catch (e: any) {
      error = e.error ?? 'Fehler beim Laden';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head><title>Dashboard — DnD Recorder</title></svelte:head>

<div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
  <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-5 mb-8">
    <div>
      <h1 class="text-3xl font-bold text-white">Deine Kampagnen</h1>
      <p class="text-gray-500 mt-1">Sessions, Gruppenmitglieder und Discord-Server im Überblick</p>
    </div>
    <div class="flex flex-wrap gap-2">
      {#if discordInviteUrl}
        <a href={discordInviteUrl} target="_blank" rel="noreferrer"
          class="border border-brand-500/40 bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 px-4 py-2.5 rounded-lg font-medium transition flex items-center gap-2">
          <span aria-hidden="true">🤖</span> Bot auf weiteren Server einladen
        </a>
      {/if}
      <a href="/kampagnen/neu"
        class="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-lg font-medium transition flex items-center gap-2">
        <span>+</span> Neue Kampagne
      </a>
    </div>
  </div>

  {#if installations.length > 0}
    <section aria-labelledby="discord-server-heading" class="mb-8">
      <h2 id="discord-server-heading" class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Verbundene Discord-Server</h2>
      <div class="flex flex-wrap gap-2">
        {#each installations as installation}
          <div role="status" class="inline-flex items-center gap-2 rounded-full border px-3 py-2 {installation.isActive ? 'border-green-500/30 bg-green-500/10' : 'border-amber-500/30 bg-amber-500/10'}">
            <span class="h-2.5 w-2.5 rounded-full {installation.isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-amber-500'}" aria-hidden="true"></span>
            <span class="text-sm text-white">{installation.guildName}</span>
          </div>
        {/each}
      </div>
      <p class="mt-2 text-xs text-gray-600">Konfiguration in Discord: <code>/kampagne</code> · Diagnose: <code>/status</code></p>
    </section>
  {/if}

  {#if loading}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {#each [1,2,3] as _}<div class="bg-surface-800 rounded-2xl aspect-[4/3] animate-pulse border border-surface-700"></div>{/each}
    </div>
  {:else if error}
    <div class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400">{error}</div>
  {:else if campaigns.length === 0}
    <div class="text-center py-20">
      <div class="text-6xl mb-4">🗺️</div>
      <h2 class="text-xl font-semibold text-white mb-2">Noch keine Kampagne</h2>
      <p class="text-gray-500 mb-6">Erstelle deine erste Kampagne, um loszulegen.</p>
      <a href="/kampagnen/neu" class="bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-lg font-medium transition">Erste Kampagne erstellen</a>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {#each campaigns as campaign}
        <a href="/kampagnen/{campaign.id}"
          class="relative isolate aspect-[4/3] overflow-hidden rounded-2xl border border-surface-600 hover:border-brand-500/60 transition group block bg-surface-800">
          {#if campaign.backgroundImageUrl}
            <img src={campaign.backgroundImageUrl} alt="" class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          {:else}
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,.28),transparent_55%),linear-gradient(145deg,#252536,#15151f)]"></div>
          {/if}
          <div class="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10"></div>
          <div class="relative flex h-full flex-col justify-between p-5">
            <div class="flex justify-between gap-2">
              <span class="rounded-full bg-black/50 px-2.5 py-1 text-xs text-gray-200 backdrop-blur">{campaign.role ?? 'PLAYER'}</span>
              {#if campaign.bindings?.some((binding) => binding.isActive && binding.installation.isActive)}
                <span class="inline-flex items-center gap-1.5 rounded-full bg-green-950/70 px-2.5 py-1 text-xs text-green-300 backdrop-blur"><span class="h-2 w-2 rounded-full bg-green-400"></span> Discord</span>
              {/if}
            </div>
            <div>
              <h3 class="text-xl font-semibold text-white drop-shadow group-hover:text-brand-300 transition">{campaign.name}</h3>
              {#if campaign.description}<p class="mt-1 line-clamp-2 text-sm text-gray-300">{campaign.description}</p>{/if}
              <div class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-300">
                <span>{campaign._count?.sessions ?? 0} Sessions</span>
                <span>{campaign._count?.memberships ?? 0} Mitglieder</span>
                <span>Seit {runningSince(campaign)}</span>
              </div>
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
