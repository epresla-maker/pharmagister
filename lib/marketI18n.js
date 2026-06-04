import { normalizeMarket } from '@/lib/market';

const TRANSLATIONS = {
  hu: {
    navHome: 'Főoldal',
    navMessages: 'Üzenetek',
    navNotifications: 'Értesítések',
    navSettings: 'Beállítások',
    activeLanguage: 'Aktív nyelv',
    huMode: 'HU mód',
    deMode: 'DE mód',
    shortageSearch: 'Hiánycikk kereső',
    pmFeed: 'PM hírfolyam',
    news: 'Hírek',
    jobSearch: 'Állást keres',
    writeSomething: 'Írj valamit...',
    reaction: 'Reakció',
    reply: 'Válasz',
    commentsSuffix: 'hozzászólás',
    noPostsTitle: 'Még nincsenek posztok',
    noPostsDesc: 'Légy te az első, aki megosztja a gondolatait!',
    loading: 'Betöltés...',
    back: 'Vissza',
    delete: 'Törlés',
    new: 'Új',
    settingsTitle: 'Beállítások',
    accountSection: 'Fiók',
    appSection: 'Alkalmazás',
    supportSection: 'Támogatás',
    adminSection: 'Adminisztráció',
    profileEdit: 'Profil szerkesztése',
    changePassword: 'Jelszó módosítása',
    deleteAccount: 'Fiók törlése',
    marketLanguage: 'Piac és nyelv (HU/DE)',
    notificationsSettings: 'Értesítések',
    feedSettings: 'Hírfolyam beállítások',
    help: 'Súgó',
    supportLabel: 'Támogatás / Support',
    privacySettings: 'Adatvédelmi beállítások',
    privacyPolicy: 'Adatvédelmi irányelvek / Privacy Policy',
    childSafetyPolicy: 'Child Safety Policy',
    addAccount: 'Fiók hozzáadása',
    logout: 'Kijelentkezés',
    logoutConfirmQuestion: 'Biztosan ki szeretnél jelentkezni?',
    cancel: 'Mégse',
    continue: 'Tovább',
    deleteDoneTitle: 'Fiók törölve',
    deleteDoneText: 'A fiókod és minden adatod véglegesen törölve lett. Átirányítás...',
    deleteInProgress: 'Fiók törlése folyamatban...',
    notificationsTitle: 'Értesítések',
    notificationsNone: 'Nincs értesítésed',
    notificationsNoneDesc: 'Az új értesítések itt fognak megjelenni',
    notificationsCountSuffix: 'értesítésed van',
    homeLowercase: 'főoldal',
    chooseRole: 'Válaszd ki a szerepköröd:',
    connectRoles: 'Kösd össze a gyógyszertárakat a helyettesítőkkel',
    profileIncomplete: 'Profil hiányos',
    profileIncompleteDesc: 'Kérlek töltsd ki a profilodat a beállításokban, hogy használhasd a Pharmagister funkcióit.',
    loadingSave: 'Mentés...',
    acceptAndContinue: 'Elfogadom és folytatom',
    decline: 'Nem fogadom el'
  },
  de: {
    navHome: 'Startseite',
    navMessages: 'Nachrichten',
    navNotifications: 'Benachrichtigungen',
    navSettings: 'Einstellungen',
    activeLanguage: 'Aktive Sprache',
    huMode: 'HU Modus',
    deMode: 'DE Modus',
    shortageSearch: 'Lieferengpasssuche',
    pmFeed: 'PM Newsfeed',
    news: 'Nachrichten',
    jobSearch: 'Sucht Stelle',
    writeSomething: 'Schreib etwas...',
    reaction: 'Reaktion',
    reply: 'Antwort',
    commentsSuffix: 'Kommentare',
    noPostsTitle: 'Noch keine Beiträge',
    noPostsDesc: 'Sei die erste Person, die etwas teilt!',
    loading: 'Laden...',
    back: 'Zurück',
    delete: 'Löschen',
    new: 'Neu',
    settingsTitle: 'Einstellungen',
    accountSection: 'Konto',
    appSection: 'App',
    supportSection: 'Support',
    adminSection: 'Administration',
    profileEdit: 'Profil bearbeiten',
    changePassword: 'Passwort ändern',
    deleteAccount: 'Konto löschen',
    marketLanguage: 'Markt und Sprache (HU/DE)',
    notificationsSettings: 'Benachrichtigungen',
    feedSettings: 'Feed-Einstellungen',
    help: 'Hilfe',
    supportLabel: 'Support',
    privacySettings: 'Datenschutzeinstellungen',
    privacyPolicy: 'Datenschutzrichtlinie',
    childSafetyPolicy: 'Kinderschutzrichtlinie',
    addAccount: 'Konto hinzufügen',
    logout: 'Abmelden',
    logoutConfirmQuestion: 'Möchtest du dich wirklich abmelden?',
    cancel: 'Abbrechen',
    continue: 'Weiter',
    deleteDoneTitle: 'Konto gelöscht',
    deleteDoneText: 'Dein Konto und alle Daten wurden endgültig gelöscht. Weiterleitung...',
    deleteInProgress: 'Konto wird gelöscht...',
    notificationsTitle: 'Benachrichtigungen',
    notificationsNone: 'Keine Benachrichtigungen',
    notificationsNoneDesc: 'Neue Benachrichtigungen erscheinen hier',
    notificationsCountSuffix: 'Benachrichtigungen',
    homeLowercase: 'startseite',
    chooseRole: 'Wähle deine Rolle:',
    connectRoles: 'Verbinde Apotheken mit Vertretungskräften',
    profileIncomplete: 'Profil unvollständig',
    profileIncompleteDesc: 'Bitte vervollständige dein Profil in den Einstellungen, um Pharmagister-Funktionen zu nutzen.',
    loadingSave: 'Speichern...',
    acceptAndContinue: 'Akzeptieren und fortfahren',
    decline: 'Nicht akzeptieren'
  },
};

