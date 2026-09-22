import { Capacitor } from '@capacitor/core';
import { LOG_LEVEL, Purchases } from '@revenuecat/purchases-capacitor';
import { resolveNativeDemandCreditProduct } from '@/lib/nativeDemandCreditProducts';

let configuredAppUserId = null;
let configuredApiKey = null;

export function isNativeStorePurchasePlatform() {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android';
}

export function getRevenueCatPlatform() {
  return Capacitor.getPlatform();
}

export function getRevenueCatPublicApiKey(platform = getRevenueCatPlatform()) {
  if (platform === 'ios') {
    return String(process.env.NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY || '').trim();
  }

  if (platform === 'android') {
    return String(process.env.NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY || '').trim();
  }

  return '';
}

export async function configureRevenueCatForUser({ appUserId, email, displayName }) {
  const platform = getRevenueCatPlatform();
  const apiKey = getRevenueCatPublicApiKey(platform);

  if (!apiKey || !appUserId || !isNativeStorePurchasePlatform()) {
    return false;
  }

  await Purchases.setLogLevel({ level: LOG_LEVEL.INFO });

  const { isConfigured } = await Purchases.isConfigured();
  if (!isConfigured) {
    await Purchases.configure({
      apiKey,
      appUserID: appUserId,
    });
  } else if (configuredAppUserId && configuredAppUserId !== appUserId) {
    await Purchases.logIn({ appUserID: appUserId });
  }

  configuredAppUserId = appUserId;
  configuredApiKey = apiKey;

  if (email) {
    await Purchases.setEmail({ email }).catch(() => {});
  }
  if (displayName) {
    await Purchases.setDisplayName({ displayName }).catch(() => {});
  }

  return true;
}

export async function getNativeDemandCreditStoreProduct(userData) {
  const platform = getRevenueCatPlatform();
  const { config, kind, offer } = resolveNativeDemandCreditProduct({ platform, userData });

  if (!config?.productId) {
    return { product: null, offer, kind, attemptedProductIds: [] };
  }

  const regularProductId = platform === 'ios'
    ? String(process.env.NEXT_PUBLIC_REVENUECAT_IOS_PRODUCT_ID_REGULAR || '').trim()
    : platform === 'android'
      ? String(process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_PRODUCT_ID_REGULAR || '').trim()
      : '';

  const attemptedProductIds = Array.from(new Set([
    config.productId,
    // If founder SKU is not yet available in store, fall back to regular SKU.
    ...(kind === 'founder' && regularProductId ? [regularProductId] : []),
  ].filter(Boolean)));

  const { products } = await Purchases.getProducts({
    productIdentifiers: attemptedProductIds,
    type: 'NON_SUBSCRIPTION',
  });

  const productList = Array.isArray(products) ? products : [];
  const readProductId = (item) => String(item?.identifier || item?.productIdentifier || item?.id || '').trim();
  const preferred = productList.find((item) => readProductId(item) === config.productId) || null;
  const fallback = !preferred && kind === 'founder' && regularProductId
    ? productList.find((item) => readProductId(item) === regularProductId) || null
    : null;
  const selectedProduct = preferred || fallback || null;

  return {
    product: selectedProduct,
    offer,
    kind,
    requestedProductId: config.productId,
    fallbackUsed: Boolean(fallback),
    attemptedProductIds,
  };
}

export async function purchaseNativeDemandCreditProduct(product) {
  return Purchases.purchaseStoreProduct({
    product,
    googleIsPersonalizedPrice: false,
  });
}

export async function restoreNativeDemandPurchases() {
  return Purchases.restorePurchases();
}

export async function getRevenueCatCustomerInfo() {
  return Purchases.getCustomerInfo();
}

export function getRevenueCatConfigurationSnapshot() {
  return {
    configuredAppUserId,
    configuredApiKey,
  };
}
