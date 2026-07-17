<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api.js';

  const token = $derived($page.url.searchParams.get('token') ?? '');
  let password = $state('');
  let confirmation = $state('');
  let showPassword = $state(false);
  let loading = $state(false);
  let error = $state('');

  async function submit(e: Event) {
    e.preventDefault();
    error = '';
    if (!token) { error = 'Reset-Link ist unvollständig'; return; }
    if (password !== confirmation) { error = 'Die Passwörter stimmen nicht überein'; return; }
    loading = true;
    try {
      await api.resetPassword(token, password);
      await goto('/login?reset=success');
    } catch (e: any) {
      error = typeof e.error === 'string' ? e.error : 'Passwort konnte nicht geändert werden';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Neues Passwort — DM Recorder</title></svelte:head>

<div class="min-h-screen flex items-center justify-center bg-surface-900 p-4">
  <form onsubmit={submit} class="w-full max-w-md space-y-5 rounded-2xl border border-surface-600 bg-surface-800 p-6 shadow-xl sm:p-8">
    <div>
      <h1 class="text-2xl font-semibold text-white">Neues Passwort festlegen</h1>
      <p class="mt-2 text-sm text-gray-300">Nach der Änderung werden alle bisherigen Sitzungen abgemeldet.</p>
    </div>
    {#if error}<div role="alert" class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>{/if}
    <div class="space-y-2">
      <label for="password" class="block text-sm text-gray-300">Neues Passwort</label>
      <div class="relative">
        <input id="password" type={showPassword ? 'text' : 'password'} bind:value={password} required minlength="12" maxlength="128"
          autocomplete="new-password" class="w-full rounded-lg border border-surface-600 bg-surface-700 py-3 pl-4 pr-24 text-white" />
        <button type="button" onclick={() => showPassword = !showPassword}
          class="absolute inset-y-0 right-1 min-w-20 rounded-lg px-3 text-sm text-gray-300">{showPassword ? 'Ausblenden' : 'Anzeigen'}</button>
      </div>
    </div>
    <div class="space-y-2">
      <label for="confirmation" class="block text-sm text-gray-300">Passwort bestätigen</label>
      <input id="confirmation" type={showPassword ? 'text' : 'password'} bind:value={confirmation} required minlength="12" maxlength="128"
        autocomplete="new-password" class="w-full rounded-lg border border-surface-600 bg-surface-700 px-4 py-3 text-white" />
    </div>
    <button type="submit" disabled={loading || !token}
      class="min-h-12 w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-500 disabled:opacity-50">
      {loading ? 'Wird geändert...' : 'Passwort ändern'}
    </button>
    <a href="/login" class="block min-h-11 py-3 text-center text-sm text-gray-300 hover:text-white">Zur Anmeldung</a>
  </form>
</div>
