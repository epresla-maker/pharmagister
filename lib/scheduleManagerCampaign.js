export const SCHEDULE_MANAGER_CAMPAIGN_SUBJECT = 'Díjmentes beosztáskezelő a Pharmagisterben';
export const SCHEDULE_MANAGER_CAMPAIGN_SUBJECT_DE = 'Kostenlose Dienstplanverwaltung bei Pharmagister';

export const SCHEDULE_MANAGER_CAMPAIGN_URL = '/beosztaskezelo-tajekoztato';

export const SCHEDULE_MANAGER_CAMPAIGN_BODY = `Tisztelt Vezetőség!

Örömmel jelezzük, hogy a Pharmagisterben elérhető a gyógyszertáraknak fejlesztett beosztáskezelő funkció.

A legfontosabb: a beosztáskezelő használata jelenleg teljesen díjmentes.

A funkcióval egy helyen kezelhető:
- a dolgozói beosztás tervezése,
- a havi beosztás publikálása,
- a műszakcsere és szabadságkezelés,
- a napi szervezést segítő értesítések.

A folyamat egyszerű:
1. A gyógyszertár rögzíti a dolgozói és tervezési adatokat.
2. Elkészíti a havi beosztást.
3. A rendszer jelzi az esetleges ütközéseket.
4. A végleges beosztás publikálható, a csapat azonnal látja a változásokat.

Célunk, hogy a beosztásszervezés gyorsabb, átláthatóbb és kevesebb adminisztrációval járjon.

Elérhetőség: https://pharmagister.hu

Ezt a levelet azért kapta, mert korábban regisztrált a Pharmagister rendszerében.

Köszönettel,
Epres László`;

export const SCHEDULE_MANAGER_CAMPAIGN_BODY_DE = `Sehr geehrte Leitung!

Wir freuen uns, Ihnen mitzuteilen, dass in Pharmagister jetzt eine Dienstplanverwaltungsfunktion fuer Apotheken verfuegbar ist.

Das Wichtigste: Die Nutzung der Dienstplanverwaltung ist derzeit komplett kostenlos.

Mit der Funktion lassen sich zentral verwalten:
- die Planung der Mitarbeitenden,
- die Veroeffentlichung des Monatsplans,
- Schichttausch und Urlaubsverwaltung,
- Benachrichtigungen fuer die taegliche Organisation.

Der Ablauf ist einfach:
1. Die Apotheke erfasst Mitarbeitenden- und Planungsdaten.
2. Sie erstellt den Monatsdienstplan.
3. Das System weist auf moegliche Konflikte hin.
4. Der finale Dienstplan kann veroeffentlicht werden, das Team sieht Aenderungen sofort.

Unser Ziel ist, die Dienstplanung schneller, transparenter und mit weniger Administration zu machen.

Kontakt: https://pharmagister.hu

Sie erhalten diese Nachricht, weil Sie sich zuvor im Pharmagister-System registriert haben.

Mit freundlichen Gruessen,
Epres Laszlo`;

export function getScheduleManagerPushDraft(market = 'hu') {
  return {
    title: market === 'de' ? 'Kostenlose Dienstplanverwaltung bei Pharmagister' : 'Díjmentes beosztáskezelő a Pharmagisterben',
    body: market === 'de'
      ? 'Die Informationen zur Pharmagister-Dienstplanverwaltung sind da. Tippe fuer Details.'
      : 'Megérkezett a tájékoztató a Pharmagister beosztáskezelő funkciójáról. Koppints a részletekért.',
    url: SCHEDULE_MANAGER_CAMPAIGN_URL,
    tag: 'schedule-manager-campaign-2026-05',
    type: 'schedule_campaign',
  };
}
