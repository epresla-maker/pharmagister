# Apple Review - Teendők listája
**Dátum:** 2026. február 22.

---

## 🔴 KRITIKUS (azonnali elutasítás kockázata)

- [x] **1. Azonnali fiók törlés implementálása** – Apple Guideline 5.1.1(v)
  - ✅ Self-service törlés: Settings → Fiók törlése → /api/delete-my-account
  - Firebase Auth + összes Firestore adat törlése

- [x] **2. Info.plist permission leírások** – ✅ Kész

- [x] **3. API route-ok hitelesítése** – ✅ verifyAuth/verifyAdmin minden route-on

- [x] **4. Cloudinary titkok rotálása + script eltávolítása git-ből** – ✅ update-cloudinary-env.sh eltávolítva

- [x] **5. Push notification natív javítás** – ✅ Foreground listener hozzáadva

- [x] **6. Firestore wildcard rule eltávolítása** – ✅ Per-collection szabályok, wildcard törölve

## 🟠 MAGAS

- [x] **7. Admin panel szerver oldali védelem** – ✅ API auth middleware-rel megoldva

- [x] **8. `Math.random()` cseréje `crypto.randomBytes()`-ra** – ✅ crypto.getRandomValues

- [x] **9. Email template XSS védelem** – ✅ escapeHtml/sanitizeUrl minden template-ben

- [ ] **10. Cloudinary unsigned upload korlátozása**
  - Upload preset korlátozás vagy signed upload

## 🟡 KÖZEPES

- [ ] **11. Rate limiting hozzáadása**
  - Regisztráció, login, jelszó reset, email küldés

- [ ] **12. Jelszó policy erősítése**
  - Minimum 6 → 8 karakter, komplexitás

- [ ] **13. React Error Boundary hozzáadása**
  - Fehér képernyő megelőzése crash esetén

- [ ] **14. Privacy policy angol verzió**
  - Apple reviewer nem tud magyarul

- [ ] **15. SMTP TLS verification bekapcsolása**
  - `rejectUnauthorized: false` → `true`

- [ ] **16. RSS scraping felülvizsgálata**
  - Semmelweis RSS – van-e jogosultság

## 🟢 ALACSONY

- [x] **17. `cleartext: true` eltávolítása capacitor.config-ból** – ✅ Kész
- [ ] **18. iOS projekt artifact cleanup** (duplikált config xml-ek)
- [ ] **19. `ITSAppUsesNonExemptEncryption` ellenőrzése**
- [ ] **20. Teszt fiók létrehozása Apple reviewer-nek**

---

## Állapot

| # | Teendő | Állapot |
|---|--------|---------|
| 1 | Fiók törlés | ✅ Kész – self-service /api/delete-my-account + Settings UI |
| 2 | Info.plist permissions | ✅ Kész |
| 3 | API auth middleware | ✅ Kész – verifyAuth/verifyAdmin minden route-on |
| 4 | Cloudinary rotálás | ✅ Script eltávolítva git-ből |
| 5 | Push natív fix | ✅ Kész – foreground listener hozzáadva |
| 6 | Firestore rules | ✅ Kész – wildcard törölve, per-collection szabályok |
| 7 | Admin védelem | ✅ API auth middleware-rel megoldva |
| 8 | Token generálás | ✅ Kész – crypto.getRandomValues |
| 9 | Email XSS | ✅ Kész – escapeHtml/sanitizeUrl minden template-ben |
| 10 | Cloudinary upload | ⬜ |
| 11 | Rate limiting | ⬜ |
| 12 | Jelszó policy | ⬜ |
| 13 | Error Boundary | ⬜ |
| 14 | Angol privacy policy | ⬜ |
| 15 | SMTP TLS | ⬜ |
| 16 | RSS scraping | ⬜ |
| 17 | cleartext removal | ✅ Kész |
| 18 | iOS cleanup | ⬜ |
| 19 | Encryption flag | ✅ Már megvolt (ITSAppUsesNonExemptEncryption: false) |
| 20 | Teszt fiók | ⬜ |
