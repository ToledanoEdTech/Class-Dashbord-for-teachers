# פתרון בעיית Build ב-Render - SIGTERM Error

## הבעיה

```
npm error signal SIGTERM
npm error command sh -c node install.mjs
npm error Chrome (121.0.6167.85) downloaded to /opt/render/.cache/puppeteer/chrome/linux-121.0.6167.85
```

**מה קורה:**
- Puppeteer מוריד Chrome (~170MB)
- התהליך לוקח יותר מדי זמן
- Render Free tier בוטל את התהליך (SIGTERM = termination signal)

## הפתרון

שיניתי את הקוד להשתמש ב-`puppeteer-core` במקום `puppeteer`.

**ההבדל:**
- `puppeteer` = מוריד Chrome אוטומטית (איטי)
- `puppeteer-core` = לא מוריד Chrome, צריך להגדיר path (מהיר יותר)

### מה עשיתי:

1. ✅ שיניתי `package.json` - `puppeteer` → `puppeteer-core`
2. ✅ עדכנתי את `server.js` - מחפש Chrome שכבר מותקן ב-Render
3. ✅ עדכנתי את `render.yaml` - build command משופר

## מה לעשות עכשיו?

### שלב 1: דחוף את השינויים

```bash
git add server/package.json server/server.js render.yaml
git commit -m "Fix Render build - use puppeteer-core"
git push
```

### שלב 2: המתן ל-Build חדש

Render יתחיל Build חדש אוטומטית. הפעם זה אמור להיות מהיר יותר כי:
- לא צריך להוריד Chrome במהלך `npm install`
- הקוד מחפש Chrome שכבר מותקן ב-Render

### שלב 3: אם עדיין יש בעיות

אם Chrome לא נמצא ב-Render, הקוד ינסה להוריד אותו בפעם הראשונה שהשרת רץ (לא במהלך Build).

---

## למה זה עובד?

### לפני (puppeteer):
```
npm install → מוריד Chrome (~170MB) → timeout → נכשל
```

### אחרי (puppeteer-core):
```
npm install → מהיר! → Build מצליח
```

ואז כשהשרת רץ בפעם הראשונה:
```
server starts → מחפש Chrome → אם אין, מוריד → עובד
```

---

## אם זה עדיין לא עובד

### אפשרות 1: השתמש ב-Chrome שכבר מותקן

ב-Render, בדרך כלל יש Chromium מותקן. הקוד מחפש אותו אוטומטית.

### אפשרות 2: הוסף Chrome installation ל-build

אם צריך, אפשר להוסיף ל-`render.yaml`:
```yaml
buildCommand: |
  apt-get update && apt-get install -y chromium-browser || true
  cd server && npm install
```

אבל זה לא צריך כי הקוד מחפש Chrome אוטומטית.

### אפשרות 3: Upgrade ל-Render Starter

Render Starter ($7/חודש) יותר מהיר ויש לו יותר משאבים.

---

## בדיקה

אחרי Build מוצלח, בדוק:
1. השרת רץ? → `https://your-service.onrender.com/api/health`
2. Chrome עובד? → בדוק את הלוגים

אם יש שגיאות, שלח לי את הלוגים!

---

## סיכום

**השינויים:**
- ✅ `puppeteer` → `puppeteer-core`
- ✅ הקוד מחפש Chrome מותקן
- ✅ Build מהיר יותר

**התוצאה:**
- Build אמור להצליח מהר יותר
- השרת יעבוד כמו קודם

דחוף את השינויים ותגיד לי אם זה עובד! 🚀
