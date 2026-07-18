<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  let activeSection = $state('basics');
  let discordInviteUrl = $state('');

  onMount(() => {
    api.getDiscordConfig()
      .then((config) => { discordInviteUrl = config.inviteUrl ?? ''; })
      .catch(() => { discordInviteUrl = ''; });
  });
</script>

<svelte:head>
  <title>Dokumentation — DnD Recorder</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
  <h1 class="text-3xl font-bold text-white mb-4">📖 Dokumentation</h1>
  <p class="text-gray-400 mb-2">Alles über den DnD Recorder Bot — vom Start bis zur epischen Zusammenfassung</p>
  <div class="flex flex-wrap items-center gap-4 mb-10">
    <p class="text-sm text-gray-600">Wähle ein Thema aus der Sidebar oder dem Dropdown-Menü (mobil). Bei Fragen hilft dir der FAQ-Bereich weiter.</p>
    {#if discordInviteUrl}
      <div class="flex flex-col items-start">
        <a href={discordInviteUrl} target="_blank" rel="noreferrer"
          class="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 transition">
          🤖 Bot zu Discord hinzufügen
        </a>
        <span class="mt-1 text-xs text-gray-600">Danach als Server-Admin <code>/status</code> ausführen</span>
      </div>
    {/if}
  </div>

  <div class="flex flex-col lg:flex-row gap-6 lg:gap-12 lg:border-l border-surface-600">
    <!-- Sidebar -->
    <nav class="w-64 shrink-0 hidden lg:block">
      <div class="bg-surface-800 rounded-xl border border-surface-600 p-4 sticky top-24 space-y-0.5">
        <h3 class="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold px-2">Inhalt</h3>
        {#each sections as section}
          <button
            onclick={() => activeSection = section.id}
            class="w-full text-left px-3 py-2 rounded-lg text-sm transition {activeSection === section.id ? 'bg-brand-600/20 text-brand-400 font-medium' : 'text-gray-400 hover:text-white hover:bg-surface-700'}">
            {section.emoji} {section.title}
          </button>
        {/each}
      </div>
    </nav>

    <!-- Mobile section selector -->
    <div class="lg:hidden w-full mb-6">
      <label for="docs-section" class="sr-only">Dokumentationsabschnitt</label>
      <select id="docs-section" bind:value={activeSection}
        class="w-full bg-surface-800 border border-surface-600 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500">
        {#each sections as section}
          <option value={section.id}>{section.title}</option>
        {/each}
      </select>
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      {#each sections.filter(s => s.id === activeSection) as section}
        <div class="prose prose-invert max-w-none">
          <h2 class="!text-2xl !font-bold !text-white !mb-2 !mt-8">{section.emoji} {section.title}</h2>
          <div class="bg-surface-800 rounded-2xl border border-surface-600 p-5 sm:p-10 space-y-6 text-gray-200 leading-relaxed">
            {@html section.content}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<script lang="ts" module>
  const sections = [
    {
      id: 'basics',
      emoji: '🚀',
      title: 'Erste Schritte',
      content: `
<h3>Willkommen bei deinem D&D Aufnahmesystem!</h3>
<p>Dieser Bot nimmt deine D&D-Sessions automatisch auf, transkribiert sie mit KI und erstellt epische Zusammenfassungen — alles in einem schicken Web-Panel.</p>

<h3>In wenigen Minuten startklar</h3>
<ol>
  <li><strong>Account erstellen:</strong> Registriere dich im Web-Panel unter <code>/register</code> und bestätige deine E-Mail über den 24 Stunden gültigen Einmal-Link. Anschließend erhältst du eine Aktivierungsbestätigung.</li>
  <li><strong>Kampagne erstellen:</strong> Lege deine Kampagne im Web-Panel an. Eine Discord-Server-ID musst du nicht eintragen.</li>
  <li><strong>Bot einladen:</strong> Lade den Bot über den Einladungslink in deinen Discord-Server ein.</li>
  <li><strong>Server verbinden:</strong> Führe als Server-Admin <code>/status</code> aus, öffne den privaten Verbindungslink und wähle deine Web-Kampagne aus.</li>
  <li><strong>Kanäle zuordnen:</strong> Verknüpfe mit <code>/kampagne verbinden</code> die Kampagne mit einem Voice-Channel und dem gewünschten Summary-Channel.</li>
  <li><strong>Einstellungen konfigurieren:</strong> Trage deine API-Keys für Transkription (Replicate) und Zusammenfassung (Anthropic/Gemini/OpenAI/SiliconFlow/Ollama) ein.</li>
  <li><strong>Los geht's:</strong> Nutze <code>/record</code> im zugeordneten Voice-Channel. Bei einer mehrdeutigen Zuordnung kannst du die Kampagne direkt auswählen.</li>
</ol>`
    },
    {
      id: 'bot',
      emoji: '🤖',
      title: 'Der Bot — Befehle & Funktionen',
      content: `
<h3>Bot einladen</h3>
<p>Dein DM kann den Bot über den Discord OAuth2-Flow in den Server einladen. Der Bot braucht folgende Berechtigungen:</p>
<ul>
  <li>✅ Voice-Channel betreten & sprechen</li>
  <li>✅ Nachrichten senden</li>
  <li>✅ Slash-Commands nutzen</li>
</ul>
<p>Nach dem Einladen als Server-Admin <code>/status</code> ausführen. Ist der Server noch nicht zugeordnet, erscheint ausschließlich für den Admin ein 15 Minuten gültiger Einmal-Link. Nach der Zuordnung zeigt das Web-Panel ein grünes Statuslicht und den erkannten Discord-Servernamen. Ein Account kann mehrere Server verbinden.</p>

<h3>Bot-Befehle</h3>
<div class="overflow-x-auto">
<table>
  <thead><tr><th>Befehl</th><th>Beschreibung</th></tr></thead>
  <tbody>
    <tr><td><code>/record [kampagne]</code></td><td>Startet die Aufnahme im aktuellen Voice-Channel. Die optionale Auswahl löst mehrdeutige Zuordnungen auf.</td></tr>
    <tr><td><code>/stop</code></td><td>Stoppt die Aufnahme, konvertiert das Audio zu MP3 und startet die Transkription.</td></tr>
    <tr><td><code>/status</code></td><td>Zeigt Aufnahme, verbundene Kampagnen und Kanalzuordnungen. Bei Bedarf erscheint ein privater Web-Link zur Server-Verknüpfung.</td></tr>
    <tr><td><code>/kampagne verbinden</code></td><td>Ordnet eine Kampagne einem Voice-Channel und optional einem festen Summary-Channel zu.</td></tr>
    <tr><td><code>/kampagne aktivieren</code></td><td>Aktiviert eine Kampagne als mögliche Aufnahmezuordnung auf diesem Server.</td></tr>
    <tr><td><code>/kampagne deaktivieren</code></td><td>Deaktiviert die Kampagne für neue Aufnahmen, ohne Daten zu löschen.</td></tr>
    <tr><td><code>/kampagne status</code></td><td>Listet alle Kampagnen- und Kanalzuordnungen des Servers.</td></tr>
    <tr><td><code>/summary-channel set</code></td><td>Legt den Summary-Channel für die ausgewählte Kampagne fest.</td></tr>
    <tr><td><code>/summary-channel status</code></td><td>Zeigt den Summary-Channel der ausgewählten Kampagne.</td></tr>
    <tr><td><code>/summary-channel clear</code></td><td>Entfernt den festen Summary-Channel dieser Kampagne; danach wird der Startkanal verwendet.</td></tr>
  </tbody>
</table>
</div>

<h3>Was postet der Bot wann?</h3>
<ul>
  <li>📢 <strong>Aufnahme gestartet:</strong> "Recording started by @DM — Session #1 live!"</li>
  <li>🤫 <strong>Auto-Stop:</strong> "Alle Spieler haben den Channel verlassen — Aufnahme nach 30s gestoppt."</li>
  <li>🧠 <strong>Summary fertig:</strong> Rich Embed mit Titel, Chronik, NSCs, Quests, Beute, Orten und Link zum Web-Panel.</li>
</ul>`
    },
    {
      id: 'workflow',
      emoji: '🔄',
      title: 'Der Workflow — Von Aufnahme zur Summary',
      content: `
<h3>Schritt 1: Aufnahme starten</h3>
<p>Ein DM oder berechtigter Spieler gibt <code>/record</code> ein. Der Bot joint den Voice-Channel und beginnt die Aufnahme aller Teilnehmer als gemischte Mono-Spur.</p>
<p><strong>Chunked Recording:</strong> Alle 30 Minuten wird ein Part (Chunk) gespeichert. So gehen auch bei stundenlangen Sessions keine Daten verloren.</p>

<h3>Schritt 2: Transkription</h3>
<p>Nach <code>/stop</code> werden die MP3-Chunks in die Job-Queue (BullMQ/Redis) geschoben. Der Transcriber-Worker verarbeitet sie mit:</p>
<ul>
  <li><strong>WhisperX</strong> (via Replicate) — beste Qualität, erkennt verschiedene Sprecher (SPEAKER_00, SPEAKER_01...)</li>
  <li><strong>OpenAI Whisper</strong> — schnell, aber ohne Sprecher-Trennung</li>
  <li>Chunks werden zusammengeführt, Zeitstempel korrigiert</li>
</ul>

<h3>Schritt 3: Summary & Titel generieren</h3>
<p>Ein LLM (Anthropic/Gemini/OpenAI/SiliconFlow/Ollama) bekommt das volle Transkript + deinen Kampagnen-Kontext + System-Prompt und generiert:</p>
<ul>
  <li>📖 <strong>Narrative Chronik:</strong> Die Session als epische Geschichte</li>
  <li>🧙 <strong>NSCs:</strong> Alle erwähnten NPCs mit Beschreibung</li>
  <li>⚔️ <strong>Quests:</strong> Neue, laufende und abgeschlossene Quests</li>
  <li>💰 <strong>Beute:</strong> Wer hat was gefunden</li>
  <li>🗺️ <strong>Orte:</strong> Besuchte Locations</li>
  <li>🔮 <strong>Offene Fäden:</strong> Ungelöste Handlungsstränge</li>
  <li>🎨 <strong>Session-Bild-Prompt:</strong> Automatisch generierter Prompt für das Session-Headerbild</li>
</ul>

<h3>Schritt 4: Sprecher zuordnen</h3>
<p>Öffne die Session im Web-Panel → Tab "Sprecher". Dort siehst du jeden anonymen Sprecher (SPEAKER_00...) mit einem Text-Ausschnitt aus dem Transkript. Ordne jedem Label einen Discord-User, Charakternamen und Spielernamen zu.</p>

<h3>Schritt 5: Im Discord posten</h3>
<p>Der Bot postet automatisch eine Zusammenfassung mit Link zum Web-Panel in den Discord-Channel. Optional auch als strukturierte Einzelnachrichten für NSCs, Quests etc.</p>`
    },
    {
      id: 'campaigns',
      emoji: '🗺️',
      title: 'Kampagnen & Sessions',
      content: `
<h3>Kampagnen anlegen & verwalten</h3>
<p>Im Dashboard findest du direkt deine Kampagnen. Ein DM kann mehrere Kampagnen auf demselben oder auf verschiedenen Discord-Servern verwalten. Jede Kampagne enthält:</p>
<ul>
  <li><strong>Name & Beschreibung:</strong> Titel und Setting deiner Kampagne.</li>
  <li><strong>Kampagnen-Kontext:</strong> Hintergrundwissen für das LLM — wird bei jeder Summary mitgegeben.</li>
  <li><strong>Mitglieder:</strong> Spieler und Charaktere, die in dieser Kampagne teilnehmen.</li>
  <li><strong>Server-Zuordnungen:</strong> Discord-Server, Voice-Channel und Summary-Channel der Kampagne.</li>
  <li><strong>Hintergrundbild:</strong> Ein generiertes oder hochgeladenes Bild im übersichtlichen 4:3-Format.</li>
  <li><strong>Sessions:</strong> Alle Aufnahme-Sessions dieser Kampagne, chronologisch sortiert. Sessions entstehen ausschließlich durch eine Bot-Aufnahme und können nicht manuell hinzugefügt werden.</li>
</ul>

<h3>Mehrere Kampagnen und Server</h3>
<p>Eine Kampagne kann mit einem oder mehreren Discord-Servern verbunden werden. Auf demselben Server lassen sich mehrere Kampagnen durch unterschiedliche Voice- und Summary-Channels trennen.</p>
<p>Bei <code>/record</code> gilt: Eine ausdrücklich gewählte Kampagne hat Vorrang, danach folgt die Zuordnung des aktuellen Voice-Channels. Ist nur eine Kampagne aktiv, wird diese verwendet. Bei mehreren verbleibenden Möglichkeiten fordert der Bot eine Auswahl an und ordnet niemals stillschweigend die zuletzt angelegte Kampagne zu.</p>

<h3>Session-Detailseite</h3>
<p>Klicke auf eine Session, um die Detailansicht zu öffnen:</p>
<ul>
  <li><strong>Session-Bild:</strong> Generierbares oder hochladbares Bild im 4:3-Format. Die Generator-Einstellungen lassen sich platzsparend aufklappen.</li>
  <li><strong>Summary-Tab:</strong> Chronik, NSCs, Quests, Beute, Orte, offene Fäden + eingebetteter MP3-Player.</li>
  <li><strong>Transkript-Tab:</strong> Vollständiges Transkript mit farbcodierten Sprechern und Timestamps.</li>
  <li><strong>Sprecher-Tab:</strong> Diarization-Label-Zuordnung mit Transkript-Ausschnitten.</li>
</ul>

<h3>Session-Paginierung</h3>
<p>Pro Kampagne werden initial 10 Sessions geladen. Ein "Mehr laden"-Button lädt die nächsten 10 Sessions dynamisch nach.</p>`
    },
    {
      id: 'members',
      emoji: '👥',
      title: 'Mitglieder verwalten',
      content: `
<h3>Mitglieder anlegen (kein Login nötig)</h3>
<p>Öffne deine Kampagne → Tab "Mitglieder". Dort kannst du direkt neue Mitglieder anlegen:</p>
<ul>
  <li><strong>Discord-Name:</strong> Der Handle des Spielers auf Discord.</li>
  <li><strong>Charaktername:</strong> Name des Charakters in dieser Kampagne.</li>
  <li><strong>Rolle:</strong> Frei definierbar (z.B. Tank, Healer, Scout, DPS...).</li>
  <li><strong>Avatar:</strong> Bild-Upload für das Charakterporträt.</li>
  <li><strong>Charakterbogen:</strong> PDF-Upload für das Character Sheet.</li>
</ul>

<h3>Mitglieder verwalten</h3>
<ul>
  <li><strong>Bearbeiten:</strong> Alle Felder nachträglich änderbar.</li>
  <li><strong>Pausieren / Aktivieren:</strong> Mitglieder temporär deaktivieren ohne sie zu löschen.</li>
  <li><strong>Entfernen:</strong> Soft-Delete — das Mitglied bleibt in der Historie erhalten.</li>
</ul>

<p><em>Hinweis:</em> Ein Discord-User kann in verschiedenen Kampagnen unterschiedliche Charaktere haben. Die Zuordnung liegt pro Kampagne, nicht global.</p>`
    },
    {
      id: 'settings',
      emoji: '⚙️',
      title: 'Einstellungen & API-Keys',
      content: `
<h3>Kampagnen-Einstellungen</h3>
<p>Jede Kampagne hat eigene Einstellungen. Öffne sie über das Menü in der Kampagnen-Ansicht.</p>

<h3>LLM-Provider</h3>
<p>Wähle deinen KI-Anbieter für die Zusammenfassung:</p>
<ul>
  <li><strong>Anthropic</strong> (Claude Opus 4.8 / Sonnet 4.6) — beste narrative Qualität</li>
  <li><strong>Google Gemini</strong> (2.5 Flash / Pro) — schnell & günstig</li>
  <li><strong>OpenAI</strong> (GPT-4o) — ausgewogen</li>
  <li><strong>SiliconFlow</strong> (DeepSeek V3/R1, Qwen, Kimi, Hy3 u.v.m.) — viele Modelle, tlw. kostenlos</li>
  <li><strong>Ollama</strong> — lokale Modelle, volle Kontrolle</li>
</ul>

<h3>System-Prompt</h3>
<p>Gib dem LLM einen eigenen Prompt mit, um den Stil und Fokus der Summary zu steuern. Beispiel:</p>
<pre>Du bist Chronist einer epischen Fantasy-Kampagne. Schreibe im Stil von Tolkiens Silmarillion. Halte dich kurz aber ergreifend.</pre>

<h3>Kampagnen-Kontext</h3>
<p>Hintergrundwissen über deine Welt, das bei JEDER Summary mitgegeben wird — NPCs, Vorgeschichte, Magiesystem, politische Lage, etc.</p>

<h3>Bildgenerierung (Replicate)</h3>
<ul>
  <li><strong>Kampagnen-Hintergrundbild:</strong> Bild für die Kampagne, erscheint als seitenweiter Parallax-Hintergrund.</li>
  <li><strong>Session-Bild:</strong> Header-Kachel pro Session. Prompt wird automatisch aus der Summary generiert (Charaktere + Orte + erster Paragraf). Überschreibbar.</li>
  <li><strong>Replicate API Key:</strong> API-Key von replicate.com.</li>
  <li><strong>Modell:</strong> Standard <code>black-forest-labs/flux-schnell</code>, beliebig änderbar.</li>
</ul>

<h3>Transkription</h3>
<ul>
  <li><strong>Replicate WhisperX:</strong> Standard. API-Key von replicate.com. Erkennt verschiedene Sprecher (Diarization).</li>
  <li><strong>HuggingFace Token:</strong> Für Speaker-Diarization (pyannote-Modelle müssen auf hf.co akzeptiert sein).</li>
  <li><strong>OpenAI Whisper:</strong> Alternative, braucht OpenAI API-Key.</li>
</ul>

<h3>Vom Superadmin freigegebene Keys</h3>
<p>Ein aktiver Grant übernimmt den Key immer zusammen mit dem passenden Provider, Modell und Endpoint. In den Feldern bleiben die ersten sechs Zeichen sichtbar. Die Anzeige nennt getrennt, ob Transkription, Bildgenerierung, Zusammenfassung und HuggingFace tatsächlich freigegeben sind.</p>
<p>Wird der Grant entzogen, gelten ab der nächsten Verarbeitung oder Bildanfrage wieder die zuvor gespeicherten eigenen Kampagnen-Keys. Nicht freigegebene Key-Typen können DMs weiterhin selbst pflegen.</p>`
    },
    {
      id: 'admin',
      emoji: '🛡️',
      title: 'Administration & Accounts',
      content: `
<h3>API-Keys freigeben und entziehen</h3>
<p>Im Adminbereich unter „DMs“ schaltet „🔑 Keys“ die Freigabe für einen Account ein oder aus. Freigegeben werden nur Key-Typen, die beim Superadmin tatsächlich in den Einstellungen einer seiner Kampagnen hinterlegt sind. Die Liste am DM zeigt den verfügbaren Umfang.</p>
<ul>
  <li><strong>Freigeben:</strong> Transcriber, Zusammenfassungen und beide Bildgeneratoren nutzen das vollständige Admin-Profil.</li>
  <li><strong>Entziehen:</strong> Neue Vorgänge nutzen sofort wieder die eigenen Kampagnen-Keys; laufende externe API-Aufrufe werden nicht nachträglich abgebrochen.</li>
  <li><strong>Erneut freigeben:</strong> Ein zuvor entzogener Grant kann ohne neuen Account wieder aktiviert werden.</li>
</ul>

<h3>Account sperren oder aktivieren</h3>
<p>„Account sperren“ beendet alle bestehenden Web-Sitzungen und verhindert sofort neue Logins sowie API-Zugriffe. Daten, Kampagnen und Sessions bleiben vollständig erhalten. Über „Account aktivieren“ kann der Zugang später wieder freigeschaltet werden.</p>

<h3>E-Mail-Bestätigung bei neuen Accounts</h3>
<p>Öffentlich registrierte Accounts erscheinen bis zum Double-Opt-in mit dem Status „E-Mail offen“. Der Bestätigungslink ist 24 Stunden gültig und nur einmal nutzbar. Vom Superadmin direkt angelegte oder bearbeitete Accounts gelten als administrativ bestätigt.</p>

<h3>Account endgültig löschen</h3>
<p>Vor dem Löschen zeigt ein Sicherheitsdialog die betroffenen Kampagnen, Sessions und Aufnahmen:</p>
<ul>
  <li>Account, Passwortdaten, Grants und alle Mitgliedschaften werden gelöscht.</li>
  <li>Allein von diesem DM verwaltete Kampagnen werden samt Sessions, Aufnahmen und Uploads gelöscht.</li>
  <li>Gemeinsam genutzte Kampagnen bleiben bestehen; dort wird nur die Mitgliedschaft des gelöschten Accounts entfernt.</li>
  <li>Solange eine Session noch aufgenommen oder verarbeitet wird, ist die Löschung zum Schutz laufender Jobs gesperrt.</li>
</ul>
<p><strong>Achtung:</strong> Die endgültige Löschung kann nicht rückgängig gemacht werden.</p>`
    },
    {
      id: 'faq',
      emoji: '❓',
      title: 'Häufige Fragen',
      content: `
<h3>Der Bot joint meinen Voice-Channel nicht</h3>
<p>Stelle sicher, dass der Bot die Berechtigungen "Connect", "Speak" und "Use Voice Activity" auf deinem Server hat.</p>

<h3>Die Transkription dauert sehr lange</h3>
<p>WhisperX mit Speaker-Diarization ist rechenintensiv. Bei langen Sessions (2h+) kann die Verarbeitung 5–10 Minuten dauern. Bei Chunked Recording läuft die Transkription parallel zur Aufnahme — dann ist sie meist sofort nach /stop fertig.</p>

<h3>Die Summary ist unvollständig oder wirr</h3>
<p>Prüfe folgende Punkte:</p>
<ol>
  <li>Hast du einen guten Kampagnen-Kontext hinterlegt?</li>
  <li>Ist dein System-Prompt klar formuliert?</li>
  <li>Hast du die Sprecher korrekt zugeordnet? (Tab "Sprecher" in der Session)</li>
  <li>Welches LLM-Modell nutzt du? Claude Opus oder GPT-5.x liefern deutlich bessere Ergebnisse als kleinere Modelle.</li>
</ol>

<h3>Ich habe mein Passwort vergessen</h3>
<p>Öffne auf der Anmeldeseite „Passwort vergessen?“. Du erhältst per E-Mail einen einmalig nutzbaren Link, der 30 Minuten gültig ist. Nach dem Zurücksetzen werden bestehende Sitzungen aus Sicherheitsgründen abgemeldet.</p>

<h3>Meine Bestätigungsmail ist nicht angekommen</h3>
<p>Prüfe zuerst den Spam-Ordner. Auf der Anmeldeseite kannst du nach einem Loginversuch mit korrektem Passwort einen neuen Link anfordern. Auch ein abgelaufener Bestätigungslink bietet diese Möglichkeit. Die Antwort bleibt aus Datenschutzgründen immer neutral.</p>

<h3>Kann ich mehrere Kampagnen gleichzeitig laufen lassen?</h3>
<p>Ja, auf verschiedenen Discord-Servern können Kampagnen gleichzeitig aufgenommen werden. Auf demselben Server ist wegen der Discord-Voice-Verbindung jeweils eine Aufnahme aktiv. Mehrere Kampagnen auf einem Server werden über Voice-Channels und die optionale Kampagnenauswahl getrennt.</p>

<h3>Muss ich Discord-Server-IDs manuell eintragen?</h3>
<p>Nein. Der Bot übermittelt die Server-ID und den Servernamen bei der Verknüpfung automatisch. Voice- und Summary-Channel ordnest du bequem über <code>/kampagne verbinden</code> zu.</p>

<h3>Wo werden die Audio-Dateien gespeichert?</h3>
<p>Die MP3-Chunks liegen im Docker-Volume <code>storage/recordings/</code> und sind über die Session-Detailseite als Download und eingebetteter Player verfügbar.</p>

<h3>Was passiert bei einem Server-Crash während der Aufnahme?</h3>
<p><strong>Chunked Recording rettet dich:</strong> Alle 30 Minuten wird ein Part gespeichert und parallel transkribiert. Selbst wenn der Server nach 2.5 Stunden crasht, hast du 5 Chunks à 30 Minuten gesichert.</p>

<h3>Warum sehe ich kein Kampagnen-Hintergrundbild?</h3>
<p>Prüfe, ob in den Kampagnen-Einstellungen ein Replicate-API-Key konfiguriert oder durch den Superadmin freigegeben ist. Die Generator-Einstellungen befinden sich in einem aufklappbaren Bereich direkt am Bild.</p>

<h3>Können meine Spieler das Web-Panel auch nutzen?</h3>
<p>Aktuell (v1) ist das Panel nur für DMs. Multi-User mit Spieler-Logins und Leseberechtigung ist für v2 geplant.</p>`
    }
  ];
</script>

<style>
  :global(.prose-invert h3) {
    font-size: 1.15rem;
    font-weight: 600;
    color: #e2e8f0;
    margin-top: 1.75rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid #334155;
  }
  :global(.prose-invert p) {
    line-height: 1.8;
    margin-bottom: 1rem;
    color: #cbd5e1;
  }
  :global(.prose-invert ul), :global(.prose-invert ol) {
    padding-left: 1.25rem;
    margin-bottom: 1.25rem;
  }
  :global(.prose-invert li) {
    margin-bottom: 0.4rem;
    line-height: 1.7;
  }
  :global(.prose-invert code) {
    background: #1e293b;
    color: #93c5fd;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.85rem;
    border: 1px solid #334155;
  }
  :global(.prose-invert pre) {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    overflow-x: auto;
    font-size: 0.85rem;
    line-height: 1.6;
  }
  :global(.prose-invert table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
  }
  :global(.prose-invert th) {
    text-align: left;
    font-weight: 600;
    color: #94a3b8;
    padding: 0.5rem 0.75rem;
    border-bottom: 2px solid #334155;
    font-size: 0.85rem;
  }
  :global(.prose-invert td) {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #1e293b;
    font-size: 0.9rem;
  }
  :global(.prose-invert strong) {
    color: #f1f5f9;
    font-weight: 600;
  }
</style>
