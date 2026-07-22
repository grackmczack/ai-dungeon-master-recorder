# Taskplan: Pflichtseiten, Consent Management und Analytics

Stand: 20. Juli 2026. Ziel ist eine datenschutzorientierte, messbare Customer Journey für DnD Recorder. Der Plan berücksichtigt den aktuellen SvelteKit-/Fastify-/Docker-Aufbau sowie die OpenClaw-Skill `google-analytics`.

> Rechtlicher Hinweis: Die technische Umsetzung und individuell formulierte Textentwürfe können Rechtskonformität unterstützen, aber keine verbindliche Rechtsberatung oder Garantie der „Rechtssicherheit“ ersetzen. Impressum, Datenschutzerklärung, Consent-Texte, Anbieterstatus und internationale Datentransfers müssen vor Veröffentlichung durch eine im deutschen IT-/Datenschutzrecht qualifizierte Stelle geprüft und anschließend bei Änderungen aktuell gehalten werden.

## Umsetzungsstand 20. Juli 2026

- umgesetzt: öffentliche Routen `/impressum` und `/datenschutz` mit den bestätigten Minimalangaben für das private Beta-Projekt
- umgesetzt: globaler Legal-Footer, Registrierungshinweis und jederzeit erreichbare Cookie-Einstellungen
- umgesetzt: nativer, barrierearm bedienbarer Consent-Banner mit gleichwertiger Ablehnung/Zustimmung, sechsmonatiger Versionierung und Consent Mode v2 (Basic Mode)
- umgesetzt: GTM/GA werden vor Opt-in und nach Ablehnung nicht geladen; Werbesignale bleiben immer verweigert; Widerruf löscht Analytics-Cookies und lädt die Seite sauber neu
- umgesetzt: typisierte Event-/Parameter-Allowlist, normalisierte token- und ID-freie Pageviews sowie zentrale Registrierungs-, Setup-, Aktivierungs- und Engagementevents
- umgesetzt: pseudonyme, versionierte `AnalyticsIdentity`, öffentlicher Widerrufsweg und consent-gebundene, idempotente Lifecycle-Outbox für asynchrone Ereignisse
- umgesetzt: gehärtete Docker-/nginx-Vorbereitung für Web-/Server-GTM auf First-Party-Subdomains, CSP, Rate Limit, gekappte Payloadgröße und redigierte Client-IP
- umgesetzt: Datenschutzinventar, Betriebs-/QA-Runbook und automatisierte Consent-/URL-Normalisierungstests
- extern offen: Google-OAuth um Analytics-/Tag-Manager-Scopes erweitern, Google-ToS annehmen, GA4/GTM-Container veröffentlichen, DNS/Plesk/Let's Encrypt für die Tracking-Subdomains aktivieren und echte IDs/Secrets serverseitig hinterlegen
- fachlich offen: Betreiberfreigabe sowie Prüfung der Texte, AV-Verträge, Providerfristen, Logrotation und Backupzyklen durch eine qualifizierte Datenschutz-/Rechtsstelle

## Ergebnis des Vorab-Audits

Aktuell fehlen:

- öffentliche Routen für Impressum und Datenschutzerklärung
- globale Footerlinks auf allen öffentlichen, Auth- und App-Seiten
- Cookie-/Consent-Einstellungen und ein Widerrufsweg
- Analytics-, GTM- und `dataLayer`-Integration
- eine definierte Eventtaxonomie für Registrierung, Aktivierung und Kundenreise
- Consent Mode v2 und eine technische Sperre vor Einwilligung
- serverseitiges GTM auf einer First-Party-Subdomain
- dokumentierte Aufbewahrung, Löschung und Data-Subject-Request-Prozesse für Analytics

Bereits relevant:

- `dnd_session` ist ein technisch notwendiges, sieben Tage gültiges HttpOnly-Cookie mit `SameSite=Strict` und in Produktion `Secure`.
- Registrierungen nutzen Double-Opt-in und eine zusätzliche manuelle Beta-Freigabe. Die Journey besitzt deshalb mehr Stufen als eine normale Registrierung.
- Verifizierungs- und Passwort-Reset-Seiten enthalten geheime Tokens in der URL. Diese dürfen weder als `page_location` noch über Referrer, Events oder Logs an Analytics gelangen.
- Discord-Servernamen, Discord-IDs, Kampagnen-, Session- und Charakternamen, Transkripte, Prompts, API-Keys und E-Mail-Adressen dürfen nicht in GA4 oder den GTM-`dataLayer` gelangen.
- Der bestehende nginx besitzt Sicherheitsheader, aber noch keine Content-Security-Policy für eine Tracking-Subdomain.

## Rechtliche und technische Leitentscheidungen

