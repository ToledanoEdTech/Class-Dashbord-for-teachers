# מדריך לזרימה מורכבת במשוב - שלב אחר שלב

## סקירה

משוב דורש:
1. שנת לימודים
2. שם בית ספר (בחירה מרשימה)
3. שם משתמש
4. סיסמה

ואז:
- יומן מחנך → שכבה → כיתה → מתחילת השנה → פירוט אירועי משמעת → הורדת Excel
- ציונים שוטפים → סדין → הורדת Excel

---

## איך לעשות את זה בצורה בטוחה?

### עקרון חשוב: READ-ONLY MODE

**הכלל הבסיסי:**
- ✅ **רק לקרוא** - מותר
- ❌ **לכתוב/לשנות** - אסור!

**איך מוודאים?**
- הקוד רק לוחץ על קישורים
- הקוד רק מוריד קבצים
- הקוד **לא** ממלא טפסים שמשנים נתונים
- הקוד **לא** לוחץ על כפתורי "שמור" או "עדכן"

---

## שלב 1: התחברות מורכבת

### הקוד הנוכחי (פשוט):
```javascript
// רק שם משתמש וסיסמה
await usernameField.type(username);
await passwordField.type(password);
await loginButton.click();
```

### הקוד החדש (מורכב):
```javascript
async function loginToMisbo(page, credentials) {
  const { year, schoolName, username, password, misboUrl } = credentials;
  
  // שלב 1: טען את דף ההתחברות
  await page.goto(misboUrl, { waitUntil: 'networkidle2' });
  await page.waitForTimeout(2000);
  
  // שלב 2: בחר שנת לימודים
  const yearSelect = await page.$('select[name="year"], #year, .year-select');
  if (yearSelect) {
    await yearSelect.select(year); // למשל: "2024-2025"
    await page.waitForTimeout(1000);
  }
  
  // שלב 3: בחר בית ספר (מתוך רשימה)
  const schoolSelect = await page.$('select[name="school"], #school, .school-select');
  if (schoolSelect) {
    // אפשרות 1: לפי טקסט
    await schoolSelect.select({ label: schoolName });
    
    // אפשרות 2: לפי value
    // await schoolSelect.select({ value: schoolId });
    
    await page.waitForTimeout(1000);
  }
  
  // שלב 4: מלא שם משתמש
  const usernameField = await findField(page, [
    'input[name="username"]',
    'input[name="user"]',
    '#username'
  ]);
  await usernameField.type(username, { delay: 100 });
  
  // שלב 5: מלא סיסמה
  const passwordField = await page.$('input[type="password"]');
  await passwordField.type(password, { delay: 100 });
  
  // שלב 6: לחץ התחברות
  const loginButton = await findButton(page, [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("התחבר")'
  ]);
  
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
    loginButton.click()
  ]);
  
  // בדוק שההתחברות הצליחה
  await page.waitForTimeout(2000);
  const cookies = await page.cookies();
  
  return { success: true, cookies };
}
```

---

## שלב 2: ניווט ליומן מחנך

```javascript
async function navigateToHomeroomJournal(page) {
  // שלב 1: מצא את התפריט "יומן מחנך"
  const homeroomLink = await findLink(page, [
    'a:has-text("יומן מחנך")',
    'a:has-text("יומן")',
    'a[href*="homeroom"]',
    'a[href*="יומן"]',
    '.menu-item:has-text("יומן מחנך")'
  ]);
  
  if (!homeroomLink) {
    throw new Error('יומן מחנך לא נמצא');
  }
  
  // לחץ והמתן לטעינה
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
    homeroomLink.click()
  ]);
  
  await page.waitForTimeout(2000);
  
  // שלב 2: בחר שכבה
  const gradeSelect = await findSelect(page, [
    'select[name="grade"]',
    'select[name="שכבה"]',
    '#grade-select',
    '.grade-select'
  ]);
  
  if (gradeSelect) {
    // למשל: "ח'" או "8"
    await gradeSelect.select({ label: 'ח\'' }); // או value: '8'
    await page.waitForTimeout(2000);
  }
  
  // שלב 3: בחר כיתה
  const classSelect = await findSelect(page, [
    'select[name="class"]',
    'select[name="כיתה"]',
    '#class-select',
    '.class-select'
  ]);
  
  if (classSelect) {
    // למשל: "ח'1" או "8-1"
    await classSelect.select({ label: 'ח\'1' });
    await page.waitForTimeout(2000);
  }
  
  // שלב 4: בחר "מתחילת השנה"
  const dateRangeButton = await findButton(page, [
    'button:has-text("מתחילת השנה")',
    'button:has-text("מתחילת השנה")',
    'input[value="מתחילת השנה"]',
    '.date-range-button'
  ]);
  
  if (dateRangeButton) {
    await dateRangeButton.click();
    await page.waitForTimeout(2000);
  }
  
  return { success: true };
}
```

