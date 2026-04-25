export function canAccessScheduleManager(user, userData) {
  const email = user?.email?.toLowerCase();
  const role = userData?.pharmagisterRole;

  return email === 'epresla@icloud.com' && role === 'pharmacy';
}
