import { GoogleGenerativeAI } from '@google/generative-ai';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { normalizeMarket } from '@/lib/market';

const ADMIN_EMAILS = ['epresla@icloud.com'];
const MIN_DAILY_POSTS = 3;
const MAX_DAILY_POSTS = 5;
const SOURCE = 'llm_auto_feed';
const TEST_BATCH = 'hu-100-2026-07-23';
const SLOT_MINUTES = 15;
const ACTIVE_HOURS_START = 7;
const ACTIVE_HOURS_END = 22; // exclusive

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function getMarketTimeZone(market) {
  return market === 'de' ? 'Europe/Berlin' : 'Europe/Budapest';
}

function getZonedNowParts(market) {
  const timeZone = getMarketTimeZone(market);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const partsRaw = fmt.formatToParts(new Date());
  const parts = {};
  partsRaw.forEach((p) => {
    if (p.type !== 'literal') parts[p.type] = p.value;
  });

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;

  return { year, month, day, hour, minute, dateKey, timeZone };
}

function shiftDateKey(dateKey, days) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

function parseDryRunFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function parseDateOverride(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error('A date param formátuma YYYY-MM-DD legyen');
  }
  return raw;
}

function buildDailyPlan({ dateKey, market }) {
  const seed = hashString(`${dateKey}:${market}:auto-feed-slots:v1`);
  const rng = createRng(seed);
  const target = MIN_DAILY_POSTS + Math.floor(rng() * (MAX_DAILY_POSTS - MIN_DAILY_POSTS + 1));

  const daySlots = [];
  for (let h = ACTIVE_HOURS_START; h < ACTIVE_HOURS_END; h += 1) {
    for (let q = 0; q < 60; q += SLOT_MINUTES) {
      daySlots.push(h * 60 + q);
    }
  }

  const shuffled = shuffle(daySlots.map((slot) => ({ slot, rank: rng() })));
  shuffled.sort((a, b) => a.rank - b.rank);

  const selected = shuffled.slice(0, target).map((s) => s.slot).sort((a, b) => a - b);
  return { target, slots: selected };
}

