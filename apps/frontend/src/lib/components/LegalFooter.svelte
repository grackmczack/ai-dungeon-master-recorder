<script lang="ts">
  import { openConsentSettings } from '$lib/consent.js';
</script>

<footer class="border-t border-white/10 bg-[#08080e]">
  <div class="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
    <div>
      <a href="/" class="inline-flex items-center gap-2 font-semibold text-white"><img src="/logo-d20.svg" width="28" height="28" alt="" aria-hidden="true" /> DnD Recorder</a>
      <p class="mt-2 max-w-2xl text-xs leading-5 text-gray-400">Nicht kommerzielles Privatprojekt für Online-Rollenspielrunden. Dungeons &amp; Dragons und D&amp;D sind Marken ihrer jeweiligen Rechteinhaber; es besteht keine offizielle Verbindung.</p>
    </div>
    <nav aria-label="Rechtliche Fußnavigation" class="flex flex-wrap gap-x-5 gap-y-3 text-sm text-gray-300">
      <a href="/docs" class="hover:text-white">Dokumentation</a>
      <a href="/impressum" class="hover:text-white">Impressum</a>
      <a href="/datenschutz" class="hover:text-white">Datenschutz</a>
      <button type="button" onclick={openConsentSettings} class="text-left hover:text-white">Cookie-Einstellungen</button>
    </nav>
  </div>
</footer>
