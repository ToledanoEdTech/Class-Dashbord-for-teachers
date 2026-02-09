# מדריך פריסה ל-Render.com - שלב אחר שלב

## סקירה

מדריך זה יסביר לך בדיוק איך לפרוס את השרת שלך ל-Render.com בחינם.

---

## שלב 1: הכנת הקוד

### 1.1 וודא שיש לך את הקבצים הבאים:

- ✅ `render.yaml` (כבר נוצר)
- ✅ `server/package.json` עם script `start` (כבר קיים)
- ✅ `server/server.js` (כבר קיים)

### 1.2 עדכן את ה-Frontend

עדכן את `components/FileUpload.tsx`:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD 
    ? 'https://your-server-name.onrender.com'  // החלף בשם השרת שלך
    : 'http://localhost:3001');
```

או עדיף, צור קובץ `.env.production`:
```env
VITE_API_URL=https://your-server-name.onrender.com
```

---

## שלב 2: יצירת חשבון ב-Render

1. היכנס ל-https://render.com
2. לחץ על **"Get Started for Free"**
3. הירשם עם **GitHub** (מומלץ) או עם אימייל
4. אם בחרת GitHub, Render יבקש הרשאות - אשר

---

## שלב 3: העלאת הקוד ל-GitHub

אם עדיין לא העלית את הקוד ל-GitHub:

1. צור repository חדש ב-GitHub
2. העלה את כל הקבצים:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

---

## שלב 4: יצירת Web Service ב-Render

### 4.1 התחלה

1. ב-Render, לחץ על **"New +"** (בצד שמאל למעלה)
2. בחר **"Web Service"**

### 4.2 חיבור Repository

1. אם זה הפעם הראשונה, Render יבקש חיבור ל-GitHub
2. בחר את ה-repository שלך
3. לחץ **"Connect"**

### 4.3 הגדרת השירות

מלא את הפרטים הבאים:

- **Name**: `toledano-edtech-server` (או כל שם שתרצה)
- **Region**: בחר הכי קרוב אליך (למשל: Frankfurt)
- **Branch**: `main` (או `master` אם זה ה-branch שלך)
- **Root Directory**: השאר ריק (או `server` אם אתה רוצה)
- **Runtime**: `Node`
- **Build Command**: `cd server && npm install`
- **Start Command**: `cd server && npm start`
- **Plan**: בחר **"Free"**

### 4.4 משתני סביבה (Environment Variables)

לחץ על **"Advanced"** והוסף:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `FRONTEND_URL` | כתובת ה-frontend שלך (אם יש) |

**הערה**: אם אתה משתמש ב-`render.yaml`, המשתנים יוגדרו אוטומטית.

### 4.5 יצירה

1. לחץ על **"Create Web Service"**
2. Render יתחיל לבנות ולהריץ את השרת
3. זה יכול לקחת 5-10 דקות בפעם הראשונה

---

## שלב 5: בדיקה

### 5.1 בדיקת השרת

1. אחרי שהבנייה מסתיימת, Render יציג לך URL
2. השרת יהיה בכתובת: `https://your-service-name.onrender.com`
3. בדוק: `https://your-service-name.onrender.com/api/health`
4. אתה אמור לראות: `{"status":"ok","timestamp":"..."}`

### 5.2 עדכון ה-Frontend

עדכן את ה-Frontend להשתמש בכתובת החדשה:

```typescript
const API_BASE_URL = 'https://your-service-name.onrender.com';
```

---

## שלב 6: טיפול ב-Spin-down (אופציונלי)

Render.com "מרדים" את השרת אחרי 15 דקות ללא פעילות. כדי למנוע זאת:

### אפשרות 1: UptimeRobot (חינם)

1. היכנס ל-https://uptimerobot.com
2. הירשם (חינם)
3. לחץ **"Add New Monitor"**
4. בחר **"HTTP(s)"**
5. הזן:
   - **Friendly Name**: `Toledano Server`
   - **URL**: `https://your-service-name.onrender.com/api/health`
   - **Monitoring Interval**: `5 minutes`
6. לחץ **"Create Monitor"**

עכשיו UptimeRobot יקרא לשרת כל 5 דקות, כך שהוא לא ירדם.

---

## בעיות נפוצות ופתרונות

### השרת לא מתחיל

1. **בדוק את הלוגים ב-Render**
   - לחץ על השירות שלך
   - לחץ על טאב **"Logs"**
   - חפש שגיאות

2. **בעיות נפוצות:**
   - **Port לא נכון**: וודא ש-`PORT=10000`
   - **Build נכשל**: בדוק ש-`npm install` עובד
   - **Start command שגוי**: וודא ש-`npm start` עובד מקומית

### CORS Errors

אם אתה מקבל שגיאות CORS:

1. עדכן את `FRONTEND_URL` ב-Render
2. או עדכן את `server/server.js` לאפשר את ה-origin שלך

### השרת איטי

1. זה נורמלי בפעם הראשונה (cold start)
2. אחרי שהשרת מתעורר, הוא מהיר יותר
3. אם זה ממש איטי, שקול Railway.app ($5/חודש)

---

## עלויות

### Render.com (Free Plan)

- ✅ **חינם לחלוטין**
- ⚠️ Spin-down אחרי 15 דקות
- ⚠️ עד דקה להתעוררות
- ⚠️ 750 שעות בחודש (מספיק לרוב השימושים)

### Render.com (Starter Plan)

- 💰 **$7/חודש**
- ✅ אין spin-down
- ✅ מהיר יותר
- ✅ יותר משאבים

---

## המלצות

1. **להתחלה**: השתמש ב-Free Plan
2. **אם יש בעיות**: נסה Railway.app ($5/חודש)
3. **לשימוש רציני**: שקול Render Starter ($7/חודש)

---

## סיכום

עכשיו יש לך:
- ✅ שרת רץ בענן בחינם
- ✅ URL קבוע לשרת
- ✅ אפשרות לעדכן את ה-Frontend להשתמש בשרת הענן

**הערה חשובה**: אם אתה משנה קוד, Render יעדכן אוטומטית (אם הגדרת auto-deploy).

---

## שאלות?

אם נתקלת בבעיות:
1. בדוק את הלוגים ב-Render
2. בדוק את ה-Health Check: `/api/health`
3. וודא שה-Build Command וה-Start Command נכונים
