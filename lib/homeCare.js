export const ALLOWED_HOMECARE_EMAILS = new Set(['epresla@icloud.com']);

export const HOME_CARE_ROLE_LABELS = {
  agency: 'Szolgáltató szervezet',
  caregiver: 'Ápoló / gondozó szakember',
  client: 'Ellátást igénylő / hozzátartozó',
};

export const HOME_CARE_ROLE_OPTIONS = [
  {
    key: 'client',
    title: 'Ellátást keresek',
    description: 'Saját vagy hozzátartozói otthonápoláshoz keresek segítséget.',
  },
  {
    key: 'caregiver',
    title: 'Ápolóként / gondozóként dolgoznék',
    description: 'Magánszemélyként vállalok otthonápolási feladatokat.',
  },
  {
    key: 'agency',
    title: 'Szolgáltatóként regisztrálok',
    description: 'Cégként vagy intézményként kínálok otthonápolási szolgáltatást.',
  },
];

export function canAccessHomeCare(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  return ALLOWED_HOMECARE_EMAILS.has(email);
}
