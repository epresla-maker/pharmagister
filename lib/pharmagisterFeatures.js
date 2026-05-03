const SCHEDULE_MANAGER_ADMIN_EMAILS = new Set(['epresla@icloud.com']);
const SCHEDULE_MANAGER_TEST_TEAM_EMAILS = new Set([
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

export function canAccessScheduleManager(user, userData) {
  const email = user?.email?.toLowerCase();
  const role = userData?.pharmagisterRole;

  if (!email || !role) return false;

  if (SCHEDULE_MANAGER_ADMIN_EMAILS.has(email)) {
    return role === 'pharmacy';
  }

  if (SCHEDULE_MANAGER_TEST_TEAM_EMAILS.has(email)) {
    return role === 'pharmacy' || role === 'pharmacist' || role === 'assistant';
  }

  return false;
}
