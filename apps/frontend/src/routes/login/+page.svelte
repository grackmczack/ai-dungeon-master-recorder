<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.js';
  import { api } from '$lib/api.js';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function login(e: Event) {
    e.preventDefault();
    loading = true;
    error = '';
    try {
      const { token, user } = await api.login(email, password);
      auth.setAuth(token, user);
      goto('/dashboard');
    } catch (e: any) {
      error = e.error ?? 'Login fehlgeschlagen';
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-surface-900 p-4">
  <div class="w-full max-w-md">
    <div class="text-center mb-8">
      <div class="text-5xl mb-3">🎲</div>
      <h1 class="text-2xl font-bold text-white">DM Recorder</h1>
      <p class="text-gray-500 text-sm mt-1">Dein KI-Chronist für D&D Sessions</p>
    </div>

    <form onsubmit={login} class="bg-surface-800 rounded-2xl p-8 border border-surface-600 shadow-xl space-y-5">
      <h2 class="text-xl font-semibold text-white">Anmelden</h2>

      {#if error}
        <div class="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
      {/if}

      <div class="space-y-2">
        <label class="block text-sm text-gray-400" for="email">E-Mail</label>
        <input
          id="email" type="email" bind:value={email} required
          class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition"
          placeholder="dm@example.com"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm text-gray-400" for="password">Passwort</label>
        <input
          id="password" type="password" bind:value={password} required
          class="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit" disabled={loading}
        class="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
      >
        {loading ? 'Anmelden...' : 'Anmelden'}
      </button>

      <p class="text-center text-sm text-gray-500">
        Noch kein Konto?
        <a href="/register" class="text-brand-500 hover:underline">Registrieren</a>
      </p>
    </form>
  </div>
</div>
