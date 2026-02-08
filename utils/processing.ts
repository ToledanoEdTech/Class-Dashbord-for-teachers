import { BehaviorEvent, EventType, Grade, Student, Correlation, RiskSettings, DEFAULT_RISK_SETTINGS } from '../types';
import { isAbsenceEvent } from '../types';
import { differenceInDays } from 'date-fns';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// --- Constants ---
const POSITIVE_KEYWORDS = [
  'מילה טובה', 
  'הצטיינות', 
  'חיזוק', 
  'פרגון', 
  'תפילה', 
  'הגעה בזמן',
  'שיפור',
  'השתתפות טובה',
  'השתתפות פעילה',
  'לבוש הולם',
  'שותף במהלך השיעור',
  'שותף בשיעור'
]; 

const NEGATIVE_KEYWORDS = [
  'חיסור', 
  'איחור', 
  'הפרעה', 
  'אי הכנת', // יתפוס גם "אי הכנת שיעורים" וגם "אי הכנת ש.ב"
  'ללא ציוד', 
  'אי הבאת ציוד',
  'הוצאה', 
  'שיחת משמעת', 
  'פטפוט', 
  'שוטטות', 
  'אי השתתפות',
  'חוצפה',
  'אלימות',
  'חוסר ציוד'
]; 

// --- Helpers ---

/** Find column index where header cell matches any of the given strings (contains). Returns -1 if not found. */
const findCol = (headerRow: any[], ...keywords: string[]): number => {
  for (let c = 0; c < headerRow.length; c++) {
    const cell = headerRow[c];
    const s = typeof cell === 'string' ? cell : String(cell ?? '').trim();
    if (keywords.some(kw => s.includes(kw))) return c;
  }
  return -1;
};

/** Subject column: prefer "מקצוע", avoid columns that are only serial number (מס' / מספר). */
const findSubjectCol = (headerRow: any[]): number => {
  for (let c = 0; c < headerRow.length; c++) {
    const cell = headerRow[c];
    const s = (typeof cell === 'string' ? cell : String(cell ?? '')).trim();
    if (s.includes('מקצוע') && !/^מס['\u0592]?\s*$|^מספר\s*$/.test(s)) return c;
    if (s.includes('שיעור') && !s.includes('מס') && !/^\d+$/.test(s)) return c; // שיעור but not מס' שיעור
  }
  return -1;
};

const parseDate = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  
  // If it's already a JS Date (from Excel parsing)
  if (dateVal instanceof Date) return dateVal;

  // If it's a string
  if (typeof dateVal === 'string') {
      const trimmed = dateVal.trim();
      // Try DD/MM/YYYY
      const parts = trimmed.split(/[\/\-\.]/);
      if (parts.length === 3) {
          // Assume DD/MM/YYYY
          const d = parseInt(parts[0]);
          const m = parseInt(parts[1]);
          const y = parseInt(parts[2]);
          if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
               return new Date(y, m - 1, d);
          }
      }
  }
  return null;
};

const categorizeEvent = (eventType: string, justification: string = ''): EventType => {
  if (!eventType) return EventType.NEUTRAL;
  
  // Robust normalization:
  // 1. Remove non-breaking spaces and other invisible Unicode chars
  // 2. Remove quotes if present
  // 3. Replace multiple spaces with single space
  // 4. Trim
  const normalizedType = eventType
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  const normalizedJustification = justification.trim();

  // Priority Logic: Check NEGATIVE first.
  if (NEGATIVE_KEYWORDS.some(k => normalizedType.includes(k))) {
      // EXCEPTION: Justified Absences (חיסור מוצדק)
      // If it is an absence, check if it is justified either by title or by justification column.
      if (normalizedType.includes('חיסור')) {
          // Check 1: Title contains "Justified"
          if (normalizedType.includes('מוצדק')) {
              return EventType.NEUTRAL;
          }

          // Check 2: Justification column has valid content
          // We filter out "Without justification" phrases just in case
          const hasJustification = normalizedJustification.length > 0 && 
                                   !normalizedJustification.includes('ללא') && 
                                   !normalizedJustification.includes('לא מוצדק');
          
          if (hasJustification) {
              return EventType.NEUTRAL;
          }
      }
      return EventType.NEGATIVE;
  }

  if (POSITIVE_KEYWORDS.some(k => normalizedType.includes(k))) return EventType.POSITIVE;
  
  return EventType.NEUTRAL;
};

