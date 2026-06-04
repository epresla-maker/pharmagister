export const MARKET_COOKIE = 'pm_market';

export function normalizeMarket(value) {
  return String(value || '').toLowerCase() === 'de' ? 'de' : 'hu';
}

export function getMarketDomains() {
  return {
    hu: process.env.MARKET_HU_DOMAIN || 'pharmagister.hu',
    de: process.env.MARKET_DE_DOMAIN || 'pharmagister.de',
  };
}

export function getMarketUrls() {
  return {
    hu: process.env.NEXT_PUBLIC_MARKET_HU_URL || 'https://pharmagister.hu',
    de: process.env.NEXT_PUBLIC_MARKET_DE_URL || 'https://pharmagister.de',
  };
}

export function getMarketFromHost(hostname = '') {
  const host = String(hostname || '').toLowerCase().split(':')[0];
  const { de } = getMarketDomains();
  if (host === de || host.endsWith(`.${de}`)) {
    return 'de';
  }
  return 'hu';
}

export function resolveMarketFromRequest(request) {
  const host = request?.headers?.get?.('host') || '';
  const hostMarket = getMarketFromHost(host);
  const cookieMarket = normalizeMarket(request?.cookies?.get?.(MARKET_COOKIE)?.value);

  if ((host || '').toLowerCase().includes('.vercel.app')) {
    return cookieMarket;
  }

  return hostMarket;
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
