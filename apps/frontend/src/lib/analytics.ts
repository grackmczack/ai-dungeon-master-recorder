import { browser } from "$app/environment";
import {
  CONSENT_POLICY_VERSION,
  isSafeTrackingConfiguration,
  journeyStageForPath,
  normalizeTrackingPath,
  pageTypeForPath,
  type JourneyStage,
  type PageType
} from "$lib/privacy-policy.js";

export type { JourneyStage, PageType } from "$lib/privacy-policy.js";

export const TRACKING_EVENT_NAMES = [
  "cta_click",
  "registration_view",
  "registration_start",
  "sign_up",
  "sign_up_error",
  "email_verification_requested",
  "email_verified",
  "approval_pending_view",
  "login",
  "first_approved_login",
  "discord_invite_click",
  "discord_connection_claimed",
  "campaign_created",
  "campaign_server_bound",
  "campaign_channel_configured",
  "ai_credentials_validated",
  "first_recording_started",
  "recording_started",
  "recording_completed",
  "recording_failed",
  "session_processing_failed",
  "first_session_completed",
  "summary_viewed",
  "wiki_viewed",
  "session_image_generated",
  "summary_regenerated",
  "speaker_mapping_updated",
  "wiki_entity_created",
  "wiki_entity_updated",
  "wiki_entity_deleted",
  "campaign_deleted",
  "discord_server_added",
  "settings_saved",
  "docs_topic_viewed"
] as const;

export type TrackingEventName = (typeof TRACKING_EVENT_NAMES)[number];
export type TrackingParameters = Partial<{
  page_type: PageType;
  journey_stage: JourneyStage;
  cta_name:
    | "hero_register"
    | "final_register"
    | "bot_invite"
    | "login"
    | "register"
    | "resend_verification";
  feature_name:
    | "registration"
    | "discord"
    | "campaign"
    | "credentials"
    | "recording"
    | "summary"
    | "wiki"
    | "session_image"
    | "speaker_mapping"
    | "settings";
  provider_type: "byok" | "admin_grant" | "self_hosted" | "mixed";
  result: "success" | "failure" | "pending";
  error_code:
    | "validation"
    | "email_exists"
    | "email_unverified"
    | "approval_pending"
    | "unauthorized"
    | "rate_limited"
    | "server_error"
    | "unknown";
  method: "web" | "discord";
  entity_type: "npc" | "quest" | "location" | "thread" | "loot";
  settings_area: "transcription" | "summary" | "images" | "discord" | "all";
  topic_id: "quickstart" | "commands" | "campaigns" | "sessions" | "settings" | "privacy";
}>;

type DataLayerEntry = Record<string, unknown> | IArguments;

declare global {
  interface Window {
    dataLayer?: DataLayerEntry[];
  }
}

const WEB_CONTAINER_ID =
  (import.meta.env.VITE_GTM_CONTAINER_ID as string | undefined)?.trim() ?? "";
const SERVER_CONTAINER_URL =
  (import.meta.env.VITE_GTM_SERVER_URL as string | undefined)?.trim().replace(/\/$/, "") ?? "";
const TAG_SERVING_PATH =
  (import.meta.env.VITE_GTM_SERVING_PATH as string | undefined)?.trim().replace(/\/$/, "") ?? "";
const SCRIPT_ID = "dnd-recorder-gtm";
const ANALYTICS_IDENTITY_KEY = "dnd_analytics_identity";
const ANALYTICS_REVOCATION_KEY = "dnd_analytics_revocation_pending";
const ANALYTICS_CLIENT_ID_PATTERN = /^[1-9]\d{0,9}\.[1-9]\d{0,9}$/;
const LEGACY_ANALYTICS_CLIENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_PARAMETERS = new Set<keyof TrackingParameters>([
  "page_type",
  "journey_stage",
  "cta_name",
  "feature_name",
  "provider_type",
  "result",
  "error_code",
  "method",
  "entity_type",
  "settings_area",
  "topic_id"
]);

