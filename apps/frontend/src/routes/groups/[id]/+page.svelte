<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';
  import { parallax, parallaxFixed } from '$lib/actions/parallax.js';
  import WikiView from '$lib/components/WikiView.svelte';
  import Dialog from '$lib/components/Dialog.svelte';
  import { keyboardTabs } from '$lib/actions/tabs.js';
  import { confirmAction } from '$lib/confirm.js';

  let group: any = $state(null);
  let loading = $state(true);
  let error = $state('');
  let discordInviteUrl = $state('');
  let discordInstallations: Array<{ id: string; guildName: string; isActive: boolean }> = $state([]);
  let bindingBusy = $state('');
  let editingContext: string | null = $state(null);
  let contextEdits: Record<string, string> = $state({});

  // Tab state
  let activeView: 'sessions' | 'diary' | 'wiki' | 'members' = $state('sessions');

  // Wiki state
  let wikiCampaignId: string | null = $state(null);
  let wikiCampaignName: string = $state('');
  let diaryLoading = $state(false);
  let diarySessions: any[] = $state([]);

  // Members state
  let showAddMember = $state(false);
  let newDiscordName = $state('');
  let newCharacterName = $state('');
  let newPartyRole = $state('');
  let newRole = $state('PLAYER');
  let creatingMember = $state(false);
  let createMemberError = $state('');
  let pausingMemberId: string | null = $state(null);
  let pauseNote = $state('');

  // Edit-Modal state
  let editingMember: any = $state(null);
  let editDiscordName = $state('');
  let editCharacterName = $state('');
  let editPartyRole = $state('');
  let editRole = $state('PLAYER');
  let savingMember = $state(false);
  let editError = $state('');
  let uploadingAvatar = $state(false);
  let uploadingSheet = $state(false);

  // Kampagnen-Hintergrundbild state
  let uploadingBackgroundFor: string | null = $state(null);
  let backgroundError: Record<string, string> = $state({});
  let generatingBackgroundFor: string | null = $state(null);
  let generatePrompt: Record<string, string> = $state({});
  let generateError: Record<string, string> = $state({});
  let backgroundVersion: Record<string, number> = $state({});
  let deletingCampaign = $state(false);

  // Paginierte Sessions
  let loadingMoreSessions: Record<string, boolean> = $state({});

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

  function campaignView(campaign: any) {
    const primaryBinding = campaign.bindings?.find(
      (binding: any) => binding.isActive && binding.installation.isActive
    ) ?? campaign.bindings?.[0];
    return {
      ...campaign,
      campaigns: [campaign],
      discordGuildId: primaryBinding?.installation.discordGuildId ?? null,
      discordGuildName: primaryBinding?.installation.guildName ?? null,
      discordBotActive: primaryBinding?.installation.isActive ?? false
    };
  }

  async function reloadCampaign() {
    group = campaignView(await api.getCampaign($page.params.id!));
  }

  onMount(async () => {
    try {
      const [campaign, discordConfig, installations] = await Promise.all([
        api.getCampaign($page.params.id!),
        api.getDiscordConfig().catch(() => ({ configured: false, inviteUrl: null })),
        api.getDiscordInstallations().catch(() => [])
      ]);
      group = campaignView(campaign);
      discordInviteUrl = discordConfig.inviteUrl ?? '';
      discordInstallations = installations;
    } catch (e: any) {
      error = e.error ?? 'Fehler beim Laden';
    } finally {
      loading = false;
    }
  });

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function backgroundImageUrl(campaign: any | null | undefined) {
    if (!campaign?.backgroundImageUrl) return null;
    const version = backgroundVersion[campaign.id] ?? (campaign.updatedAt ? new Date(campaign.updatedAt).getTime() : 0);
    return `${campaign.backgroundImageUrl}?v=${version}`;
  }

  async function saveContext(campaignId: string) {
    try {
      await api.updateCampaignContext(campaignId, contextEdits[campaignId]);
      const c = group?.campaigns.find((c: any) => c.id === campaignId);
      if (c) c.campaignContext = contextEdits[campaignId];
      editingContext = null;
    } catch (e) {
      console.error('Context save failed:', e);
    }
  }

  async function onBackgroundSelected(e: Event, campaignId: string) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    uploadingBackgroundFor = campaignId;
    backgroundError[campaignId] = '';
    try {
      const { backgroundImageUrl } = await api.uploadCampaignBackground(campaignId, file);
      const c = group?.campaigns.find((c: any) => c.id === campaignId);
      if (c) {
        c.backgroundImageUrl = backgroundImageUrl;
        backgroundVersion[campaignId] = Date.now();
      }
    } catch (err: any) {
      backgroundError[campaignId] = err.error ?? 'Fehler beim Hochladen';
    } finally {
      uploadingBackgroundFor = null;
    }
  }

  async function generateBackground(campaign: any) {
    generatingBackgroundFor = campaign.id;
    generateError[campaign.id] = '';
    try {
      const prompt = generatePrompt[campaign.id]?.trim();
      const { backgroundImageUrl } = await api.generateCampaignBackground(campaign.id, prompt || undefined);
      campaign.backgroundImageUrl = backgroundImageUrl;
      backgroundVersion[campaign.id] = Date.now();
    } catch (err: any) {
      generateError[campaign.id] = err.error ?? 'Fehler bei der Bildgenerierung';
    } finally {
      generatingBackgroundFor = null;
    }
  }

  async function removeBackground(campaignId: string) {
    if (!await confirmAction({
      title: 'Hintergrundbild entfernen?',
      message: 'Das aktuelle Kampagnen-Hintergrundbild wird dauerhaft entfernt.',
      confirmLabel: 'Bild entfernen',
      danger: true
    })) return;
    try {
      await api.removeCampaignBackground(campaignId);
      const c = group?.campaigns.find((c: any) => c.id === campaignId);
      if (c) c.backgroundImageUrl = undefined;
      delete backgroundVersion[campaignId];
    } catch (err: any) {
      backgroundError[campaignId] = err.error ?? 'Fehler beim Entfernen';
    }
  }

  async function loadDiary() {
    if (diarySessions.length > 0) return;
    diaryLoading = true;
    try {
      const allSessions: any[] = [];
      for (const campaign of group?.campaigns ?? []) {
        for (const session of campaign.sessions ?? []) {
          if (session.status === 'DONE') {
            try {
              const full = await api.getSession(session.id);
              allSessions.push(full);
            } catch { /* skip */ }
          }
        }
      }
      diarySessions = allSessions.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    } finally {
      diaryLoading = false;
    }
  }

  async function loadMoreSessions(campaignId: string) {
    loadingMoreSessions[campaignId] = true;
    try {
      const c = group?.campaigns.find((c: any) => c.id === campaignId);
      if (!c) return;
      const currentCount = c.sessions?.length ?? 0;
      const result = await api.getCampaignSessions(campaignId, currentCount, 10);
      c.sessions = [...(c.sessions ?? []), ...result.sessions];
    } catch (e) {
      console.error('Failed to load more sessions:', e);
    } finally {
      loadingMoreSessions[campaignId] = false;
    }
  }

  async function createMember() {
    creatingMember = true;
    createMemberError = '';
    try {
      await api.createMember($page.params.id!, {
        discordName: newDiscordName || undefined,
        characterName: newCharacterName || undefined,
        partyRole: newPartyRole || undefined,
        role: newRole
      });
      await reloadCampaign();
      showAddMember = false;
      newDiscordName = '';
      newCharacterName = '';
      newPartyRole = '';
      newRole = 'PLAYER';
    } catch (e: any) {
      createMemberError = e.error ?? 'Fehler beim Anlegen';
    } finally {
      creatingMember = false;
    }
  }

  function openEditMember(member: any) {
    editingMember = member;
    editDiscordName = member.discordName ?? '';
    editCharacterName = member.characterName ?? '';
    editPartyRole = member.partyRole ?? '';
    editRole = member.role;
    editError = '';
  }

  async function saveEditMember() {
    if (!editingMember) return;
    savingMember = true;
    editError = '';
    try {
      await api.updateMember($page.params.id!, editingMember.id, {
        discordName: editDiscordName || null,
        characterName: editCharacterName || null,
        partyRole: editPartyRole || null,
        role: editRole
      });
      await reloadCampaign();
      editingMember = null;
    } catch (e: any) {
      editError = e.error ?? 'Fehler beim Speichern';
    } finally {
      savingMember = false;
    }
  }

  async function onAvatarSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !editingMember) return;
    uploadingAvatar = true;
    try {
      const { avatarUrl } = await api.uploadMemberAvatar($page.params.id!, editingMember.id, file);
      editingMember.avatarUrl = avatarUrl;
      await reloadCampaign();
    } catch (e: any) {
      editError = e.error ?? 'Fehler beim Avatar-Upload';
    } finally {
      uploadingAvatar = false;
    }
  }

  async function onSheetSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !editingMember) return;
    uploadingSheet = true;
    try {
      const { characterSheetUrl } = await api.uploadMemberCharacterSheet($page.params.id!, editingMember.id, file);
      editingMember.characterSheetUrl = characterSheetUrl;
      await reloadCampaign();
    } catch (e: any) {
      editError = e.error ?? 'Fehler beim PDF-Upload';
    } finally {
      uploadingSheet = false;
    }
  }

  async function pauseMember(memberId: string) {
    await api.pauseMember($page.params.id!, memberId, pauseNote);
    await reloadCampaign();
    pausingMemberId = null;
  }

  async function resumeMember(memberId: string) {
    await api.resumeMember($page.params.id!, memberId);
    await reloadCampaign();
  }

  async function removeMember(memberId: string, name: string) {
    if (!await confirmAction({
      title: 'Mitglied entfernen?',
      message: `${name} wird aus der Kampagne entfernt. Die Session-Historie bleibt erhalten.`,
      confirmLabel: 'Mitglied entfernen',
      danger: true
    })) return;
    await api.removeMember($page.params.id!, memberId);
    await reloadCampaign();
  }

  async function deleteCurrentCampaign() {
    if (!await confirmAction({
      title: 'Kampagne löschen?',
      message: `„${group.name}“ wird einschließlich Sessions, Zusammenfassungen und Wiki dauerhaft gelöscht.`,
      confirmLabel: 'Kampagne löschen',
      danger: true
    })) return;
    deletingCampaign = true;
    try {
      await api.deleteCampaign(group.id);
      await goto('/dashboard');
    } catch (e: any) {
      error = e.error ?? 'Kampagne konnte nicht gelöscht werden';
      deletingCampaign = false;
    }
  }

  async function addDiscordServer(installationId: string) {
    if (!installationId) return;
    bindingBusy = installationId;
    try {
      await api.addCampaignDiscordBinding(group.id, installationId);
      await reloadCampaign();
    } finally {
      bindingBusy = '';
    }
  }

  async function setBindingActive(binding: any, isActive: boolean) {
    bindingBusy = binding.id;
    try {
      await api.updateCampaignDiscordBinding(group.id, binding.id, { isActive });
      await reloadCampaign();
    } finally {
      bindingBusy = '';
    }
  }

  async function removeBinding(binding: any) {
    if (!await confirmAction({
      title: 'Discord-Server trennen?',
      message: `${binding.installation.guildName} wird von dieser Kampagne getrennt.`,
      confirmLabel: 'Verbindung trennen',
      danger: true
    })) return;
    bindingBusy = binding.id;
    try {
      await api.removeCampaignDiscordBinding(group.id, binding.id);
      await reloadCampaign();
    } finally {
      bindingBusy = '';
    }
  }

  function availableDiscordInstallations() {
    return discordInstallations.filter(
      (installation) =>
        !(group?.campaigns?.[0]?.bindings ?? []).some(
          (binding: any) => binding.installation.id === installation.id
        )
    );
  }