1. **Google Analytics nur nach Opt-in:** Vor Einwilligung werden keine GA-/GTM-Requests, Cookies oder cookielosen Pings ausgelöst. Für die erste Version wird der datensparsamere Basic Consent Mode verwendet.
2. **Consent Mode v2 mit „default deny“:** `analytics_storage`, `ad_storage`, `ad_user_data` und `ad_personalization` starten als `denied`. Da keine Werbung geplant ist, bleiben die drei Advertising-Signale unabhängig von der Analytics-Wahl dauerhaft `denied`.
3. **Native Consent-Oberfläche:** Banner und Einstellungsdialog werden als Svelte-Komponenten ausgeliefert, nicht über GTM nachgeladen. Dadurch funktionieren Ablehnung, Rechtstexte und Widerruf auch ohne Trackingcontainer.
4. **Serverseitiges First-Party-Tagging:** Der Browser sendet ausschließlich nach Einwilligung an beispielsweise `https://analytics.dnd-recorder.de`; der Server-GTM prüft und bereinigt Events vor der Weitergabe an GA4.
5. **Keine personenbezogene GA-Identität zum Start:** Kein GA User-ID-Feature, kein Hash aus E-Mail oder Discord-ID und kein Google Signals. Die Webanalyse bleibt pseudonym und consent-gebunden.
6. **Operative Produktdaten bleiben intern:** Bot-Installationen, Fehler, Sessionstatus und Freigaben werden für Betrieb/Sicherheit in der eigenen Datenbank ausgewertet. Nicht eingewilligte Nutzer und „Geisterinstallationen“ werden nicht über einen Umweg an GA4 gemeldet.
7. **Analytics-Einwilligung wird nicht mit Registrierung gekoppelt:** Keine vorangekreuzte Checkbox und keine Zugangssperre bei Ablehnung. Die Registrierung stützt sich auf die erforderliche Vertrags-/vorvertragliche Verarbeitung, nicht auf eine erzwungene Marketingeinwilligung.
8. **Rechtstexte sind versionsgeführt:** Stand, Anbieterinventar und Textversion werden dokumentiert. Änderungen an Zwecken, Empfängern oder Trackingvendors lösen eine Prüfung und gegebenenfalls eine neue Einwilligung aus.

## Zielarchitektur

```text
Svelte-App
  ├─ notwendige App-Funktionen ohne Analytics
  ├─ native Consent-Komponente: default deny
  └─ nach Analytics-Opt-in
       └─ GTM-Webcontainer / dataLayer
            └─ HTTPS analytics.dnd-recorder.de
                 └─ serverseitiger GTM-Container
                      ├─ Schema-/Allowlist-Prüfung
                      ├─ Entfernung von URL-Token, IDs und Freitext
                      └─ GA4

Fastify/Worker/Discord-Bot
  ├─ interne operative Ereignisse und Funnel-Zeitpunkte
  └─ optional consent-geprüfte Lifecycle-Outbox
       └─ serverseitiger GTM, niemals direkt GA4
```

## Pflichtangaben, die vor Textfreigabe benötigt werden

Ohne diese Daten darf das Impressum nicht mit erfundenen Platzhaltern veröffentlicht werden:

- vollständiger bürgerlicher Name beziehungsweise Firma und Rechtsform
- ladungsfähige Anschrift; kein Postfach
- vertretungsberechtigte Person, falls juristische Person
- Kontakt-E-Mail und Mittel zur unmittelbaren Kommunikation
- Handels-/Vereins-/Partnerschaftsregister und Registernummer, falls vorhanden
- Umsatzsteuer-ID oder Wirtschafts-ID, falls vorhanden
- zuständige Aufsichtsbehörde beziehungsweise berufsrechtliche Angaben, falls einschlägig
- verantwortliche Person nach § 18 Abs. 2 MStV, falls journalistisch-redaktionelle Inhalte angeboten werden
- Zahl der Beschäftigten zum 31. Dezember des Vorjahres und Entscheidung zur Verbraucherschlichtung
- zuständige Datenschutzaufsichtsbehörde und gegebenenfalls Datenschutzbeauftragter
- endgültige Liste aller Auftragsverarbeiter und Unterauftragnehmer
- Entscheidung über Speicherfristen für Account, Audio, Transkript, Bilder, Logs, Consent und Analytics

Die frühere EU-Online-Streitbeilegungsplattform wird nicht verlinkt. Die zugrunde liegende Verordnung wurde zum 20. Juli 2025 aufgehoben. Eine gegebenenfalls notwendige Erklärung nach dem Verbraucherstreitbeilegungsgesetz wird stattdessen anhand des tatsächlichen Unternehmensstatus formuliert.

## Arbeitspakete und Reihenfolge

### Phase 0 – Datenschutzinventar und Entscheidungen

#### LEGAL-01: Verantwortlichen- und Unternehmensdaten einsammeln

- Pflichtangaben aus der vorstehenden Liste verbindlich erfassen.
- Unternehmer-/Verbrauchervertragsstatus und VSBG-Pflicht prüfen.
- Festhalten, ob Landingpage/Blog künftig journalistisch-redaktionelle Inhalte enthält.
- Ansprechpartner und Freigabeverantwortlichen für Rechtstexte benennen.

**Abnahme:** Kein Pflichtfeld ist ungeklärt; bedingte Angaben sind mit „zutreffend/nicht zutreffend“ dokumentiert.

#### LEGAL-02: Verzeichnis der Verarbeitungstätigkeiten für die App erstellen