// --- File Reading ---

const readFileContent = async (file: File | string): Promise<any[][]> => {
    // 1. Handle String Input (Sample Data)
    if (typeof file === 'string') {
        return new Promise((resolve) => {
            Papa.parse(file, {
                complete: (results) => resolve(results.data as any[][]),
                skipEmptyLines: false 
            });
        });
    }

    // 2. Handle Excel Files (.xlsx, .xls)
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array', cellDates: true }); 
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
    }

    // 3. Handle CSV Files
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            complete: (results) => resolve(results.data as any[][]),
            error: (err) => reject(err),
            skipEmptyLines: false 
        });
    });
};

// --- Main Parsing Logic ---

export const processFiles = async (behaviorFile: File | string, gradesFile: File | string): Promise<Student[]> => {
  const behaviorData = await readFileContent(behaviorFile);
  const gradesData = await readFileContent(gradesFile);

  // --- Process Behavior Data ---
  let headerRowIndex = behaviorData.findIndex(row => row.some(cell => typeof cell === 'string' && cell.includes('שם המורה')));
  if (headerRowIndex === -1) headerRowIndex = 2;

  const headerRow = behaviorData[headerRowIndex] || [];
  // Column indices by header (so mobile/desktop get same columns regardless of order)
  const col = {
    teacher: findCol(headerRow, 'שם המורה') >= 0 ? findCol(headerRow, 'שם המורה') : 1,
    subject: findSubjectCol(headerRow) >= 0 ? findSubjectCol(headerRow) : 2,
    date: findCol(headerRow, 'תאריך') >= 0 ? findCol(headerRow, 'תאריך') : 3,
    lessonNumber: (() => {
      const i = findCol(headerRow, 'מספר שיעור', 'מס\' שיעור', 'מס. שיעור', 'מס שיעור');
      return i >= 0 ? i : 4;
    })(),
    studentId: findCol(headerRow, 'ת.ז', 'תעודת זהות') >= 0 ? findCol(headerRow, 'ת.ז', 'תעודת זהות') : 6,
    studentName: findCol(headerRow, 'שם התלמיד') >= 0 ? findCol(headerRow, 'שם התלמיד') : 7,
    type: findCol(headerRow, 'סוג', 'הערה', 'אירוע') >= 0 ? findCol(headerRow, 'סוג', 'הערה', 'אירוע') : 10,
    justification: findCol(headerRow, 'הצדקה', 'נימוק') >= 0 ? findCol(headerRow, 'הצדקה', 'נימוק') : 11,
    comment: findCol(headerRow, 'הערות', 'הערה') >= 0 ? findCol(headerRow, 'הערות', 'הערה') : 13,
  };
  // Avoid using "מס'" for lesson number if it's the same as subject (e.g. "מס' שיעור" vs "מקצוע")
  if (col.lessonNumber === col.subject) col.lessonNumber = 4;

  const events: BehaviorEvent[] = [];
  
  for (let i = headerRowIndex + 1; i < behaviorData.length; i++) {
    const row = behaviorData[i];
    if (!row || row.length < 7) continue;

    const rawId = row[col.studentId];
    if (!rawId) continue; 
    const studentId = String(rawId).trim(); 

    const date = parseDate(row[col.date]);
    if (!date) continue;

    const eventTypeStr = (row[col.type] ?? '') as string;
    const justificationStr = (row[col.justification] ?? '') as string;

    const rawSubject = row[col.subject];
    const s = String(rawSubject ?? '').trim();
    const subjectFinal = s && !/^\d+$/.test(s) ? s : 'כללי';

    events.push({
      id: `evt-${i}`,
      studentId: studentId,
      studentName: (row[col.studentName] ?? 'Unknown') as string,
      date: date,
      teacher: (row[col.teacher] ?? '') as string,
      subject: subjectFinal,
      lessonNumber: parseInt(row[col.lessonNumber] as any) || 0,
      type: eventTypeStr,
      category: categorizeEvent(eventTypeStr, justificationStr),
      justification: justificationStr,
      comment: (row[col.comment] ?? '') as string
    });
  }

  // --- Process Grades Data ---
  let gradesHeaderIndex = gradesData.findIndex(row => row.some(cell => typeof cell === 'string' && cell.includes('שם התלמיד')));
  if (gradesHeaderIndex === -1) gradesHeaderIndex = 2;

  const gradeHeaders = gradesData[gradesHeaderIndex];
  const grades: Grade[] = [];
  
  let startColIndex = 6; 
  const headerMeta: Record<number, { subject: string, teacher: string, assignment: string, date: Date, weight: number }> = {};

  for (let c = startColIndex; c < gradeHeaders.length; c++) {
    const headerRaw = gradeHeaders[c];
    if (!headerRaw || typeof headerRaw !== 'string') continue;

    const dateMatch = headerRaw.match(/(\d{2}\/\d{2}\/\d{4})/);
    const weightMatch = headerRaw.match(/משקל\s*(\d+)/);
    
    let subject = "כללי";
    let teacher = "";
    let assignment = "מטלה";

    const parts = headerRaw.split('[');
    if (parts.length > 0) {
        const firstPart = parts[0].trim().split(' ');
        if (firstPart.length > 0) subject = firstPart[0];
        if (firstPart.length > 1) teacher = firstPart.slice(1).join(' ');
    }
    
    if (parts.length > 1) {
        const details = parts[1].split(']')[1] || '';
        assignment = details.replace(/(\d{2}\/\d{2}\/\d{4})|משקל\s*\d+/g, '').trim();
        if (!assignment) assignment = "מטלה";
    }

    headerMeta[c] = {
      subject: subject,
      teacher: teacher,
      assignment: assignment,
      date: dateMatch ? parseDate(dateMatch[0])! : new Date(),
      weight: weightMatch ? parseInt(weightMatch[1]) : 1
    };
  }

  for (let i = gradesHeaderIndex + 1; i < gradesData.length; i++) {
    const row = gradesData[i];
    if (!row || row.length < 2) continue;

    const idIndex = gradeHeaders.findIndex((h: any) => typeof h === 'string' && h.includes('ת.ז'));
    const nameIndex = gradeHeaders.findIndex((h: any) => typeof h === 'string' && h.includes('שם התלמיד'));
    
    const actualIdIndex = idIndex > -1 ? idIndex : 1;
    const actualNameIndex = nameIndex > -1 ? nameIndex : 2;

    const rawId = row[actualIdIndex];
    if (!rawId) continue;
    const studentId = String(rawId).trim();
    const studentName = row[actualNameIndex];

    for (let c = startColIndex; c < row.length; c++) {
      if (!headerMeta[c]) continue;

      const scoreVal = row[c];
      if (scoreVal === undefined || scoreVal === '' || scoreVal === null) continue;

      const score = parseFloat(scoreVal);
      if (isNaN(score)) continue;

      grades.push({
        studentId,
        studentName,
        score,
        ...headerMeta[c]
      });
    }
  }

  // --- Merge ---
  const studentsMap = new Map<string, Student>();
  const uniqueStudentIds = Array.from(new Set([...events.map(e => e.studentId), ...grades.map(g => g.studentId)]));

  uniqueStudentIds.forEach(id => {
    const sEvents = events.filter(e => e.studentId === id).sort((a,b) => a.date.getTime() - b.date.getTime());
    const sGrades = grades.filter(g => g.studentId === id).sort((a,b) => a.date.getTime() - b.date.getTime());
    const name = sEvents[0]?.studentName || sGrades[0]?.studentName || "תלמיד לא ידוע";
    const raw: Pick<Student, 'id' | 'name' | 'grades' | 'behaviorEvents'> = {
      id,
      name,
      grades: sGrades,
      behaviorEvents: sEvents,
    };
    studentsMap.set(id, calculateStudentStats(raw, DEFAULT_RISK_SETTINGS));
  });

  return Array.from(studentsMap.values());
};

