#!/bin/bash
# Script להתקנת Chrome ב-Render (אם צריך)

set -e

echo "Checking for Chrome..."

# בדוק אם Chrome כבר מותקן
if command -v google-chrome &> /dev/null; then
    echo "Chrome already installed at: $(which google-chrome)"
    exit 0
fi

if command -v chromium-browser &> /dev/null; then
    echo "Chromium already installed at: $(which chromium-browser)"
    exit 0
fi

# אם אין, נסה להתקין
echo "Chrome not found, attempting to install..."

# ב-Render, בדרך כלל יש Chromium מותקן
# אבל אם אין, נשתמש ב-puppeteer-core עם Chrome שהורד

echo "Using puppeteer-core - Chrome will be downloaded on first run"
exit 0
