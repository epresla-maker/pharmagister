# iOS TestFlight Feltöltési Útmutató

## Hol tartunk

### ✅ Kész lépések
1. **Xcode telepítve** – Xcode 26.2, developer tools path beállítva
2. **Capacitor iOS projekt kész** – `npx cap sync ios` lefutott
3. **Signing beállítva** – Automatically manage signing, Team: Epres László (Individual), Bundle ID: com.pharmagister.app
4. **PLA (Program License Agreement) elfogadva** – developer.apple.com-on
5. **Archive elkészült** – 2026. feb 19., Version 1.0 (1)

### ❌ Hiba amit meg kell oldani
**"Invalid Signature – Validation failed"** hiba a Distribute App-nál.

A probléma: Az archive Development certificate-tel lett aláírva, de az App Store Connect feltöltéshez **Distribution certificate** kell.

---

## Megoldás lépései

### 1. Clean Build + Új Archive
1. Xcode-ban: **Product → Clean Build Folder** (⇧⌘K)
2. **Product → Archive**
3. Organizer-ben az **ÚJ** archive-ot válaszd (legfrissebb dátummal)
4. **Distribute App** → **App Store Connect** → **Distribute**

### 2. Ha a Clean Build nem segít → Distribution Certificate létrehozása
1. Menj böngészőben: https://developer.apple.com/account/resources/certificates/list
2. Kattints **"+"** → válaszd **"Apple Distribution"**
3. Kelleni fog egy CSR (Certificate Signing Request):
   - Nyisd meg: **Keychain Access** app (Spotlight → "Keychain Access")
   - Menü: **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority**
   - Email: epresla@icloud.com
   - Common Name: Epres László
   - "Saved to disk" legyen kiválasztva → **Continue** → mentsd el a .certSigningRequest fájlt
4. Töltsd fel a CSR-t az Apple Developer oldalon
5. Töltsd le a .cer fájlt → dupla kattintás → települ a Keychain-be
6. Xcode-ban újra: **Product → Archive** → **Distribute App**

### 3. Ha még mindig nem megy → Xcode Signing manuális beállítás
1. **Signing & Capabilities** → kapcsold KI az "Automatically manage signing"-ot
2. **Release** konfiguráció → válaszd ki manuálisan az **Apple Distribution** certificate-et és az **App Store** provisioning profile-t
3. **Product → Archive** → **Distribute App**

---

## Ami utána jön (ha a feltöltés sikerül)

### TestFlight beállítása (App Store Connect-ben)
1. Menj: https://appstoreconnect.apple.com
2. **My Apps** → **Pharmagister**
3. **TestFlight** fül
4. A build automatikusan megjelenik (pár perc feldolgozás)
5. "Missing Compliance" → kattints → válaszd "No" (nem használ titkosítást export célra)
6. **Internal Testing** → **Add Testers** → add hozzá az email címeket
7. A tesztelők kapnak egy emailt → letöltik a **TestFlight** appot → telepítik a Pharmagister-t

### TestFlight tesztelési infó
- A tesztelőknek **Apple ID** kell (iPhone-on alapból van)
- **Nem kell Pharmagister regisztráció** a telepítéshez
- Az app PWA wrapper: betölti a https://pharmagister.hu oldalt
- A login/regisztráció az appon belül történik

---

## Capacitor konifguráció
- **App ID:** com.pharmagister.app
- **App Name:** Pharmagister
- **Web Dir:** out (de nem használt, mert server.url van beállítva)
- **Server URL:** https://pharmagister.hu
- **iOS scheme:** Pharmagister

## Fontos parancsok
```bash
# Capacitor sync
npx cap sync ios

# Xcode megnyitása
open ios/App/App.xcodeproj

# Xcode developer tools beállítása (ha kell)
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## Apple Developer fiók
- **Apple ID:** epresla@icloud.com
- **Team:** Epres László (Individual)
- **Developer portal:** https://developer.apple.com/account
- **App Store Connect:** https://appstoreconnect.apple.com
