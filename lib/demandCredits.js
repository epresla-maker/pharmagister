export const DEMAND_PACKAGE_SIZE = 4;
export const DEMAND_PACKAGE_BASE_PRICE_HUF = 5000;
export const FOUNDER_DISCOUNT_PERCENT = 50;
export const FOUNDER_JOIN_CUTOFF_ISO = '2026-09-01T21:59:59.999Z';
export const DEMAND_CREDIT_DECREASE_START_ISO = '2026-08-31T22:00:00.000Z';

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export function toDateSafe(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate();
    } catch (_) {
      return null;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function isDemandCreditDecreaseActive(now = new Date()) {
  return now >= new Date(DEMAND_CREDIT_DECREASE_START_ISO);
}

export function getDemandCreditBalance(userData = {}, now = new Date()) {
  const decreaseActive = isDemandCreditDecreaseActive(now);
  const isPharmacy = String(userData?.pharmagisterRole || '') === 'pharmacy';

  if (!decreaseActive) {
    const previewCredits = isPharmacy ? DEMAND_PACKAGE_SIZE : 0;
    return {
      totalCredits: previewCredits,
      usedCredits: 0,
      remainingCredits: previewCredits,
      decreaseActive,
      decreaseStartsAt: DEMAND_CREDIT_DECREASE_START_ISO,
      previewMode: true,
    };
  }

  const storedTotal = Number(userData.demandCreditsTotal);
  const totalCredits = Number.isFinite(storedTotal)
    ? Math.max(0, storedTotal)
    : 0;

  const storedUsedCredits = Math.max(0, asNumber(userData.demandCreditsUsed, 0));
  const usedCredits = storedUsedCredits;
  const remainingCredits = Math.max(0, totalCredits - usedCredits);

  return {
    totalCredits,
    usedCredits,
    remainingCredits,
    decreaseActive,
    decreaseStartsAt: DEMAND_CREDIT_DECREASE_START_ISO,
    previewMode: false,
  };
}

export function getFounderMembershipStatus(userData = {}) {
  const joinDate = toDateSafe(userData.createdAt) || toDateSafe(userData.registeredAt);
  const cutoffDate = new Date(FOUNDER_JOIN_CUTOFF_ISO);
  const profileComplete = Boolean(userData.pharmaProfileComplete);

  if (!joinDate || joinDate > cutoffDate) {
    return {
      isEligibleByJoinDate: false,
      profileComplete,
      discountActive: false,
      discountPercent: 0,
      validUntil: null,
    };
  }

  const discountActive = profileComplete;

  return {
    isEligibleByJoinDate: true,
    profileComplete,
    discountActive,
    discountPercent: discountActive ? FOUNDER_DISCOUNT_PERCENT : 0,
    validUntil: null,
  };
}

export function getDemandPackageOffer(userData = {}, now = new Date()) {
  const founder = getFounderMembershipStatus(userData, now);
  const discountPercent = founder.discountActive ? FOUNDER_DISCOUNT_PERCENT : 0;
  const discountedPriceHuf = Math.round(
    DEMAND_PACKAGE_BASE_PRICE_HUF * (1 - discountPercent / 100)
  );

  return {
    packageCredits: DEMAND_PACKAGE_SIZE,
    basePriceHuf: DEMAND_PACKAGE_BASE_PRICE_HUF,
    discountPercent,
    finalPriceHuf: discountedPriceHuf,
    founder,
  };
}
