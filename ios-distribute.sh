#!/bin/bash
# =============================================================
# iOS App Store / TestFlight feltöltő script
# Pharmagister - com.pharmagister.app
# =============================================================

set -e

TEAM_ID="FML6425D8G"
BUNDLE_ID="com.pharmagister.app"
SCHEME="App"
PROJECT_DIR="ios/App"
WORKSPACE=""
XCODEPROJ="$PROJECT_DIR/App.xcodeproj"
ARCHIVE_PATH="build/Pharmagister.xcarchive"
EXPORT_PATH="build/export"
CSR_PATH="$HOME/Desktop/CertificateSigningRequest.certSigningRequest"
EMAIL="epresla@icloud.com"
COMMON_NAME="Epres László"

# Színes output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE} Pharmagister iOS Distribution Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ---- 1. LÉPÉS: Distribution certificate ellenőrzése ----
echo -e "${YELLOW}[1/5] Distribution certificate ellenőrzése...${NC}"

DIST_CERT=$(security find-identity -v -p codesigning | grep "Apple Distribution" | head -1 || true)

if [ -z "$DIST_CERT" ]; then
    echo -e "${RED}❌ Nincs Apple Distribution certificate!${NC}"
    echo ""
    echo -e "${YELLOW}CSR (Certificate Signing Request) generálása...${NC}"
    
    # CSR generálása command line-ból
    # Először egy privát kulcsot generálunk, majd abból CSR-t
    KEY_PATH="/tmp/pharmagister_dist_key.pem"
    
    # Kulcs generálása és CSR létrehozása a Keychain-en keresztül
    # Ez a legmegbízhatóbb módszer macOS-en
    
    if [ -f "$CSR_PATH" ]; then
        echo -e "${YELLOW}⚠️  Már létezik CSR fájl: $CSR_PATH${NC}"
        echo -n "Felülírjam? (i/n): "
        read -r answer
        if [ "$answer" != "i" ]; then
            echo "CSR generálás kihagyva."
        fi
    fi
    
    # CSR generálása openssl-lel (egyszerűbb és megbízhatóbb script-ből)
    PRIVATE_KEY_PATH="$HOME/Desktop/dist_private_key.p12"
    
    # Generálunk egy kulcspárt
    openssl genrsa -out /tmp/dist_key.key 2048 2>/dev/null
    
    # CSR generálása
    openssl req -new -key /tmp/dist_key.key \
        -out "$CSR_PATH" \
        -subj "/emailAddress=$EMAIL/CN=$COMMON_NAME/C=HU" 2>/dev/null
    
    echo -e "${GREEN}✅ CSR elkészült: $CSR_PATH${NC}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}MOST EZT CSINÁLD:${NC}"
    echo ""
    echo "  1. Nyisd meg böngészőben:"
    echo -e "     ${BLUE}https://developer.apple.com/account/resources/certificates/add${NC}"
    echo ""
    echo "  2. Válaszd: ${GREEN}Apple Distribution${NC}"
    echo ""
    echo "  3. Töltsd fel ezt a fájlt:"
    echo -e "     ${GREEN}$CSR_PATH${NC}"
    echo ""
    echo "  4. Töltsd le a .cer fájlt az Asztalra"
    echo ""
    echo "  5. Dupla kattintás a .cer fájlra (települ a Keychain-be)"
    echo ""
    echo "  6. A privát kulcsot is importáld a Keychain-be:"
    echo -e "     ${GREEN}security import /tmp/dist_key.key -k ~/Library/Keychains/login.keychain-db -T /usr/bin/codesign${NC}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -n "Ha kész, nyomj ENTER-t a folytatáshoz..."
    read -r
    
    # Importáljuk a privát kulcsot a Keychain-be
    echo -e "${YELLOW}Privát kulcs importálása a Keychain-be...${NC}"
    security import /tmp/dist_key.key -k ~/Library/Keychains/login.keychain-db -T /usr/bin/codesign 2>/dev/null || true
    
    # Ellenőrizzük újra
    DIST_CERT=$(security find-identity -v -p codesigning | grep "Apple Distribution" | head -1 || true)
    
    if [ -z "$DIST_CERT" ]; then
        echo -e "${RED}❌ Még mindig nincs Distribution certificate!${NC}"
        echo "Ellenőrizd, hogy telepítetted-e a .cer fájlt (dupla katt)."
        echo "Majd futtasd újra ezt a scriptet."
        exit 1
    fi
fi

echo -e "${GREEN}✅ Distribution certificate megtalálva:${NC}"
echo "   $DIST_CERT"
echo ""