Mindestens folgende Prozesse inventarisieren:

- Hosting, Reverse Proxy, Sicherheits- und Zugriffslogs
- Registrierung, Login, Double-Opt-in, manuelle Beta-Freigabe und Passwort-Reset
- Mailversand über Mailgun
- Discord-Installation, Server-/Channel-Bindung und Bot-Kommandos
- Voice-Aufnahme, MP3-Speicherung, Transkription und Sprecherzuordnung
- LLM-Zusammenfassung, Wiki-Extraktion und Bildgenerierung
- eigene Nutzer-API-Keys und Admin-Beta-Key-Grants
- Support, Accountdeaktivierung, Löschung und Datenexport
- Google Analytics, Web-GTM und Server-GTM
- Cloudflare/DNS/Proxy, Strato/Plesk und Datenbank-/Backupbetrieb
- später Payment, Android und Spieleraccounts als noch nicht aktive Verarbeitung kennzeichnen

Pro Verarbeitung festhalten: Datenkategorien, betroffene Personen, Zweck, Rechtsgrundlage, Empfänger, Standort/Drittland, Schutzmaßnahme, Frist und Löschroutine.

**Abnahme:** Jede Aussage der Datenschutzerklärung kann auf einen realen Prozess und eine technische Konfiguration zurückgeführt werden.

#### LEGAL-03: Verträge und Drittlandtransfers prüfen

- AV-Verträge/DPA mit Hosting, Mailgun, Google und gegebenenfalls Cloudflare abschließen beziehungsweise dokumentieren.
- Für jeden auswählbaren KI-Anbieter klären, ob DnD Recorder selbst Empfänger auswählt oder der DM seinen Anbieter eigenverantwortlich konfiguriert; diese Rollen sauber im Text erklären.
- Google-Unternehmensstatus im EU-US Data Privacy Framework zum Freigabezeitpunkt verifizieren; zusätzlich geltende Vertragsgarantien dokumentieren.
- Unterauftragnehmerliste und Änderungsprozess anlegen.

**Abnahme:** Kein externer Empfänger ist nur im Code vorhanden, aber in Datenschutzinventar und Datenschutzerklärung unsichtbar.

### Phase 1 – Pflichtseiten und globale Auffindbarkeit

#### LEGAL-10: Impressum als öffentliche Svelte-Route erstellen

Zielroute: `/impressum`, statisch/prerenderbar und ohne Login erreichbar.

Inhalt abhängig von LEGAL-01:

- Anbietername, Rechtsform, Vertretung und ladungsfähige Anschrift
- schnelle elektronische Kontaktaufnahme einschließlich E-Mail
- Register und Registernummer, falls vorhanden
- Umsatzsteuer-/Wirtschafts-ID, falls vorhanden
- Aufsichts- und Berufsangaben, falls einschlägig
- Verantwortlicher nach § 18 Abs. 2 MStV nur falls erforderlich
- korrekte Erklärung zur Verbraucherschlichtung, falls erforderlich oder freiwillig gewünscht
- Markenhinweis zu Dungeons & Dragons getrennt von gesetzlichen Anbieterangaben
- Versionsstand und Kontakt für Korrekturen

**Nicht aufnehmen:** veralteten EU-ODR-Link, nicht vorhandene Registerdaten, pauschale Haftungsausschlüsse oder kopierte Disclaimer ohne konkreten Anwendungsfall.

#### LEGAL-11: Datenschutzerklärung als öffentliche Svelte-Route erstellen

Zielroute: `/datenschutz`, statisch/prerenderbar und ohne Login erreichbar.

Geplanter Aufbau:

1. Verantwortlicher und Datenschutzkontakt
2. allgemeine Rechtsgrundlagen und Begriffe
3. Hosting, TLS, Serverlogs und Sicherheitszwecke
4. notwendige Cookies und lokaler Speicher
5. Registrierung, Authentifizierung, Double-Opt-in und manuelle Freigabe
6. Mailversand und Passwort-Reset
7. Discord-Bot, Installationen, Server-/Channeldaten
8. Sprachaufnahmen, Teilnehmer-/Sprecherdaten und Einwilligungsverantwortung der Runde
9. Transkription, LLMs, Bilder, eigene API-Keys und mögliche Drittlandverarbeitung je Provider
10. Kampagnen-, Mitglieder-, Wiki- und Sessiondaten
11. Google Analytics, GTM, serverseitiges Tagging, Consent Mode, Zwecke und Cookiefristen
12. Empfänger/Auftragsverarbeiter und Drittlandgarantien
13. konkrete Speicher- und Löschfristen
14. Betroffenenrechte, Widerruf, Widerspruch, Datenübertragbarkeit und Beschwerderecht
15. Pflicht zur Bereitstellung einzelner Daten und Folgen der Nichtbereitstellung
16. automatisierte Entscheidungen/Profiling: derzeit nicht eingesetzt
17. Version, Änderungsverfahren und erneute Consent-Abfrage bei relevanten Änderungen

Analytics erhält eine klare Zweckbeschreibung: Reichweitenmessung, Conversion der Registrierung, Erkennung von Abbrüchen in Einrichtung und Aktivierung sowie Produktverbesserung. Es wird ausdrücklich erklärt, dass Ablehnung keine Funktionsnachteile verursacht.

