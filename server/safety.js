/**
 * Safety utilities - מונע פעולות מסוכנות במשוב
 */

// רשימת מילים מסוכנות שעלולות לשנות נתונים
const DANGEROUS_KEYWORDS = [
  // עברית
  'שמור', 'עדכן', 'מחק', 'שלח', 'אישור', 'עריכה', 'שינוי',
  'הוסף', 'הסר', 'עדכן ציון', 'שנה', 'מחק תלמיד',
  
  // אנגלית
  'save', 'update', 'delete', 'submit', 'confirm', 'edit', 'change',
  'add', 'remove', 'modify', 'create', 'remove', 'clear'
];

// רשימת מילים בטוחות (להורדות)
const SAFE_DOWNLOAD_KEYWORDS = [
  'הורד', 'ייצוא', 'download', 'export', 'excel', 'csv',
  'דוח', 'report', 'פירוט', 'detail'
];

/**
 * בדוק אם פעולה מסוכנת
 */
export function isDangerousAction(elementText, elementHref = '') {
  const text = (elementText || '').toLowerCase();
  const href = (elementHref || '').toLowerCase();
  
  return DANGEROUS_KEYWORDS.some(keyword => 
    text.includes(keyword.toLowerCase()) || 
    href.includes(keyword.toLowerCase())
  );
}

/**
 * בדוק אם זה קישור הורדה בטוח
 */
export function isSafeDownloadLink(elementText, elementHref = '') {
  const text = (elementText || '').toLowerCase();
  const href = (elementHref || '').toLowerCase();
  
  // בדוק שזה לא מסוכן
  if (isDangerousAction(elementText, elementHref)) {
    return false;
  }
  
  // בדוק שזה קישור הורדה
  return SAFE_DOWNLOAD_KEYWORDS.some(keyword => 
    text.includes(keyword.toLowerCase()) || 
    href.includes(keyword.toLowerCase())
  );
}

/**
 * Safety Logger - לוג כל פעולה חשובה
 */
export class SafetyLogger {
  static logAction(action, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      ...details
    };
    
    console.log(`[SAFETY] ${action}:`, JSON.stringify(logEntry, null, 2));
    
    // אפשר לשמור לקובץ אם צריך
    // fs.appendFileSync('safety-log.json', JSON.stringify(logEntry) + '\n');
  }
  
  static warnDangerous(action, reason) {
    console.warn(`[SAFETY WARNING] Blocked: ${action} - ${reason}`);
  }
  
  static error(message, error) {
    console.error(`[SAFETY ERROR] ${message}:`, error);
  }
}

/**
 * Helper: מצא אלמנט בצורה בטוחה
 */
export async function findSafeElement(page, selectors, elementType = 'element') {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        // בדוק שהאלמנט גלוי
        const isVisible = await page.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && 
                 style.visibility !== 'hidden' && 
                 style.opacity !== '0';
        }, element);
        
        if (isVisible) {
          return element;
        }
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  throw new Error(`${elementType} not found with selectors: ${selectors.join(', ')}`);
}

/**
 * Helper: לחץ בצורה בטוחה (רק על קישורים/כפתורים בטוחים)
 */
export async function safeClick(page, element, actionName) {
  // קבל מידע על האלמנט
  const elementInfo = await page.evaluate(el => ({
    text: el.textContent?.trim() || '',
    href: el.href || '',
    type: el.type || '',
    tagName: el.tagName.toLowerCase(),
    onclick: el.onclick ? el.onclick.toString() : ''
  }), element);
  
  // בדוק אם זה מסוכן
  if (isDangerousAction(elementInfo.text, elementInfo.href)) {
    SafetyLogger.warnDangerous(actionName, `Element contains dangerous keywords: ${elementInfo.text}`);
    throw new Error(`SAFETY: Blocked dangerous action: ${actionName}. Element: ${elementInfo.text}`);
  }
  
  // בדוק שזה לא form submit מסוכן
  if (elementInfo.type === 'submit' && isDangerousAction(elementInfo.text)) {
    SafetyLogger.warnDangerous(actionName, 'Form submission blocked');
    throw new Error(`SAFETY: Blocked form submission: ${actionName}`);
  }
  
  // אם הכל בסדר, לחץ
  SafetyLogger.logAction('Safe click', { action: actionName, element: elementInfo.text });
  await element.click();
}

/**
 * Helper: לחץ על קישור הורדה בצורה בטוחה
 */
export async function safeDownloadClick(page, element, actionName) {
  const elementInfo = await page.evaluate(el => ({
    text: el.textContent?.trim() || '',
    href: el.href || '',
    tagName: el.tagName.toLowerCase()
  }), element);
  
  // בדוק שזה קישור הורדה בטוח
  if (!isSafeDownloadLink(elementInfo.text, elementInfo.href)) {
    SafetyLogger.warnDangerous(actionName, `Not a safe download link: ${elementInfo.text}`);
    throw new Error(`SAFETY: Not a safe download link: ${elementInfo.text}`);
  }
  
  // אם הכל בסדר, לחץ
  SafetyLogger.logAction('Safe download click', { action: actionName, link: elementInfo.text });
  await element.click();
}

/**
 * Helper: בחר מתוך select בצורה בטוחה (רק בחירות, לא שינויים)
 */
export async function safeSelect(page, selectElement, value, fieldName) {
  // בדוק שזה select ולא input
  const tagName = await page.evaluate(el => el.tagName.toLowerCase(), selectElement);
  if (tagName !== 'select') {
    throw new Error(`SAFETY: Not a select element: ${fieldName}`);
  }
  
  SafetyLogger.logAction('Safe select', { field: fieldName, value });
  
  // בחר את הערך (תומך גם ב-object כמו { label: 'ח\'' })
  if (typeof value === 'object' && value.label) {
    await selectElement.select({ label: value.label });
  } else if (typeof value === 'object' && value.value) {
    await selectElement.select({ value: value.value });
  } else {
    await selectElement.select(value);
  }
  
  // המתן שהדף מגיב
  await page.waitForTimeout(1000);
}