/**
 * מחשבת מחדש את כל הסטטיסטיקות של תלמיד (ממוצע, מגמות, סיכון, קורלציות)
 * לפי grades ו-behaviorEvents הנוכחיים והגדרות הסיכון.
 * פונקציה טהורה – מתאימה לעדכון אחרי עריכה ידנית או שינוי הגדרות.
 */
export function calculateStudentStats(
  student: Pick<Student, 'id' | 'name' | 'grades' | 'behaviorEvents'>,
  settings: RiskSettings = DEFAULT_RISK_SETTINGS
): Student {
  const sGrades = [...student.grades].sort((a, b) => a.date.getTime() - b.date.getTime());
  const sEvents = [...student.behaviorEvents].sort((a, b) => a.date.getTime() - b.date.getTime());

  const totalWeight = sGrades.reduce((sum, g) => sum + g.weight, 0);
  const weightedSum = sGrades.reduce((sum, g) => sum + g.score * g.weight, 0);
  const average =
    totalWeight > 0
      ? weightedSum / totalWeight
      : sGrades.length > 0
        ? sGrades.reduce((a, b) => a + b.score, 0) / sGrades.length
        : 0;

  const negativeCount = sEvents.filter((e) => e.category === EventType.NEGATIVE).length;
  const positiveCount = sEvents.filter((e) => e.category === EventType.POSITIVE).length;
  const absenceCount = sEvents.filter((e) => isAbsenceEvent(e)).length;

  let gradeTrend: 'improving' | 'declining' | 'stable' = 'stable';
  let gradeDelta = 0;
  if (sGrades.length >= 2) {
    const recentGrades = sGrades.slice(-6);
    const mid = Math.floor(recentGrades.length / 2);
    const prevHalf = recentGrades.slice(0, mid);
    const currHalf = recentGrades.slice(mid);
    const avgPrev = prevHalf.length > 0 ? prevHalf.reduce((s, g) => s + g.score, 0) / prevHalf.length : 0;
    const avgCurr = currHalf.length > 0 ? currHalf.reduce((s, g) => s + g.score, 0) / currHalf.length : 0;
    gradeDelta = avgCurr - avgPrev;
    if (gradeDelta > 3) gradeTrend = 'improving';
    else if (gradeDelta < -3) gradeTrend = 'declining';
  }

  let behaviorTrend: 'improving' | 'declining' | 'stable' = 'stable';
  let recentBehaviorScore = 0;
  if (sEvents.length >= 2) {
    const recentEvents = sEvents.slice(-12);
    const mid = Math.floor(recentEvents.length / 2);
    const prevHalf = recentEvents.slice(0, mid);
    const currHalf = recentEvents.slice(mid);
    const getScore = (e: BehaviorEvent) => {
      if (e.category === EventType.POSITIVE) return 1;
      if (e.category === EventType.NEGATIVE) return -2;
      return 0;
    };
    const scoreCurr = currHalf.reduce((sum, e) => sum + getScore(e), 0);
    const scorePrev = prevHalf.reduce((sum, e) => sum + getScore(e), 0);
    const behaviorDelta = scoreCurr - scorePrev;
    recentBehaviorScore = scoreCurr;
    if (scoreCurr <= -6 && behaviorDelta <= 0) behaviorTrend = 'declining';
    else {
      if (behaviorDelta >= 2) behaviorTrend = 'improving';
      else if (behaviorDelta <= -2) behaviorTrend = 'declining';
    }
  }

  const minGT = settings.minGradeThreshold;
  const maxNB = settings.maxNegativeBehaviors;
  const attThr = settings.attendanceThreshold;

  let score = 10;
  if (average < minGT) score -= 4;
  else if (average < minGT + 10) score -= 2;
  else if (average < minGT + 20) score -= 1;
  if (gradeTrend === 'declining') {
    if (gradeDelta <= -10) score -= 2;
    else score -= 1;
  }
  if (gradeTrend === 'improving') score += 0.5;
  if (recentBehaviorScore <= -12) score -= 4;
  else if (recentBehaviorScore <= -6) score -= 2;
  else if (recentBehaviorScore < 0) score -= 1;
  if (behaviorTrend === 'declining') score -= 1;
  if (behaviorTrend === 'improving') score += 0.3;
  if (negativeCount > 15) score -= 2;
  else if (negativeCount > maxNB) score -= 1;
  if (absenceCount >= attThr) score -= 2;
  else if (absenceCount >= Math.max(1, attThr - 1)) score -= 0.5;
  score = Math.max(1, Math.min(10, score));
  score = Math.round(score * 10) / 10;

  let riskLevel: 'high' | 'medium' | 'low';
  if (score <= 4) riskLevel = 'high';
  else if (score <= 7) riskLevel = 'medium';
  else riskLevel = 'low';

  const correlations: Correlation[] = [];
  sGrades.filter((g) => g.score < 70).forEach((grade) => {
    const nearby = sEvents.filter((e) => {
      const diff = Math.abs(differenceInDays(grade.date, e.date));
      return diff <= 4 && e.category === EventType.NEGATIVE;
    });
    if (nearby.length > 0) {
      correlations.push({
        date: grade.date,
        grade,
        nearbyEvents: nearby,
        description: `נכשל ב${grade.subject} (${grade.score}) בסמיכות ל-${nearby.length} אירועי משמעת.`,
      });
    }
  });

  return {
    ...student,
    grades: sGrades,
    behaviorEvents: sEvents,
    averageScore: parseFloat(average.toFixed(1)),
    negativeCount,
    positiveCount,
    gradeTrend,
    behaviorTrend,
    riskLevel,
    riskScore: score,
    correlations,
  };
}