#### LEGAL-12: Globale Rechtsnavigation und Registrierungshinweise

- wiederverwendbare Footer-Komponente für Landingpage, Login, Registrierung, Warteseiten und eingeloggte App erstellen
- Links zu Impressum, Datenschutz und „Cookie-Einstellungen“ dauerhaft erreichbar machen
- `/impressum` und `/datenschutz` als öffentliche Routen im Layout freigeben
- im Registrierungsformular einen kurzen Datenschutzhinweis mit Link ergänzen
- keine verpflichtende Analytics-Checkbox in das Registrierungsformular einbauen
- Rechtstextlinks auch bei geöffnetem Consent-Banner erreichbar halten
- Fokus-, Kontrast- und Tastaturbedienung nach WCAG 2.2 AA prüfen

**Abnahme Phase 1:** Beide Seiten sind aus jeder App-Lage mit höchstens zwei Interaktionen erreichbar, funktionieren ohne JavaScript-Tracking und enthalten nur bestätigte Betreiberangaben.

### Phase 2 – Consent Management

#### CONSENT-01: Consent- und Vendor-Inventar definieren

Startkategorien:

| Kategorie | Standard | Inhalt |
| --- | --- | --- |
| Notwendig | aktiv, nicht abwählbar | `dnd_session`, Consent-Präferenz, Sicherheits-/Load-Balancing-Funktionen |
| Analyse | aus | GA4 über Web- und Server-GTM |
| Marketing | nicht angeboten | bleibt technisch und in Consent Mode dauerhaft abgelehnt |

Vor Implementierung werden die tatsächlichen Cookie-/Storage-Namen und Laufzeiten im Browser verifiziert. Dokumentiert werden Anbieter, Zweck, Datenkategorien, Rechtsgrundlage, Speicherdauer und möglicher Drittlandtransfer.

#### CONSENT-02: Consent-Datenmodell und Zustandsmaschine

Empfohlenes Zustandsmodell:

```text
UNKNOWN
  ├─ ACCEPT_ANALYTICS -> ANALYTICS_GRANTED
  ├─ NECESSARY_ONLY   -> ANALYTICS_DENIED
  └─ SETTINGS         -> individuelle Entscheidung

ANALYTICS_GRANTED
  └─ REVOKE -> ANALYTICS_DENIED + Cookies löschen + Tagging stoppen

POLICY_VERSION_CHANGED
  └─ UNKNOWN -> erneut entscheiden
```

Notwendige technische Daten:

- signierte beziehungsweise manipulationssicher validierte Präferenz `dnd_consent`
- Policy-/Vendor-Version, Kategorien, Zeitstempel und Herkunft `BANNER | SETTINGS`
- Gültigkeit zunächst sechs Monate; erneute Abfrage früher bei Zweck-/Vendoränderung
- optionaler `ConsentRecord` im Backend für Nachweis, Cross-Device und spätere serverseitige Lifecycle-Events
- keine IP-Adresse als Consent-Beweis speichern, sofern nicht nachweislich erforderlich
- eingeloggte und anonyme Entscheidungen datensparsam trennen

#### CONSENT-03: Banner und Einstellungsdialog umsetzen

Erste Ebene:

- knapper Zwecktext in verständlichem Deutsch
- Schaltflächen „Nur notwendige“, „Alle akzeptieren“ und „Einstellungen“
- Akzeptieren und Ablehnen gleichwertig sichtbar, gleiche Interaktionszahl und keine manipulative Farb-/Größenhierarchie
- direkte Links zu Datenschutz und Impressum
- Seite bleibt bei Ignorieren nutzbar; Analytics bleibt aus

Zweite Ebene:

- Analyse-Schalter standardmäßig aus
- notwendige Kategorie erklärt und nicht abwählbar
- konkrete Anbieter-, Zweck-, Laufzeit- und Drittlandinformationen
- „Auswahl speichern“ sowie gleich einfacher Widerruf

Globaler Widerruf:

- Footerlink „Cookie-Einstellungen“ öffnet den Dialog jederzeit
- bei Widerruf Consent Mode aktualisieren, Analytics stoppen und bestehende `_ga`-/GTM-Cookies auf allen zutreffenden Pfaden/Domains löschen
- keine erneute Aufforderung nach ausdrücklicher Ablehnung bis Frist-/Versionswechsel

#### CONSENT-04: Consent Mode v2 und Tag-Sperren

- Consent-Default synchron vor jeder möglichen Trackinginitialisierung setzen
- `analytics_storage = denied`
- `ad_storage = denied`
- `ad_user_data = denied`
- `ad_personalization = denied`
- GTM-/GA-Script erst nach `ANALYTICS_GRANTED` laden
- Consent-Update auf derselben Seite vor Navigation ausführen
- alle GTM-Tags zusätzlich mit Consent-Checks absichern
- keine Advanced-Consent-Pings bei Ablehnung