---

## שלב 3: הורדת קובץ התנהגות

```javascript
async function downloadBehaviorFile(page) {
  // שלב 1: מצא "פירוט אירועי משמעת"
  const behaviorLink = await findLink(page, [
    'a:has-text("פירוט אירועי משמעת")',
    'a:has-text("אירועי משמעת")',
    'a:has-text("דוח התנהגות")',
    'a[href*="behavior"]',
    'a[href*="משמעת"]'
  ]);
  
  if (!behaviorLink) {
    throw new Error('קישור לאירועי משמעת לא נמצא');
  }
  
  // לחץ על הקישור
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
    behaviorLink.click()
  ]);
  
  await page.waitForTimeout(3000);
  
  // שלב 2: מצא כפתור הורדת Excel
  const downloadButton = await findDownloadButton(page, [
    'a:has-text("הורד Excel")',
    'a:has-text("ייצוא Excel")',
    'button:has-text("הורד")',
    'a[href*="excel"]',
    'a[href*="export"]',
    'a[href*="download"]',
    '.export-excel-button',
    '#download-excel'
  ]);
  
  if (!downloadButton) {
    throw new Error('כפתור הורדת Excel לא נמצא');
  }
  
  // שלב 3: הורד את הקובץ
  const filePath = await downloadFile(page, downloadButton, 'behavior');
  
  return filePath;
}
```

---

## שלב 4: הורדת קובץ ציונים

```javascript
async function downloadGradesFile(page) {
  // שלב 1: חזור לדף הראשי או מצא "ציונים שוטפים"
  const gradesLink = await findLink(page, [
    'a:has-text("ציונים שוטפים")',
    'a:has-text("ציונים")',
    'a[href*="grades"]',
    'a[href*="ציונים"]'
  ]);
  
  if (!gradesLink) {
    // נסה לחזור לדף הראשי
    await page.goto(misboUrl, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);
    
    const gradesLink2 = await findLink(page, [
      'a:has-text("ציונים שוטפים")',
      'a:has-text("ציונים")'
    ]);
    
    if (!gradesLink2) {
      throw new Error('קישור לציונים לא נמצא');
    }
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
      gradesLink2.click()
    ]);
  } else {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
      gradesLink.click()
    ]);
  }
  
  await page.waitForTimeout(2000);
  
  // שלב 2: מצא "סדין"
  const sheetLink = await findLink(page, [
    'a:has-text("סדין")',
    'a:has-text("ציונים שוטפים - סדין")',
    'a[href*="sheet"]',
    'a[href*="סדין"]'
  ]);
  
  if (!sheetLink) {
    throw new Error('קישור לסדין לא נמצא');
  }
  
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
    sheetLink.click()
  ]);
  
  await page.waitForTimeout(2000);
  
  // שלב 3: הורד Excel
  const downloadButton = await findDownloadButton(page, [
    'a:has-text("הורד Excel")',
    'a:has-text("ייצוא")',
    'button:has-text("הורד")',
    'a[href*="excel"]',
    'a[href*="export"]'
  ]);
  
  if (!downloadButton) {
    throw new Error('כפתור הורדה לא נמצא');
  }
  
  const filePath = await downloadFile(page, downloadButton, 'grades');
  
  return filePath;
}
```

---

## Helper Functions

