# 🔐 Android Keystore Setup - Release APK Aláírás

A Google Play Store-ba történő feltöltéshez **kötelező** a digitálisan aláírt APK/AAB!

---

## 1️⃣ Keystore Generálása

```bash
# Menj a projekt gyökérkönyvtárába
cd /Users/epresl/Desktop/pharmagister

# Keystore létrehozása
keytool -genkey -v -keystore pharmagister-release.keystore -alias pharmagister -keyalg RSA -keysize 2048 -validity 10000
```

### ❓ Kérdések amiket meg fog kérdezni:

1. **Enter keystore password:** Adj meg egy erős jelszót (pl. 16 karakter)
2. **Re-enter new password:** Írd be újra
3. **What is your first and last name?** → Név
4. **What is the name of your organizational unit?** → Pharmagister vagy a cégnév
5. **What is the name of your organization?** → Cégnév
6. **What is the name of your City or Locality?** → Város
7. **What is the name of your State or Province?** → Megye/Állam
8. **What is the two-letter country code?** → `HU`
9. **Is ... correct?** → `yes`

---

## 2️⃣ Keystore Biztonságos Tárolása

```bash
# Másold biztonságos helyre (pl. Google Drive, 1Password)
cp pharmagister-release.keystore ~/Documents/Pharmagister/keystore/

# NE add hozzá a git-hez!!!
echo "pharmagister-release.keystore" >> .gitignore
```

⚠️ **VIGYÁZZ!** Ha elveszíted ezt a keystore-t, **SOHA többé nem tudod frissíteni az appot** a Google Play-en!

---

## 3️⃣ Keystore Konfiguráció az Android Projektben

Módosítsd a `capacitor.config.ts` fájlt:

```typescript
android: {
  buildOptions: {
    keystorePath: '/Users/epresl/Desktop/pharmagister/pharmagister-release.keystore',
    keystoreAlias: 'pharmagister',
  }
}
```

**VAGY** Android Studio-ban: 
- `Build` → `Generate Signed Bundle / APK`
- Válaszd a keystore-t manuálisan

---

## 4️⃣ Keystore Jelszavak Tárolása

Hozz létre egy `keystore.properties` fájlt az `android/` mappában:

```bash
# android/keystore.properties
storePassword=IDE_ÍRD_A_JELSZÓT
keyPassword=IDE_ÍRD_A_JELSZÓT
keyAlias=pharmagister
storeFile=../pharmagister-release.keystore
```

Majd add hozzá a `.gitignore`-hoz:

```bash
echo "android/keystore.properties" >> .gitignore
```

---

## 5️⃣ Android Gradle Konfiguráció

Szerkeszd az `android/app/build.gradle` fájlt:

```groovy
// Keystore properties betöltése (ha létezik)
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    // ... előző beállítások ...
    
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## 6️⃣ Release Build Generálása

### Option A - Capacitor CLI-vel:

```bash
# 1. Next.js build
npm run build

# 2. Capacitor sync
npx cap sync

# 3. Android Studio-ban Build → Generate Signed Bundle
npx cap open android
```

### Option B - Command line-ról:

```bash
# 1. Next.js build
npm run build

# 2. Capacitor sync
npx cap sync

# 3. Release APK build
cd android
./gradlew assembleRelease

# APK helye:
# android/app/build/outputs/apk/release/app-release.apk
```

---

## 7️⃣ APK/AAB Tesztelése Telepítés Előtt

```bash
# Telepítsd a release APK-t egy teszt eszközre
adb install android/app/build/outputs/apk/release/app-release.apk

# Teszteld az összes funkciót!
```

---

## 8️⃣ Google Play Console Feltöltés

1. Menj a [Google Play Console](https://play.google.com/console)-ra
2. Válaszd ki az appot (vagy hozz létre újat)
3. Production/Testing → **Create new release**
4. Upload APK/AAB
5. Töltsd ki az app leírást, screenshotokat
6. **Privacy Policy URL** - KÖTELEZŐ!
7. Submit for review

---

## ✅ Checklist Feltöltés Előtt

- [ ] Keystore létrehozva és biztonságosan tárolva
- [ ] Release APK/AAB buildelve
- [ ] APK/AAB tesztelve fizikai eszközön
- [ ] App ikonok cserélve (nem Capacitor default)
- [ ] Splash screen testreszabva
- [ ] Privacy Policy elkészült és elérhető
- [ ] App leírás magyarul + angolul
- [ ] Screenshotok készek (min. 2 db, max. 8 db)
- [ ] Targetált API level megfelelő (min. API 33)
- [ ] Engedélyek (permissions) dokumentálva

---

## 🔒 BIZTONSÁG

### ⚠️ SOHA NE COMMITÁLD GIT-RE:
- `pharmagister-release.keystore`
- `keystore.properties`
- Keystore jelszavakat

### ✅ Tárold biztonságosan:
- Cloud storage (Google Drive, Dropbox)
- Password manager (1Password, LastPass)
- Céges kódtár (ha van)

---

## 📚 Hasznos Linkek

- [Android App Signing](https://developer.android.com/studio/publish/app-signing)
- [Google Play Console](https://play.google.com/console)
- [Capacitor Android Docs](https://capacitorjs.com/docs/android)

---

**Elkészítve:** 2026. február 10.