**Abnahme Phase 2:** Browser-Netzwerkprüfung zeigt vor Opt-in und nach Ablehnung null Requests an Google oder die Tracking-Subdomain. Widerruf stoppt weitere Events und entfernt Analytics-Cookies. App, Registrierung und Rechtstexte funktionieren unverändert.

### Phase 3 – GA4, GTM und First-Party-Tracking-Infrastruktur

#### ANALYTICS-01: Konten und Zugriffe vorbereiten

Gemäß OpenClaw-Skill:

- GCP-Projekt und aktivierte Analytics Admin API, Analytics Data API und Tag Manager API prüfen
- vorhandene Google-OAuth-Credentials verwenden, aber erforderliche Analytics-/Tag-Manager-Scopes separat bestätigen
- GA4-Konto/Property/Webstream mit `ga_create_account.sh` anlegen oder vorhandenes Konto verwenden
- notwendige Google-ToS-Ticketannahme durch den Betreiber einplanen
- GTM-Konto manuell anlegen; Web- und Servercontainer anschließend über `gtm_create_container.sh` erzeugen
- Zugriffe nach Least Privilege vergeben und Adminaktivitäten auditieren

Produktionskonfiguration:

- Property-Zeitzone `Europe/Berlin`, Währung `EUR`
- Google Signals aus
- Ads-Verknüpfung, Ads-Personalisierung und Datenfreigaben aus
- Aufbewahrung auf den begründeten Mindestwert setzen; höchstens 14 Monate
- interne Zugriffe, Superadmin, lokale Entwicklung, Uptime-Checks und automatisierte Tests ausschließen

#### ANALYTICS-02: Server-GTM bereitstellen

- First-Party-Subdomain `analytics.dnd-recorder.de` festlegen
- DNS, Plesk-vHost, Let's Encrypt und Reverse Proxy einrichten
- Server-GTM als zusätzlichen Docker-Service mit fest gepinnter Imageversion deployen
- `GTM_CONTAINER_CONFIG` und GA-Stream-Secret ausschließlich als Server-Secret hinterlegen
- Port nur intern binden; Zugriff ausschließlich über TLS-Reverse-Proxy
- HSTS, Requestgrößenlimit, Rate Limit und restriktive CORS-Regeln setzen
- Payload-Logging deaktivieren beziehungsweise vollständig redigieren
- Healthcheck, Neustartpolicy, Monitoring und Update-Runbook ergänzen
- nginx-CSP um ausschließlich erforderliche First-Party-Trackingquellen erweitern

#### ANALYTICS-03: Servercontainer als Datenschutz-Gateway konfigurieren

- Eventnamen und Parameter über Allowlist akzeptieren
- Freitext, E-Mail-Muster, Tokens, UUIDs/Snowflakes und unerlaubte URL-Parameter verwerfen
- `page_location` auf Origin plus normalisierte Route begrenzen
- `/verify-email`, `/reset-password` und `/connect-discord` grundsätzlich ohne Query/Hash übertragen
- IP nicht als benutzerdefinierten Eventparameter weitergeben
- Requests ohne gültigen Consentstatus ablehnen
- Debug- und Produktionscontainer getrennt veröffentlichen
- keine stillen zusätzlichen Tags oder Werbedienste aktivieren

**Abnahme Phase 3:** Events laufen ausschließlich `Browser -> analytics.dnd-recorder.de -> GA4`; Containerports und Secrets sind nicht öffentlich, und Testpayloads mit E-Mail/Token werden verworfen.

### Phase 4 – Eventmodell und Customer Journey

#### TRACK-01: Zentralen Tracking-Client bauen

Svelte-Schnittstelle, beispielsweise:

```ts
track(eventName, allowlistedParameters)
trackPage(normalizedRoute, pageType)
setAnalyticsConsent(granted)
```

Regeln:

- ohne Analytics-Consent ist `track` ein No-op
- Eventnamen und Parameter werden TypeScript-seitig typisiert und allowlisted
- Routen werden zu Mustern normalisiert: `/kampagnen/:id`, `/sessions/:id`
- Querystrings, Hashes, Formwerte und sichtbare Texte werden nie automatisch übernommen
- SPA-Navigation erzeugt genau einen `page_view`
- Fehlertracking verwendet nur stabile Fehlercodes, niemals Stacktraces oder API-Antworttexte
- Debugmodus ist nur lokal/Staging aktiv

Zulässige gemeinsame Parameter:

- `page_type`: `landing | auth | legal | docs | app`
- `journey_stage`: `acquisition | registration | approval | setup | activation | engagement | revenue`
- `cta_name`, `feature_name`, `provider_type`, `result`, `error_code` aus festen Wertelisten
- anonymisierte Buckets wie `campaign_count_bucket`, `server_count_bucket`, `session_count_bucket`
- `method`, beispielsweise `discord`, `web`, später `upload`

Verbotene Daten:

- E-Mail, Name, Adresse, Telefonnummer
- rohe User-, Discord-, Guild-, Channel-, Campaign- oder Session-ID
- Server-, Kampagnen-, Charakter-, Spieler- oder NPC-Name
- Transkript, Summary, Prompt, Suchtext oder Wiki-Inhalt
- API-Key, Login-, Verifizierungs-, Reset- oder Verknüpfungstoken
- vollständige URL mit Querystring oder Hash

