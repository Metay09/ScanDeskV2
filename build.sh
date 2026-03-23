#!/bin/bash
set -euo pipefail

# ScanDesk - Kurulum ve APK Üretim Scripti
# Kullanım: bash build.sh

echo "=== ScanDesk Build Başlıyor ==="

# 1. Bağımlılıkları kur
echo "[1/5] Bağımlılıklar kuruluyor..."
npm ci

# 2. Web build
echo "[2/5] Web build alınıyor..."
npm run build

# 3. Capacitor başlat (ilk kurulumda)
if [ ! -d "android" ]; then
  echo "[3/5] Android platformu ekleniyor..."
  npx cap add android
else
  echo "[3/5] Android klasörü mevcut, sync yapılıyor..."
fi

# 4. Sync
echo "[4/5] Capacitor sync..."
npx cap sync android


# 5. APK üret
echo "[5/5] APK üretiliyor..."
cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

echo ""
echo "=== TAMAMLANDI ==="
echo "APK: android/app/build/outputs/apk/debug/ScanDesk-debug.apk"
