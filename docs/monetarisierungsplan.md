# Monetarisierungsplan für DnD Recorder

Stand: 19. Juli 2026. Dieses Dokument ist eine Produkt- und technische Planung. Es schaltet noch keine Limits oder Zahlungen frei.

## Korrigierte Geschäftsgrundlage

DnD Recorder ist im regulären Betrieb ein **BYOK-SaaS**: DMs hinterlegen eigene Schlüssel für Transkription, Zusammenfassung und Bildgenerierung und bezahlen deren Verbrauch direkt beim jeweiligen KI-Anbieter. DnD Recorder verkauft damit nicht weiterberechnete KI-Minuten, sondern den Produktwert aus Discord-Aufnahme, Sprecherzuordnung, Kampagnenverwaltung, automatischer Dokumentation und selbstwachsendem Wiki.

Die bisherigen Superadmin-Key-Grants sind ausschließlich ein Werkzeug für Beta-Tests und eigene Kampagnen. Sie sind kein Bestandteil eines späteren Abos und dürfen technisch nicht als Tarifleistung modelliert werden. Erst ein künftig ausdrücklich angebotenes Managed-AI-Guthaben würde wieder variable KI-Kosten für DnD Recorder erzeugen.

Für die Wirtschaftlichkeit zählen daher primär:

- fixes Serverhosting sowie Wachstumsschritte bei CPU, RAM und Datenbank
- Audio- und Bildspeicher, Backups und ausgehender Traffic
- E-Mail, Monitoring, Payment-Gebühren und Support
- ausschließlich bei Plattform-Keys: tatsächlich von DnD Recorder bezahlte KI-Aufrufe

Sessions, Kampagnen und Server sind vor allem **Entitlements und Conversion-Hebel**, keine Abbildung von KI-Selbstkosten.

## Entscheidungsvorschlag

Empfohlen ist ein einfaches **4 → 4,99 → 9,99**-Modell. Vier kostenlose Sessions reichen, damit das fortgeschriebene Kampagnenwiki seinen Wert zeigen kann. Nach dem Upgrade sollte normales Spielen nicht mehr an einem künstlichen Stundenbudget scheitern.

| Tarif | Preis inkl. USt. | Sessions | Aktive Kampagnen / Server | Wesentliche Leistungen |
| --- | ---: | --- | --- | --- |
| Novize | 0 € | 4 pro Monat | 1 / 1 | BYOK, Standard-Recap, automatische Objektextraktion, Basis-Wiki und Sessionbild mit eigenem Provider-Key |
| Abenteurer | 4,99 €/Monat | unbegrenzt im normalen Spielbetrieb | 3 / 1 | vollständiges Wiki und Questfortschritt, Exporte, eigene Prompts und längere Audio-Aufbewahrung |
| Chronist | 9,99 €/Monat | unbegrenzt im normalen Spielbetrieb | 10 / bis 3 | Multi-Server, erweiterte Wiki-Abgleiche, Offline-Upload und Spielerzugriff später, Prioritätsverarbeitung |
| Gildenmeister (später) | 19,99–24,99 €/Monat | Fair Use | 20 / bis 10 | mehrere DMs, Community-/Pro-DM-Funktionen, Rollen, Support und API-/Bulk-Export |

„Unbegrenzt“ bedeutet hier: keine Sperre für menschlich plausible Spielrunden. Ein transparentes Fair-Use-Limit gegen automatisierten Missbrauch bleibt zulässig, darf aber nicht als verstecktes reguläres Monatskontingent dienen. Falls Messdaten ein hartes Limit nötig machen, sind beispielsweise 20 beziehungsweise 50 Sessions wesentlich passender als die vorher vorgeschlagenen fünf und zwölf.

Es gibt kein zusätzliches monatliches Audio-Stundenlimit als Preisschranke. Das technische Maximum von aktuell sechs Stunden pro Session bleibt auf allen Tarifen als Betriebs- und Missbrauchsschutz bestehen. Unterschiede bei der Audio-Aufbewahrung sind sinnvoller: beispielsweise 7 Tage im Free-, 30 Tage im Abenteurer- und 90 Tage im Chronist-Tarif; Zusammenfassungen und Wiki-Inhalte bleiben dauerhaft lesbar.

Warum diese Staffelung besser passt:

- Der Plattform entstehen durch eine fünfte oder zehnte BYOK-Session keine zusätzlichen KI-Gebühren.
- Häufige Nutzung macht das Kampagnenwiki wertvoller und erhöht die Bindung; bezahlte Kunden sollten deshalb zum Spielen ermutigt werden.
- Der klare Upgradegrund für 9,99 Euro sind mehrere Kampagnen und Discord-Server, nicht künstlich knappe KI-Minuten.
- Eigene Provider-Keys müssen in allen Tarifen erlaubt sein, weil sie die Grundlage des Produkts und keine Premiumfunktion sind.

## Zielgruppen und Zahlungsgründe

### 1. Wöchentlicher Home-DM – primäre Zielgruppe

Eine Kampagne, ein Discord-Server und drei bis fünf Stunden pro Spielabend. Der Kaufgrund ist nicht „KI“, sondern weniger Nacharbeit: zuverlässige Recaps, auffindbare Lore und eine Gruppe, die beim nächsten Abend wieder im Abenteuer ist.

### 2. DM mit mehreren Kampagnen – beste Premiumzielgruppe

Mehrere Gruppen, Kampagnen oder Discord-Server erzeugen einen unmittelbar verständlichen Mehrwert für den Chronist-Tarif. Kampagnenumschaltung, getrennte Voice-/Summary-Channels und gemeinsame Kontingente lösen ein echtes Organisationsproblem.

### 3. Gelegenheits-DM und One-Shot

Diese Zielgruppe passt in vier monatliche Free-Sessions und trägt die KI-Kosten nur bei tatsächlicher Nutzung über eigene Keys. Statt Audiopaketen sind ein pausierbares Abo und dauerhaft lesbare Chroniken wichtiger.

### 4. Pro-DM, Actual Play, Verein und West-Marches-Community

Benötigt mehrere DMs, Server, Exporte, Rollen, Prioritätsverarbeitung, mehr Storage und Support. Dafür lohnt sich später eine Stufe ab etwa 19,99 Euro; der Mehrpreis bezahlt Organisations- und Betriebsumfang, nicht die BYOK-Inferenz.

### 5. Spieler – späterer Wachstumskanal

Spieler lesen Sessionchroniken, Questfortschritt und Wiki. Leseplätze sollten zunächst im DM-Tarif enthalten und nicht einzeln berechnet werden: Jeder eingeladene Spieler erhöht Reichweite, Bindung und den Gruppennutzen.

## Erweiterte Wettbewerbs- und Funktionsanalyse

Recherche-Stand: 19. Juli 2026. Verglichen wurden öffentlich dokumentierte Funktionen auf offiziellen Produkt-, Preis-, FAQ- und Hilfeseiten. Ein `—` bedeutet deshalb nicht sicher „nicht vorhanden“, sondern „in den geprüften offiziellen Quellen nicht belegt“. Marketingversprechen wurden nicht als unabhängig bewiesene Qualitätsaussagen behandelt.

### Marktsegmente

Der Markt besteht inzwischen aus drei eng zusammenrückenden Produktgruppen:

1. **Discord-native Chronisten:** Goblin Scribe und The Chronicler minimieren die Einrichtung und erledigen Aufnahme, Recap und Lore direkt in Discord.
2. **Kampagnenplattformen:** Archivist, Epicly und SessionKeeper verbinden Aufnahmen mit Wiki, Spielerzugriff, Kampagnenchat, Analyse und mobilen beziehungsweise öffentlichen Ansichten.
3. **Audio-/Transkriptprodukte:** Bardlog differenziert sich über getrennte Sprecherspuren, transcript-synchrone Wiedergabe, Suche und Clips; die KI-Chronik ist dort ein optionaler Aufbau.

