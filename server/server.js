import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// Render.com משתמש בפורט 10000, אבל יכול להיות גם משתנה סביבה
const PORT = process.env.PORT || 3001;

// אחסון זמני של sessions (בפועל צריך להשתמש ב-Redis או DB)
const sessions = new Map();

// ניקוי sessions ישנים כל 5 דקות
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > 30 * 60 * 1000) { // 30 דקות
      sessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

// Middleware
// ב-Render, צריך לאפשר את כל ה-origins או את ה-URL של ה-frontend
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware ל-rate limiting בסיסי
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // דקה
const RATE_LIMIT_MAX = 10; // 10 בקשות לדקה

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const limit = rateLimit.get(ip);
  if (now > limit.resetAt) {
    limit.count = 1;
    limit.resetAt = now + RATE_LIMIT_WINDOW;
    return next();
  }
  
  if (limit.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'יותר מדי בקשות. אנא נסה שוב בעוד דקה.' });
  }
  
  limit.count++;
  next();
});

// תיקייה לשמירת קבצים זמניים
const TEMP_DIR = join(__dirname, 'temp');
await fs.mkdir(TEMP_DIR, { recursive: true });

// ניקוי קבצים ישנים כל שעה
setInterval(async () => {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    for (const file of files) {
      const filePath = join(TEMP_DIR, file);
      const stats = await fs.stat(filePath);
      // מחק קבצים ישנים יותר מ-30 דקות
      if (now - stats.mtimeMs > 30 * 60 * 1000) {
        await fs.unlink(filePath);
      }
    }
  } catch (error) {
    console.error('Error cleaning temp files:', error);
  }
}, 60 * 60 * 1000);

/**
 * התחברות למשוב ובדיקת תקינות
 */
