<script lang="ts">
  import { tick } from 'svelte';
  import {
    closeConsentSettings,
    consentSettingsOpen,
    consentStatus,
    saveConsentDecision
  } from '$lib/consent.js';
  import {
    deleteAnalyticsCookies,
    queueAnalyticsRevocation,
    resetPageTracking,
    setAnalyticsConsent,
    syncAnalyticsConsentToBackend,
    trackPage
  } from '$lib/analytics.js';

  let analyticsSelection = $state(false);
  let dialog = $state<HTMLDivElement>();
  let previousFocus: HTMLElement | null = null;
  const showBanner = $derived($consentStatus === 'UNKNOWN' && !$consentSettingsOpen);

  $effect(() => {
    if ($consentSettingsOpen) {
      analyticsSelection = $consentStatus === 'ANALYTICS_GRANTED';
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      tick().then(() => dialog?.focus());
    } else if (previousFocus) {
      previousFocus.focus();
      previousFocus = null;
    }
  });

  async function decide(analytics: boolean, source: 'BANNER' | 'SETTINGS') {
    const wasGranted = $consentStatus === 'ANALYTICS_GRANTED';
    if (!analytics) queueAnalyticsRevocation();
    saveConsentDecision(analytics, source);
    await setAnalyticsConsent(analytics, source);
    await syncAnalyticsConsentToBackend(analytics);
    if (analytics) {
      resetPageTracking();
      trackPage(window.location.pathname);
    } else {
      deleteAnalyticsCookies();
      if (wasGranted) window.location.reload();
    }
  }

  function handleDialogKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') closeConsentSettings();
    if (event.key !== 'Tab' || !dialog) return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((element) => !element.hasAttribute('hidden'));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

{#if showBanner}
  <section aria-label="Datenschutzeinstellungen" class="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-5xl rounded-2xl border border-brand-500/35 bg-surface-800/98 p-5 shadow-2xl shadow-black/50 backdrop-blur sm:inset-x-6 sm:p-6">
    <div class="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <p class="text-xs font-bold uppercase tracking-[.16em] text-violet-300">Deine Entscheidung</p>
        <h2 class="mt-1 text-lg font-semibold text-white">Darf der Chronist die Nutzung pseudonym messen?</h2>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-300">
          Notwendige Funktionen laufen immer. Optionale Reichweiten- und Journey-Messung mit Google Analytics startet erst nach deiner Zustimmung. Eine Ablehnung hat keine Nachteile für die App.
          <a href="/datenschutz#analyse" class="text-brand-300 underline hover:text-white">Details im Datenschutz</a>.
        </p>
      </div>
      <div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <button type="button" onclick={() => decide(false, 'BANNER')} class="min-h-12 rounded-lg border border-brand-500 bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-500">Nur notwendige</button>
        <button type="button" onclick={() => consentSettingsOpen.set(true)} class="min-h-12 rounded-lg border border-surface-500 bg-surface-700 px-4 py-3 text-sm font-semibold text-white hover:border-brand-400">Einstellungen</button>
        <button type="button" onclick={() => decide(true, 'BANNER')} class="min-h-12 rounded-lg border border-brand-500 bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-500">Alle akzeptieren</button>
      </div>
    </div>
    <nav aria-label="Rechtliche Hinweise im Consent-Banner" class="mt-4 flex gap-4 text-xs text-gray-400">
      <a href="/datenschutz" class="hover:text-white">Datenschutz</a>
      <a href="/impressum" class="hover:text-white">Impressum</a>
    </nav>
  </section>
{/if}

{#if $consentSettingsOpen}
  <div class="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4" role="presentation" onclick={(event) => { if (event.currentTarget === event.target) closeConsentSettings(); }}>
    <div bind:this={dialog} tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="consent-dialog-title" onkeydown={handleDialogKeydown} class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-surface-600 bg-surface-800 shadow-2xl">
      <header class="flex items-start justify-between gap-4 border-b border-surface-600 p-5 sm:p-6">
        <div>
          <p class="text-xs font-bold uppercase tracking-[.16em] text-violet-300">Cookie-Einstellungen</p>
          <h2 id="consent-dialog-title" class="mt-1 text-xl font-semibold text-white">Du bestimmst, was der Chronist notiert</h2>
        </div>
        <button type="button" onclick={closeConsentSettings} aria-label="Cookie-Einstellungen schließen" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl text-gray-400 hover:bg-surface-700 hover:text-white">×</button>
      </header>

      <div class="space-y-4 p-5 sm:p-6">
        <section class="rounded-xl border border-surface-600 bg-surface-700/50 p-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="font-semibold text-white">Notwendig</h3>
              <p class="mt-1 text-sm leading-6 text-gray-300">Anmeldung, Sicherheit und deine Consent-Präferenz. Diese Funktionen sind für den Betrieb erforderlich.</p>
              <p class="mt-2 text-xs text-gray-400"><code>dnd_session</code>: bis zu 7 Tage · <code>dnd_consent</code>: bis zu 6 Monate</p>
            </div>
            <span class="rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">Immer aktiv</span>
          </div>
        </section>

        <section class="rounded-xl border border-surface-600 bg-surface-700/50 p-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <label for="analytics-consent" class="font-semibold text-white">Analyse</label>
              <p class="mt-1 text-sm leading-6 text-gray-300">Google Analytics 4 über Web- und serverseitigen Google Tag Manager für Reichweite, Registrierungsconversion, Einrichtungsabbrüche und Produktverbesserung.</p>
              <p class="mt-2 text-xs leading-5 text-gray-400">Optionale lokale Client-ID und <code>_ga*</code>-Cookies mit einer von uns auf bis zu 6 Monate begrenzten Laufzeit; bei Widerruf oder Ablauf werden sie soweit technisch erreichbar gelöscht. Keine Formwerte, Namen, E-Mails, fachlichen IDs, Transkripte oder URL-Parameter. Möglicher USA-Bezug; Einzelheiten in der <a href="/datenschutz#analyse" class="text-brand-300 underline hover:text-white">Datenschutzerklärung</a>.</p>
            </div>
            <input id="analytics-consent" type="checkbox" bind:checked={analyticsSelection} class="mt-1 h-6 w-6 shrink-0 accent-brand-500" />
          </div>
        </section>

        <section class="rounded-xl border border-surface-600 bg-surface-700/30 p-4 opacity-80">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="font-semibold text-white">Marketing</h3>
              <p class="mt-1 text-sm leading-6 text-gray-300">Es werden keine Marketing- oder personalisierten Werbetracker eingesetzt.</p>
            </div>
            <span class="rounded-full bg-surface-600 px-3 py-1 text-xs font-semibold text-gray-300">Deaktiviert</span>
          </div>
        </section>

        <div class="grid gap-2 sm:grid-cols-2">
          <button type="button" onclick={() => decide(false, 'SETTINGS')} class="min-h-12 rounded-lg border border-brand-500 bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-500">Nur notwendige</button>
          <button type="button" onclick={() => decide(analyticsSelection, 'SETTINGS')} class="min-h-12 rounded-lg border border-brand-500 bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-500">Auswahl speichern</button>
        </div>
        <p class="text-center text-xs text-gray-400">Du kannst deine Auswahl jederzeit im Seitenfuß ändern.</p>
      </div>
    </div>
  </div>
{/if}
