<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth.js';
  import { api } from '$lib/api.js';

  const { user } = auth;
  let discordInviteUrl = $state('');

  const extractedObjects = [
    { label: 'NPCs', value: 'Motivation & Auftritte', icon: '♟' },
    { label: 'Quests', value: 'Offen, aktiv, gelöst', icon: '⌁' },
    { label: 'Orte', value: 'Lore & Verbindungen', icon: '⌖' },
    { label: 'Loot', value: 'Funde & Besitzer', icon: '◇' },
    { label: 'Handlungsfäden', value: 'Nichts bleibt liegen', icon: '∞' }
  ];

  const features = [
    {
      icon: '◉',
      title: 'Discord Session Recorder',
      text: 'Starte die Aufnahme direkt im Voice-Channel mit /record. Der Bot ordnet Stimmen den Discord-Namen und Charakteren deiner Gruppe zu. Mit /stop beginnt die Verarbeitung – ohne extra Aufnahmeprogramm und ohne jemanden zum Protokollführer zu ernennen.'
    },
    {
      icon: '✦',
      title: 'Lesbare Session-Zusammenfassungen',
      text: 'Aus einer langen D&D-Session entsteht eine strukturierte deutsche Zusammenfassung mit Handlung, wichtigen Entscheidungen und den Momenten, über die eure Gruppe noch Wochen später spricht. Der fertige Recap landet auf Wunsch automatisch im gewählten Discord-Channel.'
    },
    {
      icon: '⌘',
      title: 'Selbstaufbauendes Kampagnenwiki',
      text: 'NPCs, Orte, Quests, Loot und offene Handlungsfäden werden automatisch aus dem Abenteuer extrahiert. Mit jeder Session wächst daraus ein durchsuchbares Kampagnenwiki – kein zweites Notizsystem, kein manuelles Übertragen, keine verlorene Improvisation.'
    },
    {
      icon: '☼',
      title: 'Sessionbilder für eure Chronik',
      text: 'Der DnD Recorder entwirft aus der Zusammenfassung einen passenden Bildprompt und kann daraus ein individuelles Sessionbild generieren. So erhält jedes Kapitel eurer Kampagne ein visuelles Erinnerungsstück statt einer austauschbaren Textwand.'
    },
    {
      icon: '⚗',
      title: 'Eigene KI-Auswahl',
      text: 'Wähle Modell und Anbieter passend zu Qualität, Kosten und Datenschutz deiner Runde. Eigene API-Keys lassen sich pro Kampagne verwalten; freigegebene Admin-Keys können zentral bereitgestellt und ebenso sauber wieder entzogen werden.'
    },
    {
      icon: '⚑',
      title: 'Kampagnen, Server und Gruppe im Griff',
      text: 'Verwalte mehrere Kampagnen, Gruppenmitglieder, Charaktere und Discord-Server in einem Dashboard. Voice- und Summary-Channels werden kampagnenspezifisch gebunden – auch wenn mehrere Abenteuer auf demselben Server gespielt werden.'
    }
  ];

  const faqItems = [
    {
      question: 'Was ist ein D&D Session Recorder?',
      answer: 'Ein D&D Session Recorder zeichnet eure Spielsitzung auf und verarbeitet das Gespräch anschließend zu nutzbaren Notizen. Der DnD Recorder arbeitet als Discord Bot im Voice-Channel, erstellt ein Transkript, eine deutsche Session-Zusammenfassung und strukturierte Einträge für das Kampagnenwiki.'
    },
    {
      question: 'Wie nehme ich eine D&D Session auf Discord auf?',
      answer: 'Lade den Bot auf deinen Discord-Server ein, verknüpfe eine Kampagne mit dem passenden Voice- und Summary-Channel und starte im Voice-Channel den Slash-Befehl /record. Nach /stop verarbeitet der Recorder die Session automatisch. Bei mehreren Kampagnen kannst du die gewünschte Kampagne direkt im Slash-Menü auswählen.'
    },
    {
      question: 'Was unterscheidet den DnD Recorder von einem normalen Discord Recorder?',
      answer: 'Ein normaler Discord Voice Recorder liefert vor allem Audiodateien. Der DnD Recorder versteht den Kampagnenkontext: Er erstellt Recaps, erkennt Sprecher und extrahiert NPCs, Orte, Quests, Loot sowie offene Handlungsfäden. Dadurch wächst aus jeder Aufnahme eine organisierte Kampagnenchronik.'
    },
    {
      question: 'Kann ich mehrere Kampagnen und Discord-Server verwalten?',
      answer: 'Ja. Ein Dungeon Master kann mehrere Kampagnen anlegen und jede Kampagne mit einem oder mehreren Discord-Servern verbinden. Unterschiedliche Voice- und Summary-Channels sorgen dafür, dass Sessions und Zusammenfassungen zuverlässig im richtigen Abenteuer landen.'
    },
    {
      question: 'Sind die Session-Zusammenfassungen auf Deutsch?',
      answer: 'Ja. Zusammenfassungen und Kampagneneinträge werden auf Deutsch erstellt. Der technische Prompt für ein Sessionbild kann auf Englisch bleiben, damit Bildmodelle gute Ergebnisse liefern, ohne die Sprache eurer Chronik zu verändern.'
    },
    {
      question: 'Kann ich mein eigenes KI-Modell verwenden?',
      answer: 'Du kannst pro Kampagne Anbieter, Modell und eigene API-Keys konfigurieren. Damit bestimmst du selbst, welche KI für Transkription, Zusammenfassung und Bildgenerierung verwendet wird und behältst die Kontrolle über laufende Anbieter-Kosten.'
    },
    {
      question: 'Müssen meine Spieler während der Session Notizen machen?',
      answer: 'Nein. Die Gruppe kann sich auf Rollenplay, Entscheidungen und Würfel konzentrieren. Trotzdem kann ein persönliches Spieltagebuch die automatische Chronik ergänzen. Vor jeder Aufnahme sollte der Dungeon Master transparent die Zustimmung aller Teilnehmenden einholen.'
    }
  ];

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'DnD Recorder',
      applicationCategory: 'GameApplication',
      applicationSubCategory: 'D&D campaign management and Discord session recorder',
      operatingSystem: 'Web, Discord',
      inLanguage: 'de-DE',
      url: 'https://dnd-recorder.de/',
      image: 'https://dnd-recorder.de/landing/dnd-recorder-social.jpg',
      description: 'KI-gestützter Discord Recorder für D&D Sessions mit deutschen Zusammenfassungen, automatischer Objektextraktion und selbstaufbauendem Kampagnenwiki.',
      featureList: [
        'Discord Voice-Channel aufnehmen',
        'D&D Session-Zusammenfassungen auf Deutsch',
        'NPCs, Quests, Orte, Loot und Handlungsfäden extrahieren',
        'Selbstaufbauendes Kampagnenwiki',
        'Sessionbilder generieren',
        'Mehrere Kampagnen und Discord-Server verwalten',
        'Eigene KI-Anbieter und Modelle auswählen'
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer }
      }))
    }
  ];
  const structuredDataJson = JSON.stringify(structuredData).replace(/</g, '\\u003c');

  onMount(() => {
    api.getDiscordConfig()
      .then((config) => { discordInviteUrl = config.inviteUrl ?? ''; })
      .catch(() => { discordInviteUrl = ''; });
  });
