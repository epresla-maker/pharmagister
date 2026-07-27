export const MARKET_COOKIE = 'pm_market';

// TEMPORARY: German market is paused. All market detection returns 'hu'.
// To re-enable: set DE_MARKET_ENABLED = true
const DE_MARKET_ENABLED = false;

export function normalizeMarket(value) {
  if (!DE_MARKET_ENABLED) return 'hu';
  return String(value || '').toLowerCase() === 'de' ? 'de' : 'hu';
}

export function getMarketFromHost(hostname = '') {
  if (!DE_MARKET_ENABLED) return 'hu';
  const host = String(hostname || '').toLowerCase();
  if (host.endsWith('.de') || host.includes('de.pharmagister')) {
    return 'de';
  }
  return 'hu';
}

export function getMarketFromAcceptLanguage(acceptLanguage = '') {
  if (!DE_MARKET_ENABLED) return 'hu';
  const value = String(acceptLanguage || '').toLowerCase();
  if (!value) return 'hu';

  // Match explicit German locales first (de, de-de, de-at, de-ch...)
  if (/\bde(?:-[a-z]{2})?\b/.test(value)) {
    return 'de';
  }
  return 'hu';
}

export function resolveMarketFromRequest(request) {
  if (!DE_MARKET_ENABLED) return 'hu';
  const rawCookieMarket = request?.cookies?.get?.(MARKET_COOKIE)?.value;
  if (rawCookieMarket) {
    return normalizeMarket(rawCookieMarket);
  }

  const acceptLanguage = request?.headers?.get?.('accept-language') || '';
  const localeMarket = getMarketFromAcceptLanguage(acceptLanguage);
  if (localeMarket) {
    return localeMarket;
  }

  return getMarketFromHost(request?.headers?.get?.('host') || '');
}

export function marketToLang(market) {
  if (!DE_MARKET_ENABLED) return 'hu';
  return normalizeMarket(market) === 'de' ? 'de' : 'hu';
}

export function isDocInMarket(docData, market) {
  const m = normalizeMarket(market); // always 'hu' when DE_MARKET_ENABLED=false
  const docMarket = String(docData?.market || '').toLowerCase();
  if (!docMarket) {
    return m === 'hu';
  }
  // When DE is disabled, exclude all explicitly German-market docs
  if (!DE_MARKET_ENABLED && docMarket === 'de') return false;
  return normalizeMarket(docMarket) === m;
}