#### TRACK-02: Registrierungsconversion

| Event | Auslöser | GA4-Rolle |
| --- | --- | --- |
| `registration_view` | Registrierungsseite sichtbar | Funnel |
| `registration_start` | erste valide Interaktion, einmalig | Funnel |
| `sign_up` | `/auth/register` erfolgreich | primäres Key Event |
| `sign_up_error` | Registrierung abgewiesen; nur sicherer Code | Diagnose |
| `email_verification_requested` | Bestätigungsmail erneut angefordert | Reibung |
| `email_verified` | Bestätigung erfolgreich | sekundäres Key Event |
| `approval_pending_view` | Warteseite nach Verifizierung | Funnel |
| `login` | erfolgreicher Login | Engagement |
| `first_approved_login` | erster Login nach Adminfreigabe | Aktivierung/Key Event |

`sign_up` ist die technische Conversion „Account angelegt“. Für die wirtschaftliche Bewertung werden `email_verified` und `first_approved_login` separat ausgewertet, damit Wegwerfregistrierungen nicht mit aktivierbaren Nutzern vermischt werden.

#### TRACK-03: Setup- und Aktivierungsfunnel

| Journey-Schritt | Event |
| --- | --- |
| Bot-Invite geöffnet | `discord_invite_click` |
| Installation mit Webkonto beansprucht | `discord_connection_claimed` |
| erste Kampagne erstellt | `campaign_created` |
| Server an Kampagne gebunden | `campaign_server_bound` |
| Voice-/Summary-Channel gesetzt | `campaign_channel_configured` |
| Provider-Credentials erfolgreich geprüft | `ai_credentials_validated` |
| erste Aufnahme gestartet | `first_recording_started` |
| Aufnahme regulär beendet | `recording_completed` |
| Transkript/Summary erfolgreich erstellt | `first_session_completed` |
| erste Summary angesehen | `summary_viewed` |
| Wiki erstmals angesehen | `wiki_viewed` |
| erstes Sessionbild erstellt | `session_image_generated` |

`first_session_completed` wird als wichtigstes Aktivierungs-Key-Event definiert: Erst hier hat der Nutzer den Kernwert des Produkts erlebt.

#### TRACK-04: Engagement, Retention und spätere Monetarisierung

Engagementevents:

- `recording_started`, `recording_failed`, `session_processing_failed`
- `summary_regenerated`
- `speaker_mapping_updated`
- `wiki_entity_created`, `wiki_entity_updated`, `wiki_entity_deleted`
- `campaign_created`, `campaign_archived` beziehungsweise später `campaign_deleted`
- `discord_server_added`
- `settings_saved` nur mit Featurebereich, niemals mit Konfigurationswerten
- `docs_topic_viewed` mit fester Topic-ID

Meilensteine:

- `second_session_completed`
- `fourth_session_completed`
- `second_campaign_created`
- `second_discord_server_added`
- `returned_after_7d`, `returned_after_30d` bevorzugt als GA-Kohorte statt künstlichem Browserevent

Für spätere Abos werden Namen jetzt reserviert, aber noch nicht gesendet:

- `pricing_view`, `plan_select`, `begin_checkout`, `purchase`, `subscription_renewed`, `subscription_cancelled`
- Kaufwerte nur aus verifiziertem Payment-Webhook, nie aus dem Browser
- keine Zahlungsdaten, Rechnungsadresse oder Provider-Kunden-ID an GA

#### TRACK-05: Asynchrone Lifecycle-Events datenschutzkonform abbilden

E-Mail-Bestätigung, Adminfreigabe und Sessionverarbeitung finden teilweise ohne offene Browserseite statt. Für vollständige, consent-gebundene Messung:

- zufällige Analytics-Client-ID nur nach Opt-in erzeugen
- Zustimmungsversion und Client-ID bei Registrierung getrennt von fachlichen Profildaten speichern
- `AnalyticsIdentity` bei Widerruf deaktivieren; keine neuen Serverevents senden
- idempotente `AnalyticsEventOutbox` für `email_verified`, `account_approved`, `discord_connection_claimed` und `first_session_completed`
- Outbox sendet ausschließlich erlaubte Events über den fest hinterlegten regionalen GA4-Measurement-Protocol-Endpunkt; API-Secret, Ereignis- und Parameter-Allowlist bleiben im Backend
- keine GA `user_id` in der ersten Version
- Events ohne nachweislich aktive Analytics-Einwilligung verwerfen
- Lösch-/Widerrufsprozess und eventuelle GA-Löschanfrage dokumentieren

Parallel bleibt eine vollständig interne, aggregierte Funnelansicht aus vorhandenen fachlichen Zeitstempeln möglich. Diese darf nicht mit Marketingtracking vermischt werden und benötigt eine eigene Zweck-/Rechtsgrundlagenprüfung.

### Phase 5 – Reports und Conversionauswertung

#### REPORT-01: GA4 Key Events

Zum Start markieren:

