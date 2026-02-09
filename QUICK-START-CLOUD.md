# התחלה מהירה - פריסה לענן

## סיכום מהיר

**המטרה**: להריץ את השרת ב-Render.com בחינם, כך שלא תהיה תלוי במחשב שלך.

---

## מה זה Render.com?

Render.com הוא שירות שמריץ את השרת שלך בענן. זה כמו שיש לך שרת וירטואלי שפועל 24/7 (אבל בחינם הוא "נרדם" אחרי 15 דקות).

---

## איך זה עובד?

1. **אתה מעלה את הקוד ל-GitHub**
2. **Render.com קורא את הקוד מ-GitHub**
3. **Render.com בונה ומריץ את השרת**
4. **השרת רץ על שרת של Render, לא על המחשב שלך**

---

## שלבים מהירים

### 1. העלה את הקוד ל-GitHub
```bash
git add .
git commit -m "Ready for Render deployment"
git push
```

### 2. היכנס ל-Render.com
- https://render.com
- הירשם (חינם)

### 3. צור Web Service
- לחץ "New +" → "Web Service"
- בחר את ה-repo שלך
- הגדר:
  - **Build Command**: `cd server && npm install`
  - **Start Command**: `cd server && npm start`
  - **Plan**: Free

### 4. חכה 5-10 דקות
- Render בונה את השרת
- תקבל URL: `https://your-name.onrender.com`

### 5. עדכן את ה-Frontend
עדכן את `components/FileUpload.tsx`:
```typescript
const API_BASE_URL = 'https://your-name.onrender.com';
```

---

## מגבלות (חינם)

- ⚠️ השרת "נרדם" אחרי 15 דקות
- ⚠️ עד דקה להתעוררות בפעם הראשונה
- ✅ אבל זה חינם!

**פתרון**: השתמש ב-UptimeRobot (חינם) כדי לשמור על השרת ער.

---

## מדריך מפורט

למדריך מפורט עם תמונות, ראה: `DEPLOY-RENDER.md`

---

## שאלות נפוצות

**Q: זה באמת חינם?**
A: כן! יש מגבלות, אבל זה חינם לחלוטין.

**Q: מה קורה אם השרת נרדם?**
A: כשמישהו מנסה להתחבר, השרת מתעורר (עד דקה).

**Q: איך מונעים מהשרת לישון?**
A: השתמש ב-UptimeRobot (ראה `DEPLOY-RENDER.md`).

**Q: מה אם אני רוצה משהו יותר חזק?**
A: Railway.app ($5/חודש) או Render Starter ($7/חודש).

---

## עזרה

אם נתקלת בבעיות:
1. בדוק את הלוגים ב-Render
2. ראה `DEPLOY-RENDER.md` לפרטים
3. בדוק ש-`/api/health` עובד
