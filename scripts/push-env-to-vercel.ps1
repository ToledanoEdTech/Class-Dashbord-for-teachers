# מעלה את משתני ה-.env ל-Vercel
# הרץ מהשורש: .\scripts\push-env-to-vercel.ps1
# דורש: Vercel CLI (npx vercel) + התחברות לפרויקט

$envFile = Join-Path $PSScriptRoot ".." ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "קובץ .env לא נמצא. צור קובץ .env עם מפתחות Firebase." -ForegroundColor Red
    exit 1
}

$vars = @(
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID"
)

foreach ($name in $vars) {
    $line = Get-Content $envFile | Where-Object { $_ -match "^$name=" }
    if ($line) {
        $value = ($line -replace "^$name=", "").Trim()
        if ($value) {
            Write-Host "מעלה $name..." -ForegroundColor Cyan
            $value | npx vercel env add $name production
        }
    }
}

Write-Host "סיימתי. בצע Redeploy ב-Vercel כדי להחיל את השינויים." -ForegroundColor Green
