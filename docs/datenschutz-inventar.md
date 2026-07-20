# Datenschutzinventar DnD Recorder

Stand: 20. Juli 2026 · Geltungsbereich: privates, nicht kommerzielles Beta-Projekt unter `dnd-recorder.de`

Dieses Dokument bildet die technische Datenschutzgrundlage für die öffentliche Datenschutzerklärung. Es ersetzt weder die Prüfung der tatsächlichen Produktionskonfiguration noch eine Rechtsberatung. Änderungen an Datenflüssen, Anbietern oder Aufbewahrungsfristen müssen hier und in der Datenschutzerklärung gemeinsam nachgezogen werden.

## Verantwortlicher

- René Greger
- Kontakt: `Artificer@dnd-recorder.de`
- Projektstatus: privat, nicht kommerziell, manuell freigeschaltete Beta
- Bei Erweiterung oder Monetarisierung: Projektstatus und Anbieterpflichten neu prüfen; soweit einschlägig insbesondere ladungsfähige Anschrift, Rechtsform, steuerliche/Registerangaben und Verbraucherinformationen ergänzen.

## Verarbeitungstätigkeiten

| Vorgang | Datenkategorien | Zweck | Grundlage/Einwilligung | Empfänger | Löschung |
| --- | --- | --- | --- | --- | --- |
| Website und API | IP, Zeit, Pfad, Browser-/Protokolldaten | Auslieferung, Sicherheit, Fehlerabwehr | Art. 6 Abs. 1 lit. f DSGVO | STRATO/Plesk | Rotations- und Hostingkonfiguration; bei Vorfällen bis Abschluss |
| Registrierung/Login | Name, E-Mail, Passwort-Hash, Konto- und Freigabestatus | Konto, Double-Opt-in, Beta-Freigabe | Art. 6 Abs. 1 lit. b/f DSGVO | Hosting | bis Kontolöschung; Einmaltokens nach Ablauf/Verwendung |
| Transaktionsmail | E-Mail, Name, Mailinhalt, Versandstatus | Bestätigung, Aktivierung, Reset | Art. 6 Abs. 1 lit. b/f DSGVO | Mailgun | DnD Recorder speichert keine separate Mailkopie; Providerlogs gemäß Konto-/Vertragskonfiguration |
| Discord-Installation | Guild-/Channel-IDs, Server-/Channelnamen, Status | Bot-Zuordnung, Aufnahme und Summary-Posting | Art. 6 Abs. 1 lit. b DSGVO | Discord, Hosting | bis Trennung/Löschung; Geisterinstallationen bleiben als Adminstatus bis Entfernung nachvollziehbar |
| Sessionaufnahme | Audio, Zeit, Discord-Sprecheraktivität/-namen | Aufnahme, Transkription, Sprecherzuordnung | Leistungserbringung; Rechtmäßigkeit der konkreten Aufnahme muss vor Start feststehen | Hosting, gewählter Transkriptionsanbieter | bis Session-, Kampagnen- oder Kontolöschung |
| KI-Verarbeitung | Audio, Transkript, Kampagnenkontext, Prompt, Referenzbilder | Transkription, Summary, Objektextraktion, Bilder | Art. 6 Abs. 1 lit. b DSGVO | je Auswahl: selbst gehostet, OpenAI, Anthropic, Google, Replicate, SiliconFlow | lokale Ergebnisse bis Löschung; Providerfristen je gewähltem Vertrag |
| Kampagnenverwaltung | Kampagnen-, Mitglieder-, Charakter-, Session- und Wiki-Inhalte | Chronik, Gruppen- und Questverwaltung | Art. 6 Abs. 1 lit. b DSGVO | Hosting, berechtigte Kampagnenmitglieder | bis Objekt-, Kampagnen- oder Kontolöschung |
| Optionale Analyse | zufällige Client-ID, normalisierte Route, feste Event-/Statuswerte, Consentversion | Reichweite, Registrierung, Setup-/Aktivierungsfunnel, UX | Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG | Google Ireland/Google LLC über First-Party-Server-GTM | Consent 6 Monate; GA4-Ereignisse höchstens 14 Monate; Outboxstatus siehe unten |

## Consent- und Analytics-Datenmodell

