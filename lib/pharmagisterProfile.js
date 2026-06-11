export function normalizePharmagisterRole(value) {
  const role = String(value || '').trim().toLowerCase();

  if (role === 'pharmacy' || role === 'gyógyszertár' || role === 'gyogyszertar') return 'pharmacy';
  if (role === 'pharmacist' || role === 'gyógyszerész' || role === 'gyogyszeresz') return 'pharmacist';
  if (role === 'assistant' || role === 'szakasszisztens') return 'assistant';
  if (role === 'pka') return 'pka';

  return null;
}

export function hasPharmagisterProfileData(userData) {
  if (!userData) return false;

  return Boolean(
    userData.pharmacyName ||
    userData.pharmacyEmail ||
    userData.pharmacyPhone ||
    userData.pharmacyAddress ||
    userData.pharmacyCity ||
    userData.pharmacyZipCode ||
    userData.pharmacyStreet ||
    userData.contactName ||
    userData.pharmaYearsOfExperience ||
    userData.pharmaHourlyRate ||
    userData.pharmaBio ||
    (Array.isArray(userData.pharmaSoftwareKnowledge) && userData.pharmaSoftwareKnowledge.length > 0)
  );
}

export function getEffectivePharmagisterRole(userData) {
  if (!userData) return null;

  const explicitRole = normalizePharmagisterRole(userData.pharmagisterRole);
  if (explicitRole) return explicitRole;

  const legacyRole = normalizePharmagisterRole(userData.pharmaRole || userData.role || userData.registrationType);
  if (legacyRole) return legacyRole;

  if (
    userData.pharmacyName ||
    userData.pharmacyEmail ||
    userData.pharmacyPhone ||
    userData.pharmacyAddress ||
    userData.pharmacyCity ||
    userData.pharmacyZipCode ||
    userData.pharmacyStreet ||
    userData.contactName
  ) {
    return 'pharmacy';
  }

  return null;
}
