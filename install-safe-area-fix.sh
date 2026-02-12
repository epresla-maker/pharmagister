#!/bin/bash

# Android Safe Area Fix - Telepítő Script
# Ez a script telepíti a szükséges Capacitor plugineket és szinkronizálja az Android projektet

set -e # Kilépés hiba esetén

echo "🚀 Android Safe Area Fix - Telepítés kezdése..."
echo ""

# Színek
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ellenőrizzük, hogy van-e npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm nem található. Telepítsd a Node.js-t először.${NC}"
    exit 1
fi

# Ellenőrizzük, hogy van-e Capacitor CLI
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx nem található. Telepítsd a Node.js-t először.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 1/4 - Capacitor Status Bar plugin telepítése...${NC}"
npm install @capacitor/status-bar
echo -e "${GREEN}✅ Status Bar plugin telepítve${NC}"
echo ""

echo -e "${BLUE}📦 2/4 - Capacitor Keyboard plugin telepítése...${NC}"
npm install @capacitor/keyboard
echo -e "${GREEN}✅ Keyboard plugin telepítve${NC}"
echo ""

echo -e "${BLUE}🔄 3/4 - Capacitor sync Android projekttel...${NC}"
npx cap sync android
echo -e "${GREEN}✅ Capacitor sync kész${NC}"
echo ""

echo -e "${BLUE}🏗️  4/4 - Next.js build...${NC}"
npm run build
echo -e "${GREEN}✅ Build kész${NC}"
echo ""

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Telepítés sikeres!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📱 Következő lépések:${NC}"
echo ""
echo -e "  1. Nyisd meg az Android projektet:"
echo -e "     ${BLUE}npx cap open android${NC}"
echo ""
echo -e "  2. Android Studio-ban build-eld az APK-t:"
echo -e "     Build > Build Bundle(s) / APK(s) > Build APK(s)"
echo ""
echo -e "  3. Vagy használd a meglévő build script-et:"
echo -e "     ${BLUE}./build-mobile.sh${NC}"
echo ""
echo -e "${YELLOW}📚 További információ:${NC}"
echo -e "   Lásd: ${BLUE}ANDROID_SAFE_AREA_FIX.md${NC}"
echo ""
