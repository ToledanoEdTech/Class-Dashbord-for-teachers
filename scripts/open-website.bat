@echo off
chcp 65001 >nul
cd /d "%~dp0.."

:: התקנת תלויות אם חסר
echo מתקין תלויות...
call npm install
if errorlevel 1 (
    echo שגיאה בהתקנה. וודא ש-Node.js מותקן.
    pause
    exit /b 1
)

:: הפעלת השרת בחלון נפרד (התיקייה כבר נכונה)
start "Server" /min cmd /c "npm run dev"

:: המתנה עד שהשרת עולה (Vite צריך כמה שניות)
echo מחכה שהשרת יעלה...
timeout /t 8 /nobreak >nul

:: פתיחת האתר בדפדפן (המרכאות הריקות חשובות - בלי זה לא נפתח דפדפן)
start "" "http://localhost:5173"
