<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/auth.js';
  import { api } from '$lib/api.js';
  import { keyboardTabs } from '$lib/actions/tabs.js';
  import { toast } from '$lib/toast.js';
  import { confirmAction } from '$lib/confirm.js';
  import type { User } from '$lib/types.js';

  let users: any[] = $state([]);
  let grants: any[] = $state([]);
  let overview: any[] = $state([]);
  let installations: any[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let activeTab: 'users' | 'grants' | 'installations' | 'overview' = $state('users');
  let currentUser: User | null = $state(null);

  // Create DM form
  let showCreateForm = $state(false);
  let newEmail = $state('');
  let newPassword = $state('');
  let newDisplayName = $state('');
  let creating = $state(false);
  let createError = $state('');

  // Request state per user
  let togglingKeys: Record<string, boolean> = $state({});
  let togglingStatus: Record<string, boolean> = $state({});
  let deletingUsers: Record<string, boolean> = $state({});

  onMount(async () => {
    try {
      currentUser = await api.me();
      if (currentUser?.role !== 'SUPER_ADMIN') {
        goto('/dashboard');
        return;
      }
      await loadAll();
    } catch (e: any) {
      if (e.statusCode === 403) goto('/dashboard');
      error = e.error ?? 'Fehler beim Laden';
    } finally {
      loading = false;
    }
  });

  async function loadAll() {
    const [userList, grantList, overviewList, installationList] = await Promise.all([
      api.getAdminUsers(),
      api.getAdminGrants(),
      api.getAdminOverview(),
      api.getAdminInstallations()
    ]);
    users = userList;
    grants = grantList;
    overview = overviewList;
    installations = installationList;
  }

  async function createDM() {
    creating = true;
    createError = '';
    try {
      await api.createAdminUser({ email: newEmail, password: newPassword, displayName: newDisplayName });
      showCreateForm = false;
      newEmail = '';
      newPassword = '';
      newDisplayName = '';
      await loadAll();
      toast.success('DM-Konto wurde angelegt');
    } catch (e: any) {
      createError = formatApiError(e.error, 'Fehler beim Anlegen');
    } finally {
      creating = false;
    }
  }

  async function toggleKeys(userId: string, hasKeys: boolean) {
    togglingKeys[userId] = true;
    try {
      if (hasKeys) {
        await api.revokeAdminKeys(userId);
      } else {
        await api.grantAdminKeys(userId);
      }
      await loadAll();
      toast.success(hasKeys ? 'Admin-Keys wurden entzogen' : 'Admin-Keys wurden freigegeben');
    } catch (e: any) {
      toast.error(e.error ?? 'Fehler beim Ändern');
    } finally {
      togglingKeys[userId] = false;
    }
  }

  async function toggleActive(userId: string, isActive: boolean) {
    togglingStatus[userId] = true;
    try {
      await api.updateAdminUser(userId, { isActive: !isActive });
      await loadAll();
      toast.success(isActive ? 'DM wurde deaktiviert' : 'DM wurde aktiviert');
    } catch (e: any) {
      toast.error(e.error ?? 'Fehler beim Ändern');
    } finally {
      togglingStatus[userId] = false;
    }
  }

  function availableKeyLabels(user: any): string {
    const available = user.availableAdminKeys ?? {};
    return [
      available.whisper && 'Transkription',
      available.replicate && 'Bilder',
      available.llm && 'Zusammenfassung',
      available.huggingface && 'HuggingFace'
    ].filter(Boolean).join(', ');
  }

  async function deleteUser(user: any) {
    deletingUsers[user.id] = true;
    try {
      const impact = await api.getAdminUserDeletionImpact(user.id);
      if (impact.activeSessions > 0) {
        toast.error(`Der Account hat noch ${impact.activeSessions} laufende oder zu verarbeitende Session(s). Warte bis zum Abschluss oder prüfe den Fehlerstatus.`);
        return;
      }
      const groupText = impact.exclusiveCampaigns.length > 0
        ? `${impact.exclusiveCampaigns.length} allein verwaltete Kampagne(n), ${impact.sessions} Session(s) und ${impact.recordings} Aufnahme(n) werden vollständig gelöscht.`
        : 'Es werden keine gemeinsam verwalteten Kampagnen oder Sessions gelöscht.';
      const sharedText = impact.sharedCampaigns.length > 0
        ? ` Aus ${impact.sharedCampaigns.length} gemeinsam verwalteten Kampagne(n) wird nur die Mitgliedschaft entfernt.`
        : '';
      const confirmed = await confirmAction({
        title: `${user.displayName} endgültig löschen?`,
        message: `Der Account, alle Grants und Login-Zuordnungen werden unwiderruflich gelöscht. ${groupText}${sharedText}`,
        confirmLabel: 'Account endgültig löschen',
        danger: true
      });
      if (!confirmed) return;

      await api.deleteAdminUser(user.id);
      await loadAll();
      toast.success(`${user.displayName} und alle zugehörigen Daten wurden gelöscht`);
    } catch (e: any) {
      toast.error(e.error ?? 'Account konnte nicht gelöscht werden');
    } finally {
      deletingUsers[user.id] = false;
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateTime(d: string | null) {
    return d ? new Date(d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  }

  function formatApiError(value: unknown, fallback: string): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'fieldErrors' in value) {
      const fieldErrors = (value as { fieldErrors?: Record<string, string[]> }).fieldErrors;
      const messages = Object.values(fieldErrors ?? {}).flat().filter(Boolean);
      if (messages.length) return messages.join(' ');
    }
    return fallback;
  }
</script>

<svelte:head>
  <title>Admin — DnD Recorder</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
    <div>
      <h1 class="text-3xl font-bold text-white">Admin</h1>
      <p class="text-gray-500 mt-1">DMs, API-Key-Grants und Discord-Server verwalten</p>
    </div>
    <a href="/dashboard" class="text-gray-500 hover:text-white text-sm transition">← Dashboard</a>
  </div>

  {#if loading}
    <div class="animate-pulse space-y-4">
      {#each [1,2,3] as _}
        <div class="h-20 bg-surface-800 rounded-2xl border border-surface-600"></div>
      {/each}
    </div>
  {:else if error}
    <div class="bg-red-900/20 border border-red-700/40 rounded-2xl p-6 text-center">
      <p class="text-red-400">{error}</p>
    </div>
  {:else}
    <!-- Tab Switcher -->
    <div role="tablist" aria-label="Adminbereiche" use:keyboardTabs
      class="flex gap-1 mb-6 bg-surface-800 rounded-xl p-1 max-w-full overflow-x-auto border border-surface-600">
      <button id="admin-tab-users" role="tab" aria-selected={activeTab === 'users'} aria-controls="admin-panel-users" tabindex={activeTab === 'users' ? 0 : -1} onclick={() => activeTab = 'users'}
        class="px-4 py-2 rounded-lg text-sm font-medium transition {activeTab === 'users' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
        👥 DMs ({users.length})
      </button>
      <button id="admin-tab-grants" role="tab" aria-selected={activeTab === 'grants'} aria-controls="admin-panel-grants" tabindex={activeTab === 'grants' ? 0 : -1} onclick={() => activeTab = 'grants'}
        class="px-4 py-2 rounded-lg text-sm font-medium transition {activeTab === 'grants' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
        🔑 Key-Grants ({grants.length})
      </button>
      <button id="admin-tab-installations" role="tab" aria-selected={activeTab === 'installations'} aria-controls="admin-panel-installations" tabindex={activeTab === 'installations' ? 0 : -1} onclick={() => activeTab = 'installations'}
        class="px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap {activeTab === 'installations' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
        🤖 Server ({installations.filter((item) => item.isActive).length}/{installations.length})
      </button>
      <button id="admin-tab-overview" role="tab" aria-selected={activeTab === 'overview'} aria-controls="admin-panel-overview" tabindex={activeTab === 'overview' ? 0 : -1} onclick={() => activeTab = 'overview'}
        class="px-4 py-2 rounded-lg text-sm font-medium transition {activeTab === 'overview' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
        📊 Übersicht
      </button>
    </div>

    <div role="tabpanel" id={`admin-panel-${activeTab}`} aria-labelledby={`admin-tab-${activeTab}`} tabindex="0">
    {#if activeTab === 'users'}
      <div class="space-y-4">
        <!-- Actions -->
        <div class="flex justify-end">
          <button onclick={() => showCreateForm = !showCreateForm}
            class="text-sm bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg transition">
            + DM anlegen
          </button>
        </div>

        <!-- Create Form -->
        {#if showCreateForm}
          <form onsubmit={(e) => { e.preventDefault(); createDM(); }}
            class="bg-surface-800 border border-brand-500/30 rounded-xl p-4 space-y-3">
            <h3 class="text-sm font-semibold text-white">Neuen DM anlegen</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label class="space-y-1"><span class="text-xs text-gray-300">Anzeigename</span>
              <input bind:value={newDisplayName} placeholder="Anzeigename" required autocomplete="name"
                class="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500" />
              </label>
              <label class="space-y-1"><span class="text-xs text-gray-300">E-Mail</span>
              <input bind:value={newEmail} type="email" placeholder="E-Mail" required autocomplete="username"
                class="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500" />
              </label>
              <label class="space-y-1"><span class="text-xs text-gray-300">Temporäres Passwort</span>
              <input bind:value={newPassword} type="password" placeholder="Mindestens 12 Zeichen" required minlength="12" maxlength="128" autocomplete="new-password"
                class="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500" />
              </label>
            </div>
            <div class="flex gap-2">
              <button type="submit" disabled={creating}
                class="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition">
                {creating ? 'Anlegen...' : 'DM erstellen'}
              </button>
              <button type="button" onclick={() => showCreateForm = false}
                class="text-gray-500 hover:text-white text-sm px-4 py-2 transition">Abbrechen</button>
            </div>
            {#if createError}<p role="alert" class="text-red-300 text-sm">{createError}</p>{/if}
          </form>
        {/if}

        <!-- DM List -->
        <div class="bg-surface-800 rounded-2xl border border-surface-600 overflow-x-auto">
          <table class="w-full min-w-[1050px] text-sm">
            <thead>
              <tr class="border-b border-surface-700">
                <th class="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">DM</th>
                <th class="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Status</th>
                <th class="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Kampagnen</th>
                <th class="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Admin-Keys</th>
                <th class="text-right px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {#each users as user (user.id)}
                <tr class="border-b border-surface-700 last:border-0 hover:bg-surface-700/50 transition">
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-full bg-surface-600 flex items-center justify-center text-sm font-medium text-white shrink-0">
                        {user.displayName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p class="font-medium text-white">{user.displayName}</p>
                        <p class="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-5 py-3">
                    {#if !user.isActive}
                      <span class="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400">○ Deaktiviert</span>
                    {:else if !user.emailVerifiedAt}
                      <span class="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-300">◌ E-Mail offen</span>
                    {:else}
                      <span class="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400">● Aktiv</span>
                    {/if}
                  </td>
                  <td class="px-5 py-3 text-gray-400">
                    {user.campaignCount ?? 0} Kampagnen
                  </td>
                  <td class="px-5 py-3">
                    {#if user.hasAdminKeys}
                      <span class="text-xs px-2 py-1 rounded-full bg-brand-500/10 text-brand-400">
                        🔑 Admin-Keys aktiv (seit {formatDate(user.keyGrantedAt)})
                      </span>
                      <p class="mt-1 text-xs text-gray-600">{availableKeyLabels(user) || 'Keine Admin-Keys konfiguriert'}</p>
                    {:else}
                      <span class="text-xs text-gray-600">Eigene Keys</span>
                    {/if}
                  </td>
                  <td class="px-5 py-3">
                    <div class="flex items-center justify-end gap-2">
                      <!-- Key-Grant Toggle -->
                      <label class="flex min-h-11 items-center gap-2 cursor-pointer rounded-lg px-2 text-xs text-gray-400" title="Admin-API-Keys für diesen DM freigeben">
                        <span class="select-none">🔑 Keys</span>
                        <div class="relative">
                          <input type="checkbox"
                            aria-label={`Admin-API-Keys für ${user.displayName} freigeben`}
                            checked={user.hasAdminKeys}
                            onchange={() => toggleKeys(user.id, user.hasAdminKeys)}
                            disabled={togglingKeys[user.id]}
                            class="sr-only peer" />
                          <div class="w-9 h-5 bg-surface-700 peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 rounded-full transition-colors"></div>
                          <div class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm"></div>
                        </div>
                      </label>

                      <!-- Active Toggle -->
                      <button type="button" onclick={() => toggleActive(user.id, user.isActive)}
                        disabled={togglingStatus[user.id]}
                        class="min-h-11 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 {user.isActive ? 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10' : 'border-green-500/30 text-green-300 hover:bg-green-500/10'}">
                        {user.isActive ? 'Account sperren' : 'Account aktivieren'}
                      </button>

                      <button type="button" onclick={() => deleteUser(user)}
                        disabled={deletingUsers[user.id]}
                        class="min-h-11 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/10 transition disabled:opacity-50">
                        Endgültig löschen
                      </button>
                    </div>
                  </td>
                </tr>
              {:else}
                <tr>
                  <td colspan="5" class="px-5 py-12 text-center text-gray-600 text-sm">
                    Keine DMs registriert
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

    {:else if activeTab === 'grants'}
      <div class="bg-surface-800 rounded-2xl border border-surface-600 overflow-x-auto">
        <table class="w-full min-w-[580px] text-sm">
          <thead>
            <tr class="border-b border-surface-700">
              <th class="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">DM</th>
              <th class="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Freigegeben am</th>
              <th class="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {#each grants as grant (grant.id)}
              <tr class="border-b border-surface-700 last:border-0">
                <td class="px-5 py-3">
                  <p class="font-medium text-white">{grant.dmDisplayName}</p>
                  <p class="text-xs text-gray-500">{grant.dmEmail}</p>
                </td>
                <td class="px-5 py-3 text-gray-400">{formatDate(grant.grantedAt)}</td>
                <td class="px-5 py-3">
                  <span class="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400">● Aktiv</span>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="3" class="px-5 py-12 text-center text-gray-600 text-sm">
                  Keine aktiven Key-Grants
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    {:else if activeTab === 'installations'}
      <div class="bg-surface-800 rounded-2xl border border-surface-600 overflow-x-auto">
        <table class="w-full min-w-[920px] text-sm">
          <thead>
            <tr class="border-b border-surface-700">
              <th class="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Discord-Server</th>
              <th class="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Bot-Status</th>
              <th class="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Verknüpfte Kampagnen</th>
              <th class="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Kanäle</th>
              <th class="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Zuletzt gesehen</th>
            </tr>
          </thead>
          <tbody>
            {#each installations as installation (installation.id)}
              <tr class="border-b border-surface-700 last:border-0 align-top">
                <td class="px-5 py-4">
                  <p class="font-medium text-white">{installation.guildName}</p>
                  <p class="text-xs text-gray-500 font-mono mt-1">{installation.discordGuildId}</p>
                </td>
                <td class="px-5 py-4">
                  <span class="text-xs px-2 py-1 rounded-full {installation.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
                    {installation.isActive ? '● Installiert' : '○ Entfernt'}
                  </span>
                  <p class="text-xs text-gray-600 mt-2">Seit {formatDateTime(installation.installedAt)}</p>
                </td>
                <td class="px-5 py-4">
                  {#if installation.campaigns?.length}
                    <div class="space-y-1">
                      {#each installation.campaigns as campaign}
                        <a href="/kampagnen/{campaign.id}" class="block text-brand-400 hover:text-brand-300">{campaign.name} <span class="text-xs text-gray-600">· {campaign.memberCount} Mitglieder</span></a>
                      {/each}
                    </div>
                  {:else}
                    <span class="text-gray-600 italic">Noch nicht verknüpft</span>
                  {/if}
                </td>
                <td class="px-5 py-4 font-mono text-xs text-gray-400">
                  {#if installation.campaigns?.length}
                    {#each installation.campaigns as campaign}
                      <p>{campaign.voiceChannelName ?? campaign.voiceChannelId ?? 'Voice offen'} → {campaign.summaryChannelName ?? campaign.summaryChannelId ?? 'Record-Kanal'}</p>
                    {/each}
                  {:else}Nicht gesetzt{/if}
                </td>
                <td class="px-5 py-4 text-gray-400">{formatDateTime(installation.lastSeenAt)}</td>
              </tr>
            {:else}
              <tr><td colspan="5" class="px-5 py-12 text-center text-gray-600">Noch keine Discord-Installationen erfasst</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

    {:else if activeTab === 'overview'}
      <div class="space-y-6">
        {#each overview as dm (dm.id)}
          <div class="bg-surface-800 rounded-2xl border border-surface-600 p-5">
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-surface-600 flex items-center justify-center text-sm font-semibold text-white">
                  {dm.displayName[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 class="font-semibold text-white">{dm.displayName}</h3>
                  <p class="text-xs text-gray-500">{dm.email}</p>
                </div>
              </div>
              <span class="text-xs px-2 py-1 rounded-full {dm.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
                {dm.isActive ? 'Aktiv' : 'Deaktiviert'}
              </span>
            </div>

            {#if dm.campaigns.length > 0}
              <div class="space-y-2">
                <p class="text-xs text-gray-600 uppercase tracking-wider mb-2">Kampagnen</p>
                {#each dm.campaigns as campaign}
                  <div class="flex items-center justify-between bg-surface-700/50 rounded-lg px-3 py-2">
                    <a href="/kampagnen/{campaign.id}" class="text-sm text-gray-300 hover:text-brand-300">{campaign.name}</a>
                  </div>
                {/each}
              </div>
              <div class="mt-4 pt-4 border-t border-surface-700 flex items-center gap-3">
                <span class="text-xs text-gray-500">Gesamt: {dm.campaigns.length} Kampagne{dm.campaigns.length !== 1 ? 'n' : ''}</span>
                {#if dm.hasAdminKeys}
                  <span class="text-xs bg-brand-500/10 text-brand-400 px-2 py-0.5 rounded-full">🔑 Admin-Keys aktiv</span>
                {/if}
              </div>
            {:else}
              <p class="text-sm text-gray-600 italic">Keine Kampagnen</p>
            {/if}
          </div>
        {:else}
          <div class="text-center py-12 text-gray-600 text-sm">Keine DMs mit Kampagnen</div>
        {/each}
      </div>
    {/if}
    </div>
  {/if}
</div>