let analyticsGranted = false;
let scriptPromise: Promise<boolean> | null = null;
let lastPagePath = "";

interface AnalyticsIdentity {
  clientId: string;
  revocationToken: string;
  source: "BANNER" | "SETTINGS";
}

function validIdentity(value: unknown): value is AnalyticsIdentity {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AnalyticsIdentity>;
  return (
    typeof candidate.clientId === "string" &&
    (ANALYTICS_CLIENT_ID_PATTERN.test(candidate.clientId) ||
      LEGACY_ANALYTICS_CLIENT_ID_PATTERN.test(candidate.clientId)) &&
    typeof candidate.revocationToken === "string" &&
    /^[a-f0-9]{64}$/.test(candidate.revocationToken) &&
    (candidate.source === "BANNER" || candidate.source === "SETTINGS")
  );
}

function storedIdentity(key = ANALYTICS_IDENTITY_KEY): AnalyticsIdentity | null {
  if (!browser) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null");
    return validIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function randomHex(bytes: number): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function getOrCreateAnalyticsIdentity(source: "BANNER" | "SETTINGS"): AnalyticsIdentity {
  const existing = storedIdentity();
  if (existing && ANALYTICS_CLIENT_ID_PATTERN.test(existing.clientId)) return existing;
  if (existing && !storedIdentity(ANALYTICS_REVOCATION_KEY)) {
    localStorage.setItem(ANALYTICS_REVOCATION_KEY, JSON.stringify(existing));
  }
  const values = crypto.getRandomValues(new Uint32Array(2));
  const identity: AnalyticsIdentity = {
    clientId: `${values[0] || 1}.${values[1] || 1}`,
    revocationToken: randomHex(32),
    source
  };
  localStorage.setItem(ANALYTICS_IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

function dataLayer(): DataLayerEntry[] {
  window.dataLayer = window.dataLayer ?? [];
  return window.dataLayer;
}

function gtag(...args: unknown[]) {
  dataLayer().push(args as unknown as IArguments);
}

function hasValidConfiguration(): boolean {
  if (!browser) return false;
  return isSafeTrackingConfiguration(
    WEB_CONTAINER_ID,
    SERVER_CONTAINER_URL,
    TAG_SERVING_PATH,
    import.meta.env.DEV
  );
}

function setDefaultConsent() {
  if (!browser) return;
  gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500
  });
}

export function initializeAnalytics() {
  setDefaultConsent();
}

export async function setAnalyticsConsent(
  granted: boolean,
  source: "BANNER" | "SETTINGS" = "SETTINGS"
): Promise<void> {
  if (!browser) return;
  analyticsGranted = granted;
  gtag("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  });

  if (granted) {
    const identity = getOrCreateAnalyticsIdentity(source);
    dataLayer().push({ analytics_client_id: identity.clientId });
    await loadTagManager();
  }
}

export function isAnalyticsGranted(): boolean {
  return analyticsGranted;
}

export function normalizePath(pathname: string): string {
  return normalizeTrackingPath(pathname);
}

export function pageTypeFor(pathname: string): PageType {
  return pageTypeForPath(pathname);
}

export function journeyStageFor(pathname: string): JourneyStage {
  return journeyStageForPath(pathname);
}

export async function loadTagManager(): Promise<boolean> {
  if (!browser || !analyticsGranted || !hasValidConfiguration()) return false;
  if (document.getElementById(SCRIPT_ID)) return true;
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    dataLayer().push({ "gtm.start": Date.now(), event: "gtm.js" });
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `${SERVER_CONTAINER_URL}${TAG_SERVING_PATH}/`;
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener(
      "error",
      () => {
        script.remove();
        scriptPromise = null;
        resolve(false);
      },
      { once: true }
    );
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function safeParameters(parameters: TrackingParameters): TrackingParameters {
  return Object.fromEntries(
    Object.entries(parameters).filter(
      ([key, value]) =>
        ALLOWED_PARAMETERS.has(key as keyof TrackingParameters) && value !== undefined
    )
  ) as TrackingParameters;
}

export function track(event: TrackingEventName, parameters: TrackingParameters = {}): boolean {
  if (!browser || !analyticsGranted || !hasValidConfiguration()) return false;
  dataLayer().push({ event, ...safeParameters(parameters) });
  return true;
}

export function trackPage(pathname: string): boolean {
  if (!browser || !analyticsGranted || !hasValidConfiguration()) return false;
  const pagePath = normalizePath(pathname);
  if (pagePath === lastPagePath) return false;
  lastPagePath = pagePath;
  dataLayer().push({
    event: "page_view",
    page_path: pagePath,
    page_location: `${window.location.origin}${pagePath}`,
    page_type: pageTypeFor(pagePath),
    journey_stage: journeyStageFor(pagePath)
  });
  return true;
}

export function resetPageTracking() {
  lastPagePath = "";
}

export function deleteAnalyticsCookies() {
  if (!browser) return;
  localStorage.removeItem("dnd_first_approved_login_tracked");
  const cookieNames = document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name) => name === "_ga" || name.startsWith("_ga_") || name === "_gcl_au");
  const domains = ["", window.location.hostname, `.${window.location.hostname}`];
  for (const name of cookieNames) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;
    }
  }
}

