<script lang="ts">
  import { auth } from '$lib/auth.js';
  import { api } from '$lib/api.js';
  import { toast } from '$lib/toast.js';

  const { user } = auth;
  let displayName = $state('');
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmation = $state('');
  let showPasswords = $state(false);
  let savingProfile = $state(false);
  let savingPassword = $state(false);
  let profileError = $state('');
  let passwordError = $state('');

  $effect(() => {
    if ($user && !displayName) displayName = $user.displayName;
  });

  async function saveProfile(e: Event) {
    e.preventDefault(); savingProfile = true; profileError = '';
    try {
      const { user } = await api.updateProfile(displayName);
      auth.setAuth(user);
      toast.success('Profil wurde gespeichert');
    } catch (e: any) { profileError = typeof e.error === 'string' ? e.error : 'Profil konnte nicht gespeichert werden'; }
    finally { savingProfile = false; }
  }

  async function savePassword(e: Event) {
    e.preventDefault(); passwordError = '';
    if (newPassword !== confirmation) { passwordError = 'Die neuen Passwörter stimmen nicht überein'; return; }
    savingPassword = true;
    try {
      await api.changePassword(currentPassword, newPassword);
      currentPassword = ''; newPassword = ''; confirmation = '';
      toast.success('Passwort wurde geändert; andere Sitzungen wurden abgemeldet');
    } catch (e: any) { passwordError = typeof e.error === 'string' ? e.error : 'Passwort konnte nicht geändert werden'; }
    finally { savingPassword = false; }
  }
</script>

<svelte:head><title>Konto — DM Recorder</title></svelte:head>

<div class="mx-auto max-w-2xl px-4 py-10 sm:px-6">
  <a href="/dashboard" class="mb-6 inline-flex min-h-11 items-center text-sm text-gray-300 hover:text-white">← Dashboard</a>
  <h1 class="text-3xl font-bold text-white">Konto</h1>
  <p class="mt-1 text-gray-300">Profil und Zugangsdaten verwalten</p>

  <div class="mt-8 space-y-8">
    <form onsubmit={saveProfile} class="space-y-5 rounded-2xl border border-surface-600 bg-surface-800 p-6">
      <h2 class="text-lg font-semibold text-white">Profil</h2>
      {#if profileError}<div role="alert" class="text-sm text-red-300">{profileError}</div>{/if}
      <div class="space-y-2"><label for="account-email" class="text-sm text-gray-300">E-Mail</label>
        <input id="account-email" value={$user?.email ?? ''} disabled class="w-full rounded-lg border border-surface-600 bg-surface-900 px-4 py-3 text-gray-300" /></div>
      <div class="space-y-2"><label for="display-name" class="text-sm text-gray-300">Anzeigename</label>
        <input id="display-name" bind:value={displayName} required maxlength="80" autocomplete="name"
          class="w-full rounded-lg border border-surface-600 bg-surface-700 px-4 py-3 text-white" /></div>
      <button type="submit" disabled={savingProfile} class="min-h-11 rounded-lg bg-brand-600 px-5 py-2 text-white hover:bg-brand-500 disabled:opacity-50">{savingProfile ? 'Speichere...' : 'Profil speichern'}</button>
    </form>

    <form onsubmit={savePassword} class="space-y-5 rounded-2xl border border-surface-600 bg-surface-800 p-6">
      <div class="flex items-center justify-between gap-4"><h2 class="text-lg font-semibold text-white">Passwort ändern</h2>
        <button type="button" onclick={() => showPasswords = !showPasswords} class="min-h-10 rounded-lg px-3 text-sm text-gray-300 hover:text-white">{showPasswords ? 'Ausblenden' : 'Anzeigen'}</button></div>
      {#if passwordError}<div role="alert" class="text-sm text-red-300">{passwordError}</div>{/if}
      <div class="space-y-2"><label for="current-password" class="text-sm text-gray-300">Aktuelles Passwort</label>
        <input id="current-password" type={showPasswords ? 'text' : 'password'} bind:value={currentPassword} required autocomplete="current-password"
          class="w-full rounded-lg border border-surface-600 bg-surface-700 px-4 py-3 text-white" /></div>
      <div class="space-y-2"><label for="new-password" class="text-sm text-gray-300">Neues Passwort</label>
        <input id="new-password" type={showPasswords ? 'text' : 'password'} bind:value={newPassword} required minlength="12" maxlength="128" autocomplete="new-password"
          class="w-full rounded-lg border border-surface-600 bg-surface-700 px-4 py-3 text-white" /></div>
      <div class="space-y-2"><label for="new-password-confirmation" class="text-sm text-gray-300">Neues Passwort bestätigen</label>
        <input id="new-password-confirmation" type={showPasswords ? 'text' : 'password'} bind:value={confirmation} required minlength="12" maxlength="128" autocomplete="new-password"
          class="w-full rounded-lg border border-surface-600 bg-surface-700 px-4 py-3 text-white" /></div>
      <button type="submit" disabled={savingPassword} class="min-h-11 rounded-lg bg-brand-600 px-5 py-2 text-white hover:bg-brand-500 disabled:opacity-50">{savingPassword ? 'Ändere...' : 'Passwort ändern'}</button>
    </form>
  </div>
</div>
