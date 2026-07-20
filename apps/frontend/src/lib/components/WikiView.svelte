<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { keyboardTabs } from '$lib/actions/tabs.js';
  import { toast } from '$lib/toast.js';
  import { confirmAction } from '$lib/confirm.js';
  import { track, type TrackingParameters } from '$lib/analytics.js';
  import type { AggregatedWiki, WikiNPC, WikiQuest, WikiLocation, WikiThread, WikiLoot } from '$lib/types.js';

  let { campaignId, campaignName }: { campaignId: string; campaignName: string } = $props();

  type Category = 'npcs' | 'quests' | 'locations' | 'threads' | 'loot';
  type LinkableCategory = 'npcs' | 'quests' | 'threads';
  type CampaignSessionOption = { id: string; sessionNumber?: number | null; title?: string | null; startedAt?: string };
  type StatusOption = { value: string; label: string };
  type WikiForm = {
    name: string;
    title: string;
    description: string;
    status: string;
  };

  function trackedEntityType(category: Category): NonNullable<TrackingParameters['entity_type']> {
    if (category === 'npcs') return 'npc';
    if (category === 'quests') return 'quest';
    if (category === 'locations') return 'location';
    if (category === 'threads') return 'thread';
    return 'loot';
  }

  let wiki: AggregatedWiki | null = $state(null);
  let loading = $state(true);
  let error = $state('');
  let activeCategory: Category = $state('npcs');
  let searchQuery = $state('');

  let campaignSessions: CampaignSessionOption[] = $state([]);
  let sessionsLoading = $state(false);
  let showCreateForm: Category | null = $state(null);
  let editingKey: string | null = $state(null);
  let form: WikiForm = $state(emptyForm('npcs'));
  let saving = $state(false);
  let actionError = $state('');
  let linkingKey: string | null = $state(null);
  let linkSelection: Record<string, string> = $state({});

  const CATEGORY_LABELS: Record<Category, string> = {
    npcs: '👤 NSCs',
    quests: '⚔️ Quests',
    locations: '🗺️ Orte',
    threads: '🔮 Offene Fäden',
    loot: '💎 Beute'
  };

  const NPC_STATUS_OPTIONS: StatusOption[] = [
    { value: 'ACTIVE', label: 'Aktiv' },
    { value: 'ALLY', label: 'Verbündet' },
    { value: 'ENEMY', label: 'Feindlich' },
    { value: 'DEAD', label: 'Tot' },
    { value: 'UNKNOWN', label: 'Unbekannt' }
  ];

  const QUEST_STATUS_OPTIONS: StatusOption[] = [
    { value: 'DISCOVERED', label: 'Entdeckt' },
    { value: 'ACTIVE', label: 'Aktiv' },
    { value: 'COMPLETED', label: 'Abgeschlossen' },
    { value: 'FAILED', label: 'Fehlgeschlagen' }
  ];

  const THREAD_STATUS_OPTIONS: StatusOption[] = [
    { value: 'OPEN', label: 'Offen' },
    { value: 'RESOLVED', label: 'Gelöst' },
    { value: 'ABANDONED', label: 'Aufgegeben' }
  ];

  const QUEST_STATUS_COLORS: Record<string, string> = {
    DISCOVERED: 'text-blue-400 bg-blue-500/10',
    ACTIVE: 'text-green-400 bg-green-500/10',
    COMPLETED: 'text-emerald-400 bg-emerald-500/10',
    FAILED: 'text-red-400 bg-red-500/10',
    UNKNOWN: 'text-gray-400 bg-gray-500/10'
  };

  const NPC_STATUS_COLORS: Record<string, string> = {
    ACTIVE: 'text-green-400 bg-green-500/10',
    ALLY: 'text-blue-400 bg-blue-500/10',
    ENEMY: 'text-red-400 bg-red-500/10',
    DEAD: 'text-gray-400 bg-gray-500/10',
    UNKNOWN: 'text-gray-400 bg-gray-500/10'
  };

  const THREAD_STATUS_COLORS: Record<string, string> = {
    OPEN: 'text-purple-400 bg-purple-500/10',
    RESOLVED: 'text-emerald-400 bg-emerald-500/10',
    ABANDONED: 'text-gray-400 bg-gray-500/10',
    UNKNOWN: 'text-gray-400 bg-gray-500/10'
  };

  onMount(async () => {
    await Promise.all([loadWiki(), loadCampaignSessions()]);
  });

  async function loadWiki() {
    loading = true;
    error = '';
    try {
      wiki = await api.getWiki(campaignId);
    } catch (e: any) {
      error = e.error ?? 'Wiki konnte nicht geladen werden';
    } finally {
      loading = false;
    }
  }

  async function loadCampaignSessions() {
    sessionsLoading = true;
    try {
      const result = await api.getCampaignSessions(campaignId, 0, 200);
      campaignSessions = (result.sessions ?? []).sort((a: CampaignSessionOption, b: CampaignSessionOption) =>
        (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0)
      );
    } catch {
      campaignSessions = [];
    } finally {
      sessionsLoading = false;
    }
  }

  function emptyForm(category: Category): WikiForm {
    return {
      name: '',
      title: '',
      description: '',
      status: defaultStatus(category)
    };
  }

  function filtered<T extends { name?: string; title?: string; text?: string; item?: string; description?: string }>(items: T[]): T[] {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item =>
      `${item.name ?? item.title ?? item.text ?? item.item ?? ''} ${item.description ?? ''}`.toLowerCase().includes(q)
    );
  }

  function categoryCount(cat: Category): number {
    if (!wiki) return 0;
    switch (cat) {
      case 'npcs': return wiki.npcs.length;
      case 'quests': return wiki.quests.length;
      case 'locations': return wiki.locations.length;
      case 'threads': return wiki.threads.length;
      case 'loot': return wiki.loot.length;
    }
  }

  function usesTitle(category: Category): boolean {
    return category === 'quests' || category === 'threads';
  }

  function statusOptions(category: Category): StatusOption[] {
    if (category === 'npcs') return NPC_STATUS_OPTIONS;
    if (category === 'quests') return QUEST_STATUS_OPTIONS;
    if (category === 'threads') return THREAD_STATUS_OPTIONS;
    return [];
  }

  function defaultStatus(category: Category): string {
    if (category === 'npcs') return 'ACTIVE';
    if (category === 'quests') return 'DISCOVERED';
    if (category === 'threads') return 'OPEN';
    return '';
  }

  function statusValue(category: Category, status?: string): string {
    const normalized = status?.toUpperCase();
    return statusOptions(category).some(option => option.value === normalized)
      ? normalized!
      : defaultStatus(category);
  }

  function statusLabel(category: Category, status?: string): string {
    const value = statusValue(category, status);
    return statusOptions(category).find(option => option.value === value)?.label ?? status ?? 'Unbekannt';
  }

  function statusClass(category: Category, status?: string): string {
    const value = statusValue(category, status) || 'UNKNOWN';
    if (category === 'npcs') return NPC_STATUS_COLORS[value] ?? NPC_STATUS_COLORS.UNKNOWN;
    if (category === 'quests') return QUEST_STATUS_COLORS[value] ?? QUEST_STATUS_COLORS.UNKNOWN;
    if (category === 'threads') return THREAD_STATUS_COLORS[value] ?? THREAD_STATUS_COLORS.UNKNOWN;
    return 'text-gray-400 bg-gray-500/10';
  }

  function primaryLabel(category: Category): string {
    if (category === 'npcs') return 'Name';
    if (category === 'quests') return 'Titel';
    if (category === 'locations') return 'Name';
    if (category === 'threads') return 'Titel';
    return 'Name';
  }

  function primaryPlaceholder(category: Category): string {
    if (category === 'npcs') return 'NSC-Name';
    if (category === 'quests') return 'Quest-Titel';
    if (category === 'locations') return 'Ort';
    if (category === 'threads') return 'Offener Faden';
    return 'Gegenstand';
  }

  function descriptionPlaceholder(category: Category): string {
    if (category === 'quests') return 'Notizen, Ziel oder aktueller Stand';
    if (category === 'threads') return 'Details, Hinweise oder offene Fragen';
    if (category === 'loot') return 'Beschreibung, Besitzer oder Fundort';
    return 'Beschreibung';
  }

  function entityKey(category: Category, label: string, id?: string): string {
    return `${category}:${id ?? label.toLowerCase().trim()}`;
  }

  function manualBadge(source?: string): string {
    return source === 'manual' ? 'Manuell' : 'Summary';
  }

  function startCreate(category: Category) {
    form = emptyForm(category);
    showCreateForm = category;
    editingKey = null;
    linkingKey = null;
    actionError = '';
  }

  function startEditNPC(npc: WikiNPC) {
    form = {
      name: npc.name,
      title: '',
      description: npc.description ?? '',
      status: statusValue('npcs', npc.status)
    };
    showCreateForm = null;
    editingKey = entityKey('npcs', npc.name, npc.id);
    actionError = '';
  }

  function startEditQuest(quest: WikiQuest) {
    form = {
      name: '',
      title: quest.title,
      description: quest.description ?? quest.notes ?? quest.allNotes.join('\n'),
      status: statusValue('quests', quest.status)
    };
    showCreateForm = null;
    editingKey = entityKey('quests', quest.title, quest.id);
    actionError = '';
  }

  function startEditLocation(loc: WikiLocation) {
    form = {
      name: loc.name,
      title: '',
      description: loc.description ?? '',
      status: ''
    };
    showCreateForm = null;
    editingKey = entityKey('locations', loc.name, loc.id);
    actionError = '';
  }

  function startEditThread(thread: WikiThread) {
    form = {
      name: '',
      title: thread.text,
      description: thread.description ?? '',
      status: statusValue('threads', thread.status)
    };
    showCreateForm = null;
    editingKey = entityKey('threads', thread.text, thread.id);
    actionError = '';
  }

  function startEditLoot(item: WikiLoot) {
    form = {
      name: item.item,
      title: '',
      description: item.description ?? (item.foundBy ? `Gefunden von: ${item.foundBy}` : ''),
      status: ''
    };
    showCreateForm = null;
    editingKey = entityKey('loot', item.item, item.id);
    actionError = '';
  }

  function cancelForm() {
    showCreateForm = null;
    editingKey = null;
    actionError = '';
  }

  function optionalText(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  function validateForm(category: Category): boolean {
    const primary = usesTitle(category) ? form.title.trim() : form.name.trim();
    if (primary) return true;
    actionError = `${primaryLabel(category)} ist erforderlich`;
    return false;
  }

  async function saveForm(category: Category, id?: string) {
    if (saving || !validateForm(category)) return;
    saving = true;
    actionError = '';
    try {
      if (category === 'npcs') {
        const data = { name: form.name.trim(), description: optionalText(form.description), status: statusValue(category, form.status) };
        if (id) await api.updateCampaignNPC(campaignId, id, data);
        else await api.createCampaignNPC(campaignId, data);
      } else if (category === 'quests') {
        const data = { title: form.title.trim(), description: optionalText(form.description), status: statusValue(category, form.status) };
        if (id) await api.updateCampaignQuest(campaignId, id, data);
        else await api.createCampaignQuest(campaignId, data);
      } else if (category === 'locations') {
        const data = { name: form.name.trim(), description: optionalText(form.description) };
        if (id) await api.updateCampaignLocation(campaignId, id, data);
        else await api.createCampaignLocation(campaignId, data);
      } else if (category === 'threads') {
        const data = { title: form.title.trim(), description: optionalText(form.description), status: statusValue(category, form.status) };
        if (id) await api.updateCampaignThread(campaignId, id, data);
        else await api.createCampaignThread(campaignId, data);
      } else {
        const data = { name: form.name.trim(), description: optionalText(form.description) };
        if (id) await api.updateCampaignLoot(campaignId, id, data);
        else await api.createCampaignLoot(campaignId, data);
      }
      track(id ? 'wiki_entity_updated' : 'wiki_entity_created', {
        page_type: 'app',
        journey_stage: 'engagement',
        feature_name: 'wiki',
        entity_type: trackedEntityType(category),
        method: 'web',
        result: 'success'
      });
      cancelForm();
      await loadWiki();
    } catch (e: any) {
      actionError = typeof e.error === 'string' ? e.error : 'Speichern fehlgeschlagen';
    } finally {
      saving = false;
    }
  }

  async function deleteEntity(category: Category, id: string | undefined, label: string) {
    if (!id) {
      toast.info('Automatisch aggregierte Einträge kommen aus Session-Summaries und können nicht gelöscht werden. Bearbeiten legt einen manuellen Eintrag an.');
      return;
    }
    if (!await confirmAction({
      title: 'Wiki-Eintrag löschen?',
      message: `„${label}“ wird dauerhaft gelöscht.`,
      confirmLabel: 'Eintrag löschen',
      danger: true
    })) return;
    saving = true;
    actionError = '';
    try {
      if (category === 'npcs') await api.deleteCampaignNPC(campaignId, id);
      else if (category === 'quests') await api.deleteCampaignQuest(campaignId, id);
      else if (category === 'locations') await api.deleteCampaignLocation(campaignId, id);
      else if (category === 'threads') await api.deleteCampaignThread(campaignId, id);
      else await api.deleteCampaignLoot(campaignId, id);
      track('wiki_entity_deleted', {
        page_type: 'app',
        journey_stage: 'engagement',
        feature_name: 'wiki',
        entity_type: trackedEntityType(category),
        method: 'web',
        result: 'success'
      });
      await loadWiki();
    } catch (e: any) {
      toast.error(e.error ?? 'Löschen fehlgeschlagen');
    } finally {
      saving = false;
    }
  }

  function firstLinkableSession(sessionIds?: string[]): string {
    return campaignSessions.find(session => !sessionIds?.includes(session.id))?.id ?? campaignSessions[0]?.id ?? '';
  }

  function startLink(entryKey: string, sessionIds?: string[]) {
    linkingKey = entryKey;
    linkSelection = { ...linkSelection, [entryKey]: linkSelection[entryKey] ?? firstLinkableSession(sessionIds) };
    actionError = '';
  }

  function setLinkSelection(entryKey: string, value: string) {
    linkSelection = { ...linkSelection, [entryKey]: value };
  }

  function sessionLabel(session: CampaignSessionOption): string {
    const number = session.sessionNumber !== null && session.sessionNumber !== undefined
      ? `#${session.sessionNumber}`
      : 'Session';
    return `${number}${session.title ? ` · ${session.title}` : ''}`;
  }

  async function ensureManualNPC(npc: WikiNPC): Promise<string> {
    if (npc.id) return npc.id;
    const created = await api.createCampaignNPC(campaignId, {
      name: npc.name,
      description: optionalText(npc.description ?? ''),
      status: statusValue('npcs', npc.status)
    });
    return created.id;
  }

  async function ensureManualQuest(quest: WikiQuest): Promise<string> {
    if (quest.id) return quest.id;
    const created = await api.createCampaignQuest(campaignId, {
      title: quest.title,
      description: optionalText(quest.description ?? quest.notes ?? quest.allNotes.join('\n')),
      status: statusValue('quests', quest.status)
    });
    return created.id;
  }

  async function ensureManualThread(thread: WikiThread): Promise<string> {
    if (thread.id) return thread.id;
    const created = await api.createCampaignThread(campaignId, {
      title: thread.text,
      description: optionalText(thread.description ?? ''),
      status: statusValue('threads', thread.status)
    });
    return created.id;
  }

  async function linkNPC(npc: WikiNPC, entryKey: string) {
    await linkEntity('npcs', entryKey, () => ensureManualNPC(npc));
  }

  async function linkQuest(quest: WikiQuest, entryKey: string) {
    await linkEntity('quests', entryKey, () => ensureManualQuest(quest));
  }

  async function linkThread(thread: WikiThread, entryKey: string) {
    await linkEntity('threads', entryKey, () => ensureManualThread(thread));
  }

  async function linkEntity(category: LinkableCategory, entryKey: string, getId: () => Promise<string>) {
    const sessionId = linkSelection[entryKey];
    if (!sessionId || saving) return;
    saving = true;
    actionError = '';
    try {
      const id = await getId();
      if (category === 'npcs') await api.linkNPCtoSession(campaignId, id, sessionId);
      else if (category === 'quests') await api.linkQuestToSession(campaignId, id, sessionId);
      else await api.linkThreadToSession(campaignId, id, sessionId);
      linkingKey = null;
      await loadWiki();
    } catch (e: any) {
      actionError = typeof e.error === 'string' ? e.error : 'Verknüpfen fehlgeschlagen';
    } finally {
      saving = false;
    }
  }
</script>

{#snippet entityForm(category: Category, submitLabel: string, submit: () => void, cancel: () => void)}
  <form onsubmit={(event) => { event.preventDefault(); submit(); }}
    class="bg-surface-800 border border-brand-500/30 rounded-xl p-4 space-y-3">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label class="space-y-1">
        <span class="text-xs font-medium text-gray-500">{primaryLabel(category)}</span>
        {#if usesTitle(category)}
          <input bind:value={form.title} placeholder={primaryPlaceholder(category)}
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500" />
        {:else}
          <input bind:value={form.name} placeholder={primaryPlaceholder(category)}
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500" />
        {/if}
      </label>

      {#if statusOptions(category).length > 0}
        <label class="space-y-1">
          <span class="text-xs font-medium text-gray-500">Status</span>
          <select bind:value={form.status}
            class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
            {#each statusOptions(category) as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>

    <label class="space-y-1 block">
      <span class="text-xs font-medium text-gray-500">Beschreibung</span>
      <textarea bind:value={form.description} rows="3" placeholder={descriptionPlaceholder(category)}
        class="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-y"></textarea>
    </label>

    {#if actionError}
      <p class="text-xs text-red-400">{actionError}</p>
    {/if}

    <div class="flex items-center gap-2">
      <button type="submit" disabled={saving}
        class="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition">
        {saving ? 'Speichere...' : submitLabel}
      </button>
      <button type="button" onclick={cancel}
        class="text-gray-500 hover:text-white text-sm px-3 py-2 rounded-lg transition">
        Abbrechen
      </button>
    </div>
  </form>
{/snippet}

{#snippet sessionLink(category: LinkableCategory, entryKey: string, sessionIds: string[] | undefined, linkAction: () => void)}
  <div class="flex items-center gap-2 flex-wrap">
    {#if linkingKey === entryKey}
      <select value={linkSelection[entryKey] ?? ''} onchange={(event) => setLinkSelection(entryKey, (event.currentTarget as HTMLSelectElement).value)}
        disabled={sessionsLoading || campaignSessions.length === 0}
        class="bg-surface-700 border border-surface-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 max-w-56">
        {#if campaignSessions.length === 0}
          <option value="">Keine Sessions</option>
        {:else}
          {#each campaignSessions as session}
            <option value={session.id} disabled={sessionIds?.includes(session.id)}>
              {sessionLabel(session)}{sessionIds?.includes(session.id) ? ' (verknüpft)' : ''}
            </option>
          {/each}
        {/if}
      </select>
      <button type="button" onclick={linkAction} disabled={saving || !linkSelection[entryKey]}
        class="text-xs bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-lg transition">
        Speichern
      </button>
      <button type="button" onclick={() => linkingKey = null}
        class="text-xs text-gray-500 hover:text-white px-2 py-1.5 rounded-lg transition">
        Abbrechen
      </button>
    {:else}
      <button type="button" onclick={() => startLink(entryKey, sessionIds)}
        class="text-xs text-gray-500 hover:text-white border border-surface-600 hover:border-brand-500/40 px-2.5 py-1.5 rounded-lg transition">
        Mit Session verknüpfen
      </button>
    {/if}
  </div>
{/snippet}

<div class="space-y-4">
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h2 class="text-lg font-semibold text-white flex items-center gap-2">
        📜 Quest-Wiki
        <span class="text-xs text-gray-500 font-normal">— {campaignName}</span>
      </h2>
      {#if wiki}
        <p class="text-xs text-gray-500 mt-0.5">Aggregiert aus {wiki.sessionCount} Session{wiki.sessionCount === 1 ? '' : 's'}</p>
      {/if}
    </div>
    <button type="button" onclick={loadWiki}
      class="text-xs text-gray-500 hover:text-white border border-surface-600 hover:border-surface-500 px-3 py-1.5 rounded-lg transition">
      ↻ Aktualisieren
    </button>
  </div>

  {#if loading}
    <div class="animate-pulse space-y-4">
      {#each [1, 2, 3] as _}
        <div class="h-20 bg-surface-800 rounded-2xl border border-surface-600"></div>
      {/each}
    </div>
  {:else if error}
    <div class="bg-red-900/20 border border-red-700/40 rounded-2xl p-6 text-center">
      <p class="text-red-400 text-sm">{error}</p>
    </div>
  {:else if wiki}
    <div role="tablist" aria-label="Wiki-Kategorien" use:keyboardTabs
      class="flex gap-1 bg-surface-800 rounded-xl p-1 border border-surface-600 overflow-x-auto">
      {#each Object.entries(CATEGORY_LABELS) as [key, label]}
        <button type="button" id={`wiki-tab-${key}`} role="tab" aria-selected={activeCategory === key}
          aria-controls={`wiki-panel-${key}`} tabindex={activeCategory === key ? 0 : -1}
          onclick={() => { activeCategory = key as Category; cancelForm(); }}
          class="px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap {activeCategory === key ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-white'}">
          {label}
          <span class="ml-1 text-xs opacity-60">{categoryCount(key as Category)}</span>
        </button>
      {/each}
    </div>

    <div role="tabpanel" id={`wiki-panel-${activeCategory}`} aria-labelledby={`wiki-tab-${activeCategory}`} tabindex="0" class="space-y-4">

    <div class="relative">
      <input bind:value={searchQuery} placeholder="Suchen..."
        class="w-full bg-surface-800 border border-surface-600 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500" />
      {#if searchQuery}
        <button type="button" onclick={() => searchQuery = ''}
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white text-sm">✕</button>
      {/if}
    </div>

    <div class="flex items-center justify-between gap-3">
      <p class="text-xs text-gray-600">
        {CATEGORY_LABELS[activeCategory]} verwalten
      </p>
      <button type="button" onclick={() => startCreate(activeCategory)}
        class="bg-brand-600 hover:bg-brand-500 text-white text-sm px-3 py-2 rounded-lg transition">
        + Hinzufügen
      </button>
    </div>

    {#if showCreateForm === activeCategory}
      {@render entityForm(activeCategory, 'Hinzufügen', () => saveForm(activeCategory), cancelForm)}
    {/if}

    {#if actionError && !showCreateForm && !editingKey}
      <p class="text-xs text-red-400">{actionError}</p>
    {/if}

    <div class="space-y-3">
      {#if activeCategory === 'npcs'}
        {#if filtered(wiki.npcs).length === 0}
          <div class="text-center py-8 text-gray-600 text-sm">Keine NSCs gefunden</div>
        {:else}
          {#each filtered(wiki.npcs) as npc (entityKey('npcs', npc.name, npc.id))}
            {@const key = entityKey('npcs', npc.name, npc.id)}
            {#if editingKey === key}
              {@render entityForm('npcs', npc.id ? 'Speichern' : 'Als manuellen Eintrag speichern', () => saveForm('npcs', npc.id), cancelForm)}
            {:else}
              <div class="bg-surface-800 border border-surface-600 rounded-xl p-4 hover:border-brand-500/30 transition">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="font-medium text-white">{npc.name}</h3>
                      {#if npc.status}
                        <span class="text-xs px-2 py-0.5 rounded-full {statusClass('npcs', npc.status)}">{statusLabel('npcs', npc.status)}</span>
                      {/if}
                      <span class="text-[11px] text-gray-600 bg-surface-700 px-2 py-0.5 rounded-full">{manualBadge(npc.source)}</span>
                    </div>
                    {#if npc.description}
                      <p class="text-sm text-gray-400 mt-1 leading-relaxed">{npc.description}</p>
                    {/if}
                    <div class="mt-3 flex items-center gap-2 flex-wrap">
                      {@render sessionLink('npcs', key, npc.sessionIds, () => linkNPC(npc, key))}
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-2 shrink-0">
                    <span class="text-xs text-gray-600 bg-surface-700 px-2 py-0.5 rounded-full">
                      👁️ {npc.sessionCount}× gesehen
                    </span>
                    {#if npc.firstSeenSessionNumber !== null}
                      <span class="text-xs text-gray-600">
                        Session #{npc.firstSeenSessionNumber}{#if npc.lastSeenSessionNumber !== null && npc.lastSeenSessionNumber !== npc.firstSeenSessionNumber}–#{npc.lastSeenSessionNumber}{/if}
                      </span>
                    {/if}
                    <div class="flex items-center gap-1">
                      <button type="button" onclick={() => startEditNPC(npc)}
                        class="text-xs text-gray-500 hover:text-white border border-surface-600 hover:border-surface-500 px-2 py-1 rounded-lg transition">Bearbeiten</button>
                      <button type="button" onclick={() => deleteEntity('npcs', npc.id, npc.name)}
                        class="text-xs text-red-400/70 hover:text-red-300 border border-red-900/40 hover:border-red-700/60 px-2 py-1 rounded-lg transition">Löschen</button>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        {/if}

      {:else if activeCategory === 'quests'}
        {#if filtered(wiki.quests).length === 0}
          <div class="text-center py-8 text-gray-600 text-sm">Keine Quests gefunden</div>
        {:else}
          {#each filtered(wiki.quests) as quest (entityKey('quests', quest.title, quest.id))}
            {@const key = entityKey('quests', quest.title, quest.id)}
            {#if editingKey === key}
              {@render entityForm('quests', quest.id ? 'Speichern' : 'Als manuellen Eintrag speichern', () => saveForm('quests', quest.id), cancelForm)}
            {:else}
              <div class="bg-surface-800 border border-surface-600 rounded-xl p-4 hover:border-brand-500/30 transition">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="font-medium text-white">{quest.title}</h3>
                      <span class="text-xs px-2 py-0.5 rounded-full {statusClass('quests', quest.status)}">
                        {statusLabel('quests', quest.status)}
                      </span>
                      <span class="text-[11px] text-gray-600 bg-surface-700 px-2 py-0.5 rounded-full">{manualBadge(quest.source)}</span>
                    </div>
                    {#if quest.allNotes.length > 0}
                      <div class="mt-2 space-y-1">
                        {#each quest.allNotes as note}
                          <p class="text-sm text-gray-400 leading-relaxed border-l border-brand-500/20 pl-2">{note}</p>
                        {/each}
                      </div>
                    {:else if quest.description}
                      <p class="text-sm text-gray-400 mt-1 leading-relaxed">{quest.description}</p>
                    {/if}
                    <div class="mt-3">
                      {@render sessionLink('quests', key, quest.sessionIds, () => linkQuest(quest, key))}
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button type="button" onclick={() => startEditQuest(quest)}
                      class="text-xs text-gray-500 hover:text-white border border-surface-600 hover:border-surface-500 px-2 py-1 rounded-lg transition">Bearbeiten</button>
                    <button type="button" onclick={() => deleteEntity('quests', quest.id, quest.title)}
                      class="text-xs text-red-400/70 hover:text-red-300 border border-red-900/40 hover:border-red-700/60 px-2 py-1 rounded-lg transition">Löschen</button>
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        {/if}

      {:else if activeCategory === 'locations'}
        {#if filtered(wiki.locations).length === 0}
          <div class="text-center py-8 text-gray-600 text-sm">Keine Orte gefunden</div>
        {:else}
          {#each filtered(wiki.locations) as loc (entityKey('locations', loc.name, loc.id))}
            {@const key = entityKey('locations', loc.name, loc.id)}
            {#if editingKey === key}
              {@render entityForm('locations', loc.id ? 'Speichern' : 'Als manuellen Eintrag speichern', () => saveForm('locations', loc.id), cancelForm)}
            {:else}
              <div class="bg-surface-800 border border-surface-600 rounded-xl p-4 hover:border-brand-500/30 transition">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="font-medium text-white">🗺️ {loc.name}</h3>
                      <span class="text-[11px] text-gray-600 bg-surface-700 px-2 py-0.5 rounded-full">{manualBadge(loc.source)}</span>
                    </div>
                    {#if loc.description}
                      <p class="text-sm text-gray-400 mt-1 leading-relaxed">{loc.description}</p>
                    {/if}
                  </div>
                  <div class="flex flex-col items-end gap-2 shrink-0">
                    <span class="text-xs text-gray-600 bg-surface-700 px-2 py-0.5 rounded-full">
                      {loc.sessionCount}× besucht
                    </span>
                    <div class="flex items-center gap-1">
                      <button type="button" onclick={() => startEditLocation(loc)}
                        class="text-xs text-gray-500 hover:text-white border border-surface-600 hover:border-surface-500 px-2 py-1 rounded-lg transition">Bearbeiten</button>
                      <button type="button" onclick={() => deleteEntity('locations', loc.id, loc.name)}
                        class="text-xs text-red-400/70 hover:text-red-300 border border-red-900/40 hover:border-red-700/60 px-2 py-1 rounded-lg transition">Löschen</button>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        {/if}

      {:else if activeCategory === 'threads'}
        {#if filtered(wiki.threads).length === 0}
          <div class="text-center py-8 text-gray-600 text-sm">Keine offenen Fäden gefunden</div>
        {:else}
          {#each filtered(wiki.threads) as thread (entityKey('threads', thread.text, thread.id))}
            {@const key = entityKey('threads', thread.text, thread.id)}
            {#if editingKey === key}
              {@render entityForm('threads', thread.id ? 'Speichern' : 'Als manuellen Eintrag speichern', () => saveForm('threads', thread.id), cancelForm)}
            {:else}
              <div class="bg-surface-800 border border-surface-600 rounded-xl p-4 hover:border-purple-500/30 transition">
                <div class="flex items-start gap-3">
                  <span class="text-purple-400 mt-0.5 shrink-0">🔮</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="text-sm text-gray-300 leading-relaxed">{thread.text}</p>
                      {#if thread.status}
                        <span class="text-xs px-2 py-0.5 rounded-full {statusClass('threads', thread.status)}">{statusLabel('threads', thread.status)}</span>
                      {/if}
                      <span class="text-[11px] text-gray-600 bg-surface-700 px-2 py-0.5 rounded-full">{manualBadge(thread.source)}</span>
                    </div>
                    {#if thread.description}
                      <p class="text-xs text-gray-500 mt-1">{thread.description}</p>
                    {/if}
                    <div class="mt-3">
                      {@render sessionLink('threads', key, thread.sessionIds, () => linkThread(thread, key))}
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-2 shrink-0">
                    {#if thread.sessionNumber !== null}
                      <a href="/sessions/{thread.sessionId}"
                        class="text-xs text-gray-600 hover:text-purple-400 transition border border-surface-600 hover:border-purple-500/40 px-2 py-1 rounded-lg">
                        Session #{thread.sessionNumber}
                      </a>
                    {/if}
                    <div class="flex items-center gap-1">
                      <button type="button" onclick={() => startEditThread(thread)}
                        class="text-xs text-gray-500 hover:text-white border border-surface-600 hover:border-surface-500 px-2 py-1 rounded-lg transition">Bearbeiten</button>
                      <button type="button" onclick={() => deleteEntity('threads', thread.id, thread.text)}
                        class="text-xs text-red-400/70 hover:text-red-300 border border-red-900/40 hover:border-red-700/60 px-2 py-1 rounded-lg transition">Löschen</button>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        {/if}

      {:else if activeCategory === 'loot'}
        {#if filtered(wiki.loot).length === 0}
          <div class="text-center py-8 text-gray-600 text-sm">Keine Beute gefunden</div>
        {:else}
          <div class="bg-surface-800 border border-surface-600 rounded-xl overflow-x-auto">
            <table class="w-full min-w-[640px] text-sm">
              <tbody>
                {#each filtered(wiki.loot) as item (entityKey('loot', item.item, item.id))}
                  {@const key = entityKey('loot', item.item, item.id)}
                  {#if editingKey === key}
                    <tr class="border-b border-surface-700 last:border-0">
                      <td colspan="4" class="px-4 py-3">
                        {@render entityForm('loot', item.id ? 'Speichern' : 'Als manuellen Eintrag speichern', () => saveForm('loot', item.id), cancelForm)}
                      </td>
                    </tr>
                  {:else}
                    <tr class="border-b border-surface-700 last:border-0 hover:bg-surface-700/50 transition">
                      <td class="px-4 py-3 text-white">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span>💎 {item.item}</span>
                          <span class="text-[11px] text-gray-600 bg-surface-700 px-2 py-0.5 rounded-full">{manualBadge(item.source)}</span>
                        </div>
                        {#if item.description}
                          <p class="text-xs text-gray-500 mt-1">{item.description}</p>
                        {/if}
                      </td>
                      <td class="px-4 py-3 text-gray-400">{item.foundBy || '—'}</td>
                      <td class="px-4 py-3 text-right">
                        {#if item.sessionNumber !== null}
                          <a href="/sessions/{item.sessionId}"
                            class="text-xs text-gray-600 hover:text-brand-400 transition">#{item.sessionNumber}</a>
                        {/if}
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex items-center justify-end gap-1">
                          <button type="button" onclick={() => startEditLoot(item)}
                            class="text-xs text-gray-500 hover:text-white border border-surface-600 hover:border-surface-500 px-2 py-1 rounded-lg transition">Bearbeiten</button>
                          <button type="button" onclick={() => deleteEntity('loot', item.id, item.item)}
                            class="text-xs text-red-400/70 hover:text-red-300 border border-red-900/40 hover:border-red-700/60 px-2 py-1 rounded-lg transition">Löschen</button>
                        </div>
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/if}
    </div>

    <div class="text-center pt-4">
      <p class="text-xs text-gray-700">
        📊 Stufe 1 — Automatisch aggregiert aus Session-Summaries, ergänzt um manuelle Wiki-Einträge.
      </p>
    </div>
    </div>
  {:else}
    <div class="text-center py-8 text-gray-600 text-sm">Keine Daten verfügbar</div>
  {/if}
</div>
