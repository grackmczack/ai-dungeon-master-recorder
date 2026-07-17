<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { tick } from 'svelte';
  import { auth } from '$lib/auth.js';
  import { api } from '$lib/api.js';

  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let error = $state('');
  let loading = $state(false);
  let errorElement = $state<HTMLDivElement>();

  async function login(e: Event) {
    e.preventDefault();
    loading = true;
    error = '';
    try {
      const { user } = await api.login(email, password);
      auth.setAuth(user);
      await goto('/dashboard');
    } catch (e: any) {
      error = typeof e.error === 'string' ? e.error : 'Login fehlgeschlagen';
      await tick();
      errorElement?.focus();
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Anmelden — DM Recorder</title></svelte:head>

<div class="min-h-screen flex items-center justify-center bg-surface-900 p-4">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <div class="text-5xl mb-3" aria-hidden="true">🎲</div>
      <h1 class="text-2xl font-bold text-white">DM Recorder</h1>
      <p class="text-gray-400 text-sm mt-1">Dein KI-Chronist für D&D Sessions</p>
    </div>

    <form onsubmit={login} class="bg-surface-800 rounded-2xl p-6 sm:p-8 border border-surface-600 shadow-xl space-y-5">
      <h2 class="text-xl font-semibold text-white">Anmelden</h2>

      {#if $page.url.searchParams.get('reset') === 'success'}
        <div role="status" class="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-200 text-sm">
          Passwort wurde geändert. Du kannst dich jetzt anmelden.
        </div>
      {/if}

      {#if error}
        <div bind:this={errorElement} tabindex="-1" role="alert"
          class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
      {/if}

      <div class="space-y-2">
        <label class="block text-sm text-gray-300" for="email">E-Mail</label>
        <input id="email" name="email" type="email" bind:value={email} required autocomplete="username"
          class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 transition"
          placeholder="dm@example.com" />
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <label class="block text-sm text-gray-300" for="password">Passwort</label>
          <a href="/forgot-password" class="text-sm text-brand-400 hover:text-brand-300 hover:underline">Passwort vergessen?</a>
        </div>
        <div class="relative">
          <input id="password" name="password" type={showPassword ? 'text' : 'password'} bind:value={password}
            required autocomplete="current-password"
            class="w-full bg-surface-700 border border-surface-600 rounded-lg py-3 pl-4 pr-24 text-white placeholder-gray-600 transition"
            placeholder="Passwort" />
          <button type="button" onclick={() => showPassword = !showPassword}
            aria-label={showPassword ? 'Passwort ausblenden' : 'Passwort anzeigen'}
            class="absolute inset-y-0 right-1 min-w-20 rounded-lg px-3 text-sm text-gray-300 hover:text-white">
            {showPassword ? 'Ausblenden' : 'Anzeigen'}
          </button>
        </div>
      </div>

      <button type="submit" disabled={loading}
        class="w-full min-h-12 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition">
        {loading ? 'Anmelden...' : 'Anmelden'}
      </button>

      <p class="text-center text-sm text-gray-400">
        Noch kein Konto? <a href="/register" class="text-brand-400 hover:underline">Registrieren</a>
      </p>
    </form>
  </div>
</div>
