<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import BrandHeader from '$lib/components/BrandHeader.svelte';

  let status = $state<'loading' | 'success' | 'error'>('loading');
  let message = $state('Deine E-Mail-Adresse wird bestätigt...');
  let email = $state('');
  let resendStatus = $state('');
  let resending = $state(false);

  onMount(async () => {
    const token = $page.url.searchParams.get('token');
    if (!token) {
      status = 'error';
      message = 'Der Bestätigungslink ist unvollständig.';
      return;
    }

    try {
      const result = await api.verifyEmail(token);
      status = 'success';
      message = result.message;
      sessionStorage.setItem('registrationStage', 'approval');
      await goto('/registration-pending?stage=approval', { replaceState: true });
    } catch (e: any) {
      status = 'error';
      message = typeof e.error === 'string'
        ? e.error
        : 'Der Bestätigungslink ist ungültig oder abgelaufen.';
    }
  });

  async function resendVerification(e: Event) {
    e.preventDefault();
    resending = true;
    resendStatus = '';
    try {
      const result = await api.resendVerification(email);
      resendStatus = result.message;
    } catch (e: any) {
      resendStatus = typeof e.error === 'string'
        ? e.error
        : 'Die Bestätigungsmail konnte nicht erneut angefordert werden.';
    } finally {
      resending = false;
    }
  }
</script>

<svelte:head><title>E-Mail bestätigen — DnD Recorder</title></svelte:head>

<div class="min-h-screen flex items-center justify-center bg-surface-900 p-4">
  <main class="w-full max-w-md rounded-2xl border border-surface-600 bg-surface-800 p-6 text-center shadow-xl sm:p-8">
    <BrandHeader subtitle="E-Mail-Bestätigung" compact />
    {#if status === 'loading'}
      <div class="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-surface-600 border-t-brand-500" aria-hidden="true"></div>
      <h1 class="text-xl font-semibold text-white">Der Artificer prüft dein Siegel</h1>
      <p role="status" class="mt-3 text-sm text-gray-300">{message}</p>
    {:else if status === 'success'}
      <div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-3xl" aria-hidden="true">✓</div>
      <h1 class="text-xl font-semibold text-white">Siegel bestätigt</h1>
      <p role="status" class="mt-3 text-sm leading-6 text-gray-300">{message}</p>
      <a href="/registration-pending?stage=approval"
        class="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-500">
        Zum Wartesaal
      </a>
    {:else}
      <div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-2xl" aria-hidden="true">!</div>
      <h1 class="text-xl font-semibold text-white">Bestätigung nicht möglich</h1>
      <p role="alert" class="mt-3 text-sm leading-6 text-red-300">{message}</p>

      <form onsubmit={resendVerification} class="mt-6 space-y-4 text-left">
        <div class="space-y-2">
          <label for="email" class="block text-sm text-gray-300">E-Mail-Adresse</label>
          <input id="email" name="email" type="email" bind:value={email} required autocomplete="email"
            class="w-full rounded-lg border border-surface-600 bg-surface-700 px-4 py-3 text-white placeholder-gray-600"
            placeholder="dm@example.com" />
        </div>
        <button type="submit" disabled={resending}
          class="w-full min-h-12 rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50">
          {resending ? 'Wird gesendet...' : 'Neuen Bestätigungslink senden'}
        </button>
      </form>

      {#if resendStatus}
        <div role="status" class="mt-4 rounded-lg border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-left text-sm text-brand-200">
          {resendStatus}
        </div>
      {/if}

      <a href="/login" class="mt-5 inline-block text-sm text-brand-400 hover:underline">Zur Anmeldung</a>
    {/if}
  </main>
</div>
