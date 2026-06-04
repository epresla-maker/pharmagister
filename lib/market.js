export const MARKET_COOKIE = 'pm_market';

export function normalizeMarket(value) {
  return String(value || '').toLowerCase() === 'de' ? 'de' : 'hu';
}

export function getMarketFromHost(hostname = '') {
  return 'hu';
}

export function resolveMarketFromRequest(request) {
  const cookieMarket = normalizeMarket(request?.cookies?.get?.(MARKET_COOKIE)?.value);
  return cookieMarket || getMarketFromHost(request?.headers?.get?.('host') || '');
}

export function marketToLang(market) {
  return normalizeMarket(market) === 'de' ? 'de' : 'hu';
}

export function isDocInMarket(docData, market) {
  const m = normalizeMarket(market);
  if (!docData?.market) {
    return m === 'hu';
  }
  return normalizeMarket(docData.market) === m;
}
