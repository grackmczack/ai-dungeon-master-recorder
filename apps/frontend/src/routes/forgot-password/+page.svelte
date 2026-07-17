<script lang="ts">
  import { api } from '$lib/api.js';

  let email = $state('');
  let loading = $state(false);
  let message = $state('');
  let error = $state('');

  async function submit(e: Event) {
    e.preventDefault();
    loading = true;
    error = '';
    message = '';
    try {
      const result = await api.forgotPassword(email);
      message = result.message;
    } catch (e: any) {
      error = typeof e.error === 'string' ? e.error : 'Anfrage konnte nicht verarbeitet werden';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Passwort vergessen — DM Recorder</title></svelte:head>

<div class="min-h-screen flex items-center justify-center bg-surface-900 p-4">
  <div class="w-full max-w-md">
    <a href="/login" class="mb-6 inline-flex min-h-11 items-center text-sm text-gray-300 hover:text-white">← Zur Anmeldung</a>
    <form onsubmit={submit} class="bg-surface-800 rounded-2xl p-6 sm:p-8 border border-surface-600 shadow-xl space-y-5">
      <div>
        <h1 class="text-2xl font-semibold text-white">Passwort vergessen?</h1>
        <p class="mt-2 text-sm leading-relaxed text-gray-300">Wir senden dir einen einmalig nutzbaren Link, der 30 Minuten gültig ist.</p>
      </div>

      {#if message}<div role="status" class="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">{message}</div>{/if}
      {#if error}<div role="alert" class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>{/if}

      <div class="space-y-2">
        <label for="email" class="block text-sm text-gray-300">E-Mail</label>
        <input id="email" name="email" type="email" bind:value={email} required autocomplete="username"
          class="w-full rounded-lg border border-surface-600 bg-surface-700 px-4 py-3 text-white" placeholder="dm@example.com" />
      </div>
      <button type="submit" disabled={loading || !!message}
        class="min-h-12 w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-500 disabled:opacity-50">
        {loading ? 'Wird gesendet...' : 'Reset-Link anfordern'}
      </button>
    </form>
  </div>
</div>
