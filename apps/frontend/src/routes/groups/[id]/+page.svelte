<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import { auth } from '$lib/auth.js';
  import { parallax } from '$lib/actions/parallax.js';
  import type { Group } from '$lib/types.js';

  let group: any = $state(null);
  let loading = $state(true);
  let error = $state('');
  let editingContext: string | null = $state(null);
  let contextEdits: Record<string, string> = $state({});

  // Tab state
  let activeView: 'sessions' | 'diary' | 'members' = $state('sessions');

  // Diary state
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

  async function onBackgroundSelected(e: Event, campaignId: string) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    uploadingBackgroundFor = campaignId;
    backgroundError[campaignId] = '';
    try {
      const { backgroundImageUrl } = await api.uploadCampaignBackground(campaignId, file);
      const c = group?.campaigns.find((c: any) => c.id === campaignId);
      if (c) c.backgroundImageUrl = backgroundImageUrl;
    } catch (err: any) {
      backgroundError[campaignId] = err.error ?? 'Fehler beim Hochladen';
    } finally {
      uploadingBackgroundFor = null;
    }
  }

  async function removeBackground(campaignId: string) {
    if (!confirm('Hintergrundbild wirklich entfernen?')) return;
    try {
      await api.removeCampaignBackground(campaignId);
      const c = group?.campaigns.find((c: any) => c.id === campaignId);
      if (c) c.backgroundImageUrl = undefined;
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
      group = await api.getGroup($page.params.id!);
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
      group = await api.getGroup($page.params.id!);
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
      group = await api.getGroup($page.params.id!);
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
      group = await api.getGroup($page.params.id!);
    } catch (e: any) {
      editError = e.error ?? 'Fehler beim PDF-Upload';
    } finally {
      uploadingSheet = false;
    }
  }

  async function pauseMember(memberId: string) {
    await api.pauseMember($page.params.id!, memberId, pauseNote);
    group = await api.getGroup($page.params.id!);
    pausingMemberId = null;
  }

  async function resumeMember(memberId: string) {
    await api.resumeMember($page.params.id!, memberId);
    group = await api.getGroup($page.params.id!);
  }

  async function removeMember(memberId: string, name: string) {
    if (!confirm(`${name} wirklich aus der Gruppe entfernen? Die Session-Historie bleibt erhalten.`)) return;
    await api.removeMember($page.params.id!, memberId);
    group = await api.getGroup($page.params.id!);
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

    <!-- Tab-Switcher für Kampagnen-Ansicht -->
    <div class="flex gap-1 mb-6 bg-surface-800 rounded-xl p-1 w-fit border border-surface-600">
      <button onclick={() => activeView = 'sessions'}
        class="px-4 py-2 rounded-lg text-sm font-medium transition {activeView === 'sessions' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
        📅 Sessions
      </button>
      <button onclick={() => { activeView = 'diary'; loadDiary(); }}
        class="px-4 py-2 rounded-lg text-sm font-medium transition {activeView === 'diary' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
        📖 Tagebuch
      </button>
      <button onclick={() => activeView = 'members'}
        class="px-4 py-2 rounded-lg text-sm font-medium transition {activeView === 'members' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
        👥 Mitglieder
      </button>
    </div>

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
            <!-- Kampagnen-Hintergrundbild mit Parallax -->
            <div class="relative h-40 md:h-56 rounded-2xl overflow-hidden mb-4 border border-surface-600 bg-surface-800">
              {#if campaign.backgroundImageUrl}
                <div class="absolute -inset-y-[25%] inset-x-0" use:parallax={0.12}>
                  <img src={campaign.backgroundImageUrl} alt="" class="w-full h-full object-cover opacity-60" />
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-surface-900 via-surface-900/40 to-transparent"></div>
              {:else}
                <div class="absolute inset-0 flex items-center justify-center text-gray-700 text-4xl">🗺️</div>
              {/if}

              <div class="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                <div class="flex items-center gap-3">
                  <h2 class="text-xl font-semibold text-white drop-shadow">{campaign.name}</h2>
                  {#if campaign.setting}<span class="text-xs text-gray-200 bg-black/40 backdrop-blur px-2 py-1 rounded">{campaign.setting}</span>{/if}
                </div>
                <div class="flex items-center gap-2">
                  <label class="text-xs text-gray-200 bg-black/40 hover:bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg transition cursor-pointer">
                    {uploadingBackgroundFor === campaign.id ? 'Lade hoch...' : campaign.backgroundImageUrl ? 'Bild ersetzen' : '🖼️ Hintergrundbild hinzufügen'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden"
                      onchange={(e) => onBackgroundSelected(e, campaign.id)}
                      disabled={uploadingBackgroundFor === campaign.id} />
                  </label>
                  {#if campaign.backgroundImageUrl}
                    <button onclick={() => removeBackground(campaign.id)}
                      class="text-xs text-gray-200 bg-black/40 hover:bg-red-900/60 backdrop-blur px-2 py-1.5 rounded-lg transition">✕</button>
                  {/if}
                </div>
              </div>
            </div>
            {#if backgroundError[campaign.id]}
              <p class="text-red-400 text-xs mb-3">{backgroundError[campaign.id]}</p>
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
                      <!-- Mitglieder dieser Session (aus speakerMaps) -->
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
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Discordname</label>
                  <input bind:value={newDiscordName} placeholder="z.B. grackmczack"
                    class="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Rolle (GM/Spieler)</label>
                  <select bind:value={newRole}
                    class="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
                    <option value="PLAYER">🎲 Spieler</option>
                    <option value="GM">🎭 Spielleiter (GM)</option>
                    <option value="OBSERVER">👁️ Zuschauer</option>
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Charaktername</label>
                  <input bind:value={newCharacterName} placeholder="z.B. Arkeles der Magier"
                    class="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Rolle in der Gruppe</label>
                  <input bind:value={newPartyRole} placeholder="z.B. Tank, Healer, Scout"
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
                    {member.role === 'GM' ? '🎭 GM' : member.role === 'PLAYER' ? '🎲 Spieler' : '👁️ Zuschauer'}
                  </span>
                  <div class="flex gap-1">
                    <button onclick={() => openEditMember(member)}
                      class="text-xs text-gray-500 hover:text-brand-400 border border-surface-600 hover:border-brand-500/40 px-2 py-1 rounded transition">
                      ✏️
                    </button>
                    {#if member.isPaused}
                      <button onclick={() => resumeMember(member.id)}
                        class="text-xs text-gray-500 hover:text-green-400 border border-surface-600 hover:border-green-500/40 px-2 py-1 rounded transition">
                        ▶ Aktiv
                      </button>
                    {:else}
                      <button onclick={() => { pausingMemberId = member.id; pauseNote = ''; }}
                        class="text-xs text-gray-500 hover:text-yellow-400 border border-surface-600 hover:border-yellow-500/40 px-2 py-1 rounded transition">
                        ⏸
                      </button>
                    {/if}
                    <button onclick={() => removeMember(member.id, member.characterName ?? member.discordName ?? member.user?.displayName ?? 'Mitglied')}
                      class="text-xs text-gray-500 hover:text-red-400 border border-surface-600 hover:border-red-500/40 px-2 py-1 rounded transition">
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
          <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div class="bg-surface-800 rounded-2xl border border-surface-600 p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
              <h3 class="font-semibold text-white mb-4">Mitglied bearbeiten</h3>

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

              <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Discordname</label>
                  <input bind:value={editDiscordName}
                    class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Rolle (GM/Spieler)</label>
                  <select bind:value={editRole}
                    class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
                    <option value="PLAYER">🎲 Spieler</option>
                    <option value="GM">🎭 Spielleiter (GM)</option>
                    <option value="OBSERVER">👁️ Zuschauer</option>
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Charaktername</label>
                  <input bind:value={editCharacterName}
                    class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Rolle in der Gruppe</label>
                  <input bind:value={editPartyRole} placeholder="z.B. Tank, Healer"
                    class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                </div>
              </div>

              <!-- Charakterbogen -->
              <div class="mb-5 pb-5 border-b border-surface-700">
                <label class="block text-xs text-gray-500 mb-2">Charakterbogen (PDF)</label>
                {#if editingMember.characterSheetUrl}
                  <a href={editingMember.characterSheetUrl} target="_blank" class="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1.5 mb-2">
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
            </div>
          </div>
        {/if}

        <!-- Pause-Modal -->
        {#if pausingMemberId}
          <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div class="bg-surface-800 rounded-2xl border border-surface-600 p-6 w-full max-w-md">
              <h3 class="font-semibold text-white mb-4">Mitglied pausieren</h3>
              <p class="text-sm text-gray-400 mb-3">Optional: Notiz für die Story (z.B. "Schläft den Abenteuer verschlafen" oder "Erkrankt")</p>
              <textarea bind:value={pauseNote} rows="2" placeholder="Notiz für die Abwesenheit..."
                class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white mb-4 focus:outline-none focus:border-brand-500 resize-none"></textarea>
              <div class="flex gap-3">
                <button onclick={() => pauseMember(pausingMemberId!)}
                  class="bg-yellow-600 hover:bg-yellow-500 text-white text-sm px-4 py-2 rounded-lg transition">Pausieren</button>
                <button onclick={() => pausingMemberId = null}
                  class="text-gray-500 hover:text-white text-sm px-4 py-2 transition">Abbrechen</button>
              </div>
            </div>
          </div>
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
  {/if}
</div>
