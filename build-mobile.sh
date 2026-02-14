#!/bin/bash
# build-mobile.sh
# Mobilapp buildhez használatos szkript

set -e

echo "🔨 Mobil app build indítása..."
echo ""

# 1. Backup az eredeti config
echo "💾 Config fájl mentése..."
cp next.config.js next.config.js.backup

# 2. Mobil config használata
echo "🔄 Mobil konfiguráció alkalmazása..."
cp next.config.mobile.js next.config.js

# 3. Next.js static export
echo "📦 Next.js static export generálása..."
npx next build

# 4. Config visszaállítása
echo "🔙 Eredeti konfiguráció visszaállítása..."
mv next.config.js.backup next.config.js

echo ""
echo "✅ Static export kész: ./out könyvtár"
echo ""

# 5. Capacitor sync (assets másolása a platformokra)
echo "🔄 Capacitor sync futtatása..."
npx cap sync

echo ""
echo "✅ Mobil build kész!"
echo ""
echo "📱 Következő lépések:"
echo "   iOS:     npx cap open ios     (Xcode-ban buildelj)"
echo "   Android: npx cap open android (Android Studio-ban buildelj)"
echo ""