- `dnd_consent`: notwendige Präferenz mit Policyversion, Kategorien, Quelle, Entscheidungs- und Ablaufzeit; sechs Monate.
- `dnd_analytics_identity`: erst nach Analyse-Opt-in lokal erzeugte zufällige UUID plus separates Widerrufsgeheimnis; wird beim Widerruf lokal entfernt.
- `AnalyticsIdentity`: pseudonyme Zuordnung zum Konto, Consentversion, Quelle, Freigabe- und Widerrufszeit; keine IP-Adresse, keine E-Mail und kein Anzeigename.
- `AnalyticsEventOutbox`: nur allowlistete Lifecycle-Ereignisse und feste Statusparameter. Erfolgreiche Einträge werden nach 30 Tagen, endgültig fehlgeschlagene Einträge nach 90 Tagen automatisch gelöscht und dürfen nicht für Produktrückschlüsse außerhalb des erklärten Analysezwecks verwendet werden.
- Ein Widerruf markiert die Identity als widerrufen, verwirft ausstehende Events und wird bei einem temporären Netzfehler aus dem Browser erneut versucht.
- Kontolöschung entfernt `AnalyticsIdentity` und Outbox per Datenbank-Cascade. Für bereits an GA4 übertragene Daten ist bei einer konkreten Betroffenenanfrage zusätzlich das GA4-Löschverfahren zu prüfen.

## Strikte Analytics-Ausschlüsse

Nie in `dataLayer`, Server-GTM oder GA4 übertragen werden:

- Name, E-Mail, Adresse, Telefon oder Formwerte
- rohe User-, Discord-, Guild-, Channel-, Kampagnen- oder Session-IDs
- Server-, Kampagnen-, Charakter-, Spieler-, NPC- oder Questnamen
- Audio, Transkript, Zusammenfassung, Prompt, Wiki- oder Suchtext
- API-Key, Login-, Bestätigungs-, Reset- oder Verknüpfungstoken
- vollständige URL, Querystring, Hash, Referrer oder Stacktrace

Routen werden vor der Übergabe normalisiert (`/kampagnen/:id`, `/sessions/:id`); die drei tokenführenden Flows `/verify-email`, `/reset-password` und `/connect-discord` werden nur ohne Query und Hash gemessen.

## Dienstleister- und Transferprüfung vor Produktionsfreigabe

Noch dokumentiert abzuschließen beziehungsweise regelmäßig zu erneuern:

- [ ] STRATO-Vertrag/AVV, Serverstandort, Plesk-Logrotation und realer Backupzyklus
- [ ] Mailgun-Vertrag/AVV, Region, Event-/Message-Retention und Transfergrundlage
- [ ] Discord-Rollenverteilung und für den Bot relevante Datenflüsse
- [ ] je aktivierbarem KI-Anbieter AVV/DPA, Region, Trainingsausschluss, Speicherfrist und Drittlandgarantie
- [ ] Google-Auftragsverarbeitungsbedingungen, EU-US DPF-/SCC-Status und serverseitige Taggingkonfiguration
- [ ] Google Signals, Ads-Verknüpfungen, Benchmarking und zusätzliche Datenfreigaben deaktiviert
- [ ] GA4-Ereignisaufbewahrung auf den begründeten Mindestwert, maximal 14 Monate

## Betroffenenanfragen und Löschung

1. Anfrage über `Artificer@dnd-recorder.de` entgegennehmen und Identität angemessen prüfen.
2. Betroffene Daten in User, Memberships, Kampagnen, Sessions, Aufnahmen, Transkripten, Summaries, Bildern, Wiki, Consent und Outbox ermitteln.
3. Auskunft oder Export datensparsam bereitstellen; Daten Dritter nicht offenlegen.
4. Berichtigung/Löschung über bestehende CRUD-, Kampagnen- oder Superadmin-Kontolöschung ausführen.
5. Zugehörige Dateien und pseudonyme Analytics-Identity entfernen; gegebenenfalls GA4 Data Deletion Request auslösen.
6. Abschluss ohne unnötige Inhaltskopien dokumentieren.

## Rechts- und Konfigurationsquellen

- [Art. 13 DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=DE)
- [§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [DSK-Orientierungshilfe Telemedien](https://www.datenschutzkonferenz-online.de/media/oh/20221205_oh_Telemedien_2021_Version_1_1_Vorlage_104_DSK_final.pdf)
- [Google Consent Mode](https://developers.google.com/tag-platform/security/guides/consent)
- [Google Server-Side Tagging](https://developers.google.com/tag-platform/tag-manager/server-side/manual-setup-guide)