</script>

<svelte:head>
  <title>D&amp;D Session Recorder für Discord | DnD Recorder</title>
  <meta name="description" content="DnD Recorder nimmt D&amp;D Sessions in Discord auf und erstellt deutsche Recaps, Sessionbilder sowie ein automatisches Kampagnenwiki für NPCs und Quests." />
  <meta name="keywords" content="D&amp;D Session Recorder, DnD Recorder, Discord Recorder, D&amp;D Session aufnehmen, D&amp;D Zusammenfassung, Discord Bot DnD, Kampagnenwiki, Dungeon Master Tool" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="https://dnd-recorder.de/" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="de_DE" />
  <meta property="og:site_name" content="DnD Recorder" />
  <meta property="og:title" content="D&amp;D Session Recorder – das magische Gedächtnis deiner Kampagne" />
  <meta property="og:description" content="Nimmt eure Discord-Session auf, schreibt den Recap und baut aus NPCs, Quests und Orten automatisch euer Kampagnenwiki." />
  <meta property="og:url" content="https://dnd-recorder.de/" />
  <meta property="og:image" content="https://dnd-recorder.de/landing/dnd-recorder-social.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Ein magisches Buch dokumentiert eine Fantasy-Rollenspielkampagne" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="D&amp;D Session Recorder für Discord | DnD Recorder" />
  <meta name="twitter:description" content="Automatische Session-Recaps, Objektextraktion und ein Kampagnenwiki, das mit jedem Abenteuer wächst." />
  <meta name="twitter:image" content="https://dnd-recorder.de/landing/dnd-recorder-social.jpg" />
  {@html '<script type="application/ld+json">' + structuredDataJson + '</scr' + 'ipt>'}