- `sign_up`
- `email_verified`
- `first_approved_login`
- `discord_connection_claimed`
- `first_session_completed`

Später zusätzlich `purchase`.

#### REPORT-02: Funnel-Explorations

1. **Akquisition:** `session_start -> landing CTA -> registration_view -> sign_up`
2. **Qualifizierte Registrierung:** `sign_up -> email_verified -> first_approved_login`
3. **Einrichtung:** `first_approved_login -> discord_connection_claimed -> campaign_created -> campaign_channel_configured -> ai_credentials_validated`
4. **Kernaktivierung:** `ai_credentials_validated -> first_recording_started -> first_session_completed -> summary_viewed/wiki_viewed`
5. **Retention:** erste erfolgreiche Session -> zweite Session -> vierte Session -> Rückkehr nach 7/30 Tagen
6. **Spätere Monetarisierung:** Quotenhinweis -> Pricing -> Checkout -> Purchase

Auswertungsdimensionen:

- Quelle/Medium/Kampagne über kontrollierte UTM-Namenskonvention
- Gerätetyp und grobe Region nur in GA-Standarddimensionen
- neue/wiederkehrende Nutzer
- Landingpage/CTA-Variante
- erlaubte Providerklasse und Setup-Ergebnis
- keine Dimension mit Server-, Kampagnen- oder Personennamen

#### REPORT-03: Customer-Journey-Dashboard

- Registrierungsconversion und verifizierte Conversion
- Dauer zwischen Registrierung, E-Mail-Bestätigung, Freigabe und erstem Login
- Setup-Abbruch je Schritt
- Zeit bis zur ersten erfolgreichen Session
- Fehlerquote nach Verarbeitungsschritt, nur mit allowlisted Codes
- Aktivierungsrate und zweite/vierte Session
- 7-/30-Tage-Retention
- Bot-Invite zu beanspruchter Installation
- später Free-to-Paid-Conversion und Churn

GA4 liefert nur die consent-gebundene Marketing-/Journey-Sicht. Operative Gesamtzahlen werden separat aus der eigenen Datenbank berichtet und sichtbar als andere Datenbasis gekennzeichnet.

### Phase 6 – Tests, Audit und Go-live

#### QA-01: Automatisierte Consent-Tests

- Erstbesuch: keine Analytics-Requests, keine `_ga`-Cookies
- „Nur notwendige“: App vollständig nutzbar, Entscheidung bleibt erhalten
- „Alle akzeptieren“: GTM lädt einmal, Consent wird vor erstem Event aktualisiert
- Widerruf: Cookies gelöscht, keine Folgeevents
- Policy-Versionswechsel: erneute Abfrage
- Banner ist per Tastatur, Screenreader und bei 200 Prozent Zoom nutzbar
- Datenschutz und Impressum bleiben bei Banneranzeige erreichbar

#### QA-02: Tracking-Qualität

- jede SPA-Navigation erzeugt genau einen bereinigten `page_view`
- Registrierung erzeugt `sign_up` nur nach erfolgreicher API-Antwort
- Doppelklicks, Reload und Job-Retry erzeugen keine doppelten Lifecycle-Events
- Querystrings/Hashes aus Verify-, Reset- und Discord-Connect-Routen fehlen vollständig
- Test mit E-Mail-, Snowflake-, UUID- und Tokenmustern: Server-GTM verwirft Payload
- GA DebugView, GTM Preview und `ga_verify_events.sh` bestätigen den vorgesehenen Eventfluss
- Superadmin-, Staging-, Healthcheck- und Testtraffic wird ausgeschlossen

#### QA-03: Infrastruktur und Sicherheit

- TLS/HSTS der Tracking-Subdomain prüfen
- Server-GTM-Port von außen nicht erreichbar
- Rate Limit, Größenlimit und CORS testen
- Containerimage gepinnt, Secrets nicht im Repository oder Docker-Inspect-Output unnötig exponiert
- Logs enthalten keine Payloads, IP-/Token-/E-Mail-Daten
- CSP blockiert nicht freigegebene Trackingquellen
- Backup-/Restore und Update-Runbook für ConsentRecord/Outbox dokumentieren

#### LEGAL-20: Abschlussprüfung

- finalen Browser-Cookie- und Netzwerk-Scan gegen Datenschutzerklärung abgleichen
- Rechtstexte mit den realen Produktionsprovidern und Fristen vergleichen
- Consent-Texte, Schaltflächenhierarchie und Widerruf fachjuristisch prüfen lassen
- DPA-/Transferunterlagen und Verzeichnis der Verarbeitungstätigkeiten ablegen
- Release erst nach schriftlich dokumentierter Betreiberfreigabe

## Abhängigkeiten

```text
LEGAL-01 ─┬─> LEGAL-10 Impressum
          └─> LEGAL-20 Abschlussprüfung

LEGAL-02 ─┬─> LEGAL-11 Datenschutz
          ├─> CONSENT-01 Vendor-Inventar
          └─> TRACK-05 Lifecycle/Consent

CONSENT-01 -> CONSENT-02 -> CONSENT-03 -> CONSENT-04
                                           └─> ANALYTICS-03

ANALYTICS-01 -> ANALYTICS-02 -> ANALYTICS-03
TRACK-01 -> TRACK-02/03/04 -> TRACK-05 -> REPORTS

Consent + Analytics + Tracking -> QA -> LEGAL-20 -> Go-live
```

