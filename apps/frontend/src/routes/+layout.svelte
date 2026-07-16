<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/auth.js';
  import { api } from '$lib/api.js';

  let { children } = $props();

  const { user, loading } = auth;

  const PUBLIC_ROUTES = ['/login', '/register', '/docs'];

  function isPublic(pathname: string) {
    return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  }

  onMount(async () => {
    try {
      auth.setAuth(await api.me());
    } catch {
      auth.logout();
    } finally {
      auth.loading.set(false);
      if ($user && ['/login', '/register'].includes($page.url.pathname)) {
        await goto('/dashboard');
      } else if (!$user && !isPublic($page.url.pathname)) {
        await goto('/login');
      }
    }
  });

  afterNavigate(async () => {
    if (!$loading && !$user && !isPublic($page.url.pathname)) await goto('/login');
  });

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      auth.logout();
      await goto('/login');
    }
  }
</script>

{#if $page.url.pathname !== '/login' && $page.url.pathname !== '/register'}
  <nav class="bg-surface-800 border-b border-surface-600 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50">
    <div class="flex min-w-0 items-center gap-3 sm:gap-6">
      <a href="/dashboard" class="text-brand-500 font-bold text-lg tracking-tight flex items-center gap-2">
        🎲 DM Recorder
      </a>
      {#if $user}
        <a href="/dashboard" class="hidden sm:inline text-sm text-gray-400 hover:text-white transition">Dashboard</a>
      {/if}
      <a href="/docs" class="text-sm text-gray-400 hover:text-white transition">Dokumentation</a>
      {#if $user?.role === 'SUPER_ADMIN'}
        <a href="/admin" class="hidden sm:inline text-sm text-brand-400 hover:text-brand-300 transition">Admin</a>
      {/if}
    </div>
    {#if $user}
      <div class="flex items-center gap-3 sm:gap-4">
        <span class="hidden sm:inline text-sm text-gray-400">{$user.displayName}</span>
        <button
          onclick={handleLogout}
          class="text-sm text-gray-500 hover:text-red-400 transition"
        >
          Logout
        </button>
      </div>
    {/if}
  </nav>
{/if}

<main class="min-h-screen">
  {@render children()}
</main>
