import { browser } from "$app/environment";
import { writable } from "svelte/store";
import {
  CONSENT_COOKIE_NAME,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_POLICY_VERSION,
  parseConsentCookie,
  type ConsentDecision,
  type ConsentSource,
  type ConsentStatus
} from "$lib/privacy-policy.js";

export {
  CONSENT_COOKIE_NAME,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_POLICY_VERSION,
  type ConsentDecision,
  type ConsentSource,
  type ConsentStatus
} from "$lib/privacy-policy.js";

export const consentStatus = writable<ConsentStatus>("UNKNOWN");
export const consentSettingsOpen = writable(false);

export function readConsentDecision(cookieHeader?: string): ConsentDecision | null {
  const source = cookieHeader ?? (browser ? document.cookie : "");
  return parseConsentCookie(source);
}

export function initializeConsent(): ConsentDecision | null {
  const decision = readConsentDecision();
  consentStatus.set(
    decision?.analytics === true
      ? "ANALYTICS_GRANTED"
      : decision?.analytics === false
        ? "ANALYTICS_DENIED"
        : "UNKNOWN"
  );
  return decision;
}

export function saveConsentDecision(analytics: boolean, source: ConsentSource): ConsentDecision {
  const decidedAt = new Date();
  const expiresAt = new Date(decidedAt.getTime() + CONSENT_MAX_AGE_SECONDS * 1000);
  const decision: ConsentDecision = {
    version: CONSENT_POLICY_VERSION,
    necessary: true,
    analytics,
    decidedAt: decidedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    source
  };

  if (browser) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(decision))}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  }
  consentStatus.set(analytics ? "ANALYTICS_GRANTED" : "ANALYTICS_DENIED");
  consentSettingsOpen.set(false);
  return decision;
}

export function openConsentSettings() {
  consentSettingsOpen.set(true);
}

export function closeConsentSettings() {
  consentSettingsOpen.set(false);
}
