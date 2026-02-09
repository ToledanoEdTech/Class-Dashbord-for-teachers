# שרת Backend - אינטגרציה עם משוב

שרת Node.js המשתמש ב-Puppeteer לאוטומציה של דפדפן וחיבור למשוב.

## התקנה

```bash
cd server
npm install
```

## הפעלה

```bash
npm run dev
```

השרת ירוץ על פורט 3001 (או הפורט שמוגדר ב-PORT).

## API Endpoints

### POST `/api/misbo/login`
התחברות למשוב

**Body:**
```json
{
  "username": "שם משתמש",
  "password": "סיסמה",
  "misboUrl": "https://misbo.example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "התחברות הצליחה",
  "cookies": [...],
  "url": "https://misbo.example.com/dashboard"
}
```

### POST `/api/misbo/download-files`
הורדת קבצים ממשוב

**Body:**
```json
{
  "misboUrl": "https://misbo.example.com",
  "cookies": [...],
  "className": "כיתה ח'1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "קבצים נמצאו",
  "files": {
    "behaviorFile": "/path/to/file.csv",
    "gradesFile": "/path/to/file.xlsx"
  }
}
```

## הערות

- השרת משתמש ב-Puppeteer לאוטומציה של דפדפן
- הקבצים נשמרים זמנית בתיקייה `temp/`
- קבצים ישנים יותר מ-30 דקות נמחקים אוטומטית
- יש להתאים את הסלקטורים לפי המבנה הספציפי של משוב

## שיפורים אפשריים

1. שימוש ב-Playwright במקום Puppeteer (תמיכה טובה יותר בהורדות)
2. שמירת session לטווח ארוך
3. תמיכה במספר כיתות
4. זיהוי אוטומטי של מבנה משוב
