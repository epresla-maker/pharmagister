export const SCHEDULE_MANAGER_ADMIN_EMAILS = new Set(['epresla@icloud.com']);
export const SCHEDULE_MANAGER_TEST_TEAM_EMAILS = new Set([
  'tesztpatika@pharmagister.hu',
  'kovacs.anna@pharmagister.hu',
  'nagy.peter@pharmagister.hu',
  'szabo.katalin@pharmagister.hu',
  'toth.eszter@pharmagister.hu',
  'varga.monika@pharmagister.hu',
  'kiss.reka@pharmagister.hu',
  'bteszt@pharmagister.hu',
  'bteszt2@pharmagister.hu',
  'etinatina22@gmail.com',
]);

export function canAccessScheduleManagerByEmailRole(emailInput, role) {
  const email = String(emailInput || '').trim().toLowerCase();

  if (!email || !role) return false;

  if (SCHEDULE_MANAGER_ADMIN_EMAILS.has(email)) {
    return role === 'pharmacy';
  }

  if (SCHEDULE_MANAGER_TEST_TEAM_EMAILS.has(email)) {
    return role === 'pharmacy' || role === 'pharmacist' || role === 'assistant' || role === 'employee';
  }

  return false;
}

export function canAccessScheduleManager(user, userData) {
  return canAccessScheduleManagerByEmailRole(user?.email, userData?.pharmagisterRole);
}