DnD Recorder liegt zwischen diesen Segmenten: Discord-native Aufnahme, aber mit eigenem Web-Panel, strukturiertem Wiki und besonders freier KI-Konfiguration. Das ist eine sinnvolle Position, jedoch keine konkurrenzfreie Nische.

### Konkrete Funktionsmatrix

Legende: `✅` klar vorhanden, `◐` teilweise, anders umgesetzt oder tarifabhängig, `—` öffentlich nicht belegt. Der DnD-Recorder-Stand wurde zusätzlich gegen Repository, Datenmodell und UI abgeglichen.

| Funktion | DnD Recorder heute | Goblin Scribe | The Chronicler | SessionKeeper | Archivist | Epicly | Bardlog |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Discord-Voice-Aufnahme | ✅ Slash-Befehle | ✅ | ✅ | ✅ ab Hero | ✅ | —; Discord veröffentlicht Recaps | ✅ |
| Aufnahme pausieren/fortsetzen | — | ✅ | — | — | ◐ Start/Stop-Kontrolle | nicht anwendbar | — |
| Audio-, Notiz- oder Transkriptimport | — | — | — | ✅ Audio | ✅ Audio, Text, Notizen, Play-by-Post | ✅ Audio, Multitrack und Notizen | ✅ Audio und Multitrack-ZIP |
| Lange Sessions | ✅ 30-Minuten-Chunks, bis 6 h | ◐ 3/5 h, höher unbegrenzt | ◐ Stundenkontingent | nicht konkret belegt | nicht konkret belegt | ✅ 6/8 h | ✅ große Dateien werden gechunked |
| Sprechererkennung | ✅ Discord-Aktivität plus Wortzeiten | ✅ speaker-attributed | ✅ Discord-Charakterbindung | ✅ mit Einwilligung | ✅ | ✅ smart speaker identification | ✅ getrennte Spur je Sprecher |
| Transcript mit Audiobezug | ◐ Zeitstempel plus MP3-Player | nicht belegt | nicht belegt | nicht belegt | ◐ Transkript und Timeline | ◐ Volltranskript | ✅ Klick auf Zeile, Suche, Spurwahl |
| Deutscher Produkt- und Summary-Fokus | ✅ | — | — | — | — | ◐ mehrsprachig | — |
| Narrative Session-Zusammenfassung | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ als optionale KI-Funktion |
| Automatisch wachsendes Wiki | ✅ Summary-Aggregation | ✅ ab Raider | ◐ Lore plus manuelle Worldbuilding-Befehle | ✅ ab Hero | ✅ | ✅ Codex ab Paid, einmaliger Free-Test | ✅ als KI-Funktion |
| Strukturierte Wiki-Kategorien | ✅ NSCs, Orte, Quests, Loot, Fäden | ✅ NPCs, Kreaturen, Orte, Quests, Items, Fraktionen | ✅ PCs, NPCs, Orte, Fraktionen, Quests | ◐ Charaktere, Orte, Storylines | ✅ Charaktere, Items, Orte, Fraktionen, Momente | ✅ NPCs, Orte, Quests, Items, Fraktionen | ✅ NPCs, Orte, Items, Fraktionen, Lore |
| Wiki bearbeiten | ✅ CRUD und Session-Verknüpfung | ✅ editieren, umbenennen, löschen | ✅ Slash-CRUD | nicht konkret belegt | ✅ | ✅ mit Berechtigungen | nicht konkret belegt |
| KI-Änderungen prüfen, mergen, rückgängig machen | ◐ manuell korrigierbar, aber ohne Vorschlagsdiff | ✅ Review, Merge, Undo | — | — | ✅ Diff, Freigabe, Merge, Rollback | ✅ Review-Modus und Versionshistorie | — |
| Automatischer Questfortschritt | ◐ Statusaggregation plus manuelle Korrektur | ✅ | ◐ manuell gepflegt | nicht konkret belegt | ✅ kanonisches Quest Log mit Freigabe | ✅ Codex-Updates | nicht konkret belegt |
| Beziehungen/Graph | — | ✅ Beziehungen und Weltkarte | — | — | ✅ Beziehungs- und Kampagnenkarten | — | — |
| Kampagnenbezogener KI-Chat | — | ✅ Lore Recall | ✅ @Chronicler/DM-Chat | ✅ Campaign Assistant | ✅ Web, Discord und Foundry | ✅ Lorekeeper | — |
| Session-/Charakterbilder | ✅ Sessionbild, Kampagnenbild, Avatarreferenzen | ✅ Szenenbilder und Stile | ✅ Szenenbilder | ✅ Portraits | ◐ Trading Cards/Handouts | ◐ Bildergalerien, keine KI-Generierung belegt | — |
| Spielerzugang | —; Mitglieder sind derzeit DM-gepflegte Datensätze | ◐ Charaktere und Discord-Recaps | ◐ Charaktere und Discord-Zugriff | ✅ gemeinsame Kampagne | ✅ Rollen, Spieleransichten, Chat | ✅ kostenlose Spieleraccounts und Rechte | ✅ Party-Links und geschützte Freigaben |
| Öffentliche/teilbare Ansichten | — | Discord-Recap | Discord-Notizen | privat eingeladene Mitglieder | ✅ Public Campaign und Handouts | ✅ Link, E-Mail, Public Hub, Discord | ✅ passwortgeschützte Links und Clips |
| Datenexport | ◐ MP3-Download | — | — | — | ✅ PDF, Obsidian, Markdown, HTML | ◐ Teilen, kein vollständiger Datenexport belegt | ✅ Audio-/Videoclips |
| Multi-Kampagne auf einem Discord-Server | ✅ Kanalbindung je Kampagne | ✅ | ✅ aktive Kampagne umschalten | ◐ mehrere Kampagnen | ✅ | ✅ | ✅ Party-/Serverbindung |
| Mehrere Discord-Server pro Konto | ✅ | ✅ Add-on | nicht belegt | nicht belegt | nicht belegt | nicht belegt | nicht belegt |
| Eigene KI-Keys/Providerwahl | ✅ BYOK | — | — | — | — | — | — |
| Lokale/self-hosted KI | ✅ Ollama und eigener Whisper-Endpunkt | — | — | — | — | — | — |

### Direkte Wettbewerber im Detail

#### Goblin Scribe – engster Discord-Bot-Wettbewerber

