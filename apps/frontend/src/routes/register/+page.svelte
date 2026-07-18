<script lang="ts">
  import { tick } from 'svelte';
  import { api } from '$lib/api.js';
  import BrandHeader from '$lib/components/BrandHeader.svelte';

  let email = $state('');
  let password = $state('');
  let passwordConfirmation = $state('');
  let displayName = $state('');
  let showPassword = $state(false);
  let error = $state('');
  let loading = $state(false);
  let registeredEmail = $state('');
  let resendStatus = $state('');
  let resending = $state(false);
  let errorElement = $state<HTMLDivElement>();

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
      const result = await api.register(email, password, displayName);
      registeredEmail = result.email;
      password = '';
      passwordConfirmation = '';
    } catch (e: any) {
      error = typeof e.error === 'string' ? e.error : 'Registrierung fehlgeschlagen';
      await tick();
      errorElement?.focus();
    } finally {
      loading = false;
    }
  }

  async function resendVerification() {
    resending = true;
    resendStatus = '';
    try {
      const result = await api.resendVerification(registeredEmail);
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

<svelte:head><title>Registrieren — DnD Recorder</title></svelte:head>

<div class="min-h-screen flex items-center justify-center bg-surface-900 p-4 py-10">
  <div class="w-full max-w-md">
    <BrandHeader subtitle="Konto erstellen" />

    {#if registeredEmail}
      <section class="bg-surface-800 rounded-2xl p-6 sm:p-8 border border-surface-600 shadow-xl space-y-5 text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15 text-2xl" aria-hidden="true">✉️</div>
        <div class="space-y-2">
          <h2 class="text-xl font-semibold text-white">Schau in dein Postfach</h2>
          <p class="text-sm leading-6 text-gray-300">
            Wir haben einen Bestätigungslink an <strong class="text-white">{registeredEmail}</strong> gesendet.
            Öffne ihn innerhalb von 24 Stunden, um dein Konto zu aktivieren.
          </p>
        </div>

        <div class="rounded-lg border border-surface-600 bg-surface-700/60 px-4 py-3 text-left text-sm text-gray-300">
          Keine Mail zu sehen? Prüfe bitte auch deinen Spam-Ordner oder fordere einen neuen Link an.
        </div>

        {#if resendStatus}
          <div role="status" class="rounded-lg border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-200">
            {resendStatus}
          </div>
        {/if}

        <button type="button" onclick={resendVerification} disabled={resending}
          class="w-full min-h-12 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition">
          {resending ? 'Wird gesendet...' : 'Bestätigungsmail erneut senden'}
        </button>

        <div class="flex flex-col gap-2 text-sm">
          <a href="/login" class="text-brand-400 hover:underline">Zur Anmeldung</a>
          <button type="button" onclick={() => { registeredEmail = ''; resendStatus = ''; }}
            class="text-gray-400 hover:text-white hover:underline">Andere E-Mail-Adresse verwenden</button>
        </div>
      </section>
    {:else}
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
    {/if}
  </div>
</div>
