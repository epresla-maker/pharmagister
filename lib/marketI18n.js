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
    noPostsDesc: 'Légy te az első, aki megosztja a gondolatait!'
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
    noPostsDesc: 'Sei die erste Person, die etwas teilt!'
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