/** Compute student stats from given grades and behavior events (e.g. date-filtered). Used for period comparison. */
export interface StudentStatsResult {
  averageScore: number;
  negativeCount: number;
  positiveCount: number;
  gradeTrend: 'improving' | 'declining' | 'stable';
  behaviorTrend: 'improving' | 'declining' | 'stable';
  riskLevel: 'high' | 'medium' | 'low';
  riskScore: number;
}

export function computeStudentStatsFromData(
  grades: Grade[],
  behaviorEvents: BehaviorEvent[],
  settings: RiskSettings = DEFAULT_RISK_SETTINGS
): StudentStatsResult {
  const raw: Pick<Student, 'id' | 'name' | 'grades' | 'behaviorEvents'> = {
    id: '',
    name: '',
    grades,
    behaviorEvents,
  };
  const full = calculateStudentStats(raw, settings);
  return {
    averageScore: full.averageScore,
    negativeCount: full.negativeCount,
    positiveCount: full.positiveCount,
    gradeTrend: full.gradeTrend,
    behaviorTrend: full.behaviorTrend,
    riskLevel: full.riskLevel,
    riskScore: full.riskScore,
  };
}

export const generateSampleData = () => {
  const behaviorCSV = `
IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE
IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE
מס',שם המורה,מקצוע,תאריך,שיעור,נושא,ת.ז,שם התלמיד,שכבה,כיתה,סוג האירוע,הצדקה,הוצדק ע"י,הערה
1,רבקה כהן,מתמטיקה,01/09/2024,1,אלגברה,123456789,ישראל ישראלי,ח,1,הגעה בזמן,ללא הערות,,
2,דוד לוי,היסטוריה,05/09/2024,3,מלה"ע 2,123456789,ישראל ישראלי,ח,1,פטפוט,ללא הערות,,הפריע למהלך התקין
3,רבקה כהן,מתמטיקה,10/09/2024,2,גיאומטריה,987654321,דניאל כהן,ח,1,מילה טובה,ללא הערות,,השתתפות מעולה
4,שרה אברהם,אנגלית,12/09/2024,4,Vocabulary,123456789,ישראל ישראלי,ח,1,אי הכנת שיעור בית,ללא הערות,,
5,רבקה כהן,מתמטיקה,15/09/2024,1,מבחן,123456789,ישראל ישראלי,ח,1,שוטטות,ללא הערות,,יצא ללא אישור
`.trim();

  const gradesCSV = `
IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE
IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE,IGNORE
מס',ת.ז,שם התלמיד,שכבה,כיתה,שליליים,"מתמטיקה רבקה כהן [101] בחן 1 02/09/2024 משקל 10","היסטוריה דוד לוי [102] עבודה 06/09/2024 משקל 20","אנגלית שרה אברהם [103] מבחן מחצית 14/09/2024 משקל 30"
1,123456789,ישראל ישראלי,ח,1,2,55,80,60
2,987654321,דניאל כהן,ח,1,0,95,90,88
`.trim();

  return { behaviorCSV, gradesCSV };
};