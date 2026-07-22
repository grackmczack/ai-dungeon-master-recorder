export const CONSENT_COOKIE_NAME = "dnd_consent";
export const CONSENT_POLICY_VERSION = "2026-07-20";
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export type ConsentSource = "BANNER" | "SETTINGS";
export type ConsentStatus = "UNKNOWN" | "ANALYTICS_GRANTED" | "ANALYTICS_DENIED";

export interface ConsentDecision {
  version: string;
  necessary: true;
  analytics: boolean;
  decidedAt: string;
  expiresAt: string;
  source: ConsentSource;
}

export type PageType = "landing" | "auth" | "legal" | "docs" | "app";
export type JourneyStage =
  | "acquisition"
  | "registration"
  | "approval"
  | "setup"
  | "activation"
  | "engagement";

export function isConsentDecision(value: unknown, now = Date.now()): value is ConsentDecision {
  if (!value || typeof value !== "object") return false;
  const decision = value as Partial<ConsentDecision>;
  return (
    decision.version === CONSENT_POLICY_VERSION &&
    decision.necessary === true &&
    typeof decision.analytics === "boolean" &&
    (decision.source === "BANNER" || decision.source === "SETTINGS") &&
    typeof decision.decidedAt === "string" &&
    typeof decision.expiresAt === "string" &&
    Number.isFinite(Date.parse(decision.decidedAt)) &&
    Number.isFinite(Date.parse(decision.expiresAt)) &&
    Date.parse(decision.expiresAt) > now
  );
}

export function parseConsentCookie(cookieHeader: string, now = Date.now()): ConsentDecision | null {
  const encoded = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${CONSENT_COOKIE_NAME}=`))
    ?.slice(CONSENT_COOKIE_NAME.length + 1);
  if (!encoded) return null;

  try {
    const value = JSON.parse(decodeURIComponent(encoded));
    return isConsentDecision(value, now) ? value : null;
  } catch {
    return null;
  }
}

export function normalizeTrackingPath(pathname: string): string {
  const clean = pathname.split(/[?#]/, 1)[0] || "/";
  return clean
    .replace(/^\/kampagnen\/[^/]+(?=\/|$)/, "/kampagnen/:id")
    .replace(/^\/groups\/[^/]+(?=\/|$)/, "/kampagnen/:id")
    .replace(/^\/sessions\/[^/]+(?=\/|$)/, "/sessions/:id");
}

export function pageTypeForPath(pathname: string): PageType {
  const path = normalizeTrackingPath(pathname);
  if (path === "/") return "landing";
  if (path === "/impressum" || path === "/datenschutz") return "legal";
  if (path.startsWith("/docs")) return "docs";
  if (
    [
      "/login",
      "/register",
      "/registration-pending",
      "/verify-email",
      "/forgot-password",
      "/reset-password"
    ].includes(path)
  )
    return "auth";
  return "app";
}

export function journeyStageForPath(pathname: string): JourneyStage {
  const path = normalizeTrackingPath(pathname);
  if (path === "/") return "acquisition";
  if (path === "/register" || path === "/verify-email") return "registration";
  if (path === "/registration-pending") return "approval";
  if (path === "/connect-discord" || path === "/kampagnen/neu" || path === "/settings")
    return "setup";
  if (path.startsWith("/sessions/")) return "activation";
  return "engagement";
}

export function isSafeTrackingConfiguration(
  webContainerId: string,
  serverContainerUrl: string,
  tagServingPath: string,
  allowHttp = false
): boolean {
  if (!/^GTM-[A-Z0-9]+$/i.test(webContainerId)) return false;
  if (!/^\/[A-Za-z0-9_-]{6,64}$/.test(tagServingPath)) return false;
  try {
    const url = new URL(serverContainerUrl);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
      return false;
    if (url.protocol === "https:") return url.hostname === "analytics.dnd-recorder.de";
    return (
      allowHttp &&
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}
