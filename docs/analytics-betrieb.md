# Analytics- und Consent-Betrieb

Stand: 21. Juli 2026

## Architektur

```text
Browser
  ├─ ohne Opt-in: kein GTM, kein GA, kein Trackingrequest
  └─ mit Opt-in: https://analytics.dnd-recorder.de
                    -> Web-GTM / serverseitiger GTM
                    -> allowlistete GA4-Ereignisse

Backend-Outbox
  └─ nur bei aktiver, versionierter AnalyticsIdentity
       -> https://analytics.dnd-recorder.de/mp/collect
       -> serverseitiger GTM
       -> GA4
```

Werbesignale sind immer abgelehnt. Browser und Backend sprechen nie direkt mit `google-analytics.com` oder `googletagmanager.com`. Der Haupt-nginx erlaubt per CSP ausschließlich die First-Party-Subdomain.

## Voraussetzungen und Secrets

Öffentliche Buildkonfiguration im Root-Compose-Environment:

```dotenv
VITE_GTM_CONTAINER_ID=GTM-W7N7J7JR
VITE_GTM_SERVER_URL=https://analytics.dnd-recorder.de
VITE_GTM_SERVING_PATH=/vom-web-container-client-erzeugter-pfad
```

Backend-Secrets in `apps/backend/.env`:

```dotenv
ANALYTICS_SERVER_URL=https://analytics.dnd-recorder.de
GA_MEASUREMENT_ID=G-J3SR1MTC8J
GA_API_SECRET=<Measurement-Protocol-Secret>
```

Server-GTM-Secrets in `deploy/analytics/.env`:

```dotenv
GTM_IMAGE=gcr.io/cloud-tagging-10302018/gtm-cloud-image@sha256:<verifizierter Digest>
GTM_CONTAINER_CONFIG=<Container Config aus dem Servercontainer>
```

Keiner dieser echten Secretwerte darf committed oder in Supportausgaben kopiert werden.

## Google-Zugriff vorbereiten

Das gemeinsame OAuth-Token benötigt zusätzlich zu den vorhandenen Workspace-Scopes:

- `https://www.googleapis.com/auth/analytics`
- `https://www.googleapis.com/auth/analytics.edit`
- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/tagmanager`
- `https://www.googleapis.com/auth/tagmanager.edit.containers`
- `https://www.googleapis.com/auth/tagmanager.edit.containerversions`
- `https://www.googleapis.com/auth/tagmanager.publish`
- `https://www.googleapis.com/auth/tagmanager.delete.containers`

Danach:

1. vorhandenes GA-Konto nutzen oder Account-Ticket erstellen und Google-ToS als Betreiber im Browser annehmen;
2. Property `DnD Recorder`, Zeitzone `Europe/Berlin`, Währung `EUR`;
3. Webstream für `https://dnd-recorder.de`;
4. GTM-Konto `DnD Recorder` mit Webcontainer `GTM-W7N7J7JR` und Servercontainer `GTM-TQ8JNHQ9` verwenden;
5. Google Signals, Ads-Verknüpfung/-Personalisierung und unnötige Datenfreigaben deaktivieren;
6. Ereignisaufbewahrung begründet minimieren, höchstens 14 Monate.

Aktueller Google-Stand:

- GA4-Property `546354789`, Webstream `15291937208`, Measurement-ID `G-J3SR1MTC8J`;
- Enhanced Measurement und Google Signals deaktiviert;
- E-Mail- und Queryparameter-Redaktion aktiviert;
- Key Events: `sign_up`, `email_verified`, `first_approved_login`, `discord_connection_claimed`, `first_session_completed`;
- Webcontainer-Version 2 veröffentlicht: Consentpflicht, feste Event-/Parameter-Allowlist, keine automatischen Pageviews, keine Werbesignale, Cookie-Laufzeit höchstens 6 Monate;
- Servercontainer-Arbeitsbereich `DnD Recorder Server – privacy setup` compilergeprüft, aber bis zur finalen Datenschutztransformation und First-Party-Auslieferung absichtlich unveröffentlicht.

## First-Party-Server deployen

1. In Cloudflare `analytics.dnd-recorder.de` und `analytics-preview.dnd-recorder.de` auf die Server-IP zeigen lassen; während der Zertifikatsausstellung DNS-only verwenden.
2. Beide Subdomains in Plesk anlegen, Let's Encrypt aktivieren und die jeweilige Datei aus `deploy/plesk/` als `.htaccess` verwenden.
3. Den stabilen Google-Container ziehen und den Digest ermitteln:

   ```bash
   docker pull gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable
   docker image inspect --format '{{index .RepoDigests 0}}' gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable
   ```

4. Digest und Server-Containerconfig in `deploy/analytics/.env` eintragen (Dateimodus 600).
5. Starten:

   ```bash
   docker compose --env-file deploy/analytics/.env -f deploy/analytics/compose.yml up -d
   ```

6. Prüfen:

   ```bash
   curl -fsS https://analytics.dnd-recorder.de/healthy
   docker compose --env-file deploy/analytics/.env -f deploy/analytics/compose.yml ps
   ```

Die eigentlichen GTM-Container besitzen keinen Hostport. Nur der gehärtete Gateway-nginx ist an `127.0.0.1:8081/8082` gebunden. Er begrenzt Rate und Requestgröße, schreibt keine Access-Payloadlogs und ersetzt Client-IP-Header vor dem Servercontainer.

## Container konfigurieren

### Servercontainer

