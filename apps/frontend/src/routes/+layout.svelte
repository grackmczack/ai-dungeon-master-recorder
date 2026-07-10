<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/auth.js';
  import { api } from '$lib/api.js';
  import { writable } from 'svelte/store';

  let { children } = $props();

  const { isAuthenticated, user, token } = auth;

  const PUBLIC_ROUTES = ['/login', '/register'];

  const statusInfo = writable<{ status: string; label: string } | null>(null);

  const STATUS_LABELS: Record<string, string> = {
    RECORDING: '🔴 Aufnahme läuft',
    PROCESSING: '⏳ Verarbeitung',
    TRANSCRIBING: '📝 Transkription',
    SUMMARIZING: '✍️ Summary wird erstellt',
  };

  async function pollStatus() {
    if (typeof window === 'undefined') return;
    try {
      const groups = await api.getGroups();
      for (const group of groups) {
        const g = await api.getGroup(group.id);
        for (const campaign of g.campaigns ?? []) {
          for (const session of campaign.sessions ?? []) {
            if (['RECORDING','PROCESSING','TRANSCRIBING','SUMMARIZING'].includes(session.status)) {
              statusInfo.set({ status: session.status, label: STATUS_LABELS[session.status] ?? session.status });
              return;
            }
          }
        }
      }
      statusInfo.set(null);
    } catch { statusInfo.set(null); }
  }

  onMount(() => {
    (async () => {
    const isPublic = PUBLIC_ROUTES.some(r => $page.url.pathname.startsWith(r));
    if (!$isAuthenticated && !isPublic) {
      goto('/login');
      return;
    }
    if ($isAuthenticated && !$user) {
      try {
        const u = await api.me();
        auth.user.set(u);
      } catch {
        auth.logout();
        goto('/login');
      }
    }
    if (!isPublic) {
      pollStatus();
      const interval = setInterval(pollStatus, 10000);
      return () => clearInterval(interval);
    }
    })();
  });

  function handleLogout() {
    auth.logout();
    goto('/login');
  }
</script>

{#if $page.url.pathname !== '/login' && $page.url.pathname !== '/register'}
  <nav class="bg-surface-800 border-b border-surface-600 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
    <div class="flex items-center gap-6">
      <a href="/dashboard" class="text-brand-500 font-bold text-lg tracking-tight flex items-center gap-2">
        🎲 DM Recorder
      </a>
      <a href="/dashboard" class="text-sm text-gray-400 hover:text-white transition">Dashboard</a>
      <a href="/docs" class="text-sm text-gray-400 hover:text-white transition">Dokumentation</a>
      {#if $user?.role === 'SUPER_ADMIN'}
        <a href="/admin" class="text-sm text-brand-400 hover:text-brand-300 transition">Admin</a>
      {/if}
    </div>
    <div class="flex items-center gap-4">\      {#if $statusInfo}
        <div class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border {
          $statusInfo.status === 'RECORDING' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
          $statusInfo.status === 'TRANSCRIBING' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
          $statusInfo.status === 'SUMMARIZING' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
          'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
        }">
          <span class="animate-pulse">●</span>
          {$statusInfo.label}
        </div>
      {/if}
      {#if $user}
        <span class="text-sm text-gray-400">{$user.displayName}</span>
      {/if}
      <button
        onclick={handleLogout}
        class="text-sm text-gray-500 hover:text-red-400 transition"
      >
        Logout
      </button>
    </div>
  </nav>
{/if}

<main class="min-h-screen">
  {@render children()}
</main>
