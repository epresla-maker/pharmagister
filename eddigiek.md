# Projekt Kontextus - Pharmagister
**Utolsó frissítés:** 2026. március 21.

---

## App státusz
- **iOS App Store:** ✅ ELÉRHETŐ – átment az Apple review-n, live az App Store-ban
- **Android:** ✅ FELTÖLTVE – zárt tesztelés lezárult (kb. március 16.)
- **App ID:** com.pharmagister.app
- **Architektúra:** Capacitor WebView → https://pharmagister.hu (távoli szerver)
- **Natív funkciók:** Push Notifications, SplashScreen, Keyboard plugin

## Android részletek
- **Verzió:** 1.2 (versionCode: 4)
- **SDK:** minSdk 24 / targetSdk 36 / compileSdk 36
- **Legfrissebb build:** `app-release.aab` – 3.9 MB, buildelve: 2026. március 1.
- **APK (közvetlen letöltés):** `app-release.apk` – 4.2 MB, buildelve: február 12.
- **Firebase Storage APK URL:** https://storage.googleapis.com/pharmacare-dfa3c.firebasestorage.app/apps/pharmagister-android.apk
- **Keystore:** ✅ konfigurálva (`android/app/pharmagister-release.keystore` + `android/keystore.properties`)

## Új funkciók (március 2. óta)
- **Kötelező továbbképzés (KTK) kereső** – OKFO SZAFTEX portál adatai alapján, statikus JSON-ból (`public/ktk-data.json`, 98 rekord)
  - Elérhető: `/ktk-kereso` oldalon, + Közösség oldalon gomb
  - Adatok: `convert-ktk.py` script generálja Excel-ből, `_compare_ktk.py` az összehasonlító
  - Firestore: csak visit statisztika (stats/ktk-kereso), a KTK adat maga NEM Firestore-ból jön
  - Facebook poszt: `facebook-post-ktk.txt`

## Firestore optimalizáció (2026. március 20.)
- **Probléma:** 3 belépés ~1000 Firestore read-et generált (napi free kvóta: 50,000)
- **Ok:** `useDashboardBadges.js` két `onSnapshot` listener LIMIT NÉLKÜL:
  - chats `onSnapshot` → minden belépésnél az ÖSSZES chat doc-ot olvasta (~30-100 read)
  - notifications `onSnapshot` → minden belépésnél az ÖSSZES olvasatlan notif-ot olvasta (~10-50 read)
  - Ezek ráadásul MINDEN oldalon futottak (globális provider), és minden változásnál újra-tüzeltek
- **Javítás:** `onSnapshot` lecserélve `getDocs` polling-ra (2 percenként), `getCountFromServer` ahol lehetett
  - Commit: `fc134ae` – "perf: replace onSnapshot with polling in badge counts"
  - Megtakarítás: ~600 read/belépés (a re-fire-ok megszűntek)
  - Kompromisszum: badge szám max 2 perc késéssel frissül (real-time helyett)
  - NEM kellett új app build (webes kód változás)

## Firestore read audit összefoglaló
Egy tipikus `/kozosseg` oldalletöltés olvasásai:
| Forrás | Collection | Read |
|--------|-----------|------|
| AuthContext onSnapshot | users/{uid} | 1-2 |
| Badges polling (chats getDocs) | chats | ~30-100 |
| Badges polling (notifs getDocs) | notifications | ~10-50 |
| Badges polling (counts) | appointments + substitutionRequests | 2 |
| kozosseg fetchPosts | communityPosts (limit 50) | 50 |
| **Összesen** | | ~93-204 |

Egyéb magas read-ű helyek (későbbi optimalizálásra):
- `/chat` oldal: duplikált chats listener (badges + chat page)
- `PharmaDashboard`: N+1 query (demand-enként külön applications lekérés)
- `useServiceFeed`: dupla fetch (cache + háttér refresh)
- `/notifications` oldal: ÖSSZES notification limit nélkül

## Fontos tudnivalók
- Webes változtatások (menü, UI, új oldalak) → **NEM kell új iOS build**, elég deployolni a webre
- Új iOS build csak natív plugin hozzáadásakor vagy Capacitor config módosításkor szükséges
- Apple review TODO: mind a 20 pont teljesítve (lásd APPLE_REVIEW_TODO.md)
- Teszt fiók Apple reviewer-nek: teszt.review@pharmagister.hu / AppleReview2026!
- Apple szempontjából a távoli WebView megoldás **nem problémás**, mert az app natív funkciókat is használ (push notif stb.)
- Deploy: `git push origin main` → Vercel automatikusan buildel és deployol

## VS Code beállítások
- **Cmd+Shift+E** → Chat megnyitás: beolvassa az eddigiek.md-t, és csak annyit ír: "Készen állok"
- **Cmd+Shift+M** → Chat megnyitás: "mentsd el az eddigiek.md-be az aktuális állapotot"
- Keybindings fájl: ~/Library/Application Support/Code/User/keybindings.json
