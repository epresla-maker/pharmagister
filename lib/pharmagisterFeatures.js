const SCHEDULE_MANAGER_ADMIN_EMAILS = new Set(['epresla@icloud.com']);
const SCHEDULE_MANAGER_TEST_PHARMACIST_EMAILS = new Set([
  'bteszt@pharmagister.hu',
  'bteszt2@pharmagister.hu',
]);

export function canAccessScheduleManager(user, userData) {
  const email = user?.email?.toLowerCase();
  const role = userData?.pharmagisterRole;

  if (!email || !role) return false;

  if (SCHEDULE_MANAGER_ADMIN_EMAILS.has(email)) {
    return role === 'pharmacy';
  }

  if (SCHEDULE_MANAGER_TEST_PHARMACIST_EMAILS.has(email)) {
    return role === 'pharmacist' || role === 'assistant';
  }

  return false;
}
