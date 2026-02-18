# הגדרת Vercel – חיבור Firebase בפרודקשן

כדי שההתחברות (Google / אימייל+סיסמה) והשמירה בענן יעבדו ב־Vercel, צריך להגדיר את משתני הסביבה של Firebase בפרויקט.

## שלב 1: הוספת משתני סביבה ב־Vercel

1. היכנס ל־**https://vercel.com**
2. בחר את הפרויקט **Class-Dashbord-for-teachers** (או השם האמיתי)
3. **Settings** → **Environment Variables**
4. הוסף את המשתנים הבאים (העתק מהקובץ `.env` שלך):

| שם המשתנה | הערך (מהקובץ .env שלך) |
|-----------|-------------------------|
| `VITE_FIREBASE_API_KEY` | ה-API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ה-Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | ה-Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | ה-Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ה-Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | ה-App ID |

5. סמן **Production**, **Preview** ו־**Development**
6. **Save**
7. בצע **Redeploy** לפרויקט (Deployments → שלוש נקודות על הדיפלוי האחרון → Redeploy)

## שלב 2: Redeploy

אחרי הוספת המשתנים – **Deployments** → שלוש נקודות על הדיפלוי האחרון → **Redeploy** (או דחיפה חדשה ל-Git).

---

## אחרי ההגדרה

- יוצג כפתור **"התחבר כדי לשמור את הנתונים בענן"** במקום "הגדר חיבור לענן"
- המשתמשים יכולים להתחבר עם **Google** או **אימייל + סיסמה**
- הנתונים נשמרים ב־Firestore ונעולים לפי משתמש

## אבטחה

- מפתח ה־API של Firebase לאפליקציות Web מיועד להיות בצד הלקוח – זה תקין
- האבטחה מתבססת על: Firestore Rules, Firebase Auth, ו־Authorized Domains
- הקובץ `.env` לא נכנס ל־Git ולא עולה ל־GitHub