[Goblin Scribe](https://scribe.goblinstack.com/) deckt die größte direkte Überschneidung ab: Discord-Aufnahme, Sprechertranskript, Recap, Sessionbild, automatisch aufgebautes Wiki, Quest-/Lore-Tracking, Charakterverwaltung und Multi-Server. Besonders stark sind die Discord-nahe Bedienung und die ausgereifte Korrekturschicht: neue NPCs werden zur Freigabe vorgeschlagen; Wiki-Einträge lassen sich umbenennen, zusammenführen und rückgängig machen; Recap und Bild können direkt per Befehl korrigiert werden.

**Vorsprung gegenüber DnD Recorder:** Pause/Resume, Lore-Chat, Fraktionen/Beziehungen/Weltkarte sowie Review/Merge/Undo.

**Vorteil DnD Recorder:** deutsche Oberfläche, BYOK, freie Provider- und Modellwahl, Ollama/self-hosted Optionen, feinere Webverwaltung und charakterreferenzierte Sessionbilder.

**Konsequenz:** Goblin Scribe ist der wichtigste Vergleich für das 4,99-/9,99-Euro-Angebot. Ein bloßes „Wiki wächst automatisch“ reicht gegen dessen Funktionsumfang nicht als USP.

#### Archivist – Referenz für Kampagnengedächtnis und Datenqualität

[Archivist](https://www.rpgarchivist.io/) ist funktional die tiefste untersuchte Plattform. Neben Discord und Imports bietet sie Compendium, Timeline, Quest Log, Charakterbögen, Story Highlights, Beziehungsdarstellung, Analyse von Pacing und Beteiligung sowie einen kampagnenbezogenen Chat. Besonders relevant ist der dokumentierte [Review- und Quest-Workflow](https://www.rpgarchivist.io/documentation): vorgeschlagene Änderungen werden als Diff geprüft, manuell gemergt, abgelehnt oder zurückgerollt. Exporte nach Obsidian, Markdown und HTML sowie Foundry-Anbindung stärken Datenportabilität und Ökosystem.

**Vorsprung gegenüber DnD Recorder:** kanonische Wissenspflege, Quellen-/Review-Fluss, Importvielfalt, Chat, Beziehungskarte, Analyse, Exporte, Spieler- und VTT-Zugriff.

**Vorteil DnD Recorder:** niedrigerer geplanter Preis, BYOK statt inkludierter KI, deutscher Fokus, einfachere Discord-first-Nutzung und eigene Modell-/Infrastrukturwahl.

**Konsequenz:** Archivist zeigt, was „selbstaufbauendes Kampagnenwiki“ in einer reifen Version bedeutet. Dessen Review-Prinzip sollte übernommen werden, nicht zwingend die gesamte Analyse-Suite.

#### Epicly – Referenz für Kollaboration, Review und flexible Eingaben

[Epicly](https://playepicly.com/) verarbeitet Audio, Multitrack-Aufnahmen oder vorhandene Notizen, erstellt Recaps und aktualisiert seinen Codex. Spieler können eingeladen, Recaps per E-Mail, Link oder Discord geteilt und Kampagnen öffentlich präsentiert werden. Besonders wertvoll sind der optionale Review-Modus, Änderungsverlauf, feine Wiki-Rechte, automatische GM-Vorbereitung und der Lorekeeper-Chat. Die [Tarife](https://playepicly.com/plans/) liegen bei 9,99 und 19,99 US-Dollar; das Wiki ist im Free-Tarif nur einmal testbar.

**Vorsprung gegenüber DnD Recorder:** Audio-/Notizimport, Spielerportal, Sharing, Review/Versionen, Prep-Dokumente, Lore-Chat.

**Vorteil DnD Recorder:** echte Discord-Voice-Aufnahme statt Upload-Workflow, Multi-Server-Bindings, BYOK und Sessionbilder.

**Konsequenz:** Offline-Upload und Spielerzugang vergrößern den Markt, sollten aber erst auf einer stabilen kanonischen Wiki-Schicht aufbauen.

#### SessionKeeper – Referenz für plattformübergreifende Spielerbindung

[SessionKeeper](https://www.sessionkeeper.ai/) kann in iOS, Android, Web, Discord oder per Audio-Upload aufnehmen. Es kombiniert Wiki und Zusammenfassung mit Charakterportraits, Achievements, Podcasts und DM-/Spieler-Assistenten. Laut [FAQ](https://www.sessionkeeper.ai/faq) werden Sprecher mit Einwilligung erkannt und Kampagnen nur mit eingeladenen Mitgliedern geteilt. Der Discord-Bot und das Wiki beginnen im 9,99-Dollar-Tarif.

**Vorsprung gegenüber DnD Recorder:** mobile und lokale Aufnahme, Spieleraccounts, Party-Sharing und emotionale Retention durch Portraits, Achievements und Audioformate.

**Vorteil DnD Recorder:** deutlich mehr DM-Kontrolle, Wiki-CRUD, Multi-Server/-Channel, BYOK und potenziell günstigeres Abo.

**Konsequenz:** Spielerzugang und später eine Reader-App sind strategisch sinnvoll; Podcasts und Achievements sind erst danach sinnvolle Bindungsfunktionen.

#### The Chronicler – Referenz für konsequente Discord-Bedienung

[The Chronicler](https://rpgchronicler.com/getting_started.html) verwaltet Kampagnen, Charaktere, NPCs, Orte, Fraktionen und Quests über [Slash-Befehle](https://rpgchronicler.com/slash_commands.html). Spieler verknüpfen ihre Charaktere mit Discord; der Bot beantwortet Lore- und Vorbereitungfragen direkt per Mention oder DM und unterstützt wiederkehrende Session-Erinnerungen.

**Vorsprung gegenüber DnD Recorder:** Discord-Chat, Erinnerungen und nahezu vollständige Worldbuilding-Verwaltung ohne Wechsel ins Web.

**Vorteil DnD Recorder:** stärkeres Web-Panel, automatische Wiki-Aggregation, freie KI-Wahl, Multi-Server/-Channel und deutscher Fokus.

**Konsequenz:** `/wiki`, `/quest` und `/recall` müssen nicht das Web-Panel kopieren, aber Status, schnelle Korrekturen und Lore-Abfragen wären wertvolle Discord-Abkürzungen.

#### Bardlog – Referenz für Transkript und Wiedergabe

[Bardlog](https://www.bardlog.com/) nimmt jeden Discord-Sprecher auf einer eigenen Spur auf. Nutzer können eine Transkriptzeile anklicken und exakt zur Audiostelle springen, nach Sprecher oder Begriff suchen, Stille überspringen und Audio-/Videoclips exportieren. Zusätzlich werden D&D-Beyond-Charakterbögen eingeblendet. Aufnahme und Transkription werden kostenlos angeboten; KI-Zusammenfassung und Wiki laufen über Guthaben.

**Vorsprung gegenüber DnD Recorder:** getrennte Audiospuren, transcript-synchrone Wiedergabe, Volltextsuche, Clips, D&D-Beyond-Integration und Audioimport.

**Vorteil DnD Recorder:** stärkere automatische Chronik- und Wiki-Verwaltung, Queststatus, Sessionbilder, Multi-Server und BYOK.

**Konsequenz:** Die Sprecherzuordnung von DnD Recorder ist funktional stark, wird aber erst mit klickbarer Audiostelle, Suche und sichtbarer Zuverlässigkeit zum klaren Produktvorteil.

### Neue und aufkommende Wettbewerber als Trendsignal

Diese Produkte wurden nicht in die Hauptmatrix aufgenommen, zeigen aber wichtige Marktbewegungen:

- [StormScape](https://stormscape.app/) fordert pro Spieler und Session eine Einwilligung an, speichert getrennte Sprecherspuren, erzeugt alle 20 Minuten Live-Kapitel und erstellt Charaktertagebücher, eine In-World-Zeitung sowie DM-Vorbereitungshinweise. Das ist ein starkes Beispiel für Consent-by-Design und emotional teilbare Artefakte.
- [Kazkar](https://kazkar.ai/) kombiniert Discord-Aufnahme mit Lore-Wiki, automatischem Beziehungsgraph, Spielerportal, mehr als 30 Sprachen und mehreren Kampagnen pro Server. Es zeigt, dass ein Beziehungsgraph und Mehrsprachigkeit bereits in günstigeren Neueinsteigerprodukten auftauchen.
- [Bardkeeper](https://bardkeeper.com/) bewirbt ein wachsendes Wiki mit Beziehungen und eine MCP-Anbindung, über die Claude, ChatGPT oder Gemini Kampagnenwissen durchsuchen können. Offene Integrationen könnten langfristig wichtiger werden als ein einziger fest eingebauter Chatbot.

### Quellenbasis

- Goblin Scribe: [Produkt, Funktionen, Befehle und Preise](https://scribe.goblinstack.com/)
- The Chronicler: [Einstieg und Preise](https://rpgchronicler.com/getting_started.html), [Slash-Befehle](https://rpgchronicler.com/slash_commands.html)
- SessionKeeper: [Produkt](https://www.sessionkeeper.ai/), [Preise](https://www.sessionkeeper.ai/pricing), [FAQ](https://www.sessionkeeper.ai/faq)
- Archivist: [Produkt](https://www.rpgarchivist.io/), [Preise](https://www.rpgarchivist.io/pricing), [FAQ](https://www.rpgarchivist.io/faq), [Dokumentation](https://www.rpgarchivist.io/documentation)
- Epicly: [Produkt](https://playepicly.com/), [Preise](https://playepicly.com/plans/), [Dokumentation](https://www.docs.playepicly.com/getting-started/), [Changelog](https://playepicly.com/changelog/)
- Bardlog: [Produkt und Funktionsübersicht](https://www.bardlog.com/)
- Trendsignale: [StormScape](https://stormscape.app/), [Kazkar](https://kazkar.ai/), [Bardkeeper](https://bardkeeper.com/)

### Überschneidung und tatsächliche Differenzierung

#### Was inzwischen Basiserwartung ist

Die folgenden Funktionen unterscheiden DnD Recorder nicht mehr zuverlässig vom Markt:

- Discord-Aufnahme mit automatischem Recap
- Sprechererkennung und Transkript
- Erkennung von NSCs, Orten, Quests und Gegenständen
- ein automatisch wachsendes Wiki
- Sessionbilder oder Charakterportraits
- mehrere Kampagnen
- ein Kampagnenchat beziehungsweise Lore Recall in bezahlten Stufen

Diese Funktionen bleiben kaufentscheidend, sind aber Kategorie-Features und keine alleinigen USPs.

#### Wo DnD Recorder sich heute abhebt

Die derzeit stärkste Differenzierung liegt in der **Kombination** folgender Eigenschaften:

1. **Deutsch zuerst:** Oberfläche, Dokumentation und erzwungene deutsche Zusammenfassung sind nicht nur eine auswählbare Sprache, sondern Kern des Produkts.
2. **KI-Souveränität:** Nutzer wählen Anthropic, Gemini, OpenAI, SiliconFlow oder Ollama, können eigene Keys verwenden und Transkription über OpenAI, Replicate oder einen eigenen kompatiblen Endpunkt betreiben. Keiner der untersuchten direkten Wettbewerber bewirbt eine vergleichbare BYOK-/Self-hosted-Kombination.
3. **Discord-Sprecher ohne Pflichtaccount:** Discord-Audioaktivität wird mit Wortzeitstempeln verbunden; Charakter- und Spielernamen können anschließend ergänzt werden. Spieler müssen dafür aktuell keinen eigenen Webaccount anlegen.
4. **Mandanten- und Channel-Modell:** mehrere Server je DM sowie mehrere Kampagnen auf demselben Server mit getrennten Voice- und Summary-Channels sind bereits fachlich vorgesehen.
5. **Charakterbezogene Bildgenerierung:** Avatare der Kampagnenmitglieder können als Referenzen für Sessionbilder dienen; das geht über einen generischen Szenenprompt hinaus.
6. **Lange Discord-Abende:** 30-Minuten-Chunks und Zeitoffset-Merge sind gezielt für fünf- bis sechsstündige Sessions gebaut.

Keiner dieser Punkte allein ist unangreifbar. Zusammen bilden sie aber eine glaubwürdige Position für deutschsprachige, technisch selbstbestimmte DMs.

#### Wo die aktuelle App noch hinter der eigenen Aussage zurückbleibt

Das Wiki ist derzeit **Stufe 1**: Session-Summaries werden nach Namen aggregiert; Queststatus wird über eine einfache Priorität fortgeschrieben; manuelle CRUD-Einträge und Session-Verknüpfungen werden darübergelegt. Das ist nützlich, aber noch keine belastbare „Kampagnenwahrheit“:

- ähnliche Namen und Aliasse können doppelte Entitäten erzeugen
- automatisch zusammengefügte Beschreibungen können widersprüchlich werden
- manuelle Korrekturen sind nicht als geschützte Fakten mit Feldpriorität modelliert
- es gibt keine Vorschlagswarteschlange mit Vorher-/Nachher-Diff
- Merge, Undo und Versionshistorie fehlen
- Wiki-Aussagen führen nicht bis zur belegenden Transkriptstelle zurück
- Fraktionen, Beziehungen und ein echter Graph fehlen
- Questfortschritt ist aggregiert, aber nicht als überprüfte Zustandsänderung mit Begründung gespeichert

Damit ist der bisher formulierte USP „automatische Objektextraktion, selbstaufbauendes Wiki und Questfortschritt“ **als Nutzenversprechen gerechtfertigt, als Alleinstellungsbehauptung jedoch nicht**. Goblin Scribe, Archivist, Epicly, SessionKeeper, Kazkar und Bardkeeper überschneiden sich deutlich damit.

### Empfohlene USP-Fassung

Für den heutigen Stand ist folgende Aussage belastbarer:

> Der deutschsprachige Discord-Chronist für lange Spielabende: DnD Recorder ordnet Stimmen euren Charakteren zu und verwandelt Sessions mit der KI eurer Wahl in eine editierbare Chronik aus Recap, Quests, NSCs, Orten und charakterbezogenen Bildern.

Nach Umsetzung der kanonischen Wissensschicht kann sie geschärft werden zu:

> Der deutschsprachige, selbstbestimmte Discord-Chronist, der jede Aussage bis zur Session belegbar macht und aus langen Spielabenden eine von der Gruppe kontrollierte Kampagnenwahrheit aufbaut – mit der KI eurer Wahl.

Die zweite Formulierung ist stärker als „automatisches Wiki“, weil sie drei konkrete Probleme adressiert, die viele Wettbewerber nur teilweise lösen: Nachvollziehbarkeit, menschliche Kontrolle und Providerunabhängigkeit.

### Priorisierter Funktionsausbau aus der Wettbewerbsanalyse

| Priorität | Ausbau | Nutzen für DnD Recorder | Vorbild/Marktsignal | Monetarisierung |
| --- | --- | --- | --- | --- |
| P0 | **Kanonische Wiki-Vorschläge:** Create/Update/Merge als Diff prüfen, annehmen, ablehnen und rückgängig machen | macht den USP wahr und schützt Kampagnenwissen vor KI-Fehlern | Archivist, Epicly, Goblin Scribe | Basisprüfung kostenlos; Verlauf und Bulk-Review im Paid-Tarif |
| P0 | **Quellen je Fakt:** Session, Sprecher, Transkriptzeit und Extraktionsmodell an jeder Änderung | schafft Vertrauen, erleichtert Korrektur und ist schwerer kopierbar als ein Recap | Archivist Review, Bardlog Audio-Sync | Kernfunktion, nicht vollständig paywallen |
| P0 | **Manuelle Fakten schützen:** Feldherkunft, Priorität, Alias-/Duplikat-Merge und Konfliktregeln | verhindert, dass spätere KI-Läufe DM-Korrekturen überschreiben | Epicly Versionierung, Goblin Merge/Undo | vollständige Historie ab Abenteurer |
| P0 | **Pause/Resume und Consent-by-Design:** sichtbare Teilnehmerliste, Einwilligungsstatus, nicht aufgenommene Sprecher | schließt UX-/Datenschutzlücke im Discord-Flow | Goblin Scribe, StormScape, SessionKeeper | Standardfunktion aller Tarife |
| P1 | **Kampagnensuche und Lore Recall mit Quellenlinks** | häufigster Wiederkehrnutzen zwischen Sessions; nutzt das verbesserte Wiki | Goblin, Archivist, Epicly, Chronicler | begrenzte Free-Fragen, großzügig in Paid; BYOK ohne künstliche Tokenmarge |
| P1 | **Spielerrolle und Spoilerrechte:** Party/DM-only/Public je Objekt, Einladungen, Reader-Ansicht | erhöht Retention und organisches Wachstum; Voraussetzung für Android | SessionKeeper, Archivist, Epicly | Lesen grundsätzlich inklusive; feinere Rechte und Co-DM später Premium |
| P1 | **Offline-Import:** Audio, Transkript und Rohnotizen; später Multitrack-ZIP | erschließt Tischrunden und laufende Altkampagnen | Archivist, Epicly, Bardlog | im Chronist-Tarif oder begrenzter Free-Test |
| P1 | **Transkript-Suche und klickbare Audiostelle** | macht die gute Sprecherzuordnung sichtbar nutzbar und belegbar | Bardlog | Suche Standard; Clips/erweiterte Exporte Premium |
| P1 | **Datenexport:** Markdown, JSON, PDF und Obsidian-kompatibles ZIP | reduziert Lock-in-Angst bei BYOK-affiner Zielgruppe | Archivist | Basisexport als Nutzerrecht, formatierte Pakete Premium |
| P2 | **Fraktionen, Beziehungen, Aliasse und Graph** | erhöht den Wert langer Kampagnen und differenziert das Wiki visuell | Archivist, Goblin Scribe, Kazkar | Chronist oder Gildenmeister |
| P2 | **Strukturierte Charakterintegration:** zunächst D&D-Beyond-Link/Import, später weitere Systeme | verbessert Namen, Sprecher, Bilder und kampagnenspezifischen Kontext | Bardlog | Abenteurer/Chronist |
| P2 | **GM-Vorbereitungsbrief:** offene Fäden, erwartbare Entscheidungen, betroffene NSCs, Checkliste | übersetzt Dokumentation in direkte Zeitersparnis vor der nächsten Runde | Epicly GM Guide, StormScape Intelligence | Chronist |
| P2 | **Session-Erinnerungen und Recap-Mail an die Gruppe** | kleine Umsetzung mit hohem Wiederkehr- und Aktivierungseffekt | Chronicler, Epicly | Standard beziehungsweise Abenteurer |
| P2 | **Bildstil und Charakterkonsistenz ausbauen** | verstärkt eine vorhandene Differenzierung statt ein neues Nebensystem zu beginnen | Goblin Custom Styles, SessionKeeper Portraits | zusätzliche Stile/Referenzsets Premium, Providerkosten bleiben BYOK |
| P3 | **Foundry-/VTT- und MCP-Schnittstelle** | macht Kampagnenwissen in bestehenden DM-Workflows verfügbar | Archivist Foundry, Bardkeeper MCP | Gildenmeister/API-Tarif |
| P3 | **Charaktertagebücher, Achievements, Podcast oder In-World-Zeitung** | emotionale Spielerbindung und teilbare Artefakte | StormScape, SessionKeeper | optionales Engagement-Paket nach Spielerrolle |
| P3 | **Öffentlicher Campaign Hub und Social Clips** | relevant für Actual Play und Pro-DMs, nicht für den Kern-Home-DM | Epicly, Archivist, Bardlog | Gildenmeister/Creator-Tarif |

### Was bewusst nicht sofort kopiert werden sollte

- Ein vollständiges VTT, Encounter Builder oder Regelwerk würde den Fokus verwässern und gegen etablierte Plattformen antreten.
- Podcasts, Zeitungen und Achievements erzeugen Charme, lösen aber die aktuelle Vertrauenslücke im Wiki nicht.
- Eine breite Analytics-Suite zu Stimmung und Spielanteilen ist datenschutzsensibel und erst nach Consent-, Rollen- und Datenqualitätsarbeit sinnvoll.
- Mehr als ein eingebauter Kampagnenchat ist nicht automatisch besser. Zuerst müssen Suche, Quellen und Rechte zuverlässig sein.
- Mehrsprachigkeit sollte den deutschen Fokus nicht verzögern; später kann sie als Expansion folgen.

### Konsequenz für Preis und Positionierung

Die Wettbewerber bündeln typischerweise KI-Verbrauch und begrenzen deshalb Sessions oder Stunden. Ihre Preise bleiben ein Zahlungsbereitschafts-Benchmark, nicht die Kostenkurve von DnD Recorder. Der Einstieg liegt sichtbar meist zwischen etwa 6 und 10 US-Dollar, während tiefe Wiki-, Chat- und Partyfunktionen häufig erst zwischen 10 und 20 US-Dollar angeboten werden.

Für das BYOK-Modell bleibt die Staffelung 0/4,99/9,99 Euro plausibel, wenn die Stufen nicht nur Zähler, sondern nachvollziehbaren Produktwert vermitteln:

- **Novize:** vier Sessions, eine Kampagne/ein Server, deutscher Recap, Basis-Wiki, Korrektur und Sessionbild mit eigenen Keys.
- **Abenteurer 4,99 Euro:** drei Kampagnen, kanonischer Review-Fluss, Versionshistorie, Exporte, eigene Prompts und Gruppenfreigabe.
- **Chronist 9,99 Euro:** Multi-Server, Lore Recall, Offline-Import, Beziehungen/Graph, erweiterter Prep-Brief und Prioritätsverarbeitung.
- **Gildenmeister später:** Co-DM, VTT/MCP/API, öffentlicher Campaign Hub, Bulk-Export und Creator-/Communityfunktionen.

Der wirtschaftliche Nachteil von BYOK bleibt die Einrichtungshürde. Onboarding, Key-Prüfung, transparente Kostenhinweise und ein optionaler OpenRouter-Sparmodus müssen diese Reibung reduzieren. Ein späterer Managed-AI-Tarif wäre ein getrenntes Produkt mit eigenen Credits und höherem Preis, nicht stillschweigend Bestandteil von 4,99 oder 9,99 Euro.

## Was monetarisiert wird

Gut geeignete Entitlements:

- vier monatliche Free-Sessions; bezahlte Tarife ohne reguläres Sessionlimit
- Zahl aktiver Kampagnen und Discord-Server
- individuelle Prompts, Exporte, erweiterte Wiki-Abgleiche und Automationen
- Audio-Aufbewahrungsdauer und Speicherumfang
- optionales Managed-AI-Guthaben als ausdrücklich getrenntes Add-on
- kampagnenweiter Assistent, Beziehungsgraph und erweiterte Questanalyse
- Co-DM-/Community-Funktionen
- PDF-, Markdown-, JSON- und später API-Export
- Prioritätswarteschlange
- Offline-Audioupload
- zusätzliche Discord-Server oder Speicherpakete

Nicht hinter einer Bezahlschranke verschwinden dürfen:

- Einwilligungs-, Datenschutz-, Lösch- und Exportgrundrechte
- Lesen bereits erzeugter eigener Inhalte
- Korrektur falscher KI-Ergebnisse
- eine brauchbare deutsche Zusammenfassung
- ein erlebbarer Teil der Entitätenextraktion, also der Kernnutzen
- später der einfache Lesezugriff eingeladener Spieler
- Eingabe und Nutzung eigener API-Keys; BYOK ist die Basis, nicht das Upsell

## Wirtschaftliche Leitplanken

Die frühere Kalkulation von Whisper-Minuten als Kosten des Free-Tarifs war für das geplante BYOK-Modell falsch. Wenn ein DM seinen eigenen OpenAI-, Replicate-, OpenRouter- oder anderen Provider-Key nutzt, entstehen diese Inferenzkosten beim DM und nicht bei DnD Recorder.

Gemessen werden müssen trotzdem:

- Audiominuten und temporäre Dateigröße für Kapazitäts- und Missbrauchsschutz
- dauerhafter Speicher in Byte-Tagen, Backups und ausgehender Audio-/Bild-Traffic
- FFmpeg-, Queue-, Datenbank- und Verarbeitungszeit als Hostinglast
- Payment-, E-Mail-, Monitoring- und Supportkosten
- Provider, Modell, Tokens und Fehler zur Produktdiagnose, jedoch mit `payer = USER`
- nur bei Admin-/Plattform-Keys: reale KI-Kosten mit `payer = PLATFORM`
- kostenlose OpenRouter-Aufrufe mit `payer = FREE_PROVIDER` und Kostenwert null

`CostEvent` benötigt deshalb mindestens `payer: USER | PLATFORM | FREE_PROVIDER`, `credentialSource`, `taskType`, `provider`, `model`, `quantity` und `costAmount`. BYOK-Nutzung darf nicht versehentlich in eine Plattform-Margenkalkulation eingehen.

Die relevante Deckungsbeitragsrechnung lautet:

```text
Aboerlös netto
- Payment- und Steuerabwicklung
- anteiliges Hosting, Storage, Backup und Traffic
- E-Mail, Monitoring und Support
- ausschließlich tatsächlich plattformbezahlte KI
= Deckungsbeitrag
```

Ziel bleibt eine hohe Softwaremarge, aber die Freigabe von Sessions muss nicht aus einer vermeintlichen KI-Marge abgeleitet werden. Speicher-Retention, technische Sechs-Stunden-Grenze, Rate Limits und Fair Use schützen die reale Infrastruktur.

## OpenRouter-Sparmodus

Die Idee ist sinnvoll, sollte aber in zwei klar getrennten Varianten umgesetzt werden:

1. **Empfohlen: OpenRouter-BYOK.** Der DM hinterlegt einen eigenen OpenRouter-Key und wählt `openrouter/free` oder ein konkretes `:free`-Modell. Kosten und Rate Limits liegen damit beim jeweiligen Nutzerkonto; DnD Recorder behält sein nahezu kostenfreies Betriebsmodell.
2. **Optional in der Beta: zentraler Community-AI-Pool.** Ein DnD-Recorder-Key stellt kostenlose Modelle best effort bereit. Das ist ein Beta-Override, keine garantierte Tarifleistung.

Der [OpenRouter Free Models Router](https://openrouter.ai/docs/guides/routing/routers/free-router) ist kostenfrei, wählt aber zufällig ein aktuell passendes Modell aus. Verfügbarkeit, Geschwindigkeit und Modellqualität können schwanken. Laut [OpenRouter-Limits](https://openrouter.ai/docs/api_reference/limits) gelten für Free-Modelle gemeinsame Tages- und Minutenlimits; ein zentraler Key wäre deshalb ein Engpass für alle Mandanten. OpenRouter nennt 50 Free-Anfragen pro Tag ohne vorherigen Credit-Kauf und bis zu 1.000 pro Tag nach mindestens 10 US-Dollar erworbenen Credits.

Geeignete Aufgaben für den kostenlosen Router:

| Aufgabe | Free Router | Begründung |
| --- | --- | --- |
| Sessiontitel, Kurz-Teaser, Tags | ja | kurz, leicht validierbar und bei Ausfall verzichtbar |
| englischer Textprompt für das Sessionbild | ja | keine kanonischen Kampagnendaten; Ergebnis kann manuell editiert werden |
| einfache Standard-Zusammenfassung | optional | nur mit Schema-Prüfung, Modellprotokoll und sichtbarem Qualitätsmodus |
| finale Objektextraktion und Questfortschritt | zunächst nein | strukturierte Fehler verändern die Kampagnenwahrheit |
| Wiki-Deduplizierung und bestehende Lore überschreiben | nein | hohe Folgekosten bei falscher Zuordnung |
| Audiotranskription oder Bildgenerierung | nein | der Text-Router ersetzt dafür keinen Whisper-/Bildprovider-Key |

Technische Regeln:

- Aufgabenbasierte Routen statt eines einzigen LLM-Providers pro Kampagne: `TITLE`, `IMAGE_PROMPT`, `SUMMARY`, `ENTITY_EXTRACTION`, `WIKI_RECONCILIATION`.
- Pro Aufgabe `USER_BYOK`, `OPENROUTER_FREE_BYOK`, `PLATFORM_BETA_GRANT` oder später `MANAGED_CREDITS` speichern.
- JSON-/Schema-Validierung und höchstens ein kontrollierter Repair-Versuch; keine Endlosschleife auf Free-Modellen.
- 429/Provider-Ausfall mit `Retry-After`, exponentiellem Backoff und Queue behandeln. Ein Fehler darf keine neue Session verbrauchen.
- Das tatsächlich gewählte Modell aus der OpenRouter-Antwort protokollieren und im Diagnosebereich sichtbar machen.
- Kein heimlicher Fallback von kostenlos auf einen plattformbezahlten Provider.
- Für kanonische Wiki-Änderungen immer menschliche Korrektur beziehungsweise eine zuverlässige BYOK-Route vorsehen.
- Datenschutzmodus und Provider-Policy berücksichtigen. OpenRouter beschreibt Promptspeicherung als Opt-in, weist aber auf separate Upstream-Provider hin; die [Datenverarbeitung muss daher transparent konfiguriert](https://openrouter.ai/docs/guides/privacy/data-collection) und in der Unterauftragnehmerliste dokumentiert werden.

Der Sparmodus senkt also die Einstiegshürde für Textaufgaben, beseitigt aber nicht die Notwendigkeit eines Transkriptions-Keys. Im Onboarding muss dieser Unterschied ausdrücklich erklärt werden.

## Zentrale technische Lücke: der zahlende Mandant

Aktuell gehören Kampagnen über GM-Mitgliedschaften zu Benutzern; eine Discord-Installation hat keinen Eigentümer. Bei zwei GMs wäre deshalb unklar, wessen Abo eine Session belastet. Vor Billing wird ein eindeutiger `Workspace` als Mandanten-, Entitlement- und Abrechnungsgrenze benötigt.

Empfohlenes Zielmodell:

- `Workspace`: Name, Besitzer, Status, Zeitzone
- `WorkspaceMember`: `OWNER | ADMIN | MEMBER`
- `Campaign.workspaceId`
- `DiscordInstallation.workspaceId?`; `NULL` bedeutet echte Geisterinstallation
- `Session.workspaceId`; historische Abrechnungszuordnung bleibt dadurch stabil
- `BillingProfile`: Provider-Kunden-ID, Rechnungsland/-E-Mail, niemals Kartendaten
- `Subscription`: Provider-ID, Planversion, Status, Periode, Kündigung, Grace Period
- `UsageEvent`: Metrik, Menge, `RESERVED | COMMITTED | RELEASED`, idempotenter Quellschlüssel
- `UsageBucket`: atomarer Zähler pro Workspace, Metrik und Periode
- `EntitlementOverride`: begründete, befristete Superadmin-Kulanz
- `BillingWebhookEvent`: deduplizierte Provider-Events und Fehler
- `CostEvent`: Kostenträger und Providerkosten unabhängig von der Rechnung
- `AiCredentialProfile`: verschlüsselte Nutzer-Credentials samt Provider, Status und letzter erfolgreicher Prüfung
- `AiTaskPolicy`: Credential-Modus und Fallbackregel pro Aufgabentyp
- `BetaKeyGrant`: befristeter Plattform-Key-Zugriff mit Ablauf, Zweck und Auditspur
- `AuditLog`: Planänderungen, Sperren, Credits und Adminaktionen

API-Schlüssel dürfen weder Bestandteil von `Subscription` noch `Entitlement` sein. Sie werden serverseitig verschlüsselt, nie vollständig zurückgegeben, bei Widerruf sofort aus der effektiven Task-Policy entfernt und über einen expliziten Verbindungstest geprüft. So bleibt Billing von Credential-Verantwortung und Beta-Grants sauber getrennt.

## Entitlement-Schicht

Routen prüfen keine Tarifnamen wie `plan === "premium"`, sondern eine zentrale Autorisierung:

```text
sessions.monthly
sessions.unlimited
recording.max_minutes
campaigns.active
discord_servers.active
custom_prompts
custom_ai_endpoint
community_ai_pool
exports.markdown_pdf_json
managed_ai.credits
wiki.basic_extraction
wiki.reconciliation
wiki.export
player_seats
audio.retention_days
offline_upload
queue_priority
```

So können Preise und Paketgrenzen geändert oder Bestandskunden auf einer alten Planversion belassen werden, ohne Fachrouten umzuschreiben.

Eigene Standard-Provider-Keys sind bewusst kein Premium-Entitlement. `managed_ai.credits` bedeutet ausschließlich von DnD Recorder bezahlte Nutzung. Superadmin-Testkeys werden als befristeter `PLATFORM_BETA_GRANT` beziehungsweise `EntitlementOverride` mit Ablaufdatum geführt und niemals aus dem normalen Abo abgeleitet.

## Quotenablauf bei `/record`

```text
/record
  -> Installation beansprucht?
  -> E-Mail bestätigt, Account aktiv und durch Superadmin freigegeben?
  -> Kampagne und Workspace eindeutig?
  -> Server-/Kampagnen-Entitlement erfüllt?
  -> Free-Tarif: Monats-Sessionplatz atomar reservieren
  -> bezahlter Tarif: Fair-Use- und Missbrauchsschutz prüfen, kein normales Audiobudget
  -> benötigte Nutzer-Keys beziehungsweise gewählten Sparmodus vorprüfen
  -> Session + UsageEvent in derselben Transaktion anlegen
  -> Aufnahme starten
  -> beim Stoppen reale Nutzung committen
  -> Transkription, Zusammenfassung und Wiki
```

Regeln:

- Die Reservierung verhindert ausschließlich im Free-Tarif, dass parallele Starts das Viererlimit umgehen.
- Eine sehr kurze, technisch leere Testaufnahme kann freigegeben werden.
- Dieselbe Session darf nach einem Provider- oder Verarbeitungsfehler beliebig neu angestoßen werden, ohne erneut zu zählen.
- Schlägt eine Session vollständig fehl und erzeugt weder nutzbares Transkript noch Chronik, wird der Free-Platz automatisch freigegeben oder durch den Admin gutgeschrieben.
- Fehlende, abgelaufene und falsche Nutzer-Keys werden möglichst vor der Aufnahme mit einer konkreten Einrichtungsanleitung gemeldet.
- Verwaiste Reservierungen werden nach Maximaldauer plus Karenz automatisch committed oder freigegeben.
- Summary-, Bildprompt- oder Wiki-Neugenerierung verbraucht keinen Sessionplatz. Bei BYOK ist kein künstliches KI-Regenerationskontingent nötig; Rate Limits schützen nur die Plattform.
- `/status` und Dashboard zeigen Nutzung, Reset-Datum und Upgradeweg.
- Der Bot fragt den Zahlungsprovider nie synchron ab; lokale, per Webhook gepflegte Entitlements sind maßgeblich.

## Zahlungsanbieter und Flows

Zwei sinnvolle Optionen:

1. Stripe Checkout, Billing und Tax: mehr Kontrolle; DnD Recorder bleibt Händler und trägt Steuer-/Meldepflichten.
2. Paddle als Merchant of Record: Paddle übernimmt laut [Paddle-Dokumentation](https://developer.paddle.com/get-started/how-paddle-works/saas/) Händlerrolle und Tax-Compliance, ist aber teurer und bindet stärker.

Die Integration bleibt providerneutral:

```ts
interface BillingProvider {
  createCheckout(workspaceId: string, planKey: string): Promise<{ url: string }>;
  createPortal(workspaceId: string): Promise<{ url: string }>;
  fetchSubscription(externalId: string): Promise<NormalizedSubscription>;
  verifyWebhook(rawBody: Buffer, headers: unknown): VerifiedBillingEvent;
}
```

Notwendige Endpunkte:

- `GET /billing/plans`
- `GET /billing/status`
- `GET /usage/current`
- `POST /billing/checkout`
- `POST /billing/portal`
- `POST /billing/webhooks/:provider`

Webhook-Regeln:

- Signatur am unveränderten Raw Body prüfen.
- Provider-Event-ID eindeutig speichern; doppelte und ungeordnete Events tolerieren.
- Schnell antworten und intern asynchron verarbeiten.
- Bei Unklarheit Subscription beim Provider abgleichen.
- Checkout-Redirect aktiviert niemals selbst Premium.
- Täglicher sowie manueller Reconciliation-Job.

[Stripe verlangt den Raw Body und weist auf doppelte beziehungsweise ungeordnete Events hin](https://docs.stripe.com/webhooks). Kündigung, Zahlungsmittel und Rechnungsdownloads sollten zunächst über das [gehostete Kundenportal](https://docs.stripe.com/customer-management) laufen.

## Produktregeln vor der Implementierung

- Upgrade sofort; Downgrade zum Periodenende.
- Zahlung fehlgeschlagen: beispielsweise sieben Tage Karenz, danach keine neue Aufnahme.
- Bestehende Chroniken bleiben auch nach Kündigung oder Zahlfehler lesbar.
- Beim Downgrade werden überzählige Kampagnen/Server pausiert, niemals gelöscht.
- Rückbuchung sperrt neue kostenpflichtige Aktionen, löscht aber keine Inhalte.
- Beta-/Lifetime-Zugänge und Admin-Key-Grants sind befristete Overrides mit Auditspur und nie impliziter Tarifbestandteil.
- Jahresabo erst nach validierter 30-/60-/90-Tage-Retention; üblich sind zwei Gratismonate.
- Ein zusätzlicher Server für etwa 1,99 Euro pro Monat ist ein nachvollziehbares Add-on. Session-/Bildpakete sind bei BYOK zunächst unnötig.
- Managed-AI wird später ausschließlich als klar benanntes Credit-Paket mit eigenem Preis, Budgetlimit und Kill-Switch angeboten.
- Eine Kündigung stoppt neue Premiumaktionen; Nutzer-Keys und bereits erzeugte Inhalte bleiben exportierbar und werden nicht als Druckmittel gesperrt.

## Superadmin und Operations

Der Superadmin benötigt zusätzlich:

- Workspace, Tarif, Subscription-Status, Laufzeit und Kündigung
- aktuelle Nutzung und Zahl aktiver Server
- Storage, Traffic und geschätzter Hostinganteil je Workspace
- Credential-Modus und Kostenträger je KI-Aufgabe; nur Plattformkosten fließen in die Marge ein
- Geisterinstallation, beansprucht, Freigabe offen, gesperrt
- befristete Plan-, Beta-Key- und Managed-Credit-Overrides mit Begründung und Ablaufdatum
- Webhookfehler, Reconciliation und Audit-Historie
- Payment Failure, Refund und Dispute

Vor zahlenden Kunden außerdem:

- Offsite-Backups und getesteter Restore
- S3-kompatibler Object Storage mit Lifecycle-Regeln und signierten URLs
- Provider-Budgetalarme und globaler Kill-Switch ausschließlich für Plattform-Keys
- Redis-basiertes, verteiltes Rate Limiting
- idempotente Jobs und Bildgenerierung über Queue statt langem synchronem Request
- Monitoring für Aufnahme, Verarbeitung, Billing und Mail

## Recht, Datenschutz und Steuern

Vor Zahlungsstart fachlich/rechtlich prüfen:

- Preise für Verbraucher inklusive Umsatzsteuer
- EU-B2C-OSS und Steuersatz des Kundenlandes; siehe [EU One Stop Shop](https://europa.eu/youreurope/business/taxation/vat/one-stop-shop/index_de.htm)
- AGB, Datenschutz, Widerruf, Kündigung, Leistungs- und Erstattungsregeln
- AV-Verträge und Unterauftragnehmerliste für Payment, Mail, KI, Hosting und Storage
- transparente Einwilligung aller Voice-Teilnehmer und Lösch-/Aufbewahrungsfristen
- Self-Service für Datenexport, Accountlöschung und Abo-Kündigung
- getrennte Aufbewahrung gesetzlich erforderlicher Rechnungsdaten bei Accountlöschung

Stripe Tax kann bei Berechnung helfen, ersetzt laut [Stripe Tax Setup](https://docs.stripe.com/tax/set-up) aber nicht automatisch Registrierung und Meldung. Vor Launch sind Steuer- und Rechtsberatung ein eigener Abnahmepunkt.

## Spielerrolle

Der spätere Spielerzugang gehört in den Workspace des DMs. Nötig sind:

- Trennung von globaler Plattformrolle und `CampaignMembership.role`
- Einladungslink mit einmaligem Claim
- eigene Read-DTOs ohne API-Keys, Prompts, Billing oder DM-Geheimnisse
- Sichtbarkeit je Wikiobjekt: `DM_ONLY | PARTY | PUBLIC`
- separate Freigabe für Audio und Volltranskript
- Spoiler-/Geheimnotizen getrennt von sichtbarem Questfortschritt
- kostenlose Leseplätze zum Start; Seats bleiben als späteres Entitlement modelliert

## Android

Die erste Android-Version sollte eine Reader-App für Spieler sein: Recaps, Wiki, Quests, Push und Offline-Lesen. Voraussetzungen:

- versionierte API `/api/v1` und OpenAPI-Vertrag
- kurzlebige Access- und rotierende Refresh-Tokens
- Geräteübersicht und einzelner Widerruf
- paginierte Delta-Synchronisation, `updatedSince`/ETags
- signierte Mediendownloads und FCM-Präferenzen
- Android Keystore und Contract-Tests

Wenn die App später digitale Upgrades verkauft, ist nach den dann geltenden Regeln Google Play Billing mit serverseitiger Verifikation und Real-Time Developer Notifications nötig. Eine reine Consumption-App kann extern erworbene Inhalte anzeigen; siehe [Google Play Payments Policy](https://support.google.com/googleplay/android-developer/answer/10281818) und [Billing-Backend-Leitfaden](https://developer.android.com/google/play/billing/backend).

## Umsetzungsphasen und Abnahmekriterien

### Phase 1 – Messen und entscheiden

- BYOK als Standard, vier Free-Sessions, Audio-Retention und Fair-Use-Regeln festlegen.
- `UsageEvent` für Entitlements sowie `CostEvent.payer` für Infrastruktur und echte Plattformkosten im Shadow Mode erfassen.
- Preis-Fake-Door 4,99/9,99 Euro ohne Abbuchung und kurze Befragung nach Session 1 und 4.
- Onboarding messen: Wie viele Nutzer scheitern am eigenen Transkriptions- oder LLM-Key?
- **Abnahme:** P50/P90/P95 für Dauer, Storage und Hostinglast sind nachvollziehbar; BYOK-Aufrufe erscheinen nicht als Plattformkosten.

### Phase 1b – OpenRouter-Sparmodus validieren

- OpenRouter als regulären Nutzer-Provider mit eigenem Key integrieren.
- `openrouter/free` zunächst nur für Titel, Tags und Bildprompt aktivieren.
- Strukturierte Standard-Summary separat gegen mehrere kostenlose Modelle testen; Qualitäts- und Schemaquote messen.
- Zentralen Community-Pool nur per Beta-Feature-Flag mit Tagesbudget, 429-Handling und ohne bezahlten Fallback testen.
- **Abnahme:** Kein Free-Router-Ausfall blockiert Transkript oder Session; tatsächliches Modell und Credential-Modus sind nachvollziehbar.

### Phase 2 – Workspace-/Ownership-Migration

- Workspaces und Mitglieder einführen.
- Kampagnen und beanspruchte Installationen eindeutig migrieren; echte Geister bleiben `workspaceId = NULL`.
- **Abnahme:** Jede neue Session besitzt genau einen Billing-Workspace.

### Phase 3 – Entitlements und Usage im Shadow Mode

- Planversionen, Usage Events/Buckets, Overrides und zentrale Autorisierung.
- Viererlimit zunächst nur berechnen und anzeigen; bezahlte Tarife prüfen Kampagnen/Server statt Audiostunden.
- Parallelstart, Monatswechsel, Fehler und verwaiste Reservierungen testen.
- **Abnahme:** Shadow-Zähler entsprechen den realen Free-Sessions, aktiven Kampagnen und Servern; Audiominuten bleiben eine reine Betriebsmetrik.

### Phase 4 – Checkout und Webhooks

- Provideradapter, Sandbox-Produkte, Checkout, Portal, Raw-Body-Webhooks und Reconciliation.
- Upgrade, Kündigung, Zahlfehler, Refund, Replay und Event-Reihenfolge testen.
- **Abnahme:** Lokale Entitlements bleiben unter Wiederholung und Ausfall konsistent.

### Phase 5 – UX und aktive Durchsetzung

- Verbrauch im Dashboard und `/status`, klare Botfehler, Upgradeflow und Admin-Billingansicht.
- Free-Sessionlimit, Kampagnen- und Mehrserver-Premium per Feature Flag schrittweise aktivieren.
- Beta-Nutzer über befristete Overrides migrieren.
- **Abnahme:** Kein `/record` umgeht Freigabe, Serverlimit oder Quoten; vorhandene Daten bleiben lesbar.

### Phase 6 – Produktionshärtung

- Storage, Backup/Restore, Monitoring, Billing-Runbooks, Datenschutz- und Rechtstexte.
- **Abnahme:** Provider-/Webhookausfälle, Restore und Kulanzcredits wurden praktisch getestet.

### Phase 7 – Spielerzugang

- Invite, Sichtbarkeiten, Read-API, Quest-/Wiki-Zugriff und Push-Ereignisse.

### Phase 8 – Android

- Reader-App und Offline-Sync; In-App-Kauf erst nach Bedarf und Regelprüfung.

## Offene Produktentscheidungen

Vor Monetarisierungscode müssen beantwortet werden:

1. Wer ist bei mehreren GMs Eigentümer und Zahler?
2. Wann zählt eine Session, und wann wird eine Reservierung zurückgegeben?
3. Kalender- oder individuelles Abo-Intervall?
4. Welche Aufgaben dürfen außer BYOK auch den best-effort OpenRouter-Sparmodus nutzen?
5. Welche Audio-Retention gilt je Tarif?
6. Ist nur Mehrserver oder auch Mehrkampagne Premium?
7. Welche Beta-Bestandskonten erhalten welchen Übergangstarif?
8. Wie viele Spieler sind inklusive und welche Inhalte sind DM-only?
9. Stripe/OSS oder Merchant of Record?
10. Soll Android nur lesen oder auch Käufe anbieten?
11. Ist 4,99 Euro bewusst auf einen Server begrenzt oder sind zwei Server conversion-stärker?
12. Welche klare Fair-Use-Grenze greift nur bei automatisiertem Missbrauch bezahlter „unbegrenzter“ Sessions?

Die Preisidee 4,99/9,99 Euro ist für ein BYOK-Produkt marktgerecht und kann großzügiger sein als die Pakete KI-inklusiver Wettbewerber. Der wichtigste nächste Schritt ist nicht Checkout-Code, sondern die Validierung von BYOK-Onboarding, vier kostenlosen Sessions, Multi-Server-Zahlungsbereitschaft und realem Storage-/Hostingwachstum. OpenRouter Free ist ein sinnvoller Spar- und Onboardingmodus, aber kein SLA-fähiger Ersatz für Nutzer-Keys oder ein späteres Managed-AI-Produkt.
