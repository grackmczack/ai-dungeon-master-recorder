<script lang="ts">
  import LegalPageShell from '$lib/components/LegalPageShell.svelte';
  import { openConsentSettings } from '$lib/consent.js';
</script>

<svelte:head>
  <title>Datenschutzerklärung — DnD Recorder</title>
  <meta name="description" content="Datenschutzerklärung des DnD Recorder für Web-App, Discord-Bot, Sessionaufnahmen und optionale Nutzungsanalyse." />
  <link rel="canonical" href="https://dnd-recorder.de/datenschutz" />
</svelte:head>

<LegalPageShell title="Datenschutzerklärung" eyebrow="Transparenz für deine Chronik">
  <h2>1. Verantwortlicher und Kontakt</h2>
  <p>
    Verantwortlich für die Verarbeitung personenbezogener Daten im Rahmen dieses privaten Beta-Projekts ist:<br /><br />
    René Greger<br />
    E-Mail: <a href="mailto:Artificer@dnd-recorder.de">Artificer@dnd-recorder.de</a>
  </p>

  <h2>2. Grundsätze und Rechtsgrundlagen</h2>
  <p>Wir verarbeiten personenbezogene Daten nur, soweit dies zum Betrieb, zur Sicherheit und zur Bereitstellung der von dir angeforderten Funktionen erforderlich ist. Je nach Vorgang beruht die Verarbeitung insbesondere auf:</p>
  <ul>
    <li>Art. 6 Abs. 1 Buchst. b DSGVO für Registrierung, Konto, Bot-Verknüpfung und die angeforderten Recorder- und Verwaltungsfunktionen,</li>
    <li>Art. 6 Abs. 1 Buchst. f DSGVO für Systemsicherheit, Missbrauchsprävention, Fehleranalyse und den kontrollierten Beta-Zugang,</li>
    <li>Art. 6 Abs. 1 Buchst. a DSGVO sowie § 25 Abs. 1 TDDDG für die optionale Nutzungsanalyse,</li>
    <li>Art. 6 Abs. 1 Buchst. c DSGVO, soweit gesetzliche Pflichten bestehen.</li>
  </ul>

  <h2>3. Hosting, Transportverschlüsselung und Serverprotokolle</h2>
  <p>Die Anwendung wird auf Servern von STRATO betrieben. Beim Aufruf werden technisch erforderliche Verbindungsdaten verarbeitet, insbesondere IP-Adresse, Zeitpunkt, angeforderte Ressource, übertragene Datenmenge, Referrer sowie Browser- und Systeminformationen. Dies dient der sicheren Auslieferung, Fehlererkennung und Abwehr von Angriffen.</p>
  <p>Die Website und die Tracking-Subdomain werden ausschließlich verschlüsselt per HTTPS bereitgestellt. Zugriffs- und Sicherheitsprotokolle werden grundsätzlich auf den für Betrieb und Sicherheitsanalyse erforderlichen Zeitraum begrenzt und regelmäßig rotiert. Bei einem Sicherheitsvorfall können betroffene Protokolle bis zur Klärung und Durchsetzung von Ansprüchen gesondert aufbewahrt werden.</p>

  <h2>4. Notwendige Cookies und lokaler Speicher</h2>
  <p>Für unbedingt erforderliche Funktionen werden folgende Informationen auf deinem Gerät gespeichert:</p>
  <ul>
    <li><code>dnd_session</code>: HTTP-only-Sitzungscookie für die Anmeldung, Speicherdauer bis zu 7 Tage; ohne dieses Cookie ist der geschützte Kontobereich nicht nutzbar.</li>
    <li><code>dnd_consent</code>: deine Datenschutzentscheidung mit Versions- und Zeitangabe, Speicherdauer bis zu 6 Monate.</li>
    <li>temporärer Session Storage: Rücksprungpfade und Registrierungsstatus bis zum Schließen des Browser-Tabs. Geheime Verifizierungs-, Reset- oder Discord-Verknüpfungstokens werden nicht für Analytics verwendet.</li>
  </ul>
  <p>Diese Zugriffe sind zur Bereitstellung der ausdrücklich angeforderten Funktionen erforderlich (§ 25 Abs. 2 TDDDG). Sie können nicht über den Analyse-Schalter deaktiviert werden.</p>

  <h2 id="registrierung">5. Registrierung, Anmeldung und Beta-Freigabe</h2>
  <p>Bei der Registrierung verarbeiten wir Anzeigename, E-Mail-Adresse, einen kryptografischen Hash des Passworts, Zeitstempel sowie E-Mail-Bestätigungs- und Freigabestatus. Passwörter werden nicht im Klartext gespeichert. Zur Double-Opt-in-Bestätigung und zum Zurücksetzen des Passworts werden zeitlich begrenzte Einmal-Links verwendet.</p>
  <p>Neue Konten werden während der Beta manuell geprüft und freigeschaltet. Dabei findet keine automatisierte Entscheidung oder Profilbildung statt. Ein abgelehnter oder gesperrter Zugang kann auf Anfrage überprüft werden.</p>

  <h2>6. Transaktionsmails</h2>
  <p>Für Bestätigung, Freigabe, Sicherheits- und Passwort-Reset-Mails verwenden wir Mailgun als Versanddienst. Verarbeitet werden insbesondere Empfängeradresse, Absender, Nachrichteninhalt sowie technische Zustell- und Fehlerdaten. Diese Daten werden ausschließlich für den angeforderten Versand, Zustellbarkeit und Missbrauchsschutz verwendet. Je nach technischer Zustellung kann eine Verarbeitung durch Mailgun-Unternehmen außerhalb der EU nicht ausgeschlossen werden; hierfür werden die jeweils verfügbaren Garantien nach Kapitel V DSGVO herangezogen.</p>

  <h2>7. Discord-Bot, Server und Kanäle</h2>
  <p>Wenn der Bot einem Discord-Server hinzugefügt oder mit einem Konto verbunden wird, verarbeitet DnD Recorder die Discord-Server-ID, den Servernamen, Installationsstatus sowie die für Kampagnen gewählten Voice- und Summary-Channel-IDs und -Namen. Zur Aufnahme und Sprecherzuordnung werden außerdem die für die Session nötigen Discord-Nutzerkennungen und sichtbaren Discord-Namen verarbeitet.</p>
  <p>Discord verarbeitet die Nutzung seiner Plattform eigenverantwortlich nach den dort geltenden Bedingungen. Der Bot kann erst für Aufnahmen genutzt werden, nachdem ein bestätigtes, aktives und manuell freigegebenes DnD-Recorder-Konto mit dem Server verbunden wurde.</p>

  <h2>8. Sprachaufnahmen und Sprecherzuordnung</h2>
  <p>Mit <code>/record</code> zeichnet der Bot das Gespräch im ausgewählten Discord-Voice-Channel auf. Verarbeitet werden Audiodaten, Zeitpunkte, Session- und Kanalzuordnung sowie Sprecheraktivitätsdaten. Die Sprecherzuordnung verknüpft Zeitabschnitte mit den beteiligten Discord-Namen; es wird kein biometrisches Stimmprofil zur eindeutigen Identifizierung erstellt.</p>
  <p>Der Dungeon Master beziehungsweise die Person, die die Aufnahme startet, muss alle Beteiligten vor Beginn verständlich informieren und sicherstellen, dass die Aufnahme und weitere Verarbeitung für die konkrete Runde rechtmäßig ist. Heimliche Aufnahmen sind untersagt. Jede beteiligte Person kann verlangen, dass die Aufnahme beendet und ihre personenbezogenen Inhalte gelöscht oder berichtigt werden, soweit keine gesetzlichen Gründe entgegenstehen.</p>

  <h2>9. Transkription, Zusammenfassungen, Bilder und KI-Anbieter</h2>
  <p>Je nach Kampagneneinstellung werden Audio, Transkript, Kampagnenkontext, Zusammenfassungen oder Bildprompts an den vom Nutzer ausgewählten Dienst übermittelt. Unterstützt werden insbesondere selbst gehostete Modelle sowie – bei entsprechender Auswahl und eigenem API-Schlüssel oder einer ausdrücklichen Beta-Freigabe – Dienste von OpenAI, Anthropic, Google, Replicate und SiliconFlow.</p>
  <p>Welche Daten ein Anbieter erhält, hängt von der Funktion ab: Transkriptionsdienste erhalten Audio; Sprachmodelle erhalten Transkript und erforderlichen Kampagnenkontext; Bilddienste erhalten Bildprompt und gegebenenfalls ausgewählte Referenzbilder. API-Schlüssel werden verschlüsselt gespeichert, in der Oberfläche nur gekürzt angezeigt und nicht für andere Kampagnen freigegeben, sofern dies nicht ausdrücklich administrativ gewährt wurde.</p>
  <p>Bei externen Anbietern kann eine Verarbeitung außerhalb des Europäischen Wirtschaftsraums stattfinden. Maßgeblich sind der ausgewählte Anbieter, dessen Vertrags- und Datenschutzbedingungen sowie eine gegebenenfalls bestehende Angemessenheitsentscheidung oder geeignete Garantien. Wenn du Drittlandverarbeitung vermeiden möchtest, nutze ausschließlich die angebotenen selbst gehosteten Komponenten.</p>

  <h2>10. Kampagnen-, Session- und Wiki-Daten</h2>
  <p>Gespeichert werden die von dir angelegten Kampagnen, Mitglieder, Charakterdaten, Einstellungen, automatisch erstellten Sessions, Aufnahmen, Transkripte, Zusammenfassungen, Bilder sowie Wiki-Objekte wie NPCs, Orte, Quests, Handlungsfäden und Loot. Diese Inhalte werden zur Darstellung, Bearbeitung und Fortführung deiner Kampagnen verarbeitet und nur berechtigten Kampagnenmitgliedern beziehungsweise Administratoren zugänglich gemacht.</p>

  <h2 id="analyse">11. Optionale Analyse mit Google Analytics und Tag Manager</h2>
  <p>Nur nach deiner freiwilligen Einwilligung verwenden wir Google Analytics 4 mit einem Web- und einem serverseitigen Google Tag Manager. Der Browser übermittelt dann ausschließlich freigegebene, strukturierte Ereignisse an <code>analytics.dnd-recorder.de</code>. Von dort werden zulässige Daten an Google Analytics weitergeleitet. Zeitversetzte Lifecycle-Ereignisse wie E-Mail-Bestätigung, Adminfreigabe oder Sessionabschluss werden nur bei weiterhin aktiver Einwilligung durch das Backend über den regionalen GA4-Measurement-Protocol-Endpunkt gesendet.</p>
  <p>Zwecke sind Reichweitenmessung, Ermittlung der Registrierungsconversion, Erkennen von Abbrüchen bei Einrichtung und Aktivierung sowie Verbesserung der Bedienbarkeit. Nicht übertragen werden Formwerte, E-Mail-Adressen, Namen, rohe Nutzer-, Discord-, Server-, Kanal-, Kampagnen- oder Session-IDs, Transkripte, Zusammenfassungen, Prompts, API-Schlüssel, Stacktraces oder URL-Parameter und -Fragmente.</p>
  <p>Consent Mode v2 startet mit <code>analytics_storage</code>, <code>ad_storage</code>, <code>ad_user_data</code> und <code>ad_personalization</code> im Zustand „denied“. GTM und GA werden erst nach Zustimmung geladen. Werbespeicherung und personalisierte Werbung bleiben immer deaktiviert. Eine Ablehnung hat keine funktionalen Nachteile.</p>
  <p>Nach der Einwilligung erzeugt der Browser eine zufällige, GA4-kompatible Analyse-Client-ID und ein separates Widerrufsgeheimnis im Local Storage. Die Client-ID ist keine fachliche Konto-, Discord- oder Kampagnen-ID. Das Widerrufsgeheimnis wird serverseitig nur als kryptografischer Hash gespeichert. Bei Widerruf oder Ablauf der Consentversion werden diese lokalen Analysedaten entfernt und ausstehende serverseitige Ereignisse verworfen. Die Backend-Lifecycle-Payloads enthalten keine Browser-, Geräte- oder IP-Daten und werden vor dem Versand auf feste Ereignis- und Parameterwerte begrenzt.</p>
  <p>Empfänger ist Google Ireland Limited; eine technische Verarbeitung durch Google LLC in den USA kann stattfinden. Google LLC ist nach dem EU-US Data Privacy Framework zertifiziert; ergänzend können vertragliche Garantien eingesetzt werden. Die Aufbewahrung nutzerbezogener Ereignisdaten wird auf höchstens 14 Monate begrenzt. Die Laufzeit von Analytics-Cookies wie <code>_ga</code> ist auf bis zu 6 Monate begrenzt; beim Widerruf werden sie soweit technisch erreichbar gelöscht.</p>
  <p><button type="button" onclick={openConsentSettings} class="rounded-lg border border-brand-500/50 bg-brand-500/10 px-4 py-2 font-semibold text-violet-100 hover:bg-brand-500/20">Cookie-Einstellungen öffnen</button></p>

  <h2>12. Empfänger</h2>
  <p>Personenbezogene Daten erhalten nur Stellen, die sie für den jeweiligen Zweck benötigen. Dazu können Hosting- und Infrastrukturbetreiber, Mailversand, Discord, der von dir ausgewählte KI-Anbieter, Google bei aktivierter Analyse sowie sorgfältig ausgewählte technische Dienstleister gehören. Eine Weitergabe zu Werbezwecken findet nicht statt.</p>

  <h2>13. Speicherdauer und Löschung</h2>
  <ul>
    <li>Konten und fachliche Inhalte: bis zur Löschung des Kontos beziehungsweise der jeweiligen Kampagne, sofern keine vorrangige Pflicht oder ein berechtigter Sicherungsgrund besteht.</li>
    <li>Audio, Transkript, Zusammenfassung und Sessionbilder: bis zur Löschung der Session, Kampagne oder des Kontos; einzelne Bilder können separat gelöscht werden.</li>
    <li>E-Mail-Verifizierungslinks: 24 Stunden; Passwort-Reset- und Discord-Verknüpfungstokens nur für ihre technisch festgelegte kurze Gültigkeit.</li>
    <li>Consent-Präferenz: bis zu 6 Monate oder bis zu einer früher erforderlichen erneuten Abfrage.</li>
    <li>Analytics-Cookies: bis zu 6 Monate oder bis zu einem früheren Widerruf.</li>
    <li>Analytics-Ereignisdaten: höchstens 14 Monate, nur nach Einwilligung.</li>
    <li>Sicherheitsdaten: so kurz wie für Betrieb, Abwehr und Aufklärung erforderlich; bei konkreten Vorfällen bis zu deren Abschluss.</li>
  </ul>
  <p>Backups werden zyklisch überschrieben. Gelöschte Daten können deshalb bis zum Ablauf des jeweiligen Backup-Zyklus ausschließlich für Wiederherstellungs- und Sicherheitszwecke enthalten sein.</p>

  <h2>14. Deine Rechte</h2>
  <p>Du hast nach Maßgabe der DSGVO insbesondere das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen. Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen.</p>
  <p>Wende dich dazu an <a href="mailto:Artificer@dnd-recorder.de">Artificer@dnd-recorder.de</a>. Du hast außerdem das Recht, dich bei einer Datenschutzaufsichtsbehörde zu beschweren, insbesondere an deinem gewöhnlichen Aufenthaltsort oder am Ort des mutmaßlichen Verstoßes.</p>

  <h2>15. Pflicht zur Bereitstellung</h2>
  <p>Für ein Konto sind Name, E-Mail und Passwort erforderlich. Für Bot- und Kampagnenfunktionen werden die jeweils beschriebenen Discord- und Inhaltsdaten benötigt. Ohne diese Angaben kann die entsprechende Funktion nicht erbracht werden. Die Einwilligung in Analytics ist vollständig freiwillig.</p>

  <h2>16. Automatisierte Entscheidungen</h2>
  <p>Es findet keine ausschließlich automatisierte Entscheidung mit rechtlicher oder ähnlich erheblicher Wirkung und kein Profiling statt. KI-generierte Inhalte sind Arbeitshilfen und können von berechtigten Nutzern geprüft und bearbeitet werden.</p>

  <h2>17. Änderungen dieser Erklärung</h2>
  <p>Wir aktualisieren diese Erklärung, wenn Funktionen, Anbieter oder Rechtslage sich ändern. Bei einer wesentlichen Änderung der Analysezwecke oder -anbieter wird die bisherige Einwilligung nicht stillschweigend erweitert, sondern erneut abgefragt.</p>
</LegalPageShell>