# ---- 2. LÉPÉS: Capacitor sync ----
echo -e "${YELLOW}[2/5] Capacitor sync...${NC}"
npx cap sync ios 2>&1 | tail -5
echo -e "${GREEN}✅ Capacitor sync kész${NC}"
echo ""

# ---- 3. LÉPÉS: Clean Build + Archive ----
echo -e "${YELLOW}[3/5] Clean Build + Archive...${NC}"
echo "   (Ez 1-2 percig tarthat...)"

# Workspace keresése
if [ -f "$PROJECT_DIR/App.xcworkspace/contents.xcworkspacedata" ]; then
    WORKSPACE="$PROJECT_DIR/App.xcworkspace"
    echo "   Workspace használata: $WORKSPACE"
    
    xcodebuild clean archive \
        -workspace "$WORKSPACE" \
        -scheme "$SCHEME" \
        -configuration Release \
        -archivePath "$ARCHIVE_PATH" \
        -destination "generic/platform=iOS" \
        CODE_SIGN_STYLE=Automatic \
        DEVELOPMENT_TEAM="$TEAM_ID" \
        -allowProvisioningUpdates \
        -quiet 2>&1 | tail -20
else
    echo "   Xcodeproj használata: $XCODEPROJ"
    
    xcodebuild clean archive \
        -project "$XCODEPROJ" \
        -scheme "$SCHEME" \
        -configuration Release \
        -archivePath "$ARCHIVE_PATH" \
        -destination "generic/platform=iOS" \
        CODE_SIGN_STYLE=Automatic \
        DEVELOPMENT_TEAM="$TEAM_ID" \
        -allowProvisioningUpdates \
        -quiet 2>&1 | tail -20
fi

if [ ! -d "$ARCHIVE_PATH" ]; then
    echo -e "${RED}❌ Archive sikertelen!${NC}"
    echo "Próbáld meg Xcode-ban manuálisan: Product > Archive"
    exit 1
fi

echo -e "${GREEN}✅ Archive elkészült: $ARCHIVE_PATH${NC}"
echo ""

# ---- 4. LÉPÉS: Export Options + Feltöltés ----
echo -e "${YELLOW}[4/5] Export és feltöltés App Store Connect-re...${NC}"

# ExportOptions.plist létrehozása
EXPORT_OPTIONS="build/ExportOptions.plist"
cat > "$EXPORT_OPTIONS" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>${TEAM_ID}</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>uploadBitcode</key>
    <false/>
    <key>uploadSymbols</key>
    <true/>
    <key>destination</key>
    <string>upload</string>
    <key>manageAppVersionAndBuildNumber</key>
    <true/>
    <key>testFlightInternalTestingOnly</key>
    <false/>
</dict>
</plist>
EOF

echo "   ExportOptions.plist létrehozva"

# Export és feltöltés
if [ -n "$WORKSPACE" ]; then
    xcodebuild -exportArchive \
        -archivePath "$ARCHIVE_PATH" \
        -exportOptionsPlist "$EXPORT_OPTIONS" \
        -exportPath "$EXPORT_PATH" \
        -allowProvisioningUpdates \
        2>&1 | tail -20
else
    xcodebuild -exportArchive \
        -archivePath "$ARCHIVE_PATH" \
        -exportOptionsPlist "$EXPORT_OPTIONS" \
        -exportPath "$EXPORT_PATH" \
        -allowProvisioningUpdates \
        2>&1 | tail -20
fi

echo ""

# ---- 5. LÉPÉS: Eredmény ----
echo -e "${YELLOW}[5/5] Eredmény ellenőrzése...${NC}"

if [ -d "$EXPORT_PATH" ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN} ✅ FELTÖLTÉS SIKERES!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Következő lépések:"
    echo "  1. Menj ide: https://appstoreconnect.apple.com"
    echo "  2. My Apps > Pharmagister > TestFlight"
    echo "  3. A build megjelenik pár percen belül"
    echo "  4. 'Missing Compliance' > kattints > válaszd 'No'"
    echo "  5. Internal Testing > Add Testers"
    echo ""
else
    echo -e "${RED}❌ A feltöltés nem sikerült.${NC}"
    echo "Nézd meg a hibaüzeneteket fentebb."
    echo "Alternatíva: Xcode > Organizer > Distribute App"
fi

# Cleanup
rm -f /tmp/dist_key.key 2>/dev/null

echo ""
echo -e "${BLUE}Kész!${NC}"
