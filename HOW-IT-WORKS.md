# איך המערכת עובדת - הסבר מפורט למתחילים

## תוכן עניינים

1. [סקירה כללית](#סקירה-כללית)
2. [מה זה Web Scraping?](#מה-זה-web-scraping)
3. [איך Puppeteer עובד](#איך-puppeteer-עובד)
4. [הזרימה המלאה - שלב אחר שלב](#הזרימה-המלאה---שלב-אחר-שלב)
5. [איך השרת מתחבר למשוב](#איך-השרת-מתחבר-למשוב)
6. [איך הקבצים נשמרים ומועברים](#איך-הקבצים-נשמרים-ומועברים)
7. [איך ה-Frontend מתחבר לשרת](#איך-ה-frontend-מתחבר-לשרת)
8. [מה קורה כשמשהו נכשל](#מה-קורה-כשמשהו-נכשל)

---

## סקירה כללית

### התמונה הגדולה

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   מורה     │────────▶│   Frontend   │────────▶│   Server    │
│  (דפדפן)   │         │  (React App) │         │  (Node.js)  │
└─────────────┘         └──────────────┘         └──────┬──────┘
                                                         │
                                                         ▼
                                                  ┌─────────────┐
                                                  │    משוב     │
                                                  │   (Website) │
                                                  └─────────────┘
```

**במילים פשוטות:**
1. המורה נכנס לאתר שלך (Frontend)
2. המורה מזין פרטי התחברות למשוב
3. ה-Frontend שולח את הפרטים לשרת שלך
4. השרת מתחבר למשוב בשם המורה
5. השרת מוריד את הקבצים ממשוב
6. השרת מחזיר את הקבצים ל-Frontend
7. ה-Frontend מציג את הנתונים בדשבורד

---

## מה זה Web Scraping?

### הסבר פשוט

**Web Scraping** = "גריפת אינטרנט" בעברית.

**דוגמה מהחיים:**
- אתה נכנס לאתר משוב
- אתה לוחץ על כפתורים
- אתה מוריד קבצים
- אתה עושה את זה ידנית

**Web Scraping:**
- תוכנה עושה את זה במקומך
- התוכנה "מתחזת" לדפדפן
- התוכנה לוחצת על כפתורים אוטומטית
- התוכנה מורידה קבצים אוטומטית

### למה זה שימושי?

במקום שהמורה יעשה:
1. נכנס למשוב
2. מחפש את הדוח הנכון
3. מוריד קובץ התנהגות
4. מחפש דוח אחר
5. מוריד קובץ ציונים
6. מעלה את הקבצים לאתר שלך

התוכנה עושה את כל זה **אוטומטית**!

---

## איך Puppeteer עובד?

### מה זה Puppeteer?

**Puppeteer** = כלי שמאפשר לך לשלוט בדפדפן Chrome מתוך קוד JavaScript.

**דוגמה:**
```javascript
// זה כמו שאתה אומר לדפדפן:
"פתח את האתר הזה"
"לחץ על הכפתור הזה"
"תמלא את הטופס הזה"
"תוריד את הקובץ הזה"
```

### איך זה עובד בפועל?

```
┌─────────────────────────────────────────┐
│         הקוד שלך (server.js)            │
│                                         │
│  puppeteer.launch()  ◄─────────────────┼── פותח דפדפן חדש
│                                         │
│  page.goto('https://misbo.com')  ◄─────┼── פותח את משוב
│                                         │
│  page.type('#username', 'user')  ◄─────┼── מזין שם משתמש
│                                         │
│  page.click('#login-button')  ◄─────────┼── לוחץ התחברות
│                                         │
└─────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   Chrome Browser      │
        │   (Headless Mode)     │
        │                       │
        │  - פותח את משוב       │
        │  - ממלא טופס          │
        │  - לוחץ כפתורים       │
        │  - מוריד קבצים        │
        └───────────────────────┘
```

### Headless Mode - מה זה?

**Headless** = "ללא ראש" = ללא חלון דפדפן גלוי.

- השרת פותח דפדפן ברקע
- אתה לא רואה אותו
- הוא עובד "בשקט"
- זה מהיר יותר וצורך פחות משאבים

---

## הזרימה המלאה - שלב אחר שלב

### שלב 1: המורה נכנס לאתר שלך

```
מורה → פותח דפדפן → נכנס ל: https://your-site.com
```

**מה קורה:**
- ה-Frontend (React) נטען
- המורה רואה מסך התחברות למשוב
- המורה מזין: כתובת משוב, שם משתמש, סיסמה

### שלב 2: ה-Frontend שולח בקשה לשרת

```javascript
// בקוד (FileUpload.tsx):
const response = await fetch('https://your-server.onrender.com/api/misbo/login', {
  method: 'POST',
  body: JSON.stringify({
    username: 'מורה123',
    password: 'סיסמה',
    misboUrl: 'https://misbo.example.com'
  })
});
```

**מה קורה:**
- ה-Frontend שולח HTTP POST request
- המידע נשלח דרך האינטרנט
- השרת מקבל את הבקשה

### שלב 3: השרת מתחבר למשוב

```javascript
// בקוד (server.js):
const browser = await puppeteer.launch();  // פותח דפדפן
const page = await browser.newPage();      // יוצר דף חדש
await page.goto(misboUrl);                  // נכנס למשוב
```

**מה קורה:**
1. השרת פותח דפדפן Chrome (ברקע)
2. השרת נכנס לאתר משוב
3. השרת מחפש את שדות הטופס

### שלב 4: השרת ממלא את הטופס

```javascript
// השרת מוצא את שדה שם המשתמש
const usernameField = await page.$('input[name="username"]');
await usernameField.type(username);  // מזין שם משתמש

// השרת מוצא את שדה הסיסמה
const passwordField = await page.$('input[type="password"]');
await passwordField.type(password);  // מזין סיסמה

// השרת לוחץ על כפתור התחברות
const loginButton = await page.$('button[type="submit"]');
await loginButton.click();
```

**מה קורה:**
- השרת "רואה" את הדף כמו שאתה רואה אותו
- השרת מוצא את השדות הנכונים
- השרת ממלא אותם אוטומטית
- השרת לוחץ על כפתור התחברות

### שלב 5: השרת שומר את ה-Session

```javascript
// אחרי התחברות מוצלחת:
const cookies = await page.cookies();  // שומר את ה-cookies

// יוצר session ID
const sessionId = crypto.randomBytes(32).toString('hex');

// שומר ב-memory (או ב-Redis/DB)
sessions.set(sessionId, {
  cookies: cookies,
  misboUrl: misboUrl,
  createdAt: Date.now()
});

// מחזיר ל-Frontend
res.json({ sessionId: sessionId });
```

**מה זה Cookies?**
- Cookies = "עוגיות" = קבצים קטנים שהאתר שומר
- הם מכילים את פרטי ההתחברות שלך
- עם Cookies, אתה לא צריך להתחבר שוב
- השרת שומר אותם כדי להשתמש בהם אחר כך

**מה זה Session?**
- Session = "סשן" = תקופת זמן של חיבור
- Session ID = מספר מזהה ייחודי
- השרת שומר: "Session ID זה שייך למורה הזה"
- ככה השרת יודע מי מתחבר

### שלב 6: השרת מוריד קבצים

```javascript
// השרת משתמש ב-session ID שקיבל
const session = sessions.get(sessionId);
await page.setCookie(...session.cookies);  // משתמש ב-cookies

// השרת מחפש את הקישור להורדת קבצים
const downloadLink = await page.$('a:has-text("הורד דוח")');
await downloadLink.click();  // לוחץ על הקישור

// השרת מחכה שהקובץ יורד
await page.waitForTimeout(5000);
```

**מה קורה:**
1. השרת משתמש ב-Cookies שנשמרו
2. השרת נכנס למשוב (עם ההתחברות של המורה)
3. השרת מנווט לדף הנכון
4. השרת מוצא את הקישור להורדה
5. השרת לוחץ עליו
6. הקובץ נשמר על השרת

### שלב 7: השרת מחזיר את הקבצים ל-Frontend

```javascript
// השרת קורא את הקובץ שהורד
const fileContent = await fs.readFile(downloadedFile);

// השרת שולח ל-Frontend
res.json({
  success: true,
  file: fileContent  // או URL לקובץ
});
```

**מה קורה:**
- השרת קורא את הקובץ מהדיסק
- השרת שולח אותו ל-Frontend
- ה-Frontend מקבל את הקובץ
- ה-Frontend מעבד את הנתונים

---

## איך השרת מתחבר למשוב?

### הסבר טכני מפורט

#### 1. פתיחת דפדפן

```javascript
const browser = await puppeteer.launch({
  headless: true,  // ללא חלון גלוי
  args: ['--no-sandbox', '--disable-setuid-sandbox']  // הגדרות אבטחה
});
```

**מה קורה:**
- Puppeteer מוריד Chrome (אם אין)
- Puppeteer פותח תהליך Chrome חדש
- Chrome רץ ברקע (headless)
- השרת מקבל "שלט רחוק" לשלוט ב-Chrome

#### 2. יצירת דף חדש

```javascript
const page = await browser.newPage();
```

**מה קורה:**
- השרת יוצר טאב חדש ב-Chrome
- זה כמו לפתוח טאב חדש בדפדפן שלך
- השרת יכול לשלוט בטאב הזה

#### 3. מעבר לאתר

```javascript
await page.goto('https://misbo.example.com', {
  waitUntil: 'networkidle2',  // מחכה שהדף נטען לגמרי
  timeout: 30000  // מקסימום 30 שניות
});
```

**מה קורה:**
- Chrome נכנס לאתר משוב
- השרת מחכה שהדף נטען לגמרי
- השרת מחכה שכל הקבצים נטענו (תמונות, CSS, JS)

#### 4. חיפוש אלמנטים בדף

```javascript
// השרת מחפש שדה input עם name="username"
const usernameField = await page.$('input[name="username"]');
```

**מה זה `$`?**
- `$` = querySelector (כמו ב-jQuery)
- זה מחפש אלמנט אחד בדף
- `$$` = querySelectorAll (מחפש כמה)

**איך השרת מוצא אלמנטים?**
- השרת "רואה" את ה-HTML של הדף
- השרת מחפש לפי:
  - שם התג (`input`, `button`)
  - תכונות (`name="username"`, `type="password"`)
  - טקסט (`:has-text("התחבר")`)
  - ID (`#login-button`)
  - Class (`.btn-primary`)

#### 5. מילוי טופס

```javascript
await usernameField.type('מורה123', { delay: 100 });
```

**מה קורה:**
- השרת "לוחץ" על השדה
- השרת מזין טקסט (אות אחר אות, עם delay)
- זה נראה כמו אדם שמקליד

#### 6. לחיצה על כפתור

```javascript
await loginButton.click();
```

**מה קורה:**
- השרת "לוחץ" על הכפתור
- זה כמו שאתה לוחץ עם העכבר
- הדף מגיב (שולח טופס, עובר לדף אחר)

#### 7. המתנה לניווט

```javascript
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle2' }),
  loginButton.click()
]);
```

**מה קורה:**
- השרת לוחץ על הכפתור
- השרת מחכה שהדף עובר לדף חדש
- השרת מחכה שהדף החדש נטען לגמרי

---

## איך הקבצים נשמרים ומועברים?

### תהליך ההורדה

#### 1. השרת לוחץ על קישור הורדה

```javascript
const downloadLink = await page.$('a[href*="download"]');
await downloadLink.click();
```

**מה קורה:**
- השרת מוצא קישור להורדה
- השרת לוחץ עליו
- משוב מתחיל להוריד קובץ

#### 2. השרת מחכה שהקובץ יורד

```javascript
// הגדרת Chrome DevTools Protocol להורדות
const client = await page.target().createCDPSession();
await client.send('Page.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: '/tmp/downloads'  // איפה לשמור
});

// המתנה להורדה
client.on('Page.downloadProgress', async (event) => {
  if (event.state === 'completed') {
    // הקובץ הורד!
    const filePath = `/tmp/downloads/${event.guid}`;
  }
});
```

**מה זה CDP?**
- Chrome DevTools Protocol
- דרך לשלוט ב-Chrome ברמה נמוכה
- מאפשר לשלוט בהורדות

#### 3. השרת קורא את הקובץ

```javascript
const fileContent = await fs.readFile(filePath);
```

**מה קורה:**
- השרת קורא את הקובץ מהדיסק
- השרת מקבל את כל התוכן
- השרת יכול לשלוח אותו ל-Frontend

#### 4. השרת שולח ל-Frontend

**אפשרות 1: Base64 Encoding**
```javascript
const base64 = fileContent.toString('base64');
res.json({
  file: base64,
  filename: 'behavior.csv',
  type: 'text/csv'
});
```

**אפשרות 2: URL זמני**
```javascript
// השרת שומר את הקובץ
const publicUrl = `https://your-server.com/files/${fileId}`;
res.json({ fileUrl: publicUrl });
```

**אפשרות 3: Stream ישיר**
```javascript
res.setHeader('Content-Type', 'application/octet-stream');
res.setHeader('Content-Disposition', 'attachment; filename="file.csv"');
fileContent.pipe(res);  // שולח ישירות
```

---

## איך ה-Frontend מתחבר לשרת?

### HTTP Requests - הסבר פשוט

**HTTP** = HyperText Transfer Protocol = פרוטוקול להעברת מידע

**זה כמו דואר:**
- אתה שולח מכתב (Request)
- השרת מקבל את המכתב
- השרת שולח תשובה (Response)

### סוגי Requests

#### 1. GET - לקרוא מידע

```javascript
// Frontend מבקש מידע
const response = await fetch('https://server.com/api/health');
const data = await response.json();
// data = { status: 'ok' }
```

**מתי משתמשים:**
- לקבל רשימת כיתות
- לקבל מידע על תלמיד
- לבדוק אם השרת עובד

#### 2. POST - לשלוח מידע

```javascript
// Frontend שולח מידע
const response = await fetch('https://server.com/api/misbo/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'מורה123',
    password: 'סיסמה'
  })
});
```

**מתי משתמשים:**
- להתחבר למשוב
- לשלוח קבצים
- ליצור משהו חדש

#### 3. PUT/PATCH - לעדכן מידע

```javascript
// Frontend מעדכן מידע
await fetch('https://server.com/api/student/123', {
  method: 'PUT',
  body: JSON.stringify({ name: 'יוסי' })
});
```

#### 4. DELETE - למחוק מידע

```javascript
// Frontend מוחק מידע
await fetch('https://server.com/api/class/456', {
  method: 'DELETE'
});
```

### CORS - מה זה ולמה צריך?

**CORS** = Cross-Origin Resource Sharing

**הבעיה:**
- ה-Frontend רץ על: `https://your-site.com`
- השרת רץ על: `https://your-server.onrender.com`
- זה שני דומיינים שונים!
- הדפדפן חוסם את זה (מסיבות אבטחה)

**הפתרון:**
```javascript
// בשרת (server.js):
app.use(cors({
  origin: 'https://your-site.com',  // מאפשר רק לאתר שלך
  credentials: true  // מאפשר cookies
}));
```

**מה קורה:**
- השרת אומר: "אני מאפשר לאתר הזה לגשת אליי"
- הדפדפן בודק את זה
- אם זה מותר, הבקשה עוברת

---

## מה קורה כשמשהו נכשל?

### שגיאות נפוצות

#### 1. השרת לא מוצא את השדה

```javascript
const usernameField = await page.$('input[name="username"]');
if (!usernameField) {
  // השדה לא נמצא!
  return res.status(400).json({ 
    error: 'לא נמצא שדה שם משתמש' 
  });
}
```

**למה זה קורה?**
- המבנה של משוב שונה
- השדה נקרא אחרת
- הדף לא נטען לגמרי

**איך לתקן?**
- לבדוק את ה-HTML של משוב
- לעדכן את הסלקטור
- להוסיף המתנות

#### 2. התחברות נכשלת

```javascript
// השרת בודק אם ההתחברות הצליחה
const pageContent = await page.content();
if (pageContent.includes('שגיאה')) {
  return res.status(401).json({ 
    error: 'שם משתמש או סיסמה שגויים' 
  });
}
```

**למה זה קורה?**
- סיסמה שגויה
- שם משתמש שגוי
- משוב שינה את המבנה

**איך לתקן?**
- לבדוק את פרטי ההתחברות
- לבדוק את הלוגים של השרת
- לעדכן את הקוד לפי המבנה החדש

#### 3. הקובץ לא מורד

```javascript
// השרת מחכה שהקובץ יורד
await page.waitForTimeout(5000);
const files = await fs.readdir(TEMP_DIR);
if (files.length === 0) {
  // הקובץ לא הורד!
}
```

**למה זה קורה?**
- הקישור לא עובד
- משוב דורש אישור נוסף
- השרת לא מוצא את הקישור

**איך לתקן?**
- לבדוק את הלוגים
- להוסיף המתנות
- לנסות דרכים אחרות להוריד

#### 4. השרת נרדם (Render.com)

**מה קורה:**
- Render "מרדים" את השרת אחרי 15 דקות
- כשמישהו מנסה להתחבר, השרת מתעורר
- זה לוקח עד דקה

**איך לטפל:**
```javascript
// ה-Frontend צריך לטפל בזה
try {
  const response = await fetch(API_URL);
} catch (error) {
  if (error.message.includes('timeout')) {
    // השרת מתעורר, נסה שוב
    await new Promise(resolve => setTimeout(resolve, 60000));
    const response = await fetch(API_URL);
  }
}
```

---

## איך לשפר את המערכת?

### 1. שמירת Sessions ב-Redis

**במקום:**
```javascript
const sessions = new Map();  // בזיכרון - נמחק בעת restart
```

**עדיף:**
```javascript
import Redis from 'redis';
const redis = Redis.createClient();
// Sessions נשמרים ב-Redis - לא נמחקים
```

**למה?**
- Sessions לא נמחקים בעת restart
- אפשר לשתף בין כמה שרתים
- יותר יציב

### 2. טיפול טוב יותר בשגיאות

```javascript
try {
  await page.goto(url);
} catch (error) {
  // לוג מפורט
  console.error('Error navigating:', {
    url: url,
    error: error.message,
    stack: error.stack
  });
  
  // נסה שוב
  await retry(() => page.goto(url), { retries: 3 });
}
```

### 3. זיהוי אוטומטי של מבנה משוב

```javascript
// במקום סלקטורים קבועים:
const usernameField = await page.$('input[name="username"]');

// נסה כמה אפשרויות:
const selectors = [
  'input[name="username"]',
  'input[type="text"]',
  '#username',
  '.username-input'
];

for (const selector of selectors) {
  const field = await page.$(selector);
  if (field) {
    await field.type(username);
    break;
  }
}
```

### 4. Caching

```javascript
// שמור תוצאות כדי לא לשאוב שוב
const cache = new Map();

async function downloadFiles(sessionId) {
  const cacheKey = `files-${sessionId}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);  // החזר מהמטמון
  }
  
  const files = await actuallyDownloadFiles();
  cache.set(cacheKey, files);
  return files;
}
```

---

## סיכום

### הזרימה המלאה (בקצרה):

1. **מורה** → מזין פרטי התחברות ב-**Frontend**
2. **Frontend** → שולח HTTP POST ל-**Server**
3. **Server** → פותח Chrome עם **Puppeteer**
4. **Server** → מתחבר ל-**משוב** בשם המורה
5. **Server** → שומר **Cookies** ו-**Session ID**
6. **Server** → מוריד קבצים מ-**משוב**
7. **Server** → מחזיר קבצים ל-**Frontend**
8. **Frontend** → מעבד ומציג נתונים ב-**Dashboard**

### מושגים חשובים:

- **Web Scraping** = אוטומציה של דפדפן
- **Puppeteer** = כלי לשליטה ב-Chrome
- **Session** = תקופת חיבור (עם Cookies)
- **HTTP** = פרוטוקול תקשורת
- **CORS** = אבטחה בין דומיינים שונים
- **Headless** = דפדפן ללא חלון גלוי

### מה הלאה?

עכשיו שאתה מבין איך זה עובד, אתה יכול:
- לתקן בעיות כשהן קורות
- לשפר את הקוד
- להוסיף תכונות חדשות
- להתאים למבנה ספציפי של משוב

---

## שאלות נפוצות

**Q: למה לא להשתמש ב-API של משוב?**
A: כי אין API פתוח. לכן צריך web scraping.

**Q: זה חוקי?**
A: תלוי בתנאי השימוש של משוב. בדרך כלל זה בסדר אם אתה משתמש בזה בעצמך.

**Q: מה אם משוב משנה את המבנה?**
A: צריך לעדכן את הסלקטורים בקוד. זה למה חשוב להבין איך זה עובד!

**Q: למה לא לשמור סיסמאות?**
A: מסיבות אבטחה! אנחנו שומרים רק Cookies ו-Session ID.

**Q: מה אם השרת נרדם?**
A: ב-Render.com, השרת מתעורר אוטומטית כשמישהו מנסה להתחבר (עד דקה).

---

עכשיו אתה מבין את המערכת לעומק! 🎉
