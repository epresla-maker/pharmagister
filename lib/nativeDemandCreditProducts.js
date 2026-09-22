import { getDemandPackageOffer } from '@/lib/demandCredits';

function normalizeString(value) {
  return String(value || '').trim();
}

function readProductConfig(platform, kind) {
  const upperPlatform = platform === 'ios' ? 'IOS' : platform === 'android' ? 'ANDROID' : '';
  const upperKind = kind === 'founder' ? 'FOUNDER' : 'REGULAR';

  if (!upperPlatform) return null;

  const productId = normalizeString(process.env[`NEXT_PUBLIC_REVENUECAT_${upperPlatform}_PRODUCT_ID_${upperKind}`]);
  if (!productId) return null;

  return {
    platform,
    kind,
    productId,
    packageCredits: 4,
  };
}

export function getNativeDemandCreditProductCatalog() {
  return [
    readProductConfig('ios', 'regular'),
    readProductConfig('ios', 'founder'),
    readProductConfig('android', 'regular'),
    readProductConfig('android', 'founder'),
  ].filter(Boolean);
}

export function resolveNativeDemandCreditProduct({ platform, userData }) {
  const offer = getDemandPackageOffer(userData || {});
  const kind = offer.founder?.discountActive ? 'founder' : 'regular';
  const config = readProductConfig(platform, kind);

  return {
    config,
    offer,
    kind,
  };
}

export function getNativeDemandCreditProductById(productId) {
  const normalized = normalizeString(productId);
  if (!normalized) return null;

  return getNativeDemandCreditProductCatalog().find((item) => item.productId === normalized) || null;
}
