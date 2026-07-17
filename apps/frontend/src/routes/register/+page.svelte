<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { tick } from 'svelte';
  import { auth } from '$lib/auth.js';
  import { api } from '$lib/api.js';

  let email = $state('');
  let password = $state('');
  let passwordConfirmation = $state('');
  let displayName = $state('');
  let showPassword = $state(false);
  let error = $state('');
  let loading = $state(false);
  let errorElement = $state<HTMLDivElement>();

  function safeReturnTo() {
    const value = $page.url.searchParams.get('returnTo')
      ?? (browser ? sessionStorage.getItem('postLoginReturnTo') : null);
    return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
  }

  async function register(e: Event) {
    e.preventDefault();
    error = '';
    if (password !== passwordConfirmation) {
      error = 'Die Passwörter stimmen nicht überein';
      await tick();
      errorElement?.focus();
      return;
    }

    loading = true;
    try {
      const { user } = await api.register(email, password, displayName);
      auth.setAuth(user);
      const returnTo = safeReturnTo();
      sessionStorage.removeItem('postLoginReturnTo');
      await goto(returnTo);
    } catch (e: any) {
      error = typeof e.error === 'string' ? e.error : 'Registrierung fehlgeschlagen';
      await tick();
      errorElement?.focus();
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Registrieren — DM Recorder</title></svelte:head>

<div class="min-h-screen flex items-center justify-center bg-surface-900 p-4 py-10">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <div class="text-5xl mb-3" aria-hidden="true">🎲</div>
      <h1 class="text-2xl font-bold text-white">DM Recorder</h1>
      <p class="text-gray-400 text-sm mt-1">Konto erstellen</p>
    </div>

    <form onsubmit={register} class="bg-surface-800 rounded-2xl p-6 sm:p-8 border border-surface-600 shadow-xl space-y-5">
      <h2 class="text-xl font-semibold text-white">Registrieren</h2>

      {#if error}
        <div bind:this={errorElement} tabindex="-1" role="alert"
          class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
      {/if}

      <div class="space-y-2">
        <label class="block text-sm text-gray-300" for="name">Name</label>
        <input id="name" name="name" type="text" bind:value={displayName} required autocomplete="name" maxlength="80"
          class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 transition"
          placeholder="Dein Name" />
      </div>

      <div class="space-y-2">
        <label class="block text-sm text-gray-300" for="email">E-Mail</label>
        <input id="email" name="email" type="email" bind:value={email} required autocomplete="username"
          class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 transition"
          placeholder="dm@example.com" />
      </div>

      <div class="space-y-2">
        <label class="block text-sm text-gray-300" for="password">Passwort</label>
        <div class="relative">
          <input id="password" name="new-password" type={showPassword ? 'text' : 'password'} bind:value={password}
            required minlength="12" maxlength="128" autocomplete="new-password" aria-describedby="password-help"
            class="w-full bg-surface-700 border border-surface-600 rounded-lg py-3 pl-4 pr-24 text-white placeholder-gray-600 transition"
            placeholder="Mindestens 12 Zeichen" />
          <button type="button" onclick={() => showPassword = !showPassword}
            aria-label={showPassword ? 'Passwörter ausblenden' : 'Passwörter anzeigen'}
            class="absolute inset-y-0 right-1 min-w-20 rounded-lg px-3 text-sm text-gray-300 hover:text-white">
            {showPassword ? 'Ausblenden' : 'Anzeigen'}
          </button>
        </div>
        <p id="password-help" class="text-xs text-gray-400">12–128 Zeichen; lange Passphrasen sind willkommen.</p>
      </div>

      <div class="space-y-2">
        <label class="block text-sm text-gray-300" for="password-confirmation">Passwort bestätigen</label>
        <input id="password-confirmation" name="password-confirmation" type={showPassword ? 'text' : 'password'}
          bind:value={passwordConfirmation} required minlength="12" maxlength="128" autocomplete="new-password"
          class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 transition"
          placeholder="Passwort wiederholen" />
      </div>

      <button type="submit" disabled={loading}
        class="w-full min-h-12 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition">
        {loading ? 'Registrieren...' : 'Konto erstellen'}
      </button>

      <p class="text-center text-sm text-gray-400">
        Bereits registriert? <a href="/login" class="text-brand-400 hover:underline">Anmelden</a>
      </p>
    </form>
  </div>
</div>
