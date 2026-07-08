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

  // Tab state
  let activeView: 'sessions' | 'diary' | 'members' = $state('sessions');

  // Diary state
  let diaryLoading = $state(false);
  let diarySessions: any[] = $state([]);

  // Members state
  let showInvite = $state(false);
  let inviteEmail = $state('');
  let inviteRole = $state('PLAYER');
  let inviteCharName = $state('');
  let inviting = $state(false);
  let inviteError = $state('');
  let pausingMemberId: string | null = $state(null);
  let pauseNote = $state('');

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

  async function inviteMember() {
    inviting = true;
    inviteError = '';
    try {
      const res = await fetch(`/api/groups/${$page.params.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.getToken()}` },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, characterName: inviteCharName || undefined })
      });
      if (!res.ok) {
        const d = await res.json() as any;
        inviteError = d.error ?? 'Fehler beim Einladen';
        return;
      }
      group = await api.getGroup($page.params.id!);
      showInvite = false;
      inviteEmail = '';
      inviteCharName = '';
    } catch (e: any) {
      inviteError = e.message ?? 'Fehler';
    } finally {
      inviting = false;
    }
  }

  async function pauseMember(memberId: string) {
    await fetch(`/api/groups/${$page.params.id}/members/${memberId}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.getToken()}` },
      body: JSON.stringify({ note: pauseNote })
    });
    group = await api.getGroup($page.params.id!);
    pausingMemberId = null;
  }

  async function resumeMember(memberId: string) {
    await fetch(`/api/groups/${$page.params.id}/members/${memberId}/resume`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth.getToken()}` }
    });
    group = await api.getGroup($page.params.id!);
  }

  async function removeMember(memberId: string, name: string) {
    if (!confirm(`${name} wirklich aus der Gruppe entfernen? Die Session-Historie bleibt erhalten.`)) return;
    await fetch(`/api/groups/${$page.params.id}/members/${memberId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${auth.getToken()}` }
    });
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
            <h3 class="font-semibold text-white">Aktive Mitglieder</h3>
            <button onclick={() => showInvite = !showInvite}
              class="text-sm bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg transition">
              + Einladen
            </button>
          </div>

          <!-- Invite Form -->
          {#if showInvite}
            <form onsubmit={inviteMember} class="mb-5 bg-surface-700 rounded-xl p-4 border border-brand-500/30 space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">E-Mail</label>
                  <input bind:value={inviteEmail} type="email" required placeholder="spieler@example.com"
                    class="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Rolle</label>
                  <select bind:value={inviteRole}
                    class="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
                    <option value="PLAYER">🎲 Spieler</option>
                    <option value="GM">🎭 Spielleiter (GM)</option>
                    <option value="OBSERVER">👁️ Zuschauer</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Charaktername (optional)</label>
                <input bind:value={inviteCharName} placeholder="z.B. Arkeles der Magier"
                  class="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
              </div>
              <div class="flex gap-2">
                <button type="submit" disabled={inviting}
                  class="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition">
                  {inviting ? 'Einladen...' : 'Einladen'}
                </button>
                <button type="button" onclick={() => showInvite = false} class="text-gray-500 hover:text-white text-sm px-4 py-2 transition">Abbrechen</button>
              </div>
              {#if inviteError}<p class="text-red-400 text-xs">{inviteError}</p>{/if}
            </form>
          {/if}

          <!-- Mitgliederliste -->
          <div class="space-y-3">
            {#each (group?.memberships ?? []).filter((m: any) => !m.leftAt) as member}
              <div class="flex items-center justify-between py-3 border-b border-surface-700 last:border-0">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-surface-600 flex items-center justify-center text-sm font-medium text-white">
                    {member.user.displayName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <p class="text-sm font-medium text-white">{member.user.displayName}</p>
                      {#if member.isPaused}
                        <span class="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">⏸ Pausiert</span>
                      {/if}
                    </div>
                    <p class="text-xs text-gray-500">
                      {member.characterName ? `${member.characterName} · ` : ''}{member.user.email}
                    </p>
                    {#if member.isPaused && member.pauseNote}
                      <p class="text-xs text-yellow-600 italic mt-0.5">"{member.pauseNote}"</p>
                    {/if}
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs px-2 py-1 rounded-full {member.role === 'GM' ? 'bg-brand-500/20 text-brand-400' : 'bg-gray-700/50 text-gray-400'}">
                    {member.role === 'GM' ? '🎭 GM' : member.role === 'PLAYER' ? '🎲 Spieler' : '👁️ Zuschauer'}
                  </span>
                  <div class="flex gap-1">
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
                    <button onclick={() => removeMember(member.id, member.user.displayName)}
                      class="text-xs text-gray-500 hover:text-red-400 border border-surface-600 hover:border-red-500/40 px-2 py-1 rounded transition">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>

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
                    <p class="text-sm text-gray-400">{member.user.displayName}</p>
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
