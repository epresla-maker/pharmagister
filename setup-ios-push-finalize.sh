#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="pharmacare-dfa3c"
IOS_APP_ID="1:701125119608:ios:fd3a6e72f7d372c06be78d"
BUNDLE_ID="com.pharmagister.app"
USER_EMAIL="${1:-epresla@icloud.com}"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_PATH="$ROOT_DIR/ios/App/App/GoogleService-Info.plist"
KEY_PATH="$(ls -1 "$HOME"/Downloads/AuthKey_*.p8 2>/dev/null | head -1 || true)"
KEY_FILE="$(basename "$KEY_PATH" 2>/dev/null || true)"
KEY_ID="$(echo "$KEY_FILE" | sed -E 's/^AuthKey_([^.]+)\.p8$/\1/')"
TEAM_ID="$(grep -E '^TEAM_ID=' "$ROOT_DIR/ios-distribute.sh" | head -1 | cut -d'=' -f2 | tr -d '"' || true)"

echo "== iOS Push Finalize =="
echo "Project: $PROJECT_ID"
echo "Bundle:  $BUNDLE_ID"
echo "iOS App: $IOS_APP_ID"
echo

if ! command -v firebase >/dev/null 2>&1; then
  echo "ERROR: firebase CLI nincs telepitve."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node nincs telepitve."
  exit 1
fi

echo "1) Firebase iOS app ellenorzes"
APPS_JSON="$(firebase apps:list IOS --project "$PROJECT_ID" --json)"
if ! echo "$APPS_JSON" | grep -q "$IOS_APP_ID"; then
  echo "ERROR: iOS app nincs regisztralva Firebase-ben: $IOS_APP_ID"
  exit 5
fi
echo "   OK: iOS app regisztralva"

echo "2) Friss plist lehuzasa Firebase-bol"
firebase apps:sdkconfig IOS "$IOS_APP_ID" --project "$PROJECT_ID" > "$PLIST_PATH"
echo "   OK: $PLIST_PATH frissitve"

echo "3) APNs kulcs ellenorzes"
if [[ -z "$KEY_PATH" || ! -f "$KEY_PATH" ]]; then
  echo "ERROR: Nem talaltam AuthKey_*.p8 fajlt a ~/Downloads alatt."
  exit 2
fi
if [[ -z "$KEY_ID" || "$KEY_ID" == "$KEY_FILE" ]]; then
  echo "ERROR: Nem sikerult kinyerni a Key ID-t a fajlnevbol: $KEY_FILE"
  exit 3
fi
if [[ -z "$TEAM_ID" ]]; then
  echo "ERROR: Nem talaltam TEAM_ID-t az ios-distribute.sh fajlban."
  exit 4
fi

echo "   APNs key file: $KEY_PATH"
echo "   Key ID:        $KEY_ID"
echo "   Team ID:       $TEAM_ID"

cat <<EOF

4) MANUALIS LEPES (ezt API-val jelenleg nem lehet teljesen automatizalni):
   Firebase Console -> Project Settings -> Cloud Messaging -> Apple app config
   Toltsd fel ezeket:
   - APNs Auth Key file: $KEY_PATH
   - Key ID:             $KEY_ID
   - Team ID:            $TEAM_ID
   - Bundle ID:          $BUNDLE_ID

   Ugyanitt Production es Development kuldes legyen engedelyezve.

   Ha kesz, nyomj Enter-t, es kuldok teszt push-t.
EOF

read -r

echo "5) Teszt push kuldes: $USER_EMAIL"
cd "$ROOT_DIR"
node send-test-push.js "$USER_EMAIL"

echo
echo "KESZ: ha sikeres a kuldes, az iOS push end-to-end mukodik."
