<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/auth.js';
  import { api } from '$lib/api.js';

  let { children } = $props();

  const { isAuthenticated, user } = auth;

  const PUBLIC_ROUTES = ['/login', '/register'];

  onMount(async () => {
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
    </div>
    <div class="flex items-center gap-4">
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