</script>

<svelte:head><title>{group?.name ?? 'Kampagne'} — DnD Recorder</title></svelte:head>

<div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 relative">
  <!-- Seitenweiter Hintergrund (Parallax) -->
  {#if group && backgroundImageUrl(group.campaigns?.[0])}
    <div class="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      <div class="absolute -inset-y-[40%] inset-x-0" use:parallaxFixed={0.5}>
        <img src={backgroundImageUrl(group.campaigns[0])!} alt="" class="w-full h-full object-cover opacity-30" />
      </div>
      <div class="absolute inset-0 bg-gradient-to-t from-surface-900 via-surface-900/60 to-surface-900/40"></div>
    </div>
  {/if}

  <a href="/dashboard" class="text-gray-500 hover:text-white text-sm flex items-center gap-2 mb-6 transition">← Dashboard</a>

  {#if loading}
    <div class="animate-pulse space-y-4">
      <div class="h-8 bg-surface-800 rounded w-1/3"></div>
      <div class="h-4 bg-surface-800 rounded w-1/2"></div>
    </div>
  {:else if error}
    <div class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400">{error}</div>
  {:else if group}
    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white">{group.name}</h1>
        {#if group.description}<p class="text-gray-500 mt-1">{group.description}</p>{/if}
        <div class="mt-3 flex flex-wrap gap-2">
          {#each group.campaigns?.[0]?.bindings ?? [] as binding}
            <div role="status" class="inline-flex items-center gap-2 rounded-full border px-3 py-2 {binding.isActive && binding.installation.isActive ? 'border-green-500/30 bg-green-500/10' : 'border-amber-500/30 bg-amber-500/10'}">
              <span class="h-2.5 w-2.5 rounded-full {binding.isActive && binding.installation.isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-amber-500'}" aria-hidden="true"></span>
              <span class="text-sm text-white">{binding.installation.guildName}</span>
              <span class="text-xs {binding.isActive && binding.installation.isActive ? 'text-green-300' : 'text-amber-300'}">· {binding.isActive && binding.installation.isActive ? 'Verbunden' : 'Inaktiv'}</span>
              {#if binding.voiceChannelName}<span class="text-xs text-gray-400">· {binding.voiceChannelName}</span>{/if}
            </div>
          {/each}
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        {#if discordInviteUrl}<a href={discordInviteUrl} target="_blank" rel="noreferrer" class="text-sm border border-brand-500/40 text-brand-300 hover:bg-brand-500/10 px-4 py-2 rounded-lg transition">🤖 Weiteren Server</a>{/if}
        <a href="/settings?campaignId={group.id}"
          class="text-gray-500 hover:text-white text-sm border border-surface-600 hover:border-surface-500 px-4 py-2 rounded-lg transition">
          ⚙️ Einstellungen
        </a>
        <button type="button" onclick={deleteCurrentCampaign} disabled={deletingCampaign}
          class="text-sm border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 px-4 py-2 rounded-lg transition">
          {deletingCampaign ? 'Lösche…' : 'Kampagne löschen'}
        </button>
      </div>
    </div>

    {#if !group.discordGuildId}
      <section aria-labelledby="discord-connect-title" class="mb-8 rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5 sm:p-6">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div class="max-w-2xl">
            <h2 id="discord-connect-title" class="text-lg font-semibold text-white">🤖 Discord-Server verbinden</h2>
            <p class="mt-1 text-sm text-gray-400">Keine Server-ID nötig: Der Bot erkennt den Server automatisch und gibt den Verbindungslink ausschließlich einem Server-Admin aus.</p>
            <ol class="mt-4 space-y-2 text-sm text-gray-300">
              <li><span class="mr-2 text-brand-400">1.</span>Bot zum gewünschten Server einladen.</li>
              <li><span class="mr-2 text-brand-400">2.</span>Als Server-Admin <code>/status</code> ausführen – alternativ erscheint der Hinweis nach <code>/record</code>.</li>
              <li><span class="mr-2 text-brand-400">3.</span>Den privaten Link anklicken und diese Kampagne auswählen.</li>
            </ol>
          </div>
          <div class="flex shrink-0 flex-col items-start gap-1">
            {#if discordInviteUrl}
              <a href={discordInviteUrl} target="_blank" rel="noreferrer"
                class="inline-flex min-h-11 items-center rounded-lg border border-brand-500/40 px-4 py-2 text-sm font-medium text-brand-300 hover:bg-brand-500/10 transition">
                Bot einladen
              </a>
              <p class="max-w-52 text-xs leading-relaxed text-gray-600">Danach als Server-Admin <code>/status</code> ausführen und den privaten Link öffnen.</p>
            {/if}
          </div>
        </div>
      </section>
    {/if}

    <section aria-labelledby="campaign-discord-title" class="mb-8 rounded-2xl border border-surface-600 bg-surface-800 p-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="campaign-discord-title" class="font-semibold text-white">Discord-Zuordnungen</h2>
          <p class="mt-1 text-xs text-gray-500">Voice- und Summary-Kanal setzt du komfortabel mit <code>/kampagne verbinden</code>.</p>
        </div>
        {#if availableDiscordInstallations().length > 0}
          <label class="text-xs text-gray-400">
            <span class="sr-only">Weiteren Discord-Server zuordnen</span>
            <select disabled={!!bindingBusy} onchange={(event) => { const select = event.currentTarget; addDiscordServer(select.value); select.value = ''; }}
              class="min-h-10 rounded-lg border border-surface-600 bg-surface-700 px-3 text-sm text-white focus:border-brand-500 focus:outline-none">
              <option value="">Server zuordnen…</option>
              {#each availableDiscordInstallations() as installation}<option value={installation.id}>{installation.guildName}</option>{/each}
            </select>
          </label>
        {/if}
      </div>
      {#if (group.campaigns?.[0]?.bindings ?? []).length > 0}
        <div class="mt-4 space-y-2">
          {#each group.campaigns[0].bindings as binding}
            <div class="flex flex-col gap-3 rounded-xl border border-surface-600 bg-surface-700/60 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-white">{binding.installation.guildName}</p>
                <p class="mt-0.5 text-xs text-gray-500">
                  {binding.voiceChannelName ? `Voice: ${binding.voiceChannelName}` : 'Voice wird beim nächsten /record automatisch festgelegt'}
                  {binding.summaryChannelName ? ` · Summary: ${binding.summaryChannelName}` : binding.summaryChannelId ? ' · Summary-Kanal verbunden' : ''}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button type="button" disabled={bindingBusy === binding.id} onclick={() => setBindingActive(binding, !binding.isActive)}
                  class="min-h-10 rounded-lg border px-3 text-xs transition {binding.isActive ? 'border-green-500/30 text-green-300 hover:bg-green-500/10' : 'border-surface-500 text-gray-400 hover:text-white'}">
                  {binding.isActive ? '🟢 Aktiv' : '⚫ Inaktiv'}
                </button>
                <button type="button" disabled={bindingBusy === binding.id} onclick={() => removeBinding(binding)}
                  class="min-h-10 rounded-lg border border-red-500/20 px-3 text-xs text-red-400 hover:bg-red-500/10 transition">Trennen</button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="mt-4 text-sm text-gray-500">Noch kein Discord-Server zugeordnet.</p>
      {/if}
    </section>

    <div role="tablist" aria-label="Kampagnenbereiche" use:keyboardTabs
      class="flex gap-1 mb-6 bg-surface-800 rounded-xl p-1 max-w-full overflow-x-auto border border-surface-600">
      <button id="group-tab-sessions" role="tab" aria-selected={activeView === 'sessions'} aria-controls="group-panel-sessions" tabindex={activeView === 'sessions' ? 0 : -1} onclick={() => activeView = 'sessions'}
        class="px-4 py-2 rounded-lg text-sm font-medium transition {activeView === 'sessions' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
        📅 Sessions
      </button>
      <button id="group-tab-diary" role="tab" aria-selected={activeView === 'diary'} aria-controls="group-panel-diary" tabindex={activeView === 'diary' ? 0 : -1} onclick={() => { activeView = 'diary'; loadDiary(); }}
        class="px-4 py-2 rounded-lg text-sm font-medium transition {activeView === 'diary' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
        📖 Tagebuch
      </button>
      <button id="group-tab-wiki" role="tab" aria-selected={activeView === 'wiki'} aria-controls="group-panel-wiki" tabindex={activeView === 'wiki' ? 0 : -1} onclick={() => {
          activeView = 'wiki';
          // Wähle erste Kampagne für Wiki-Ansicht
          if (!wikiCampaignId && group?.campaigns?.length) {
            wikiCampaignId = group.campaigns[0].id;
            wikiCampaignName = group.campaigns[0].name;
          }
        }}
        class="px-4 py-2 rounded-lg text-sm font-medium transition {activeView === 'wiki' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
        📜 Wiki
      </button>
      <button id="group-tab-members" role="tab" aria-selected={activeView === 'members'} aria-controls="group-panel-members" tabindex={activeView === 'members' ? 0 : -1} onclick={() => activeView = 'members'}
        class="px-4 py-2 rounded-lg text-sm font-medium transition {activeView === 'members' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
        👥 Mitglieder
      </button>
    </div>

    <div role="tabpanel" id={`group-panel-${activeView}`} aria-labelledby={`group-tab-${activeView}`} tabindex="0">
    {#if activeView === 'sessions'}
      <!-- Kampagnen & Sessions -->
      {#if group.campaigns.length === 0}
        <div class="text-center py-16 bg-surface-800 rounded-2xl border border-surface-600">
          <div class="text-5xl mb-3">📜</div>
          <h2 class="text-lg font-semibold text-white mb-1">Keine Kampagnen</h2>
          <p class="text-gray-500 text-sm">Sessions werden hier erscheinen sobald der Bot aufnimmt</p>
        </div>
      {:else}
        {#each group.campaigns as campaign}
          <div class="mb-8">
            <div class="relative aspect-[4/3] rounded-2xl overflow-hidden mb-4 border border-surface-600 bg-surface-800">
              {#if campaign.backgroundImageUrl}
                <div class="absolute -inset-y-[25%] inset-x-0" use:parallax={0.12}>
                  <img src={backgroundImageUrl(campaign)!} alt="" class="w-full h-full object-cover opacity-60" />
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-surface-900 via-surface-900/40 to-transparent"></div>
              {:else}
                <div class="absolute inset-0 flex items-center justify-center text-gray-700 text-4xl">🗺️</div>
              {/if}

              <div class="absolute bottom-0 left-0 right-0 p-4 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
                <div class="flex items-center gap-3">
                  <h2 class="text-xl font-semibold text-white drop-shadow">{campaign.name}</h2>
                  {#if campaign.setting}<span class="text-xs text-gray-200 bg-black/40 backdrop-blur px-2 py-1 rounded">{campaign.setting}</span>{/if}
                </div>
                <details class="w-full sm:w-auto rounded-lg bg-black/50 text-xs text-gray-200 backdrop-blur">
                  <summary class="cursor-pointer list-none px-3 py-2 text-right hover:text-white">🖼️ Kampagnenbild bearbeiten</summary>
                  <div class="flex w-full sm:w-80 flex-col gap-2 border-t border-white/10 p-3">
                    <div class="flex items-center gap-2">
                      <label class="cursor-pointer rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10 transition">
                        {uploadingBackgroundFor === campaign.id ? 'Lade hoch…' : campaign.backgroundImageUrl ? 'Bild ersetzen' : 'Bild hochladen'}
                        <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden"
                          onchange={(e) => onBackgroundSelected(e, campaign.id)}
                          disabled={uploadingBackgroundFor === campaign.id} />
                      </label>
                      {#if campaign.backgroundImageUrl}
                        <button onclick={() => removeBackground(campaign.id)} class="rounded-lg border border-red-500/30 px-3 py-2 text-red-300 hover:bg-red-900/40 transition">Entfernen</button>
                      {/if}
                    </div>
                    <label for={`campaign-image-prompt-${campaign.id}`} class="sr-only">Prompt für das Kampagnenbild</label>
                    <input id={`campaign-image-prompt-${campaign.id}`} bind:value={generatePrompt[campaign.id]}
                      class="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white placeholder:text-gray-400 outline-none focus:border-brand-500/60"
                      placeholder="Stimmung oder Motiv beschreiben…" />
                    <button onclick={() => generateBackground(campaign)} disabled={generatingBackgroundFor === campaign.id}
                      class="min-h-10 rounded-lg bg-brand-600 px-3 py-2 text-white hover:bg-brand-500 disabled:opacity-60 transition">
                      {generatingBackgroundFor === campaign.id ? 'Generiere…' : campaign.backgroundImageUrl ? '🔄 Neu generieren' : '🎨 Bild generieren'}
                    </button>
                  </div>
                </details>
              </div>
            </div>
            {#if backgroundError[campaign.id]}
              <p class="text-red-400 text-xs mb-3">{backgroundError[campaign.id]}</p>
            {/if}
            {#if generateError[campaign.id]}
              <p class="text-red-400 text-xs mb-3">{generateError[campaign.id]}</p>
            {/if}

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
                    <div class="flex-1">
                      <div class="flex items-center gap-4">
                        <span class="text-gray-600 text-sm w-8">#{session.sessionNumber ?? '?'}</span>
                        <div>
                          <p class="font-medium text-white group-hover:text-brand-400 transition">
                            {session.title ?? `Session vom ${formatDate(session.startedAt)}`}
                          </p>
                          <p class="text-xs text-gray-600 mt-0.5">{formatDate(session.startedAt)}</p>
                        </div>
                      </div>
                      {#if session.speakerMaps?.length > 0}
                        <div class="flex flex-wrap gap-1 mt-2">
                          {#each session.speakerMaps.slice(0,4) as sm}
                            <span class="text-xs bg-surface-700 text-gray-400 px-2 py-0.5 rounded-full">
                              {sm.characterName ?? sm.discordName}
                            </span>
                          {/each}
                          {#if session.speakerMaps.length > 4}
                            <span class="text-xs text-gray-600">+{session.speakerMaps.length - 4}</span>
                          {/if}
                        </div>
                      {/if}
                    </div>
                    <span class="text-xs px-2.5 py-1 rounded-full {STATUS_COLORS[session.status] ?? 'text-gray-400 bg-gray-500/10'}">
                      {STATUS_LABELS[session.status] ?? session.status}
                    </span>
                  </a>
                {/each}
                {#if campaign._count?.sessions > (campaign.sessions?.length ?? 0)}
                  <div class="text-center pt-2">
                    <button
                      onclick={() => loadMoreSessions(campaign.id)}
                      disabled={loadingMoreSessions[campaign.id]}
                      class="text-sm text-brand-400 hover:text-brand-300 disabled:opacity-50 transition">
                      {loadingMoreSessions[campaign.id] ? 'Lade...' : `+ ${campaign._count.sessions - (campaign.sessions?.length ?? 0)} weitere Sessions laden`}
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    {:else if activeView === 'diary'}
      <!-- Tagebuch-Ansicht -->
      <div class="space-y-8">
        {#if diaryLoading}
          <div class="animate-pulse space-y-4">
            {#each [1,2,3] as _}
              <div class="h-48 bg-surface-800 rounded-2xl"></div>
            {/each}
          </div>
        {:else if diarySessions.length === 0}
          <div class="text-center py-16 bg-surface-800 rounded-2xl border border-surface-600 border-dashed">
            <div class="text-4xl mb-3">📖</div>
            <p class="text-gray-500">Noch keine Einträge im Tagebuch</p>
          </div>
        {:else}
          {#each diarySessions as entry}
            <div class="bg-surface-800 rounded-2xl border border-surface-600 p-7">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <span class="text-2xl font-bold text-brand-400">#{entry.sessionNumber ?? '?'}</span>
                  <div>
                    <h3 class="font-semibold text-white">{entry.title ?? `Session vom ${formatDate(entry.startedAt)}`}</h3>
                    <p class="text-xs text-gray-500">{formatDate(entry.startedAt)}</p>
                  </div>
                </div>
                <a href="/sessions/{entry.id}" class="text-xs text-gray-500 hover:text-brand-400 transition border border-surface-600 hover:border-brand-500/40 px-3 py-1.5 rounded-lg">
                  Details →
                </a>
              </div>
              {#if entry.summary?.narrative}
                <div class="text-gray-300 leading-relaxed font-serif text-sm whitespace-pre-line border-l-2 border-brand-500/30 pl-4">
                  {entry.summary.narrative}
                </div>
                {#if entry.summary.openThreads?.length > 0}
                  <div class="mt-4 pt-4 border-t border-surface-700">
                    <p class="text-xs text-purple-400 font-medium mb-2">🔮 Offene Fäden</p>
                    <ul class="space-y-1">
                      {#each entry.summary.openThreads.slice(0,3) as thread}
                        <li class="text-xs text-gray-500 flex items-start gap-1.5">
                          <span class="text-purple-400 mt-0.5">›</span>{thread}
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              {:else}
                <p class="text-gray-600 text-sm italic">Keine Summary vorhanden</p>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    {:else if activeView === 'wiki'}
      <!-- Quest-Wiki -->
      {#if group.campaigns.length === 0}
        <div class="text-center py-16 bg-surface-800 rounded-2xl border border-surface-600">
          <div class="text-5xl mb-3">📜</div>
          <p class="text-gray-500 text-sm">Keine Kampagnen — Wiki wird mit der ersten Session verfügbar</p>
        </div>
      {:else if group.campaigns.length === 1}
        <WikiView campaignId={group.campaigns[0].id} campaignName={group.campaigns[0].name} />
      {:else}
        <!-- Mehrere Kampagnen: Auswahl + Wiki -->
        <div class="space-y-4">
          <div class="flex gap-2 flex-wrap">
            {#each group.campaigns as campaign}
              <button
                onclick={() => { wikiCampaignId = campaign.id; wikiCampaignName = campaign.name; }}
                class="px-3 py-1.5 rounded-lg text-sm font-medium transition {wikiCampaignId === campaign.id ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white border border-surface-600'}">
                {campaign.name}
              </button>
            {/each}
          </div>
          {#if wikiCampaignId}
            <WikiView campaignId={wikiCampaignId} campaignName={wikiCampaignName} />
          {:else}
            <div class="text-center py-12 text-gray-600 text-sm">Wähle eine Kampagne aus</div>
          {/if}
        </div>
      {/if}
    {:else if activeView === 'members'}
      <!-- Mitglieder-Verwaltung -->
      <div class="space-y-6">
        <!-- Aktive Mitglieder -->
        <div class="bg-surface-800 rounded-2xl border border-surface-600 p-6">
          <div class="flex items-center justify-between mb-5">
            <div>
              <h3 class="font-semibold text-white">Aktive Mitglieder</h3>
              <p class="text-xs text-gray-600 mt-0.5">Mitglieder sind reine Einträge für die Verwaltung — kein eigener Login nötig</p>
            </div>
            <button onclick={() => showAddMember = !showAddMember}
              class="text-sm bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg transition">
              + Mitglied hinzufügen
            </button>
          </div>

          <!-- Add-Member Form -->
          {#if showAddMember}
            <form onsubmit={(e) => { e.preventDefault(); createMember(); }} class="mb-5 bg-surface-700 rounded-xl p-4 border border-brand-500/30 space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="new-member-discord" class="block text-xs text-gray-500 mb-1">Discordname</label>
                  <input id="new-member-discord" bind:value={newDiscordName} placeholder="z.B. grackmczack"
                    class="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label for="new-member-role" class="block text-xs text-gray-500 mb-1">Rolle (GM/Spieler)</label>
                  <select id="new-member-role" bind:value={newRole}
                    class="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
                    <option value="PLAYER">🧙 Spieler</option>
                    <option value="GM">🎭 Spielleiter (GM)</option>
                    <option value="OBSERVER">👁️ Zuschauer</option>
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="new-member-character" class="block text-xs text-gray-500 mb-1">Charaktername</label>
                  <input id="new-member-character" bind:value={newCharacterName} placeholder="z.B. Arkeles der Magier"
                    class="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label for="new-member-party-role" class="block text-xs text-gray-500 mb-1">Rolle in der Gruppe</label>
                  <input id="new-member-party-role" bind:value={newPartyRole} placeholder="z.B. Tank, Healer, Scout"
                    class="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                </div>
              </div>
              <div class="flex gap-2">
                <button type="submit" disabled={creatingMember}
                  class="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition">
                  {creatingMember ? 'Anlegen...' : 'Hinzufügen'}
                </button>
                <button type="button" onclick={() => showAddMember = false} class="text-gray-500 hover:text-white text-sm px-4 py-2 transition">Abbrechen</button>
              </div>
              {#if createMemberError}<p class="text-red-400 text-xs">{createMemberError}</p>{/if}
            </form>
          {/if}

          <!-- Mitgliederliste -->
          <div class="space-y-3">
            {#each (group?.memberships ?? []).filter((m: any) => !m.leftAt) as member}
              <div class="flex items-center justify-between py-3 border-b border-surface-700 last:border-0">
                <button onclick={() => openEditMember(member)} class="flex items-center gap-3 text-left flex-1 min-w-0">
                  {#if member.avatarUrl}
                    <img src={member.avatarUrl} alt="" class="w-9 h-9 rounded-full object-cover bg-surface-600 shrink-0" />
                  {:else}
                    <div class="w-9 h-9 rounded-full bg-surface-600 flex items-center justify-center text-sm font-medium text-white shrink-0">
                      {(member.characterName ?? member.discordName ?? member.user?.displayName ?? '?')[0]?.toUpperCase()}
                    </div>
                  {/if}
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <p class="text-sm font-medium text-white truncate">
                        {member.characterName ?? member.discordName ?? member.user?.displayName ?? 'Unbenanntes Mitglied'}
                      </p>
                      {#if member.isPaused}
                        <span class="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full shrink-0">⏸ Pausiert</span>
                      {/if}
                    </div>
                    <p class="text-xs text-gray-500 truncate">
                      {#if member.discordName}@{member.discordName}{/if}
                      {#if member.partyRole} · {member.partyRole}{/if}
                      {#if member.user?.email} · {member.user.email}{/if}
                    </p>
                    {#if member.isPaused && member.pauseNote}
                      <p class="text-xs text-yellow-600 italic mt-0.5">"{member.pauseNote}"</p>
                    {/if}
                  </div>
                </button>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-xs px-2 py-1 rounded-full {member.role === 'GM' ? 'bg-brand-500/20 text-brand-400' : 'bg-gray-700/50 text-gray-400'}">
                    {member.role === 'GM' ? '🎭 GM' : member.role === 'PLAYER' ? '🧙 Spieler' : '👁️ Zuschauer'}
                  </span>
                  <div class="flex gap-1">
                    <button onclick={() => openEditMember(member)}
                      class="min-h-10 text-xs text-gray-500 hover:text-brand-400 border border-surface-600 hover:border-brand-500/40 px-3 py-2 rounded-lg transition">
                      ✏️
                    </button>
                    {#if member.isPaused}
                      <button onclick={() => resumeMember(member.id)}
                        class="min-h-10 text-xs text-gray-500 hover:text-green-400 border border-surface-600 hover:border-green-500/40 px-3 py-2 rounded-lg transition">
                        ▶ Aktiv
                      </button>
                    {:else}
                      <button aria-label={`${member.characterName ?? member.discordName ?? 'Mitglied'} pausieren`} onclick={() => { pausingMemberId = member.id; pauseNote = ''; }}
                        class="min-h-10 min-w-10 text-xs text-gray-500 hover:text-yellow-400 border border-surface-600 hover:border-yellow-500/40 px-3 py-2 rounded-lg transition">
                        ⏸
                      </button>
                    {/if}
                    <button aria-label={`${member.characterName ?? member.discordName ?? 'Mitglied'} entfernen`} onclick={() => removeMember(member.id, member.characterName ?? member.discordName ?? member.user?.displayName ?? 'Mitglied')}
                      class="min-h-10 min-w-10 text-xs text-gray-500 hover:text-red-400 border border-surface-600 hover:border-red-500/40 px-3 py-2 rounded-lg transition">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Edit-Mitglied-Modal -->
        {#if editingMember}
          <Dialog title="Mitglied bearbeiten" titleId="edit-member-dialog-title" onClose={() => editingMember = null}>

              <!-- Avatar -->
              <div class="flex items-center gap-4 mb-5">
                {#if editingMember.avatarUrl}
                  <img src={editingMember.avatarUrl} alt="" class="w-16 h-16 rounded-full object-cover bg-surface-700" />
                {:else}
                  <div class="w-16 h-16 rounded-full bg-surface-700 flex items-center justify-center text-2xl text-gray-500">👤</div>
                {/if}
                <div>
                  <label class="text-xs text-brand-400 hover:text-brand-300 cursor-pointer border border-surface-600 hover:border-brand-500/40 px-3 py-1.5 rounded-lg transition inline-block">
                    {uploadingAvatar ? 'Lade hoch...' : 'Avatar hochladen'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" onchange={onAvatarSelected} disabled={uploadingAvatar} />
                  </label>
                  <p class="text-xs text-gray-600 mt-1">PNG/JPEG/WebP/GIF, max. 15 MB</p>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label for="edit-member-discord" class="block text-xs text-gray-500 mb-1">Discordname</label>
                  <input id="edit-member-discord" bind:value={editDiscordName}
                    class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label for="edit-member-role" class="block text-xs text-gray-500 mb-1">Rolle (GM/Spieler)</label>
                  <select id="edit-member-role" bind:value={editRole}
                    class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
                    <option value="PLAYER">🧙 Spieler</option>
                    <option value="GM">🎭 Spielleiter (GM)</option>
                    <option value="OBSERVER">👁️ Zuschauer</option>
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label for="edit-member-character" class="block text-xs text-gray-500 mb-1">Charaktername</label>
                  <input id="edit-member-character" bind:value={editCharacterName}
                    class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label for="edit-member-party-role" class="block text-xs text-gray-500 mb-1">Rolle in der Gruppe</label>
                  <input id="edit-member-party-role" bind:value={editPartyRole} placeholder="z.B. Tank, Healer"
                    class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                </div>
              </div>

              <!-- Charakterbogen -->
              <div class="mb-5 pb-5 border-b border-surface-700">
                <p class="block text-xs text-gray-500 mb-2">Charakterbogen (PDF)</p>
                {#if editingMember.characterSheetUrl}
                  <a href={`/api/campaigns/${$page.params.id}/members/${editingMember.id}/character-sheet`} target="_blank" rel="noreferrer" class="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1.5 mb-2">
                    📄 Aktueller Charakterbogen öffnen
                  </a>
                {/if}
                <label class="text-xs text-brand-400 hover:text-brand-300 cursor-pointer border border-surface-600 hover:border-brand-500/40 px-3 py-1.5 rounded-lg transition inline-block">
                  {uploadingSheet ? 'Lade hoch...' : editingMember.characterSheetUrl ? 'PDF ersetzen' : 'PDF hochladen'}
                  <input type="file" accept="application/pdf" class="hidden" onchange={onSheetSelected} disabled={uploadingSheet} />
                </label>
              </div>

              {#if editError}<p class="text-red-400 text-xs mb-3">{editError}</p>{/if}

              <div class="flex gap-3">
                <button onclick={saveEditMember} disabled={savingMember}
                  class="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition">
                  {savingMember ? 'Speichern...' : 'Speichern'}
                </button>
                <button onclick={() => editingMember = null}
                  class="text-gray-500 hover:text-white text-sm px-4 py-2 transition">Schließen</button>
              </div>
          </Dialog>
        {/if}

        <!-- Pause-Modal -->
        {#if pausingMemberId}
          <Dialog title="Mitglied pausieren" titleId="pause-member-dialog-title" onClose={() => pausingMemberId = null} maxWidth="max-w-md">
              <p class="text-sm text-gray-400 mb-3">Optional: Notiz für die Story (z.B. "Schläft den Abenteuer verschlafen" oder "Erkrankt")</p>
              <textarea bind:value={pauseNote} rows="2" placeholder="Notiz für die Abwesenheit..."
                class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white mb-4 focus:outline-none focus:border-brand-500 resize-none"></textarea>
              <div class="flex gap-3">
                <button onclick={() => pauseMember(pausingMemberId!)}
                  class="bg-yellow-600 hover:bg-yellow-500 text-white text-sm px-4 py-2 rounded-lg transition">Pausieren</button>
                <button onclick={() => pausingMemberId = null}
                  class="text-gray-500 hover:text-white text-sm px-4 py-2 transition">Abbrechen</button>
              </div>
          </Dialog>
        {/if}

        <!-- Ehemalige Mitglieder -->
        {#if (group?.memberships ?? []).filter((m: any) => m.leftAt).length > 0}
          <div class="bg-surface-800 rounded-2xl border border-surface-600 p-6">
            <h3 class="font-semibold text-gray-500 mb-4 text-sm">Ehemalige Mitglieder</h3>
            <div class="space-y-2">
              {#each (group?.memberships ?? []).filter((m: any) => m.leftAt) as member}
                <div class="flex items-center justify-between py-2 opacity-50">
                  <div>
                    <p class="text-sm text-gray-400">{member.characterName ?? member.discordName ?? member.user?.displayName ?? 'Unbenanntes Mitglied'}</p>
                    <p class="text-xs text-gray-600">Dabei: {formatDate(member.joinedAt)} – {formatDate(member.leftAt!)}</p>
                  </div>
                  <span class="text-xs text-gray-600">ausgeschieden</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
    </div>

  {/if}
</div>