## Aufwandsschätzung

| Paket | Technischer Aufwand | Externe/inhaltliche Abhängigkeit |
| --- | ---: | --- |
| Dateninventar und Betreiberangaben | 1–2 Tage | Betreiberinput, DPA-Unterlagen |
| Impressum, Datenschutz, globale Navigation | 2–3 Tage | juristische Prüfung |
| Consent-Komponenten und Consent Mode | 2–4 Tage | freigegebene Texte/Vendorliste |
| GA4/GTM-Konten und Server-GTM | 2–4 Tage | Google-ToS, OAuth-Scopes, DNS/Plesk |
| Eventmodell und Clienttracking | 3–5 Tage | finale Funneldefinition |
| Lifecycle-Outbox und Consent-Verknüpfung | 3–5 Tage | Datenmodellentscheidung |
| Reports, Tests, Security- und Legal-Audit | 2–4 Tage | genügend Testdaten, juristische Freigabe |

Gesamt: etwa 15–27 technische Arbeitstage zuzüglich Betreiberinput und externer rechtlicher Prüfung. Ein rechtlich sauberes MVP aus Pflichtseiten, nativem Consent, registrierungsbezogenem Clienttracking und GA4/GTM ohne asynchrone Outbox ist in ungefähr 8–13 Arbeitstagen realistisch. Die vollständige serverseitige Customer Journey folgt anschließend.

## Empfohlene Releases

### Release A – Legal und Consent zuerst

- Betreiber-/Dateninventar
- Impressum und Datenschutzerklärung
- globale Footerlinks
- natives Banner und Einstellungsdialog
- Consent Mode default deny
- automatisierte No-Tracking-before-consent-Tests

Noch kein Analytics-Go-live, bis diese Abnahme bestanden ist.

### Release B – Registrierungs- und Akquisitionstracking

- GA4, Web-GTM, Server-GTM und First-Party-Subdomain
- bereinigte Pageviews und CTA-Events
- `sign_up`, `email_verified` auf Browserrückkehr und `first_approved_login`
- Registration-/Approval-Funnel und Quellenberichte

### Release C – Vollständige Produkt-Journey

- Setup-, Recording-, Summary-, Wiki- und Retentionevents
- consent-geprüfte Lifecycle-Outbox
- Aktivierungs- und Customer-Journey-Dashboard
- Lösch-/Widerrufsprozess und abschließender Datenabgleich

## Definition of Done

Der Gesamtauftrag ist abgeschlossen, wenn:

- Impressum und Datenschutz individuell befüllt, öffentlich erreichbar und juristisch freigegeben sind
- notwendige und optionale Speicherungen vollständig dokumentiert sind
- Analytics vor Einwilligung technisch unmöglich ist
- Ablehnen und Akzeptieren gleich einfach sind und Widerruf jederzeit funktioniert
- GTM und GA4 ausschließlich consent-gebundene, allowlisted, PII-freie Events erhalten
- Registrierungs-, Einrichtungs-, Aktivierungs- und Retentionfunnel ohne sensible Inhalte auswertbar sind
- serverseitiges GTM ausschließlich über eine gehärtete First-Party-Subdomain erreichbar ist
- automatisierte Consent-/PII-/Deduplizierungs-Tests sowie GA4-Verifikation bestanden sind
- Datenschutzinventar, AV-Verträge, Transfergrundlagen, Löschkonzept und Betriebsrunbook dokumentiert sind

## Maßgebliche Quellen

- [§ 5 Digitale-Dienste-Gesetz – Anbieterinformationen](https://www.gesetze-im-internet.de/ddg/__5.html)
- [§ 25 TDDDG – Schutz der Privatsphäre bei Endeinrichtungen](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [Art. 13 DSGVO – Informationspflichten](https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=DE)
- [Datenschutzkonferenz – Orientierungshilfe Telemedien](https://www.datenschutzkonferenz-online.de/media/oh/20221205_oh_Telemedien_2021_Version_1_1_Vorlage_104_DSK_final.pdf)
- [BfDI/DSK – Einsatz von Google Analytics](https://www.bfdi.bund.de/SharedDocs/Downloads/DE/DSK/DSKBeschluessePositionspapiere/99DSK_Google-Analytics.pdf?__blob=publicationFile&v=4)
- [§ 36 VSBG – Verbraucherstreitbeilegung](https://www.gesetze-im-internet.de/vsbg/__36.html)
- [EU-Verordnung 2024/3228 – Einstellung der ODR-Plattform](https://eur-lex.europa.eu/eli/reg/2024/3228/oj)
- [Google – Consent Mode auf Websites](https://developers.google.com/tag-platform/security/guides/consent)
- [Google – client- und serverseitiges Tagging](https://support.google.com/tagmanager/answer/13387731?hl=de)
- [Europäische Kommission – EU-US Data Privacy Framework](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/eu-us-data-transfers_en)
