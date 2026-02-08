#!/bin/bash
# check-mobile-setup.sh
# Capacitor setup ellenőrző szkript

echo "🔍 Pharmagister Capacitor Setup Ellenőrzése"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_command() {
  if command -v $1 &> /dev/null; then
    echo -e "${GREEN}✅ $1 telepítve${NC}"
    return 0
  else
    echo -e "${RED}❌ $1 NINCS telepítve${NC}"
    return 1
  fi
}

check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✅ $1 létezik${NC}"
    return 0
  else
    echo -e "${RED}❌ $1 HIÁNYZIK${NC}"
    return 1
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✅ $1 mappa létezik${NC}"
    return 0
  else
    echo -e "${YELLOW}⚠️  $1 mappa még nincs létrehozva${NC}"
    return 1
  fi
}

# 1. Node.js és npm
echo "📦 Node.js Environment:"
check_command node
check_command npm
echo ""

# 2. Capacitor CLI
echo "⚡ Capacitor:"
if npm list @capacitor/cli &> /dev/null; then
  echo -e "${GREEN}✅ @capacitor/cli telepítve${NC}"
else
  echo -e "${RED}❌ @capacitor/cli NINCS telepítve${NC}"
fi

if npm list @capacitor/core &> /dev/null; then
  echo -e "${GREEN}✅ @capacitor/core telepítve${NC}"
else
  echo -e "${RED}❌ @capacitor/core NINCS telepítve${NC}"
fi

if npm list @capacitor/ios &> /dev/null; then
  echo -e "${GREEN}✅ @capacitor/ios telepítve${NC}"
else
  echo -e "${RED}❌ @capacitor/ios NINCS telepítve${NC}"
fi

if npm list @capacitor/android &> /dev/null; then
  echo -e "${GREEN}✅ @capacitor/android telepítve${NC}"
else
  echo -e "${RED}❌ @capacitor/android NINCS telepítve${NC}"
fi
echo ""

# 3. TypeScript
echo "📘 TypeScript:"
if npm list typescript &> /dev/null; then
  echo -e "${GREEN}✅ typescript telepítve${NC}"
else
  echo -e "${RED}❌ typescript NINCS telepítve${NC}"
fi
echo ""

# 4. Config fájlok
echo "⚙️  Konfigurációs Fájlok:"
check_file "capacitor.config.ts"
check_file "next.config.mobile.js"
check_file "build-mobile.sh"
echo ""

# 5. Platform mappák
echo "📱 Natív Platformok:"
check_dir "ios"
check_dir "android"
check_dir "out"
echo ""

# 6. iOS környezet (csak macOS-en)
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "🍎 iOS Fejlesztői Környezet:"
  check_command xcodebuild
  check_command pod
  echo ""
fi

# 7. Android környezet
echo "🤖 Android Fejlesztői Környezet:"
if [ -n "$ANDROID_HOME" ] || [ -n "$ANDROID_SDK_ROOT" ]; then
  echo -e "${GREEN}✅ Android SDK környezeti változó beállítva${NC}"
else
  echo -e "${YELLOW}⚠️  Android SDK környezeti változó nincs beállítva${NC}"
  echo "   (Nem szükséges, ha Android Studio telepítve van)"
fi
echo ""

# 8. Összesítés
echo "=========================================="
echo "✅ Setup ellenőrzés kész!"
echo ""
echo "📋 Következő lépések:"
echo "   1. Ha minden ✅: ./build-mobile.sh"
echo "   2. iOS: npx cap open ios"
echo "   3. Android: npx cap open android"
echo ""
echo "📖 Részletes útmutató: CAPACITOR_SETUP.md"
echo ""