```javascript
// מצא שדה input
async function findField(page, selectors) {
  for (const selector of selectors) {
    try {
      const field = await page.$(selector);
      if (field) {
        const isVisible = await page.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }, field);
        
        if (isVisible) return field;
      }
    } catch (e) {
      // Continue
    }
  }
  throw new Error(`Field not found with selectors: ${selectors.join(', ')}`);
}

// מצא select dropdown
async function findSelect(page, selectors) {
  for (const selector of selectors) {
    try {
      const select = await page.$(selector);
      if (select) return select;
    } catch (e) {
      // Continue
    }
  }
  return null; // לא חובה
}

// מצא קישור
async function findLink(page, selectors) {
  for (const selector of selectors) {
    try {
      const link = await page.$(selector);
      if (link) {
        const href = await page.evaluate(el => el.href, link);
        if (href && !href.includes('javascript:')) {
          return link;
        }
      }
    } catch (e) {
      // Continue
    }
  }
  return null;
}

// מצא כפתור
async function findButton(page, selectors) {
  for (const selector of selectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        const isEnabled = await page.evaluate(el => !el.disabled, button);
        if (isEnabled) return button;
      }
    } catch (e) {
      // Continue
    }
  }
  throw new Error(`Button not found with selectors: ${selectors.join(', ')}`);
}

// מצא כפתור הורדה (רק קריאה!)
async function findDownloadButton(page, selectors) {
  for (const selector of selectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        // בדוק שזה לא כפתור מסוכן
        const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', button);
        const dangerousKeywords = ['שמור', 'עדכן', 'מחק', 'שלח', 'save', 'update', 'delete', 'submit'];
        
        if (dangerousKeywords.some(kw => text.includes(kw))) {
          console.warn(`Skipping potentially dangerous button: ${text}`);
          continue;
        }
        
        return button;
      }
    } catch (e) {
      // Continue
    }
  }
  return null;
}

// הורד קובץ (בטוח)
async function downloadFile(page, button, fileType) {
  // הגדר path להורדות
  const downloadPath = join(TEMP_DIR, `${fileType}-${Date.now()}`);
  
  // הגדר CDP להורדות
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: TEMP_DIR
  });
  
  // לחץ על הכפתור
  await button.click();
  
  // המתן שהקובץ יורד
  await page.waitForTimeout(5000);
  
  // מצא את הקובץ החדש
  const files = await fs.readdir(TEMP_DIR);
  const newFile = files.find(f => 
    f.includes(fileType) || 
    f.endsWith('.xlsx') || 
    f.endsWith('.csv')
  );
  
  if (!newFile) {
    throw new Error(`File not downloaded: ${fileType}`);
  }
  
  return join(TEMP_DIR, newFile);
}
```

---

## אבטחה - איך למנוע שינויים במשוב?

### כלל 1: רק קריאה, לא כתיבה

```javascript
// ✅ מותר - רק קריאה
await page.goto(url);           // לקרוא דף
await page.click('a');          // ללחוץ על קישור
await downloadButton.click();   // להוריד קובץ

// ❌ אסור - כתיבה/שינוי
await page.type('#grade-input', '100');  // לשנות ציון
await page.click('button:has-text("שמור")');  // לשמור שינויים
await page.click('button:has-text("מחק")');    // למחוק
```

### כלל 2: בדוק לפני לחיצה

```javascript
async function safeClick(page, selector, actionName) {
  const element = await page.$(selector);
  if (!element) {
    throw new Error(`${actionName}: Element not found`);
  }
  
  // בדוק מה האלמנט עושה
  const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', element);
  const href = await page.evaluate(el => el.href || '', element);
  const type = await page.evaluate(el => el.type || '', element);
  
  // רשימת מילים מסוכנות
  const dangerousKeywords = [
    'שמור', 'עדכן', 'מחק', 'שלח', 'אישור',
    'save', 'update', 'delete', 'submit', 'confirm',
    'עריכה', 'edit', 'change', 'modify'
  ];
  
  // בדוק אם זה מסוכן
  const isDangerous = dangerousKeywords.some(kw => 
    text.includes(kw) || href.includes(kw)
  );
  
  if (isDangerous) {
    throw new Error(`SAFETY: Blocked dangerous action: ${actionName} (${text})`);
  }
  
  // בדוק שזה לא form submit
  if (type === 'submit' || element.tagName === 'BUTTON' && text.includes('שמור')) {
    throw new Error(`SAFETY: Blocked form submission: ${actionName}`);
  }
  
  // אם הכל בסדר, לחץ
  await element.click();
}
```

### כלל 3: רק קישורים להורדה

