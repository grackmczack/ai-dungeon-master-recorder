<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/auth.js';
  import { api } from '$lib/api.js';
  import ToastRegion from '$lib/components/ToastRegion.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  let { children } = $props();

  const { user, loading } = auth;
  let discordInviteUrl = $state('');

  const PUBLIC_ROUTES = [
    '/login',
    '/register',
    '/registration-pending',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/docs'
  ];

  function isPublic(pathname: string) {
    return pathname === '/'
      || PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }

  function isIndexable(pathname: string) {
    return pathname === '/' || pathname === '/docs';
  }

  function loginRedirectUrl() {
    const returnTo = `${$page.url.pathname}${$page.url.search}${$page.url.hash}`;
    sessionStorage.setItem('postLoginReturnTo', returnTo);
    return '/login';
  }

  function safeReturnTo(value: string | null) {
    const candidate = value ?? sessionStorage.getItem('postLoginReturnTo');
    if (candidate?.startsWith('/') && !candidate.startsWith('//')) {
      sessionStorage.removeItem('postLoginReturnTo');
      return candidate;
    }
    return '/dashboard';
  }

  onMount(async () => {
    api.getDiscordConfig()
      .then((config) => { discordInviteUrl = config.inviteUrl ?? ''; })
      .catch(() => { discordInviteUrl = ''; });
    try {
      auth.setAuth(await api.me());
    } catch {
      auth.logout();
    } finally {
      auth.loading.set(false);
      if ($user && ['/login', '/register'].includes($page.url.pathname)) {
        await goto(safeReturnTo($page.url.searchParams.get('returnTo')));
      } else if ($user && ['/forgot-password', '/reset-password'].includes($page.url.pathname)) {
        await goto('/dashboard');
      } else if (!$user && !isPublic($page.url.pathname)) {
        await goto(loginRedirectUrl());
      }
    }
  });

  afterNavigate(async () => {
    if (!$loading && !$user && !isPublic($page.url.pathname)) await goto(loginRedirectUrl());
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

<svelte:head>
  {#if !isIndexable($page.url.pathname)}
    <meta name="robots" content="noindex, nofollow" />
  {/if}
</svelte:head>

<a href="#main-content" class="skip-link">Zum Inhalt springen</a>

{#if !['/', '/login', '/register', '/registration-pending', '/verify-email', '/forgot-password', '/reset-password'].includes($page.url.pathname)}
  <nav class="bg-surface-800 border-b border-surface-600 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50">
    <div class="flex min-w-0 items-center gap-3 sm:gap-6">
      <a href="/dashboard" class="text-brand-500 font-bold text-lg tracking-tight flex items-center gap-2">
        <img src="/logo-d20.svg" alt="" aria-hidden="true" width="32" height="32" class="h-8 w-8" />
        <span>DnD Recorder</span>
      </a>
      {#if $user}
        <a href="/dashboard" aria-current={$page.url.pathname.startsWith('/dashboard') ? 'page' : undefined}
          class="hidden sm:inline text-sm text-gray-400 hover:text-white transition">Dashboard</a>
      {/if}
      <a href="/docs" aria-current={$page.url.pathname.startsWith('/docs') ? 'page' : undefined}
        class="text-sm text-gray-400 hover:text-white transition">Dokumentation</a>
      {#if discordInviteUrl}
        <a href={discordInviteUrl} target="_blank" rel="noreferrer"
          aria-label="Discord-Bot zu einem Server hinzufügen"
          class="text-sm text-brand-400 hover:text-brand-300 transition">
          <span class="sm:hidden" aria-hidden="true">🤖+</span><span class="hidden sm:inline">Bot einladen</span>
        </a>
      {/if}
      {#if $user?.role === 'SUPER_ADMIN'}
        <a href="/admin" aria-current={$page.url.pathname.startsWith('/admin') ? 'page' : undefined}
          aria-label="Administration" class="text-sm text-brand-400 hover:text-brand-300 transition">
          <span class="sm:hidden" aria-hidden="true">🛡️</span><span class="hidden sm:inline">Admin</span>
        </a>
      {/if}
    </div>
    {#if $user}
      <div class="flex items-center gap-3 sm:gap-4">
        <a href="/account" aria-current={$page.url.pathname.startsWith('/account') ? 'page' : undefined}
          aria-label="Konto von {$user.displayName}" class="text-sm text-gray-400 hover:text-white">
          <span class="sm:hidden" aria-hidden="true">👤</span><span class="hidden sm:inline">{$user.displayName}</span>
        </a>
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

<ToastRegion />
<ConfirmDialog />

<main id="main-content" tabindex="-1" class="min-h-screen">
  {@render children()}
</main>