function formatSlot(slot) {
  const hour = Math.floor(slot / 60);
  const minute = slot % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

async function acquireSlotLock(db, { market, dateKey, slot }) {
  const lockId = `${market}_${dateKey}_${slot}`;
  const ref = db.collection('autoFeedSlotLocks').doc(lockId);
  try {
    await ref.create({
      market,
      dateKey,
      slot,
      slotLabel: formatSlot(slot),
      source: SOURCE,
      createdAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    const code = String(error?.code || '');
    if (code === 'already-exists' || code === '6') {
      return false;
    }
    throw error;
  }
}

function getPromptTypePool(market) {
  if (market === 'de') {
    return [
      { kind: 'question', instruction: 'Schreibe eine kurze, offene Frage an die Community zu Schichtplanung oder Vertretung.' },
      { kind: 'tip', instruction: 'Schreibe einen kurzen, praktischen Tipp zu Schichtorganisation in der Apotheke.' },
      { kind: 'micro-story', instruction: 'Schreibe einen kurzen Erfahrungsimpuls (1-2 Saetze) aus dem Apothekenalltag.' },
      { kind: 'poll', instruction: 'Schreibe einen Beitrag im Umfrage-Stil mit 2-3 Antwortoptionen im Text.' },
      { kind: 'motivation', instruction: 'Schreibe einen motivierenden, freundlichen Beitrag fuer den Arbeitsalltag.' },
    ];
  }

  return [
    { kind: 'question', instruction: 'Írj egy rövid, nyitott kérdést a közösségnek beosztásról, helyettesítésről vagy patikai munkaszervezésről.' },
    { kind: 'tip', instruction: 'Írj egy rövid, gyakorlati tippet a gyógyszertári műszaktervezéshez.' },
    { kind: 'micro-story', instruction: 'Írj egy rövid (1-2 mondatos) hétköznapi szakmai helyzetet, amire lehet reagálni.' },
    { kind: 'poll', instruction: 'Írj egy mini szavazás jellegű posztot 2-3 válaszopcióval a szövegben.' },
    { kind: 'motivation', instruction: 'Írj egy rövid, pozitív, közösségépítő üzenetet a szakmának.' },
  ];
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForDedup(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[.,!?;:()\[\]"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function soundsInstitutionalPharmacyVoice(text, market) {
  const source = String(text || '').toLowerCase();
  if (!source) return false;

  const huSignals = [
    'gyogyszertarunk',
    'gyógyszertárunk',
    'patikank',
    'patikánk',
    'nalunk a patikaban',
    'nálunk a patikában',
    'csapatunk',
    'uzletunk',
    'üzletünk',
  ];

  const deSignals = [
    'unsere apotheke',
    'in unserer apotheke',
    'unser team',
  ];

  const signals = market === 'de' ? deSignals : huSignals;
  return signals.some((signal) => source.includes(signal));
}

function makeUniqueText(text, market, usedNormalized) {
  const base = cleanText(text);
  if (!base) return base;

  const baseNorm = normalizeForDedup(base);
  if (!usedNormalized.has(baseNorm)) return base;

  const huSuffixes = [
    'Ti mit próbáltatok erre?',
    'Kinek mi vált be ebben?',
    'Nálatok mi működik jól erre?',
  ];
  const deSuffixes = [
    'Wie macht ihr das konkret?',
    'Was hat bei euch gut funktioniert?',
    'Welche Loesung war bei euch stabil?',
  ];

  const suffixes = market === 'de' ? deSuffixes : huSuffixes;
  for (const suffix of suffixes) {
    const candidate = cleanText(`${base} ${suffix}`);
    const normalized = normalizeForDedup(candidate);
    if (!usedNormalized.has(normalized)) return candidate;
  }

  return cleanText(`${base} #${Date.now().toString().slice(-4)}`);
}

function maybeHumanizeTypos(text) {
  const source = cleanText(text);
  if (!source) return source;

  // ~60% of posts get one subtle typo for human feel.
  if (Math.random() > 0.60) return source;

  const transforms = [
    (s) => s.replace(/\bhogy\b/i, 'hoyg'),
    (s) => s.replace(/\bnem\b/i, 'nme'),
    (s) => s.replace(/\bmert\b/i, 'mret'),
    (s) => s.replace(/\bde\b/i, 'd e'),
    (s) => s.replace(/\bés\b/i, 'es'),
    (s) => s.replace(/\bmeg\b/i, 'mge'),
    (s) => s.replace(/\bvan\b/i, 'vna'),
    (s) => s.replace(/\bma\b/i, 'm a'),
    (s) => s.replace(/\?$/, '??'),
  ];

  const shuffled = shuffle(transforms);
  for (const transform of shuffled) {
    const next = transform(source);
    if (next !== source) {
      return next;
    }
  }

  return source;
}

function fallbackText(type, market, variationKey = '') {
  if (market === 'de') {
    const deFallbacks = {
      question: [
        'Wie plant ihr kurzfristige Ausfaelle im Team, ohne dass die Woche komplett neu organisiert werden muss?',
        'Wenn morgens ploetzlich jemand ausfaellt: Wie fangt ihr das ab, ohne die ganze Schichtkette umzubauen?',
        'Welche Loesung hilft euch am meisten, wenn kurzfristig eine Luecke im Dienstplan entsteht?',
      ],
      tip: [
        'Kurzer Tipp: Wenn ihr den Wochenplan 2 Tage vor Monatsstart finalisiert, sinken spontane Tausch-Anfragen deutlich.',
        'Bei uns hilft es, offene Tauschwuensche schon zur Wochenmitte zu sammeln statt erst am Vorabend.',
        'Praktisch im Alltag: Eine kurze Schichtbestaetigung am Vorabend verhindert viele Missverstaendnisse.',
      ],
      'micro-story': [
        'Heute hat uns ein fruehes Team-Check-in geholfen, eine Luecke in der Spaetschicht rechtzeitig zu loesen.',
        'Eine kurze Morgenabstimmung hat heute gereicht, damit aus einer Ausfallmeldung kein Tageschaos wurde.',
        'Spannend, wie viel eine 5-Minuten-Abstimmung bringt, wenn der Tag schon mit Plan-Aenderung startet.',
      ],
      poll: [
        'Kurze Umfrage: Was hilft euch mehr bei fairen Diensten? A) Feste Rotation B) Wunschdienst-Block C) Monatsweiser Wechsel',
        'Was ist fuer euch bei Diensttauschen realistischer? A) Fester Tauschrahmen B) Freie Abstimmung C) Teamleitung entscheidet',
        'Kleine Umfrage: Was entlastet euren Alltag mehr? A) Fruehe Planung B) Flexible Wechsel C) Klare Springer-Regel',
      ],
      motivation: [
        'Kleine Erinnerung: Eine klare Schichtkommunikation spart am Ende des Tages Zeit und Nerven fuer alle.',
        'Auch an stressigen Tagen hilft oft schon ein sauber abgestimmter Plan mehr als jedes Improvisieren.',
        'Wenn alle frueh wissen, woran sie sind, laeuft selbst ein voller Tag meist deutlich ruhiger.',
      ],
    };
    const options = deFallbacks[type] || deFallbacks.question;
    return options[hashString(`${type}:${variationKey}`) % options.length];
  }

  const huFallbacks = {
    question: [
      'Ti hogyan kezelitek a hirtelen kieséseket úgy, hogy ne boruljon az egész heti beosztás?',
      'Ha reggel derül ki egy hiány, nálatok mi az első lépés, hogy ne csússzon szét a nap?',
      'Milyen megoldás vált be nálatok akkor, amikor valaki rövid időn belül kiesik a műszakból?',
    ],
    tip: [
      'Gyakorlati tipp: ha a havi beosztást 2 nappal a hónap előtt lezárjátok, kevesebb lesz az utólagos csereigény.',
      'Nálunk sokat segít, ha a csereigényeket nem külön chatben, hanem egy fix heti idősávban gyűjtjük össze.',
      'Apró trükk, de működik: az előző esti rövid visszaigazolás sok félreértést kivesz a másnapi műszakból.',
    ],
    'micro-story': [
      'Ma egy reggeli 10 perces egyeztetés elég volt ahhoz, hogy időben megoldjuk az esti műszakhiányt.',
      'Ma az segített a legtöbbet, hogy még nyitás előtt gyorsan átbeszéltük, kinél mennyi mozgástér van.',
      'Érdekes, hogy néha egy rövid reggeli egyeztetés többet ér, mint a napközbeni kapkodás.',
    ],
    poll: [
      'Mini szavazás: Nektek mi működik jobban? A) fix rotáció B) kívánságműszak blokk C) havi váltott rendszer',
      'Kíváncsi vagyok, nálatok mi a legélhetőbb: A) előre lezárt hónap B) heti finomhangolás C) tartalékos rendszer',
      'Ti mire szavaztok beosztásnál? A) teljesen fix rend B) részben rugalmas csere C) gyors beugrós lista',
    ],
    motivation: [
      'Rövid emlékeztető: a világos beosztás-kommunikáció rengeteg időt és feszültséget spórol a csapatnak.',
      'Sokszor már az is fél siker, ha mindenki időben látja, mire számíthat a következő napokban.',
      'Egy jól átlátható beosztás nem látványos dolog, de elképesztően sok napi feszültséget levesz a vállakról.',
    ],
  };
  const options = huFallbacks[type] || huFallbacks.question;
  return options[hashString(`${type}:${variationKey}`) % options.length];
}

async function generateWithGemini({ model, market, typeConfig, avoidTexts = [], variationHint = '' }) {
  const language = market === 'de' ? 'német' : 'magyar';
  const bannedList = avoidTexts.map((item) => `- ${cleanText(item)}`).filter(Boolean).join('\n');
  const prompt = [
    `Feladat: ${typeConfig.instruction}`,
    `Nyelv: ${language}`,
    'Kontextus: Pharmagister hírfolyam, gyógyszertári szakmai közösség.',
    'Stílus: közvetlen, emberi, nem reklámszagú.',
    'Perspektíva: mindig egy egyéni szakdolgozó ír, E/1 vagy E/2 természetes hangnemben.',
    'TILOS intézményi hang: ne írj úgy, mintha a gyógyszertár vagy vállalkozás kommunikálna.',
    'Kerüld ezeket a fordulatokat: "gyógyszertárunk", "patikánk", "nálunk a patikában", "csapatunk", "unsere Apotheke", "in unserer Apotheke".',
    'Hossz: 1-3 mondat, maximum 260 karakter.',
    'Ne legyen benne hashtag, ne legyen benne emoji, ne legyen benne túl általános bullshit.',
    variationHint ? `Variációs jel: ${variationHint}` : '',
    bannedList ? `Ezeket a korábbi szövegeket ne ismételd:\n${bannedList}` : '',
    'Adj vissza kizárólag JSON-t ebben a formában:',
    '{"text":"...","tags":["...","..."],"category":"kozosseg"}',
  ].filter(Boolean).join('\n');

  const result = await model.generateContent(prompt);
  const raw = String(result.response.text() || '').trim();

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      parsed = JSON.parse(m[0]);
    }
  }

  let text = maybeHumanizeTypos(cleanText(parsed?.text));
  if (soundsInstitutionalPharmacyVoice(text, market)) {
    text = fallbackText(typeConfig.kind, market, variationHint);
  }
  const tags = Array.isArray(parsed?.tags) ? parsed.tags.map((t) => cleanText(t)).filter(Boolean).slice(0, 5) : [];
  const category = cleanText(parsed?.category) || 'kozosseg';

  if (!text) {
    return {
      text: fallbackText(typeConfig.kind, market, variationHint),
      tags: [],
      category: 'kozosseg',
      usedFallback: true,
    };
  }

  return {
    text,
    tags,
    category,
    usedFallback: false,
  };
}

async function loadAdminUserIds(db) {
  const ids = [];
  for (const email of ADMIN_EMAILS) {
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!snap.empty) ids.push(snap.docs[0].id);
  }
  return ids;
}

async function loadCandidateAuthors(db, market) {
  const batchSnap = await db.collection('users').where('testBatch', '==', TEST_BATCH).get();
  const authors = batchSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((u) => u.isTestUser && (u.market || 'hu') === market);

  if (authors.length > 0) return authors;

  const fallbackSnap = await db.collection('users').where('isTestUser', '==', true).limit(200).get();
  return fallbackSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((u) => (u.market || 'hu') === market);
}

function isSameDay(date, baseDate) {
  return date.getFullYear() === baseDate.getFullYear()
    && date.getMonth() === baseDate.getMonth()
    && date.getDate() === baseDate.getDate();
}

async function countTodayAutoPosts(db, market, dateKey) {
  const snap = await db.collection('serviceFeedPosts')
    .orderBy('createdAt', 'desc')
    .limit(300)
    .get();

  let count = 0;
  const postedSlots = new Set();

  snap.docs.forEach((doc) => {
    const data = doc.data() || {};
    if (String(data.source || '') !== SOURCE) return;
    if ((data.market || 'hu') !== market) return;
    if (String(data.generatedDateKey || '') !== dateKey) return;
    count += 1;
    if (Number.isInteger(data.generatedSlot)) {
      postedSlots.add(data.generatedSlot);
    }
  });

  return { count, postedSlots, dateKey };
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      return Response.json({ error: 'Nincs jogosultság' }, { status: 401 });
    }

    const url = new URL(request.url);
    const market = normalizeMarket(url.searchParams.get('market') || 'hu');
    const dryRun = parseDryRunFlag(url.searchParams.get('dryRun'));

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'GEMINI_API_KEY nincs beállítva' }, { status: 500 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const now = getZonedNowParts(market);
    const requestedDate = parseDateOverride(url.searchParams.get('date'));
    const defaultPreviewDate = dryRun && !requestedDate ? shiftDateKey(now.dateKey, 1) : null;
    const effectiveDateKey = requestedDate || defaultPreviewDate || now.dateKey;
    const plan = buildDailyPlan({ dateKey: effectiveDateKey, market });

    const todaySummary = await countTodayAutoPosts(db, market, effectiveDateKey);
    const missingSlots = plan.slots.filter((slot) => !todaySummary.postedSlots.has(slot));

    if (todaySummary.count >= plan.target || missingSlots.length === 0) {
      return Response.json({
        success: true,
        created: 0,
        skipped: true,
        reason: 'daily_limit_reached',
        todayCount: todaySummary.count,
        targetDaily: plan.target,
        dateKey: effectiveDateKey,
        plannedSlots: plan.slots.map(formatSlot),
        dryRun,
      });
    }

    const authors = await loadCandidateAuthors(db, market);
    if (!authors.length) {
      return Response.json({ error: 'Nincs elérhető szerző a teszt felhasználók között' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 350,
        responseMimeType: 'application/json',
      },
    });

    const promptPool = shuffle(getPromptTypePool(market));
    const adminUserIds = dryRun ? [] : await loadAdminUserIds(db);

    const created = [];
    const usedTexts = new Set();
    for (let index = 0; index < missingSlots.length; index += 1) {
      const slot = missingSlots[index];
      if (!dryRun) {
        const lockAcquired = await acquireSlotLock(db, {
          market,
          dateKey: effectiveDateKey,
          slot,
        });

        if (!lockAcquired) {
          continue;
        }
      }

      const typeConfig = promptPool[index % promptPool.length];
      const author = pickRandom(authors);
      let generated = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        generated = await generateWithGemini({
          model,
          market,
          typeConfig,
          avoidTexts: Array.from(usedTexts),
          variationHint: `${now.dateKey}:${formatSlot(slot)}:${attempt}`,
        });

        const normalized = normalizeForDedup(generated.text);
        const duplicate = usedTexts.has(normalized);
        const institutional = soundsInstitutionalPharmacyVoice(generated.text, market);
        if (!duplicate && !institutional) {
          break;
        }
      }

      const finalText = makeUniqueText(
        generated?.text || fallbackText(typeConfig.kind, market, `${effectiveDateKey}:${slot}:final`),
        market,
        usedTexts,
      );
      usedTexts.add(normalizeForDedup(finalText));

      const postData = {
        postType: 'userPost',
        module: 'pharmagister',
        market,
        userId: author.id,
        text: finalText,
        category: generated.category || 'kozosseg',
        tags: generated.tags || [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        authorData: {
          displayName: author.displayName || author.name || 'Felhasználó',
          photoURL: author.photoURL || null,
        },
        reactions: {},
        comments: [],
        shares: 0,
        source: SOURCE,
        generatedBy: 'gemini-2.5-flash',
        generationKind: typeConfig.kind,
        generationFallback: Boolean(generated.usedFallback),
        generatedDateKey: effectiveDateKey,
        generatedSlot: slot,
        generatedSlotLabel: formatSlot(slot),
        generatedTimeZone: now.timeZone,
        requiresAdminApproval: true,
        approvalStatus: 'pending',
        approvalRequestedAt: dryRun ? null : admin.firestore.FieldValue.serverTimestamp(),
      };

      if (dryRun) {
        created.push({
          id: `dryrun-${effectiveDateKey}-${slot}`,
          authorId: author.id,
          authorName: author.displayName || author.name || 'Felhasználó',
          kind: typeConfig.kind,
          slot,
          text: finalText,
          category: postData.category,
        });
      } else {
        const postRef = await db.collection('serviceFeedPosts').add(postData);
        created.push({ id: postRef.id, authorId: author.id, authorName: author.displayName || author.name || 'Felhasználó', kind: typeConfig.kind, slot, text: finalText, category: postData.category });
      }
    }

    if (created.length === 0) {
      return Response.json({
        success: true,
        created: 0,
        skipped: true,
        reason: 'all_slots_locked_or_already_created',
        todayCount: todaySummary.count,
        targetDaily: plan.target,
        dateKey: effectiveDateKey,
        plannedSlots: plan.slots.map(formatSlot),
        dryRun,
      });
    }

    if (created.length > 0 && adminUserIds.length > 0) {
      const notifBatch = db.batch();
      adminUserIds.forEach((adminId) => {
        const notifRef = db.collection('notifications').doc();
        notifBatch.set(notifRef, {
          userId: adminId,
          market,
          type: 'admin_approval_request',
          title: market === 'de' ? 'Neue KI-Feedbeitraege warten auf Freigabe' : 'Új AI hírfolyam posztok várnak jóváhagyásra',
          message: market === 'de'
            ? `${created.length} neue Beitraege wurden erstellt und warten auf deine Freigabe im Admin/Posts Bereich.`
            : `${created.length} új bejegyzés készült, jóváhagyásra várnak az Admin/Posztok felületen.`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          data: {
            source: SOURCE,
            pendingCount: created.length,
            url: '/admin/posts',
          },
          url: '/admin/posts',
        });
      });
      await notifBatch.commit();
    }

    return Response.json({
      success: true,
      created: created.length,
      pendingApproval: created.length,
      todayCountAfter: todaySummary.count + created.length,
      targetDaily: plan.target,
      postedSlots: created.map((c) => formatSlot(c.slot)),
      dateKey: effectiveDateKey,
      plannedSlots: plan.slots.map(formatSlot),
      ids: created.map((c) => c.id),
      dryRun,
      previews: created.map((c) => ({
        id: c.id,
        slot: formatSlot(c.slot),
        kind: c.kind,
        authorName: c.authorName,
        text: c.text,
        category: c.category || 'kozosseg',
      })),
    });
  } catch (error) {
    console.error('[cron/auto-feed-posts] error:', error);
    return Response.json({ error: error.message || 'Ismeretlen hiba' }, { status: 500 });
  }
}