export function trackingIsConfigured(): boolean {
  return hasValidConfiguration();
}

export function getAnalyticsRegistrationContext():
  | (AnalyticsIdentity & { policyVersion: string })
  | undefined {
  if (!analyticsGranted) return undefined;
  const identity = storedIdentity();
  return identity ? { ...identity, policyVersion: CONSENT_POLICY_VERSION } : undefined;
}

export function queueAnalyticsRevocation() {
  if (!browser) return;
  const identity = storedIdentity();
  if (identity) localStorage.setItem(ANALYTICS_REVOCATION_KEY, JSON.stringify(identity));
  localStorage.removeItem(ANALYTICS_IDENTITY_KEY);
}

export async function syncAnalyticsConsentToBackend(granted: boolean): Promise<void> {
  if (!browser) return;

  async function revoke(identity: AnalyticsIdentity): Promise<boolean> {
    const response = await fetch("/api/analytics/consent/revoke", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: identity.clientId,
        revocationToken: identity.revocationToken
      })
    });
    return response.ok;
  }

  try {
    const pendingRevocation = storedIdentity(ANALYTICS_REVOCATION_KEY);
    if (pendingRevocation && (await revoke(pendingRevocation))) {
      localStorage.removeItem(ANALYTICS_REVOCATION_KEY);
    }

    if (granted) {
      const identity = storedIdentity();
      if (!identity || !ANALYTICS_CLIENT_ID_PATTERN.test(identity.clientId)) return;
      await fetch("/api/analytics/consent", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: identity.clientId,
          revocationToken: identity.revocationToken,
          policyVersion: CONSENT_POLICY_VERSION,
          source: identity.source
        })
      });
    }
  } catch {
    // A pending revocation remains locally and is retried on the next visit.
  }
}

export function trackingErrorCode(error: unknown): NonNullable<TrackingParameters["error_code"]> {
  if (!error || typeof error !== "object") return "unknown";
  const candidate = error as { code?: unknown; statusCode?: unknown };
  if (candidate.code === "EMAIL_NOT_VERIFIED") return "email_unverified";
  if (candidate.code === "APPROVAL_PENDING") return "approval_pending";
  if (candidate.statusCode === 400) return "validation";
  if (candidate.statusCode === 401 || candidate.statusCode === 403) return "unauthorized";
  if (candidate.statusCode === 409) return "email_exists";
  if (candidate.statusCode === 429) return "rate_limited";
  if (typeof candidate.statusCode === "number" && candidate.statusCode >= 500)
    return "server_error";
  return "unknown";
}