</svelte:head>

<div class="landing-page overflow-hidden bg-[#0b0b14] text-gray-100">
  <header class="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b14]/90 backdrop-blur-xl">
    <nav aria-label="Hauptnavigation" class="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <a href="/" aria-label="DnD Recorder Startseite" class="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-white">
        <img src="/logo-d20.svg" alt="" width="38" height="38" aria-hidden="true" class="h-9 w-9" />
        <span class="text-lg">DnD Recorder</span>
      </a>
      <div class="hidden items-center gap-6 text-sm text-gray-300 lg:flex">
        <a href="#kampagnenwiki" class="hover:text-white">Kampagnenwiki</a>
        <a href="#funktionen" class="hover:text-white">Funktionen</a>
        <a href="#so-funktionierts" class="hover:text-white">So funktioniert’s</a>
        <a href="#faq" class="hover:text-white">FAQ</a>
        <a href="/docs" class="hover:text-white">Dokumentation</a>
      </div>
      <div class="flex items-center gap-2 sm:gap-3">
        {#if $user}
          <a href="/dashboard" class="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white hover:bg-white/5 sm:px-4">Dashboard</a>
        {:else}
          <a href="/login" class="inline-flex min-h-11 items-center px-2 py-2 text-sm font-medium text-gray-300 hover:text-white sm:px-3">Login</a>
          <a href="/register" data-analytics-cta="hero_register" class="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 hover:bg-brand-500 sm:px-4">Registrieren</a>
        {/if}
      </div>
    </nav>
  </header>

  <div id="landing-content">
    <section class="relative isolate">
      <div class="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_72%_30%,rgba(124,58,237,.24),transparent_36%),radial-gradient(circle_at_10%_10%,rgba(180,83,9,.13),transparent_30%)]"></div>
      <div class="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-brand-500/70 to-transparent"></div>
      <div class="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[.92fr_1.08fr] lg:gap-14 lg:px-8 lg:py-28">
        <div>
          <p class="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-300/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.16em] text-amber-200">
            <span aria-hidden="true">✦</span> Das magische Gedächtnis deiner Kampagne
          </p>
          <h1 class="max-w-3xl text-4xl font-black leading-[1.08] tracking-[-.035em] text-white sm:text-5xl lg:text-6xl">
            Der KI <span class="bg-gradient-to-r from-violet-300 via-brand-500 to-amber-300 bg-clip-text text-transparent">D&amp;D Session Recorder</span> für Discord
          </h1>
          <p class="mt-6 max-w-2xl text-lg leading-8 text-gray-300 sm:text-xl">
            Spiele den Dungeon Master – nicht den Protokollführer. Der DnD Recorder nimmt eure Session im Discord Voice-Channel auf, schreibt eine lesbare deutsche Zusammenfassung und verwandelt NPCs, Quests, Orte und Loot automatisch in ein Kampagnenwiki, das mit jedem Abenteuer wächst.
          </p>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={$user ? '/dashboard' : '/register'} data-analytics-cta={$user ? undefined : 'hero_register'} class="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 font-semibold text-white shadow-xl shadow-violet-950/50 transition hover:-translate-y-0.5 hover:bg-brand-500">
              {$user ? 'Zum Kampagnen-Dashboard' : 'Chronik beginnen'} <span aria-hidden="true">→</span>
            </a>
            <a href="/login" class="inline-flex min-h-13 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 font-semibold text-white transition hover:border-white/25 hover:bg-white/10">
              Bereits registriert? Login
            </a>
            {#if discordInviteUrl}
              <a href={discordInviteUrl} target="_blank" rel="noreferrer" class="inline-flex min-h-13 items-center justify-center rounded-xl px-5 py-3.5 font-medium text-violet-300 hover:bg-violet-500/10">
                Bot zu Discord einladen
              </a>
            {/if}
          </div>
          <ul class="mt-7 grid gap-2 text-sm text-gray-400 sm:grid-cols-3" aria-label="Produktvorteile">
            <li class="flex items-center gap-2"><span class="text-emerald-400" aria-hidden="true">✓</span> Deutsche Recaps</li>
            <li class="flex items-center gap-2"><span class="text-emerald-400" aria-hidden="true">✓</span> Eigene KI-Auswahl</li>
            <li class="flex items-center gap-2"><span class="text-emerald-400" aria-hidden="true">✓</span> Mehrere Kampagnen</li>
          </ul>
        </div>

        <div class="relative mx-auto w-full max-w-3xl lg:mx-0">
          <div class="absolute -inset-5 -z-10 rounded-[2.5rem] bg-brand-500/15 blur-3xl"></div>
          <div class="overflow-hidden rounded-3xl border border-white/15 bg-surface-800 shadow-2xl shadow-black/60">
            <picture>
              <source media="(max-width: 767px)" srcset="/landing/dnd-recorder-magisches-kampagnenbuch-768.webp" />
              <img src="/landing/dnd-recorder-magisches-kampagnenbuch.webp" width="1440" height="960" fetchpriority="high" decoding="async" alt="Ein Dungeon Master am Spieltisch, während ein magisches Buch aus dem gesprochenen Abenteuer eine leuchtende Kampagnenwelt mit Quests und Orten erschafft" class="aspect-[3/2] h-auto w-full object-cover" />
            </picture>
          </div>
          <div class="absolute -bottom-5 left-4 right-4 rounded-2xl border border-white/10 bg-[#11111e]/95 p-4 shadow-2xl backdrop-blur sm:left-auto sm:right-5 sm:w-[21rem]">
            <div class="flex items-center gap-3">
              <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300" aria-hidden="true">✓</span>
              <div>
                <p class="text-sm font-semibold text-white">Session-Chronik fertig</p>
                <p class="mt-0.5 text-xs text-gray-400">5 NPCs · 3 Quests · 2 neue Orte extrahiert</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section aria-labelledby="problem-title" class="border-y border-white/8 bg-white/[.025]">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div class="mx-auto max-w-3xl text-center">
          <p class="section-kicker">Der Endgegner nach der Session</p>
          <h2 id="problem-title" class="section-title">Wenn niemand mitschreibt, verliert selbst die beste Kampagne ihre Spuren</h2>
          <p class="section-copy">Zwischen Arbeit, Alltag und dem nächsten Spielabend vergehen Tage oder Wochen. Dann fehlen der Name des Informanten, der Grund für den Fluch und die Nebenquest, die eigentlich längst gelöst werden sollte. Manuelle D&amp;D-Notizen helfen – kosten aber genau die Aufmerksamkeit, die am Tisch für Rollenplay und Entscheidungen gebraucht wird.</p>
        </div>
        <div class="mt-10 grid gap-4 md:grid-cols-3">
          <article class="pain-card">
            <span class="pain-number" aria-hidden="true">01</span>
            <h3>Der DM jongliert zu viel</h3>
            <p>Begegnung leiten, Regeln klären, improvisieren und gleichzeitig jeden neuen NPC notieren: Gute Ideen entstehen spontan – und verschwinden oft genauso schnell.</p>
          </article>
          <article class="pain-card">
            <span class="pain-number" aria-hidden="true">02</span>
            <h3>Recaps werden zur Hausaufgabe</h3>
            <p>Nach vier Stunden Spielzeit möchte niemand noch einmal vier Stunden Aufnahme durchhören. Deshalb bleibt die Zusammenfassung liegen oder verliert wichtige Zusammenhänge.</p>
          </article>
          <article class="pain-card">
            <span class="pain-number" aria-hidden="true">03</span>
            <h3>Wissen verteilt sich über zehn Orte</h3>
            <p>Discord-Posts, lose Dokumente, Charakterbögen und private Notizen ergeben noch kein Kampagnenwissen. Die Gruppe braucht eine gemeinsame, lebende Chronik.</p>
          </article>
        </div>
      </div>
    </section>

    <section id="kampagnenwiki" aria-labelledby="wiki-title" class="scroll-mt-24">
      <div class="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
        <div>
          <p class="section-kicker">Größter USP: automatische Objektextraktion</p>
          <h2 id="wiki-title" class="section-title text-left">Ein Kampagnenwiki, das sich aus euren Abenteuern selbst aufbaut</h2>
          <p class="section-copy text-left">Der DnD Recorder erzeugt nicht nur eine KI-Zusammenfassung. Nach jeder aufgenommenen D&amp;D-Session erkennt er die Bausteine eurer Geschichte und führt sie kampagnenweit fort. Aus einem erwähnten Wirt wird ein NPC-Eintrag, aus dem Gerücht über die Mine eine Quest und aus dem vergessenen Siegel ein offener Handlungsfaden.</p>
          <p class="mt-5 text-base leading-7 text-gray-400">Für den Dungeon Master bedeutet das weniger Nachbereitung und verlässlichere Vorbereitung. Für die Spieler bedeutet es, dass Entscheidungen Gewicht behalten: Wer war noch einmal die Händlerin in Grauhafen? Welche Hinweise führen zum verschwundenen Archiv? Was schuldet die Gruppe dem Orden? Das Wiki hält die Antworten dort bereit, wo alle wieder in die Geschichte einsteigen können.</p>
          <ul class="mt-7 space-y-3 text-sm leading-6 text-gray-300">
            <li class="flex gap-3"><span class="check-orb" aria-hidden="true">✓</span><span><strong class="text-white">Quest-Fortschritt statt statischer Liste:</strong> neue und gelöste Aufgaben werden Session für Session zugeordnet.</span></li>
            <li class="flex gap-3"><span class="check-orb" aria-hidden="true">✓</span><span><strong class="text-white">Verknüpfte Welt:</strong> NPCs, Orte, Loot und Handlungsfäden bleiben mit ihrer Kampagne und den betreffenden Sessions verbunden.</span></li>
            <li class="flex gap-3"><span class="check-orb" aria-hidden="true">✓</span><span><strong class="text-white">Volle Kontrolle:</strong> automatisch erkannte Objekte können anschließend geprüft, ergänzt und bearbeitet werden.</span></li>
          </ul>
        </div>

        <div class="rounded-3xl border border-white/10 bg-[#121220] p-3 shadow-2xl shadow-black/40 sm:p-5">
          <div class="mb-4 flex items-center justify-between border-b border-white/8 px-2 pb-4">
            <div>
              <p class="text-xs uppercase tracking-[.16em] text-gray-500">Kampagnenwiki</p>
              <p class="mt-1 font-semibold text-white">Das Vermächtnis von Lanos</p>
            </div>
            <span class="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">wächst automatisch</span>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            {#each extractedObjects as object, index}
              <div class="rounded-2xl border border-white/8 bg-white/[.035] p-4 {index === extractedObjects.length - 1 ? 'sm:col-span-2' : ''}">
                <div class="flex items-start gap-3">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-lg text-violet-300" aria-hidden="true">{object.icon}</span>
                  <div>
                    <p class="text-sm font-semibold text-white">{object.label}</p>
                    <p class="mt-1 text-xs text-gray-500">{object.value}</p>
                  </div>
                </div>
              </div>
            {/each}
          </div>
          <div class="mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/[.04] p-4">
            <p class="text-xs font-semibold uppercase tracking-[.14em] text-amber-200">Quest aktualisiert</p>
            <p class="mt-2 text-sm font-medium text-white">Die Splitter des Sternenspiegels</p>
            <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8"><div class="h-full w-2/3 rounded-full bg-gradient-to-r from-brand-500 to-amber-300"></div></div>
            <p class="mt-2 text-xs text-gray-500">2 von 3 Hinweisen entdeckt</p>
          </div>
        </div>
      </div>
    </section>

    <section id="so-funktionierts" aria-labelledby="steps-title" class="scroll-mt-24 border-y border-white/8 bg-gradient-to-b from-violet-950/15 to-transparent">
      <div class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div class="mx-auto max-w-3xl text-center">
          <p class="section-kicker">Drei einfache Schritte</p>
          <h2 id="steps-title" class="section-title">D&amp;D Session aufnehmen, spielen, Chronik öffnen</h2>
          <p class="section-copy">Kein kompliziertes Setup und keine Server-ID zum Abtippen. Der Discord Bot erkennt den Server, die Kampagne bestimmt ihre Channels und der Rest passiert nach dem Spielabend.</p>
        </div>
        <ol class="relative mt-12 grid gap-5 lg:grid-cols-3">
          <li class="step-card">
            <span class="step-index">1</span>
            <p class="step-command">Bot + Kampagne</p>
            <h3>Discord verbinden</h3>
            <p>Erstelle deinen Account, lege eine Kampagne an und lade den Bot auf den Discord-Server deiner Gruppe ein. Voice- und Summary-Channel lassen sich über das Web-Panel oder <code>/kampagne verbinden</code> zuordnen.</p>
          </li>
          <li class="step-card">
            <span class="step-index">2</span>
            <p class="step-command">/record</p>
            <h3>Abenteuer spielen</h3>
            <p>Betritt den Voice-Channel und starte die Aufnahme. Bei mehreren Kampagnen wählst du das richtige Abenteuer im Slash-Menü. Der Bot zeichnet die Session auf, während ihr euch vollständig auf die Geschichte konzentriert.</p>
          </li>
          <li class="step-card">
            <span class="step-index">3</span>
            <p class="step-command">/stop</p>
            <h3>Wissen zurückbekommen</h3>
            <p>Nach dem Stopp entstehen Transkript, Zusammenfassung, Sessionbild und strukturierte Wiki-Objekte. Der Recap wird in Discord gepostet und bleibt im Kampagnen-Dashboard jederzeit auffindbar.</p>
          </li>
        </ol>
      </div>
    </section>

    <section id="funktionen" aria-labelledby="features-title" class="scroll-mt-24">
      <div class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div class="max-w-3xl">
          <p class="section-kicker">Ein Werkzeug, das mit der Kampagne mitdenkt</p>
          <h2 id="features-title" class="section-title text-left">Mehr als D&amp;D aufnehmen: die gesamte Gruppe profitiert</h2>
          <p class="section-copy text-left">Ein guter D&amp;D Session Recorder muss nach dem letzten Würfelwurf nützlicher werden, nicht stiller. Deshalb verbindet der DnD Recorder Aufzeichnung, KI-Recap, visuelle Erinnerung und Kampagnenverwaltung in einem verlässlichen Ablauf.</p>
        </div>
        <div class="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {#each features as feature}
            <article class="feature-card">
              <span class="feature-icon" aria-hidden="true">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          {/each}
        </div>
      </div>
    </section>

    <section aria-labelledby="choice-title" class="border-y border-white/8 bg-white/[.025]">
      <div class="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-24">
        <div class="rounded-3xl border border-white/10 bg-[#121220] p-5 shadow-xl sm:p-7">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-xs uppercase tracking-[.16em] text-gray-500">Kampagnen-Einstellungen</p>
              <p class="mt-1 font-semibold text-white">Eigene KI-Konfiguration</p>
            </div>
            <span class="rounded-lg bg-brand-500/10 px-2.5 py-1 text-xs text-violet-300">pro Kampagne</span>
          </div>
          <div class="mt-6 space-y-3">
            <div class="setting-row"><span>Zusammenfassung</span><strong>Deutsch</strong></div>
            <div class="setting-row"><span>LLM-Anbieter</span><strong>frei wählbar</strong></div>
            <div class="setting-row"><span>Modell</span><strong>passend zur Runde</strong></div>
            <div class="setting-row"><span>Sessionbild</span><strong>eigener Prompt</strong></div>
            <div class="setting-row"><span>API-Key</span><strong class="font-mono">sk-pro…</strong></div>
          </div>
        </div>
        <div>
          <p class="section-kicker">Keine Einheitsmagie</p>
          <h2 id="choice-title" class="section-title text-left">Deine Kampagne, deine Modelle, deine Regeln</h2>
          <p class="section-copy text-left">Eine düstere Intrigenkampagne braucht einen anderen Ton als ein chaotischer One-Shot. Deshalb kannst du Systemprompt, Sprache, KI-Anbieter, Modell und Bildgenerierung an deine Runde anpassen. Der DnD Recorder bleibt das gemeinsame Interface; die passende Intelligenz dahinter bestimmst du.</p>
          <p class="mt-5 text-base leading-7 text-gray-400">Auch die technische Verwaltung bleibt transparent: API-Keys sind kampagnenspezifisch, werden in der Oberfläche nur teilweise angezeigt und können zentral freigegeben oder wieder entzogen werden. So wächst das Tool mit einer einzelnen Gruppe ebenso wie mit mehreren Kampagnen auf verschiedenen Discord-Servern.</p>
        </div>
      </div>
    </section>

    <section aria-labelledby="management-title">
      <div class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div class="mx-auto max-w-3xl text-center">
          <p class="section-kicker">Ordnung für lange Abenteuer</p>
          <h2 id="management-title" class="section-title">Kampagnenverwaltung, die nicht nach drei Sessions auseinanderfällt</h2>
          <p class="section-copy">Der Dungeon Master sieht auf einen Blick, welche Kampagne aktiv ist, auf welchem Discord-Server sie läuft und wohin der nächste Recap gehört. Jede Session erhält ihren Platz in einer fortlaufenden Chronik – zusammen mit den Personen, Orten und Entscheidungen, die sie geprägt haben.</p>
        </div>
        <div class="mt-12 grid gap-6 lg:grid-cols-2">
          <article class="management-card">
            <div class="management-art bg-[radial-gradient(circle_at_70%_20%,rgba(124,58,237,.45),transparent_38%),linear-gradient(145deg,#24203a,#11111c)]">
              <span class="text-5xl" aria-hidden="true">🗺️</span>
            </div>
            <div class="p-6 sm:p-7">
              <p class="text-xs font-semibold uppercase tracking-[.15em] text-violet-300">Für den Dungeon Master</p>
              <h3 class="mt-2 text-xl font-semibold text-white">Mehrere Kampagnen, sauber getrennt</h3>
              <p class="mt-3 leading-7 text-gray-400">Kampagnenbilder, Laufzeit, Sessions und Serverstatus bilden eine klare Übersicht. Unterschiedliche Abenteuer können auf unterschiedlichen Servern – oder über getrennte Channels auf demselben Server – laufen, ohne dass Datenströme durcheinandergeraten.</p>
            </div>
          </article>
          <article class="management-card">
            <div class="management-art bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,.3),transparent_38%),linear-gradient(145deg,#182c2b,#11111c)]">
              <span class="text-5xl" aria-hidden="true">🧙</span>
            </div>
            <div class="p-6 sm:p-7">
              <p class="text-xs font-semibold uppercase tracking-[.15em] text-emerald-300">Für die ganze Gruppe</p>
              <h3 class="mt-2 text-xl font-semibold text-white">Charakternamen statt anonymer Stimmen</h3>
              <p class="mt-3 leading-7 text-gray-400">Gruppenmitglieder werden mit Discord-Namen und ihren Charakteren verknüpft. Pausierte Figuren, Rollen und Notizen bleiben kampagnenbezogen erhalten. Dadurch liest sich die Session-Zusammenfassung wie eure Geschichte – nicht wie ein Meeting-Protokoll.</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="faq" aria-labelledby="faq-title" class="scroll-mt-24 border-y border-white/8 bg-white/[.025]">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[.72fr_1.28fr] lg:px-8 lg:py-24">
        <div>
          <p class="section-kicker">Häufige Fragen</p>
          <h2 id="faq-title" class="section-title text-left">Bevor der Chronist der Gruppe beitritt</h2>
          <p class="section-copy text-left">Antworten zur Aufnahme auf Discord, zu mehreren Kampagnen, deutschen Recaps und der eigenen KI-Auswahl.</p>
          <a href="/docs" class="mt-6 inline-flex min-h-11 items-center gap-2 font-medium text-violet-300 hover:text-violet-200">Zur vollständigen Dokumentation <span aria-hidden="true">→</span></a>
        </div>
        <div class="space-y-3">
          {#each faqItems as item}
            <details class="group rounded-2xl border border-white/10 bg-[#121220] open:border-brand-500/30 open:bg-brand-500/[.04]">
              <summary class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-5 px-5 py-4 font-semibold text-white marker:hidden">
                <span>{item.question}</span>
                <span class="text-xl font-light text-violet-300 transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p class="px-5 pb-5 leading-7 text-gray-400">{item.answer}</p>
            </details>
          {/each}
        </div>
      </div>
    </section>

    <section aria-labelledby="final-cta-title" class="relative isolate">
      <div class="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(124,58,237,.2),transparent_48%)]"></div>
      <div class="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:py-32">
        <img src="/logo-d20.svg" width="64" height="64" alt="" aria-hidden="true" class="mx-auto h-16 w-16" />
        <p class="section-kicker mt-6">Ein neues magisches Item für deinen Spieltisch</p>
        <h2 id="final-cta-title" class="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">Lass das Abenteuer Spuren hinterlassen</h2>
        <p class="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-300">Deine Gruppe soll sich an Entscheidungen, Figuren und große Momente erinnern – nicht daran, wer diesmal Notizen machen musste. Beginne die erste Chronik mit dem DnD Recorder.</p>
        <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={$user ? '/dashboard' : '/register'} data-analytics-cta={$user ? undefined : 'final_register'} class="inline-flex min-h-13 items-center justify-center rounded-xl bg-brand-600 px-7 py-3.5 font-semibold text-white shadow-xl shadow-violet-950/50 hover:bg-brand-500">{$user ? 'Kampagnen öffnen' : 'Account erstellen'}</a>
          {#if discordInviteUrl}
            <a href={discordInviteUrl} target="_blank" rel="noreferrer" class="inline-flex min-h-13 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 font-semibold text-white hover:bg-white/10">Bot einladen</a>
          {:else}
            <a href="/login" class="inline-flex min-h-13 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 font-semibold text-white hover:bg-white/10">Einloggen</a>
          {/if}
        </div>
      </div>
    </section>
  </div>

</div>

<style>
  :global(html) { scroll-behavior: smooth; }
  .landing-page { color-scheme: dark; }
  .section-kicker { font-size: .75rem; font-weight: 700; letter-spacing: .16em; line-height: 1.25rem; text-transform: uppercase; color: #c4b5fd; }
  .section-title { margin-top: .65rem; font-size: clamp(1.9rem, 4vw, 3rem); font-weight: 800; letter-spacing: -.03em; line-height: 1.12; color: #fff; text-wrap: balance; }
  .section-copy { margin-top: 1.25rem; font-size: 1.0625rem; line-height: 1.85rem; color: #aeb5c3; text-wrap: pretty; }
  .pain-card { position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,.09); border-radius: 1rem; background: rgba(255,255,255,.025); padding: 1.5rem; }
  .pain-card h3, .step-card h3, .feature-card h3 { position: relative; font-size: 1.125rem; font-weight: 650; color: #fff; }
  .pain-card p, .step-card p:not(.step-command), .feature-card p { position: relative; margin-top: .75rem; line-height: 1.65rem; color: #aeb5c3; }
  .pain-number { position: absolute; right: .75rem; top: -.9rem; font-size: 5rem; font-weight: 900; color: rgba(139,92,246,.08); }
  .check-orb { display: inline-flex; width: 1.5rem; height: 1.5rem; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 999px; background: rgba(52,211,153,.1); color: #6ee7b7; margin-top: .05rem; }
  .step-card { position: relative; border: 1px solid rgba(255,255,255,.1); border-radius: 1.25rem; background: #121220; padding: 1.6rem; }
  .step-index { display: flex; height: 2.5rem; width: 2.5rem; align-items: center; justify-content: center; border-radius: .75rem; background: linear-gradient(135deg,#7c3aed,#a78bfa); font-weight: 800; color: white; box-shadow: 0 12px 30px rgba(76,29,149,.35); }
  .step-command { margin: 1.25rem 0 .4rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .75rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #c4b5fd; }
  .step-card code { border-radius: .3rem; background: rgba(139,92,246,.12); padding: .1rem .3rem; color: #ddd6fe; }
  .feature-card { border: 1px solid rgba(255,255,255,.09); border-radius: 1.25rem; background: linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.015)); padding: 1.6rem; transition: transform .2s ease,border-color .2s ease,background .2s ease; }
  .feature-card:hover { transform: translateY(-3px); border-color: rgba(139,92,246,.35); background: rgba(139,92,246,.045); }
  .feature-icon { display: flex; height: 2.75rem; width: 2.75rem; align-items: center; justify-content: center; margin-bottom: 1.25rem; border: 1px solid rgba(167,139,250,.18); border-radius: .85rem; background: rgba(139,92,246,.1); font-size: 1.25rem; color: #c4b5fd; }
  .setting-row { display: flex; min-height: 3.25rem; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid rgba(255,255,255,.08); border-radius: .75rem; background: rgba(255,255,255,.025); padding: .75rem 1rem; font-size: .875rem; color: #aeb5c3; }
  .setting-row strong { color: #fff; }
  .management-card { overflow: hidden; border: 1px solid rgba(255,255,255,.1); border-radius: 1.5rem; background: #121220; }
  .management-art { display: flex; min-height: 12rem; align-items: center; justify-content: center; border-bottom: 1px solid rgba(255,255,255,.08); }
  summary::-webkit-details-marker { display: none; }
  @media (prefers-reduced-motion: reduce) {
    :global(html) { scroll-behavior: auto; }
    .feature-card, .group-open\:rotate-45 { transition: none; }
  }
</style>
