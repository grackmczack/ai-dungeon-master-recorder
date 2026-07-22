<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { tick } from 'svelte';
  import { api } from '$lib/api.js';
  import BrandHeader from '$lib/components/BrandHeader.svelte';
  import { track, trackingErrorCode } from '$lib/analytics.js';

  let email = $state('');
  let password = $state('');
  let passwordConfirmation = $state('');
  let displayName = $state('');
  let showPassword = $state(false);
  let error = $state('');
  let loading = $state(false);
  let errorElement = $state<HTMLDivElement>();
  let registrationStarted = false;

  onMount(() => {
    track('registration_view', {
      page_type: 'auth',
      journey_stage: 'registration',
      feature_name: 'registration',
      method: 'web'
    });
  });

  function startRegistration() {
    if (registrationStarted) return;
    registrationStarted = true;
    track('registration_start', {
      page_type: 'auth',
      journey_stage: 'registration',
      feature_name: 'registration',
      method: 'web'
    });
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
      const result = await api.register(email, password, displayName);
      track('sign_up', {
        page_type: 'auth',
        journey_stage: 'registration',
        feature_name: 'registration',
        method: 'web',
        result: 'success'
      });
      sessionStorage.setItem('registrationEmail', result.email);
      password = '';
      passwordConfirmation = '';
      await goto('/registration-pending?stage=email');
    } catch (e: any) {
      track('sign_up_error', {
        page_type: 'auth',
        journey_stage: 'registration',
        feature_name: 'registration',
        method: 'web',
        result: 'failure',
        error_code: trackingErrorCode(e)
      });
      error = typeof e.error === 'string' ? e.error : 'Registrierung fehlgeschlagen';
      await tick();
      errorElement?.focus();
    } finally {
      loading = false;
    }
  }

</script>

<svelte:head><title>Registrieren — DnD Recorder</title></svelte:head>

<div class="min-h-screen flex items-center justify-center bg-surface-900 p-4 py-10">
  <div class="w-full max-w-md">
    <BrandHeader subtitle="Konto erstellen" />

    <form onsubmit={register} oninput={startRegistration} class="bg-surface-800 rounded-2xl p-6 sm:p-8 border border-surface-600 shadow-xl space-y-5">
        <h2 class="text-xl font-semibold text-white">Registrieren</h2>

        <aside class="rounded-xl border border-brand-500/30 bg-brand-500/10 p-4" aria-labelledby="beta-notice-title">
          <div class="flex gap-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-lg" aria-hidden="true">⚗</span>
            <div>
              <h3 id="beta-notice-title" class="font-semibold text-violet-100">Beta-Zugang mit persönlicher Freigabe</h3>
              <p class="mt-1 text-sm leading-6 text-gray-300">
                Nach der E-Mail-Bestätigung prüft der Obere Artificer jeden neuen Account und schaltet ihn manuell frei. Sobald dein Platz am Spieltisch bereit ist, erhältst du eine Nachricht.
              </p>
            </div>
          </div>
        </aside>

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

        <p class="text-xs leading-5 text-gray-400">
          Mit dem Erstellen des Kontos werden deine Angaben zur Bereitstellung des Beta-Zugangs verarbeitet. Optionale Analyse ist davon unabhängig und kann im Consent-Banner abgelehnt werden. Mehr dazu in der <a href="/datenschutz#registrierung" class="text-brand-300 underline hover:text-white">Datenschutzerklärung</a>.
        </p>

        <p class="text-center text-sm text-gray-400">
          Bereits registriert? <a href="/login" class="text-brand-400 hover:underline">Anmelden</a>
        </p>
    </form>
  </div>
</div>