const CATEGORY_LABELS = {
  altalanos: { hu: 'Általános', de: 'Allgemein' },
  szakmai: { hu: 'Szakmai kérdés', de: 'Fachfrage' },
  tapasztalat: { hu: 'Tapasztalat', de: 'Erfahrung' },
  munkahely: { hu: 'Munkahelyi', de: 'Arbeitsplatz' },
  jogszabaly: { hu: 'Jogszabály', de: 'Rechtliches' },
  kepzes: { hu: 'Képzés / Oktatás', de: 'Weiterbildung / Schulung' },
  egyeb: { hu: 'Egyéb', de: 'Sonstiges' },
};

const REACTION_LABELS = {
  like: { hu: 'Tetszik', de: 'Gefallt mir' },
  love: { hu: 'Imádom', de: 'Liebe ich' },
  haha: { hu: 'Haha', de: 'Haha' },
  wow: { hu: 'Wow', de: 'Wow' },
  sad: { hu: 'Szomorú', de: 'Traurig' },
  angry: { hu: 'Dühös', de: 'Wütend' },
};

export function getClientMarket() {
  if (typeof document === 'undefined') return 'hu';
  const match = document.cookie.match(/(?:^|; )pm_market=([^;]+)/);
  return normalizeMarket(decodeURIComponent(match?.[1] || 'hu'));
}

export function t(key, market = 'hu') {
  const m = normalizeMarket(market);
  return TRANSLATIONS[m]?.[key] || TRANSLATIONS.hu[key] || key;
}

export function getCategoryLabel(categoryId, market = 'hu') {
  const m = normalizeMarket(market);
  return CATEGORY_LABELS[categoryId]?.[m] || CATEGORY_LABELS[categoryId]?.hu || categoryId;
}

export function getReactionLabel(reactionType, market = 'hu') {
  const m = normalizeMarket(market);
  return REACTION_LABELS[reactionType]?.[m] || REACTION_LABELS[reactionType]?.hu || reactionType;
}