```javascript
async function safeDownloadClick(page, selector) {
  const element = await page.$(selector);
  
  // בדוק שזה קישור הורדה
  const href = await page.evaluate(el => el.href || '', element);
  const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', element);
  
  const downloadKeywords = ['download', 'export', 'excel', 'csv', 'הורד', 'ייצוא'];
  const isDownload = downloadKeywords.some(kw => 
    href.includes(kw) || text.includes(kw)
  );
  
  if (!isDownload) {
    throw new Error(`SAFETY: Not a download link: ${href}`);
  }
  
  // בדוק שזה לא מסוכן
  const dangerousKeywords = ['delete', 'remove', 'מחק', 'הסר'];
  const isDangerous = dangerousKeywords.some(kw => 
    href.includes(kw) || text.includes(kw)
  );
  
  if (isDangerous) {
    throw new Error(`SAFETY: Dangerous download link blocked: ${href}`);
  }
  
  // אם הכל בסדר, לחץ
  await element.click();
}
```

### כלל 4: אל תמלא טפסים שמשנים נתונים

```javascript
// ✅ מותר - רק בחירות
await select.select('ח\'');  // בחירת שכבה
await select.select('ח\'1'); // בחירת כיתה

// ❌ אסור - שינוי נתונים
await input.type('100');     // שינוי ציון
await input.type('הערה');    // הוספת הערה
```

### כלל 5: לוג כל פעולה מסוכנת

```javascript
class SafetyLogger {
  static logAction(action, details) {
    console.log(`[SAFETY] ${action}:`, details);
    
    // אפשר גם לשמור לקובץ
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      details
    };
    
    // שמור לוג (לא חובה, אבל מומלץ)
    // await fs.appendFile('safety-log.json', JSON.stringify(logEntry) + '\n');
  }
  
  static warnDangerous(action, reason) {
    console.warn(`[SAFETY WARNING] Blocked: ${action} - ${reason}`);
  }
}

// שימוש:
SafetyLogger.logAction('Download file', { type: 'behavior', url: downloadUrl });
SafetyLogger.warnDangerous('Click button', 'Button contains "שמור"');
```

---

## פונקציה מלאה ובטוחה

```javascript
async function downloadFilesFromMisbo(credentials) {
  const { year, schoolName, username, password, misboUrl, grade, className } = credentials;
  
  let browser = null;
  try {
    // פתח דפדפן
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // שלב 1: התחברות
    SafetyLogger.logAction('Login', { username, url: misboUrl });
    await loginToMisbo(page, { year, schoolName, username, password, misboUrl });
    
    // שלב 2: ניווט ליומן מחנך
    SafetyLogger.logAction('Navigate', { to: 'יומן מחנך' });
    await navigateToHomeroomJournal(page, { grade, className });
    
    // שלב 3: הורדת קובץ התנהגות
    SafetyLogger.logAction('Download', { type: 'behavior' });
    const behaviorFile = await downloadBehaviorFile(page);
    
    // שלב 4: הורדת קובץ ציונים
    SafetyLogger.logAction('Download', { type: 'grades' });
    const gradesFile = await downloadGradesFile(page);
    
    return {
      success: true,
      files: {
        behavior: behaviorFile,
        grades: gradesFile
      }
    };
    
  } catch (error) {
    SafetyLogger.warnDangerous('Error', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
```

---

## סיכום - כללי בטיחות

1. ✅ **רק קריאה** - רק לקרוא דפים ולהוריד קבצים
2. ✅ **רק קישורים** - רק ללחוץ על קישורים, לא על כפתורי "שמור"
3. ✅ **בדוק לפני לחיצה** - בדוק מה האלמנט עושה לפני לחיצה
4. ✅ **לוג כל פעולה** - שמור לוג של כל פעולה חשובה
5. ✅ **חסום פעולות מסוכנות** - אם יש ספק, אל תעשה!

---

## איך לבדוק שהכל בטוח?

### בדיקה 1: הרץ במצב לא-headless

```javascript
const browser = await puppeteer.launch({
  headless: false,  // תראה את הדפדפן
  slowMo: 250       // האט את הפעולות
});
```

כך תראה בדיוק מה הקוד עושה!

### בדיקה 2: צלם מסכים

```javascript
await page.screenshot({ path: 'step-1-login.png' });
await page.screenshot({ path: 'step-2-homeroom.png' });
await page.screenshot({ path: 'step-3-download.png' });
```

כך תראה מה קרה בכל שלב.

### בדיקה 3: בדוק את הלוגים

```javascript
// כל פעולה חשובה נכתבת ללוג
console.log('[ACTION] Clicked on:', buttonText);
console.log('[ACTION] Navigated to:', page.url());
console.log('[ACTION] Downloaded:', fileName);
```

---

עכשיו אתה יודע איך לעשות את זה בצורה בטוחה! 🔒
