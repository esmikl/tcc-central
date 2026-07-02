// ── Cookie Consent (shared across all pages) ────────────────
// Stores the visitor's choice in localStorage so it persists across visits
// without requiring an account. Also gates whether Google Analytics is
// allowed to load at all — nothing fires until the user has consented.

const COOKIE_CONSENT_KEY = 'tcc_cookieConsent';
let gaLoaded = false;

function getCookieConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCookieConsent(analytics) {
  const value = { analytics: !!analytics, decidedAt: new Date().toISOString() };
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(value));
  } catch {
    // localStorage unavailable (private browsing, etc.) — the choice just
    // won't persist, and the prompt will reappear next visit.
  }
  applyAnalyticsConsent(value.analytics);
  return value;
}

function applyAnalyticsConsent(analytics) {
  if (!window.GA_MEASUREMENT_ID) return;
  if (analytics) {
    loadGoogleAnalytics(window.GA_MEASUREMENT_ID);
  } else {
    window['ga-disable-' + window.GA_MEASUREMENT_ID] = true;
  }
}

function loadGoogleAnalytics(id) {
  if (gaLoaded) return;
  gaLoaded = true;
  window['ga-disable-' + id] = false;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id);
}

// If a choice was already made on a previous visit, apply it immediately.
(function () {
  const consent = getCookieConsent();
  if (consent) applyAnalyticsConsent(consent.analytics);
})();
