@echo off
chcp 65001 >nul
title הרצת האתר לוקאלית - Class Dashboard

cd /d "%~dp0.."

echo.
echo ========================================
echo   התקנת תלויות (אם נדרש)...
echo ========================================
call npm install
if errorlevel 1 (
    echo.
    echo שגיאה בהתקנת התלויות. וודא ש-npm מותקן.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   מפעיל שרת פיתוח...
echo   האתר ייפתח בדפדפן ב: http://localhost:5173
echo   לעצירה: סגור חלון זה או Ctrl+C
echo ========================================
echo.

call npm run dev

pause