- Server Container URL: `https://analytics.dnd-recorder.de`
- Preview Server URL: `https://analytics-preview.dnd-recorder.de`
- GA4 Client aktivieren.
- Im Server-Container einen Client vom Typ **Google Tag Manager: Web Container** anlegen, die Web-Container-ID erlauben und den automatisch erzeugten, zufälligen **Tag serving path** unverändert als `VITE_GTM_SERVING_PATH` hinterlegen.
- Google Tag Gateway/Dependency Serving so konfigurieren, dass `gtm.js` über genau diesen First-Party-Pfad ausgeliefert wird; der Pfad gehört nicht in `server_container_url`.
- Einen GA4-Tag für die erlaubten Events anlegen; keine Werbe-, Remarketing- oder zusätzlichen Vendor-Tags.
- Eingehende Ereignisse nur bei aktivem `analytics_storage` beziehungsweise für die consent-gebundene Backend-Outbox annehmen.
- Vor Veröffentlichung die eingebaute Transformation **Allow parameters** auf den GA4-Tag anwenden und ausschließlich die für GA4 technisch notwendigen Felder sowie `page_path`, `page_location`, `page_type`, `journey_stage`, `cta_name`, `feature_name`, `provider_type`, `result`, `error_code`, `method`, `entity_type`, `settings_area` und `topic_id` zulassen. Freitext und alle übrigen Parameter verwerfen.

### Webcontainer

- Google-Tag/GA4-Konfiguration mit Measurement-ID und `server_container_url=https://analytics.dnd-recorder.de`.
- `analytics_client_id` aus dem `dataLayer` als `client_id` verwenden; es ist eine erst nach Opt-in zufällig erzeugte UUID, keine fachliche Nutzer-ID.
- Consent Checks für jeden Tag; `analytics_storage` erforderlich.
- `ad_storage`, `ad_user_data` und `ad_personalization` nicht überschreiben und dauerhaft abgelehnt lassen.
- Manuelle Pageviews verwenden; Enhanced Measurement für Pageviews deaktivieren, damit SPA-Navigation nicht doppelt zählt.
- `cookie_expires=15552000` und `cookie_update=false` beibehalten; dadurch laufen die Analytics-Cookies spätestens nach 6 Monaten ab und werden nicht bei jedem Besuch verlängert.

## Event-Allowlist

Gemeinsame Parameter: ausschließlich `page_type`, `journey_stage`, `cta_name`, `feature_name`, `provider_type`, `result`, `error_code`, `method`, `entity_type`, `settings_area`, `topic_id` und die normalisierten Pageviewfelder.

Key Events:

- `sign_up`
- `email_verified`
- `first_approved_login`
- `discord_connection_claimed`
- `first_session_completed`

Weitere erlaubte Ereignisse stehen typisiert in `apps/frontend/src/lib/analytics.ts`. Asynchron serverseitig sind ausschließlich die in `apps/backend/src/lib/analytics.ts` definierte Allowlist aus Verifizierung, Freigabe, Discord-Verknüpfung, Aufnahmebeginn/-ende, Verarbeitungsfehler und erster fertiger Session zulässig. Deduplizierung erfolgt über interne, nie übertragene Outbox-Schlüssel.

## Consent-QA vor jedem Release

| Fall | Erwartung |
| --- | --- |
| neue Sitzung, keine Auswahl | kein GTM-/GA-/Analytics-Request; App vollständig nutzbar |
| „Nur notwendige“ | Consent gespeichert, weiterhin kein Trackingrequest |
| „Alle akzeptieren“ | Consent-Update vor einmaligem GTM-Laden; genau ein bereinigter SPA-Pageview |
| Analyse in Einstellungen aus | Widerruf an Backend, `_ga*` gelöscht, Seite neu geladen, keine Folgeevents |
| Policyversion geändert/Consent abgelaufen | Identity widerrufen, Banner erscheint erneut |
| Verify-/Reset-/Discord-Link | keine Query, kein Hash und kein Token in `page_location` oder Eventdaten |
| Formularfehler | nur fester Fehlercode, niemals API-Text, E-Mail oder Eingabewert |

Browserprüfung:

1. DevTools -> Application: Cookies/Local Storage vor Auswahl prüfen.
2. DevTools -> Network nach `google`, `gtm`, `collect`, `analytics` filtern.
3. Ablehnen und die Kernjourney einmal durchlaufen: null Trackingrequests.
4. Zustimmen, Registrierung testen und Eventpayloads einzeln auf PII kontrollieren.
5. Widerrufen und erneut durch die App navigieren: null weitere Requests.
6. GTM Preview und GA4 DebugView nur mit einem dedizierten Testbrowser/-property nutzen.

## Betrieb und Störungen

- Container bei jedem von Google angekündigten Major-Update mit neu geprüftem Digest aktualisieren; Preview und Server gemeinsam neu starten.
- `/healthy`, Containerzustand und fehlgeschlagene Outbox-Zähler überwachen, aber keine Payloads loggen.
- Nach acht fehlgeschlagenen Zustellungen bleibt ein Event mit generischem Fehlercode `FAILED`; es wird nicht endlos wiederholt.
- Bei Widerruf werden noch nicht gesendete Events sofort verworfen.
- Bei einer Zweck-/Vendoränderung `CONSENT_POLICY_VERSION` erhöhen, Texte aktualisieren und erneut einwilligen lassen.
- Bei einem möglichen Datenleck Tracking abschalten, Containerconfig sichern, Secrets rotieren und den Vorfall nach dem Incident-Prozess bewerten.

## Maßgebliche technische Dokumentation

- [Google: Consent Mode](https://developers.google.com/tag-platform/security/guides/consent)
- [Google: Server-Side Tagging manuell bereitstellen](https://developers.google.com/tag-platform/tag-manager/server-side/manual-setup-guide)
- [Google: Custom Domain](https://developers.google.com/tag-platform/tag-manager/server-side/custom-domain)
- [Google: Google-Skripte first-party ausliefern](https://developers.google.com/tag-platform/tag-manager/server-side/dependency-serving)
