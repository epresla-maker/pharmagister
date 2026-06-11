export const SCHEDULE_MANAGER_ADMIN_EMAILS = new Set(['epresla@icloud.com']);

const SCHEDULE_MANAGER_ALLOWED_ROLES = new Set([
  'pharmacy',
  'pharmacist',
  'assistant',
  'pka',
  'employee',
]);

export function canAccessScheduleManagerByEmailRole(emailInput, role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (!normalizedRole) return false;
  return SCHEDULE_MANAGER_ALLOWED_ROLES.has(normalizedRole);
}

export function canAccessScheduleManager(user, userData) {
  return canAccessScheduleManagerByEmailRole(user?.email, userData?.pharmagisterRole);
}
