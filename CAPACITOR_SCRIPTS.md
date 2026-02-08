# 📝 Opcionális NPM Scripts

Ha szeretnéd, hozzáadhatsz új npm script-eket a `package.json`-hoz a Capacitor parancsok egyszerűsítésére.

## Hozzáadható Scripts a package.json-hoz:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    
    // ⬇️ Új Capacitor scripts (opcionálisak):
    "mobile:build": "NEXT_CONFIG_FILE=next.config.mobile.js next build && npx cap sync",
    "mobile:ios": "npx cap open ios",
    "mobile:android": "npx cap open android",
    "mobile:sync": "npx cap sync",
    "mobile:run:ios": "npx cap run ios",
    "mobile:run:android": "npx cap run android"
  }
}
```

## Használat a Scripts Hozzáadása Után:

```bash
# Mobil build
npm run mobile:build

# iOS projekt megnyitása
npm run mobile:ios

# Android projekt megnyitása
npm run mobile:android

# Platforms sync
npm run mobile:sync

# Direct run
npm run mobile:run:ios
npm run mobile:run:android
```

## ⚠️ Megjegyzés

Ezek **teljesen opcionálisak**! A `build-mobile.sh` szkript is ugyanezt csinálja.

A parancsok közvetlenül is használhatóak:
- `./build-mobile.sh`
- `npx cap open ios`
- `npx cap open android`

Ha hozzá akarod adni ezeket a script-eket, másold be a fenti JSON részletet a `package.json` `scripts` sections-ébe.
