# Betti Training Mode (Tanítási Mód)

## Hogyan működik?

A Betti chatbot most tanulni tud a felhasználótól! Ha Betti nem érti meg a kérdésed, vagy rossz választ ad, a "xx " prefixszel megtaníthatod őt.

### Példa:

```
Te: "milyen az idő?"
Betti: "Ezt nem értettem teljesen. Próbáld így: ..."
Te: "xx jelenleg 11:30 perc van"
Betti: "✓ Megtanultam! Legközelebb erre 'jelenleg 11:30 perc van' válaszolok."
```

Legközelebb ha azt kérdezed: "milyen az idő?" akkor Betti visszaadja a tanított választ **dinamikusan a jelenlegi idővel** (!).

## Technikai felépítés

### 1. **bettiTraining.js** - Tanítási segédfüggvények
- `detectTrainingInput()` - Felismeri az "xx " prefixet
- `saveTrainingPattern()` - Mentés a Firestore-ba
- `loadTrainingPatterns()` - Betöltés a Firestore-ból
- `checkLearnedPatterns()` - Ellenőrzi, hogy egy üzenet egyezik-e tanított pattern-el
- `injectDynamicContext()` - Dinamikus időinjektálás az időtől függő válaszokba
- `buildTrainingPattern()` - Pattern objektum készítése

### 2. **intentParser.js** - Intent felismerés tanult pattern-ekkel
- `parseBettiIntent(message, learnedPatterns)` - Most már elfogad tanult pattern-eket
- **Prioritás**: Tanult pattern-ek ELÖBB, mint a hardkódolt intents
- **Dinamikus időinjektálás**: Ha `isTimeAware` flag, az aktuális időt injektálja

### 3. **schedule-chat API route** - Backend szerver
- Betöltés: `loadTrainingPatterns(uid)` Firestore-ból
- Felismerés: `detectTrainingInput(message)` vizsgálja az "xx " prefixet
- Mentés: Ha training input → `saveTrainingPattern()` mentés
- Intent parsing: `parseBettiIntent(message, learnedPatterns)`

### 4. **ScheduleManagerTab.js** - Frontend UI
- `sendBettiChatMessage()` - Nyomon követi az utolsó bot-üzenet intentjét
- Meghív az API-val `previousMessageIntent` és `lastUserMessage` küldésével
- Chat bubble-ben megjeleníti a tanítás megerősítését

## Firestore Adatszerkezet

```
users/{uid}/bettiTraining/{trainingId}
{
  intent: "unknown",           // Milyen intent-re tanítottunk?
  originalQuestion: "milyen az idő?",  // Az eredeti kérdés
  response: "jelenleg 11:30 perc van",   // A tanított válasz
  pattern: "milyen|ido",       // Kulcsszavak a pattern-ből ("|" szeparáló)
  isTimeAware: true,           // Dinamikus időinjektálás szükséges?
  savedAt: "2026-04-29T...",   // Timestamp
}
```

## Dinamikus Időinjektálás

Ha a tanított válasz tartalmazza az "idő" vagy "jelenleg" szavakat, Betti automatikusan **`isTimeAware: true`**-nak jelöli.

Legközelebb ha az üzenet illeszkedik a pattern-re, a jelenlegi idővel helyettesíti:
```
tanított: "jelenleg 11:30 perc van"
aktuális: "jelenleg 14:45 perc van"  (a jelenlegi rendszeridő szerint)
```

## Jövőbeli fejlesztések

- [ ] Tanított pattern-ek szerkesztése/törlése
- [ ] Pattern popularitásának nyomon követése
- [ ] Közösségi pattern-ek megosztása
- [ ] Magasabb szintű NLU (regex helyett)
- [ ] Kontextus-alapú válaszok (employee data, schedule, stb.)
