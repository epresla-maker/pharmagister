#!/bin/bash
# build-mobile.sh
# Mobilapp buildhez használatos szkript

set -e

echo "🔨 Mobil app build indítása..."
echo ""

# 1. Next.js static export a mobil konfigurációval
echo "📦 Next.js static export generálása..."
NEXT_CONFIG_FILE=next.config.mobile.js npx next build

echo ""
echo "✅ Static export kész: ./out könyvtár"
echo ""

# 2. Capacitor sync (assets másolása a platformokra)
echo "🔄 Capacitor sync futtatása..."
npx cap sync

echo ""
echo "✅ Mobil build kész!"
echo ""
echo "📱 Következő lépések:"
echo "   iOS:     npx cap open ios     (Xcode-ban buildelj)"
echo "   Android: npx cap open android (Android Studio-ban buildelj)"
echo ""
