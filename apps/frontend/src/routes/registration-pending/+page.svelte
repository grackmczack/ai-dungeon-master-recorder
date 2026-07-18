<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api.js';
  import BrandHeader from '$lib/components/BrandHeader.svelte';

  let email = $state('');
  let resendStatus = $state('');
  let resending = $state(false);
  const approvalPending = $derived($page.url.searchParams.get('stage') === 'approval');

  onMount(() => {
    email = sessionStorage.getItem('registrationEmail') ?? '';
  });

  async function resendVerification(e: Event) {
    e.preventDefault();
    if (!email) return;
    resending = true;
    resendStatus = '';
    try {
      sessionStorage.setItem('registrationEmail', email);
      const result = await api.resendVerification(email);
      resendStatus = result.message;
    } catch (error: any) {
      resendStatus = typeof error.error === 'string'
        ? error.error
        : 'Die Bestätigungsmail konnte nicht erneut angefordert werden.';
    } finally {
      resending = false;
    }
  }
</script>

<svelte:head>
  <title>Beta-Zugang wird vorbereitet — DnD Recorder</title>
  <meta name="description" content="Status deines DnD-Recorder-Beta-Zugangs: E-Mail bestätigen und auf die persönliche Freigabe warten." />
</svelte:head>

<div class="min-h-screen bg-surface-900 px-4 py-10 sm:py-16">
  <main class="mx-auto w-full max-w-2xl">
    <BrandHeader subtitle="Der Wartesaal zum Spieltisch" />

    <section class="overflow-hidden rounded-2xl border border-surface-600 bg-surface-800 shadow-2xl shadow-black/20">
      <div class="border-b border-surface-600 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,.2),transparent_45%)] px-6 py-8 text-center sm:px-10">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-500/30 bg-brand-500/10 text-3xl shadow-lg shadow-violet-950/30" aria-hidden="true">
          {approvalPending ? '⌛' : '✉'}
        </div>
        <p class="mt-5 text-xs font-bold uppercase tracking-[.18em] text-violet-300">Beta-Aufnahmeverfahren</p>
        <h1 class="mt-2 text-2xl font-bold text-white sm:text-3xl">
          {approvalPending ? 'Dein Platz wird vorbereitet' : 'Bestätige zuerst dein magisches Siegel'}
        </h1>
        <p role="status" class="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-300 sm:text-base">
          {#if approvalPending}
            Deine E-Mail ist bestätigt. Nun prüft der Obere Artificer deinen Account und öffnet dir persönlich das Tor zur Beta.
          {:else}
            Dein Account wurde angelegt. Öffne den Bestätigungslink in deiner E-Mail; danach beginnt die manuelle Freigabe durch den Oberen Artificer.
          {/if}
        </p>
      </div>

      <div class="space-y-6 p-6 sm:p-10">
        <ol class="grid gap-3 sm:grid-cols-2" aria-label="Schritte zur Accountfreigabe">
          <li class="rounded-xl border p-4 {approvalPending ? 'border-green-500/30 bg-green-500/[.07]' : 'border-brand-500/40 bg-brand-500/10'}">
            <div class="flex items-start gap-3">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {approvalPending ? 'bg-green-500/15 text-green-300' : 'bg-brand-500/20 text-violet-200'}" aria-hidden="true">
                {approvalPending ? '✓' : '1'}
              </span>
              <div>
                <h2 class="font-semibold text-white">E-Mail bestätigen</h2>
                <p class="mt-1 text-sm leading-5 text-gray-400">{approvalPending ? 'Siegel erfolgreich bestätigt.' : 'Link innerhalb von 24 Stunden öffnen.'}</p>
              </div>
            </div>
          </li>
          <li class="rounded-xl border p-4 {approvalPending ? 'border-brand-500/40 bg-brand-500/10' : 'border-surface-600 bg-surface-700/40'}">
            <div class="flex items-start gap-3">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {approvalPending ? 'bg-brand-500/20 text-violet-200' : 'bg-surface-600 text-gray-400'}" aria-hidden="true">2</span>
              <div>
                <h2 class="font-semibold text-white">Beta-Freigabe</h2>
                <p class="mt-1 text-sm leading-5 text-gray-400">{approvalPending ? 'Prüfung durch den Oberen Artificer läuft.' : 'Beginnt nach deiner Bestätigung.'}</p>
              </div>
            </div>
          </li>
        </ol>

        {#if approvalPending}
          <div class="rounded-xl border border-amber-500/25 bg-amber-500/[.06] p-4 text-sm leading-6 text-amber-100">
            <strong class="text-amber-200">Du musst nichts weiter würfeln.</strong>
            Sobald dein Zugang freigeschaltet ist, erhältst du eine E-Mail und kannst dich direkt anmelden.
          </div>
          <a href="/login" class="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-surface-600 bg-surface-700 px-4 py-3 font-semibold text-white transition hover:border-brand-500/40 hover:bg-surface-600">
            Zur Anmeldung
          </a>
        {:else}
          <form onsubmit={resendVerification} class="space-y-4">
            <div class="space-y-2 text-left">
              <label for="pending-email" class="block text-sm text-gray-300">E-Mail-Adresse für einen neuen Bestätigungslink</label>
              <input id="pending-email" name="email" type="email" bind:value={email} required autocomplete="email"
                class="w-full rounded-lg border border-surface-600 bg-surface-700 px-4 py-3 text-white placeholder-gray-600"
                placeholder="dm@example.com" />
            </div>
            <button type="submit" disabled={resending}
              class="min-h-12 w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50">
              {resending ? 'Botschaft wird gesendet...' : 'Bestätigungslink erneut senden'}
            </button>
          </form>

          {#if resendStatus}
            <div role="status" class="rounded-lg border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm leading-6 text-violet-100">
              {resendStatus}
            </div>
          {/if}

          <p class="text-center text-sm text-gray-500">Prüfe bitte auch deinen Spam-Ordner.</p>
        {/if}
      </div>
    </section>
  </main>
</div>
