export const SCHEDULE_MANAGER_CAMPAIGN_SUBJECT = 'Díjmentes beosztáskezelő a Pharmagisterben';

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

export function getScheduleManagerPushDraft() {
  return {
    title: 'Díjmentes beosztáskezelő a Pharmagisterben',
    body: 'Megérkezett a tájékoztató a Pharmagister beosztáskezelő funkciójáról. Koppints a részletekért.',
    url: SCHEDULE_MANAGER_CAMPAIGN_URL,
    tag: 'schedule-manager-campaign-2026-05',
    type: 'schedule_campaign',
  };
}