app.post('/api/misbo/login', async (req, res) => {
  const { username, password, misboUrl } = req.body;

  if (!username || !password || !misboUrl) {
    return res.status(400).json({ error: 'נדרשים שם משתמש, סיסמה וכתובת משוב' });
  }

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    
    // הגדרת viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // מעבר לדף ההתחברות של משוב
    await page.goto(misboUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // חיפוש שדות התחברות (צריך להתאים לפי המבנה של משוב)
    // נסה למצוא שדות לפי placeholder או label
    await page.waitForTimeout(2000);
    
    // חיפוש שדה שם משתמש
    const usernameSelectors = [
      'input[name="username"]',
      'input[name="user"]',
      'input[type="text"]',
      'input[placeholder*="שם משתמש"]',
      'input[placeholder*="משתמש"]',
      '#username',
      '#user'
    ];
    
    let usernameField = null;
    for (const selector of usernameSelectors) {
      try {
        usernameField = await page.$(selector);
        if (usernameField) break;
      } catch (e) {}
    }
    
    if (!usernameField) {
      // נסה למצוא את כל שדות ה-input ולבדוק
      const inputs = await page.$$('input[type="text"], input[type="email"]');
      if (inputs.length > 0) {
        usernameField = inputs[0];
      }
    }
    
    if (!usernameField) {
      return res.status(400).json({ error: 'לא נמצא שדה שם משתמש. אנא ודא שכתובת משוב נכונה.' });
    }
    
    // הזנת שם משתמש
    await usernameField.type(username, { delay: 100 });
    
    // חיפוש שדה סיסמה
    const passwordField = await page.$('input[type="password"]');
    if (!passwordField) {
      return res.status(400).json({ error: 'לא נמצא שדה סיסמה' });
    }
    
    await passwordField.type(password, { delay: 100 });
    
    // חיפוש כפתור התחברות
    const loginSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("התחבר")',
      'button:has-text("כניסה")',
      'a:has-text("התחבר")',
      '.login-button',
      '#login-button'
    ];
    
    let loginButton = null;
    for (const selector of loginSelectors) {
      try {
        loginButton = await page.$(selector);
        if (loginButton) break;
      } catch (e) {}
    }
    
    if (!loginButton) {
      // נסה למצוא כפתור כלשהו
      const buttons = await page.$$('button');
      if (buttons.length > 0) {
        loginButton = buttons[0];
      }
    }
    
    if (!loginButton) {
      return res.status(400).json({ error: 'לא נמצא כפתור התחברות' });
    }
    
    // לחיצה על כפתור התחברות
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      loginButton.click()
    ]);
    
    await page.waitForTimeout(3000);
    
    // בדיקה אם ההתחברות הצליחה (בדוק אם יש הודעת שגיאה או שהגענו לדף אחר)
    const currentUrl = page.url();
    const pageContent = await page.content();
    
    // בדיקות נפוצות לכשלון התחברות
    const errorIndicators = [
      'שם משתמש או סיסמה שגויים',
      'שגיאה',
      'לא הצלחתי להתחבר',
      'invalid',
      'error',
      'שגוי'
    ];
    
    const hasError = errorIndicators.some(indicator => 
      pageContent.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (hasError && currentUrl === misboUrl) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    }
    
    // אם הגענו לכאן, ההתחברות כנראה הצליחה
    // שמור cookies ל-session (ללא סיסמה!)
    const cookies = await page.cookies();
    
    // יצירת session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    // שמירת session (ללא סיסמה!)
    sessions.set(sessionId, {
      cookies: cookies,
      misboUrl: misboUrl,
      createdAt: Date.now(),
      // לא שומרים סיסמה!
    });
    
    res.json({ 
      success: true,
      message: 'התחברות הצליחה',
      sessionId: sessionId,
      url: currentUrl
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'שגיאה בהתחברות למשוב',
      details: error.message 
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

/**
 * הורדת קבצים ממשוב
 */
app.post('/api/misbo/download-files', async (req, res) => {
  const { sessionId, className } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'נדרש session ID תקין' });
  }

  // קבלת session
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session לא נמצא או פג תוקף. אנא התחבר שוב.' });
  }

  const { cookies, misboUrl } = session;

  let browser = null;
  const downloadedFiles = {
    behaviorFile: null,
    gradesFile: null
  };

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // הגדרת cookies
    await page.setCookie(...cookies);
    
    // הגדרת CDP client להורדות
    const client = await page.target().createCDPSession();
    
    // הגדרת path להורדות
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: TEMP_DIR
    });
    
    // מעבר לדף הראשי של משוב
    await page.goto(misboUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // ===== הורדת קובץ התנהגות =====
    try {
      console.log('מחפש קובץ התנהגות...');
      
      // חיפוש קישורים/כפתורים רלוונטיים
      const behaviorLinks = await page.evaluate(() => {
        const links = [];
        const allElements = document.querySelectorAll('a, button, [onclick]');
        allElements.forEach(el => {
          const text = el.textContent?.toLowerCase() || '';
          const href = el.href || '';
          if (text.includes('יומן') || text.includes('התנהגות') || text.includes('אירוע') ||
              text.includes('דוח') || text.includes('הורד') || text.includes('ייצוא') ||
              href.includes('behavior') || href.includes('report') || href.includes('export') ||
              href.includes('download') || href.includes('csv') || href.includes('excel')) {
            links.push({
              text: el.textContent,
              href: href,
              tag: el.tagName.toLowerCase()
            });
          }
        });
        return links;
      });
      
      console.log('נמצאו קישורים רלוונטיים:', behaviorLinks.length);
      
      // נסה ללחוץ על הקישור הראשון שנראה רלוונטי
      if (behaviorLinks.length > 0) {
        const firstLink = behaviorLinks[0];
        const selector = `a[href="${firstLink.href}"], button:has-text("${firstLink.text}")`;
        
        try {
          const element = await page.$(selector);
          if (element) {
            // המתן להורדה
            const downloadPromise = new Promise((resolve) => {
              client.on('Page.downloadProgress', async (event) => {
                if (event.state === 'completed') {
                  const downloadPath = join(TEMP_DIR, event.guid);
                  downloadedFiles.behaviorFile = downloadPath;
                  resolve();
                }
              });
            });
            
            await Promise.all([
              downloadPromise.catch(() => {}),
              element.click()
            ]);
            
            await page.waitForTimeout(5000);
          }
        } catch (error) {
          console.error('Error clicking behavior link:', error);
        }
      }
      
      // אם לא מצאנו דרך אוטומטית, ננסה לקחת תוכן מהדף
      if (!downloadedFiles.behaviorFile) {
        // נסה למצוא טבלה או נתונים בדף
        const tableData = await page.evaluate(() => {
          const tables = document.querySelectorAll('table');
          if (tables.length > 0) {
            // נסה לחלץ נתונים מטבלה
            return Array.from(tables).map(table => {
              const rows = Array.from(table.querySelectorAll('tr'));
              return rows.map(row => {
                const cells = Array.from(row.querySelectorAll('td, th'));
                return cells.map(cell => cell.textContent?.trim() || '');
              });
            });
          }
          return null;
        });
        
        if (tableData && tableData.length > 0) {
          // שמור כקובץ CSV זמני
          const csvContent = tableData[0].map(row => row.join(',')).join('\n');
          const tempFilePath = join(TEMP_DIR, `behavior_${Date.now()}.csv`);
          await fs.writeFile(tempFilePath, csvContent, 'utf-8');
          downloadedFiles.behaviorFile = tempFilePath;
        }
      }
      
    } catch (error) {
      console.error('Error downloading behavior file:', error);
    }
    
    // ===== הורדת קובץ ציונים =====
    try {
      console.log('מחפש קובץ ציונים...');
      
      // חזרה לדף הראשי
      await page.goto(misboUrl, { waitUntil: 'networkidle2' });
      await page.waitForTimeout(2000);
      
      // חיפוש קישורים/כפתורים רלוונטיים לציונים
      const gradesLinks = await page.evaluate(() => {
        const links = [];
        const allElements = document.querySelectorAll('a, button, [onclick]');
        allElements.forEach(el => {
          const text = el.textContent?.toLowerCase() || '';
          const href = el.href || '';
          if (text.includes('ציונים') || text.includes('סדין') || text.includes('שוטפים') ||
              text.includes('הורד') || text.includes('ייצוא') ||
              href.includes('grades') || href.includes('export') || href.includes('download') ||
              href.includes('csv') || href.includes('excel')) {
            links.push({
              text: el.textContent,
              href: href,
              tag: el.tagName.toLowerCase()
            });
          }
        });
        return links;
      });
      
      console.log('נמצאו קישורי ציונים:', gradesLinks.length);
      
      if (gradesLinks.length > 0) {
        const firstLink = gradesLinks[0];
        const selector = `a[href="${firstLink.href}"], button:has-text("${firstLink.text}")`;
        
        try {
          const element = await page.$(selector);
          if (element) {
            const downloadPromise = new Promise((resolve) => {
              client.on('Page.downloadProgress', async (event) => {
                if (event.state === 'completed') {
                  const downloadPath = join(TEMP_DIR, event.guid);
                  downloadedFiles.gradesFile = downloadPath;
                  resolve();
                }
              });
            });
            
            await Promise.all([
              downloadPromise.catch(() => {}),
              element.click()
            ]);
            
            await page.waitForTimeout(5000);
          }
        } catch (error) {
          console.error('Error clicking grades link:', error);
        }
      }
      
    } catch (error) {
      console.error('Error downloading grades file:', error);
    }
    
    // החזרת תוצאות
    if (downloadedFiles.behaviorFile || downloadedFiles.gradesFile) {
      res.json({
        success: true,
        message: 'קבצים נמצאו',
        files: downloadedFiles,
        note: downloadedFiles.behaviorFile && downloadedFiles.gradesFile 
          ? 'שני הקבצים הורדו בהצלחה'
          : 'חלק מהקבצים לא נמצאו. נסה להוריד ידנית.'
      });
    } else {
      res.json({
        success: false,
        message: 'לא נמצאו קבצים להורדה אוטומטית',
        suggestion: 'אנא הורד את הקבצים ידנית ממשוב והעלה אותם כאן'
      });
    }
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      error: 'שגיאה בהורדת קבצים',
      details: error.message 
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Temp directory: ${TEMP_DIR}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
