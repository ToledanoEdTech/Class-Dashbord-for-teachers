import { BehaviorEvent, EventType, Grade, Student, Correlation, RiskSettings, DEFAULT_RISK_SETTINGS, DEFAULT_RISK_WEIGHTS, type TrendDirection, type TrendDetails, type RateComparison } from '../types';
export type { TrendDirection };
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

/**
 * מנרמל שם מורה: אם מופיע תג הקבצה/מקצוע בתחילה (למשל "א1 רבקה גורדון") מחזיר רק "רבקה גורדון".
 * כך מורים שמופיעים בהקבצות שונות יזוהו כאותו מורה.
 * שומרים על תואר "הרב" / "הרבנית" וכו' אם הוא קיים – זה חלק מזיהוי המורה.
 */
const normalizeTeacherName = (raw: string): string => {
  const t = (raw || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  // אם מופיע תואר "הרב"/"הרבנית"/וכו' – נחזיר אותו ואת מה שאחריו (התואר + שם המורה)
  const titleMatch = t.match(/(?:^|\s)(הרבנית|הרב|רב|הרה"ג|הגאון)\s+\S+/);
  if (titleMatch && titleMatch.index !== undefined) {
    return t.substring(titleMatch.index).trim();
  }
  const words = t.split(' ').filter(Boolean);
  if (words.length >= 3) return words.slice(-2).join(' ');
  return t;
};

/**
 * Clean subject labels – מחזיר רק את שם המקצוע (למשל "אנגלית")
 * בלי שם המורה/הרב/הקבצה (לא "אנגלית ב1 הרב נגאוקר אבינעם").
 */
export const normalizeSubjectName = (raw: string): string => {
  const withComma = (raw || '').trim().replace(/\s+/g, ' ');
  let clean = withComma.includes(',') ? withComma.split(',')[0].trim().replace(/\s+/g, ' ') : withComma;
  if (!clean) return 'כללי';
  // אם מופיע "הרב" / "רב" / "הרבנית" / "הרה"ג" כתואר של המורה –
  // לוקחים רק את החלק שלפניהם (מקצוע + אולי הקבצה).
  // התואר יכול להופיע באמצע (לפני שם המורה: "אנגלית הרב נגאוקר") או בסוף
  // (אם שם המורה כבר הוסר במקום אחר ונשאר רק "עברית הרב").
  const rabbiMatch = clean.match(/\s+(הרבנית|הרב|רב|הרה"ג|הגאון)(\s|$)/);
  if (rabbiMatch && rabbiMatch.index !== undefined) {
    clean = clean.substring(0, rabbiMatch.index).trim();
    if (!clean) return 'כללי';
  }
  let words = clean.split(' ').filter(Boolean);
  if (words.length <= 1) return clean;
  // אם יש 3+ מילים בלי שחתכנו לפי הרב – שתי המילים האחרונות = מורה
  if (words.length >= 3 && !rabbiMatch) {
    clean = words.slice(0, -2).join(' ');
    if (!clean) return 'כללי';
  }
  // להסיר הקבצה בסוף (א1, ב1, א2 וכו')
  let subjectCandidate = clean;
  let last: string;
  for (;;) {
    const w = subjectCandidate.split(' ').filter(Boolean);
    if (w.length <= 1) break;
    last = w[w.length - 1];
    const isGroupTail = /^[א-ת]\d{0,2}$/i.test(last) || /^[a-z]\d{1,2}$/i.test(last);
    if (!isGroupTail) break;
    subjectCandidate = w.slice(0, -1).join(' ') || 'כללי';
    if (!subjectCandidate) return 'כללי';
  }
  return subjectCandidate || 'כללי';
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
    const subjectFinal = s && !/^\d+$/.test(s) ? normalizeSubjectName(s) : 'כללי';
    const rawTeacher = (row[col.teacher] ?? '') as string;
    const teacherNormalized = normalizeTeacherName(rawTeacher) || rawTeacher.trim();

    events.push({
      id: `evt-${i}`,
      studentId: studentId,
      studentName: (row[col.studentName] ?? 'Unknown') as string,
      date: date,
      teacher: teacherNormalized,
      subject: subjectFinal,
      lessonNumber: parseInt(row[col.lessonNumber] as any) || 0,
      type: eventTypeStr,
      category: categorizeEvent(eventTypeStr, justificationStr),
      justification: justificationStr,
      comment: (row[col.comment] ?? '') as string
    });
  }

  // --- Process Grades Data ---
  // שורת הכותרת: מכילה "שם התלמיד" בעמודות האישיות
  let gradesHeaderIndex = gradesData.findIndex(row => row.some(cell => typeof cell === 'string' && cell.includes('שם התלמיד')));
  if (gradesHeaderIndex === -1) gradesHeaderIndex = 2;

  const gradeHeaders = gradesData[gradesHeaderIndex];
  const grades: Grade[] = [];
  let startColIndex = 6;

  // === DEBUG: הדפסת מבנה הנתונים כדי לזהות פורמט ===
  console.log('=== GRADES DEBUG START ===');
  console.log('gradesHeaderIndex:', gradesHeaderIndex);
  console.log('Total rows in gradesData:', gradesData.length);
  console.log('Header row length:', gradeHeaders.length);
  // הדפסת 5 שורות סביב הכותרת
  for (let r = Math.max(0, gradesHeaderIndex - 1); r < Math.min(gradesData.length, gradesHeaderIndex + 5); r++) {
    const row = gradesData[r];
    if (!row) continue;
    const sample: Record<string, any> = {};
    for (let c = 0; c < Math.min(row.length, 10); c++) {
      const val = row[c];
      const s = String(val ?? '').substring(0, 80);
      sample[`col${c}`] = s + (String(val ?? '').length > 80 ? '...' : '');
    }
    console.log(`Row ${r}${r === gradesHeaderIndex ? ' [HEADER]' : ''}:`, JSON.stringify(sample));
  }
  // הדפסת 3 תאים מעמודות ציונים
  for (let c = startColIndex; c < Math.min(gradeHeaders.length, startColIndex + 3); c++) {
    const raw = gradeHeaders[c];
    console.log(`Header col ${c} type:`, typeof raw, '| hasNewline:', typeof raw === 'string' && /\n/.test(raw), '| value:', JSON.stringify(String(raw ?? '').substring(0, 200)));
  }
  console.log('=== GRADES DEBUG END ===');

  // === זיהוי פורמט: האם כותרות הציונים מכילות \n (תא אחד) או שהן בשורות נפרדות ===
  let headerHasNewlines = false;
  for (let c = startColIndex; c < gradeHeaders.length; c++) {
    const h = gradeHeaders[c];
    if (h && typeof h === 'string' && /\n/.test(h)) {
      headerHasNewlines = true;
      break;
    }
  }

  // אם אין newlines בתאים — בדוק אם השורה הבאה היא שורת שמות מטלות (טקסט, לא מספרים)
  let assignmentRow: any[] | null = null;
  let weightRow: any[] | null = null;
  let dataStartIndex: number;

  if (headerHasNewlines) {
    // כל המידע בתא אחד עם \n — נתונים מתחילים מיד אחרי שורת הכותרת
    dataStartIndex = gradesHeaderIndex + 1;
  } else {
    // בדוק אם שורת gradesHeaderIndex+1 מכילה שמות מטלות (טקסט) ולא ציונים (מספרים)
    const candidateAssignmentRow = gradesData[gradesHeaderIndex + 1];
    let nextRowHasText = false;
    if (candidateAssignmentRow) {
      for (let c = startColIndex; c < Math.min(candidateAssignmentRow.length, gradeHeaders.length); c++) {
        const val = candidateAssignmentRow[c];
        const s = String(val ?? '').trim();
        // אם יש תא עם טקסט שאינו רק מספר — זו שורת מטלות
        if (s && !/^\d+(\.\d+)?$/.test(s) && !/^$/.test(s)) {
          nextRowHasText = true;
          break;
        }
      }
    }

    if (nextRowHasText) {
      assignmentRow = candidateAssignmentRow;
      // בדוק אם השורה אחריה היא שורת משקלים (מכילה "משקל")
      const candidateWeightRow = gradesData[gradesHeaderIndex + 2];
      let hasWeightRow = false;
      if (candidateWeightRow) {
        for (let c = startColIndex; c < Math.min(candidateWeightRow.length, gradeHeaders.length); c++) {
          const val = candidateWeightRow[c];
          const s = String(val ?? '').trim();
          if (/משקל/.test(s)) {
            hasWeightRow = true;
            break;
          }
        }
      }
      weightRow = hasWeightRow ? candidateWeightRow : null;
      dataStartIndex = gradesHeaderIndex + (hasWeightRow ? 3 : 2);
    } else {
      dataStartIndex = gradesHeaderIndex + 1;
    }
  }

  console.log('=== FORMAT DETECTION ===');
  console.log('headerHasNewlines:', headerHasNewlines);
  console.log('assignmentRow found:', assignmentRow !== null);
  console.log('weightRow found:', weightRow !== null);
  console.log('dataStartIndex:', dataStartIndex);
  if (assignmentRow) {
    for (let c = startColIndex; c < Math.min(assignmentRow.length, startColIndex + 3); c++) {
      console.log(`AssignmentRow col ${c}:`, JSON.stringify(String(assignmentRow[c] ?? '')));
    }
  }

  // === פענוח כל עמודת ציון ===
  const headerMeta: Record<number, { subject: string, teacher: string, assignment: string, date: Date | null, weight: number, dateIsInferred: boolean }> = {};

  for (let c = startColIndex; c < gradeHeaders.length; c++) {
    const headerRaw = gradeHeaders[c];
    if (headerRaw == null) continue;

    let subjectLine = '';
    let assignmentLine = '';
    let weightLine = '';

    if (headerHasNewlines) {
      // פורמט A: תא אחד עם \n — מפצלים ל-3 שורות
      const lines = String(headerRaw).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      subjectLine = lines[0] || '';
      assignmentLine = lines[1] || '';
      weightLine = lines[2] || '';
    } else {
      // פורמט B: כותרות מפוזרות בשורות נפרדות
      subjectLine = String(headerRaw ?? '').trim();
      assignmentLine = assignmentRow ? String(assignmentRow[c] ?? '').trim() : '';
      weightLine = weightRow ? String(weightRow[c] ?? '').trim() : '';
    }

    // --- חילוץ מקצוע ומורה מ-subjectLine ---
    // דוגמה: "אנגלית א1 רבקה גורדון [71]"  או  "גמרא הרב נגאוקר אבינעם [71]"
    const subjectClean = subjectLine.replace(/\s*\[\d+\]\s*$/, '').trim();
    let subject = 'כללי';
    let teacher = '';
    // אם מופיע תואר "הרב" / "הרבנית" וכו' – הכל ממנו והלאה הוא שם המורה (כולל התואר),
    // וכל מה שלפני התואר הוא המקצוע (ואולי הקבצה).
    const rabbiTitleMatch = subjectClean.match(/\s+(הרבנית|הרב|רב|הרה"ג|הגאון)(\s|$)/);
    if (rabbiTitleMatch && rabbiTitleMatch.index !== undefined) {
      subject = subjectClean.substring(0, rabbiTitleMatch.index).trim();
      teacher = subjectClean.substring(rabbiTitleMatch.index).trim();
    } else {
      const words = subjectClean ? subjectClean.split(/\s+/).filter(Boolean) : [];
      if (words.length >= 3) {
        teacher = words.slice(-2).join(' ');
        subject = words.slice(0, -2).join(' ');
      } else if (words.length === 2) {
        teacher = words[1];
        subject = words[0];
      } else if (words.length === 1) {
        subject = words[0];
      }
    }

    // --- חילוץ שם מטלה ותאריך מ-assignmentLine ---
    // דוגמה: "Quiz 1- p17 28/09/2025"
    const dateMatch = assignmentLine.match(/(\d{2}\/\d{2}\/\d{4})/);
    let assignment = assignmentLine
      .replace(/\s*\d{2}\/\d{2}\/\d{4}\s*$/, '')
      .trim();
    if (!assignment || /^\d+$/.test(assignment)) assignment = '';

    // --- חילוץ משקל מ-weightLine ---
    // דוגמה: "משקל 45" או פשוט "45"
    const weightMatch = weightLine.match(/משקל\s*(\d+)/) || weightLine.match(/^(\d+)$/);
    const parsedDate = dateMatch ? parseDate(dateMatch[0]) : null;

    headerMeta[c] = {
      subject: normalizeSubjectName(subject || 'כללי'),
      teacher: teacher.trim(),
      assignment: assignment || `אירוע ${c - startColIndex + 1}`,
      date: parsedDate,
      weight: weightMatch ? parseInt(weightMatch[1]) : 1,
      dateIsInferred: !parsedDate
    };
  }

  // עמודה בלי תאריך לא מקבלת "היום" — אחרת היא נראית כמו הציון האחרון.
  // אם יש עמודות מתוארכות, משחזרים תאריך ביניהן. אם אין בכלל, התאריך נשאר ריק.
  const metaCols = Object.keys(headerMeta).map(Number).sort((a, b) => a - b);
  const datedCols = metaCols.filter((col) => headerMeta[col].date && !headerMeta[col].dateIsInferred);
  for (const col of metaCols) {
    if (!headerMeta[col].dateIsInferred && headerMeta[col].date) continue;
    const prev = [...datedCols].reverse().find((k) => k < col);
    const next = datedCols.find((k) => k > col);
    if (prev != null && next != null) {
      const span = next - prev;
      const frac = span === 0 ? 0 : (col - prev) / span;
      const t0 = headerMeta[prev].date!.getTime();
      const t1 = headerMeta[next].date!.getTime();
      headerMeta[col].date = new Date(t0 + frac * (t1 - t0));
    } else if (prev != null) {
      headerMeta[col].date = new Date(headerMeta[prev].date!);
    } else if (next != null) {
      headerMeta[col].date = new Date(headerMeta[next].date!);
    } else {
      headerMeta[col].date = new Date(0);
    }
  }

  for (let i = dataStartIndex; i < gradesData.length; i++) {
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

      const meta = headerMeta[c];
      grades.push({
        studentId,
        studentName,
        score,
        subject: meta.subject,
        teacher: meta.teacher,
        assignment: meta.assignment,
        date: meta.date ?? new Date(0),
        weight: meta.weight,
        dateIsInferred: meta.dateIsInferred
      });
    }
  }

  // --- Merge ---
  const studentsMap = new Map<string, Student>();
  const uniqueStudentIds = Array.from(new Set([...events.map(e => e.studentId), ...grades.map(g => g.studentId)]));

  const classContext = buildTrendContext([{ grades, behaviorEvents: events }]);

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
    studentsMap.set(id, calculateStudentStats(raw, DEFAULT_RISK_SETTINGS, classContext));
  });

  return Array.from(studentsMap.values());
};

/**
 * ממוצע משוקלל של אירועי ציון: סכום(ציון × משקל) / סכום המשקלים.
 * אם סכום המשקלים הוא 0, חוזרים לממוצע פשוט. מערך ריק מחזיר 0.
 */
export function weightedGradeAverage(grades: ReadonlyArray<{ score: number; weight?: number }>): number {
  if (grades.length === 0) return 0;
  let totalWeight = 0;
  let weightedSum = 0;
  let scoreSum = 0;
  for (const g of grades) {
    const w = Number(g.weight) || 0;
    totalWeight += w;
    weightedSum += g.score * w;
    scoreSum += g.score;
  }
  if (totalWeight > 0) return weightedSum / totalWeight;
  return scoreSum / grades.length;
}

// --- מגמות ---
//
// כל המגמות עונות על אותה שאלה: "האם בתקופה האחרונה המצב שונה מהרגיל אצל התלמיד הזה?"
// החלון האחרון הוא 4 השבועות האחרונים של הטווח המוצג (או חציו, בטווח קצר),
// והבסיס הוא עד 12 שבועות שלפניו. חיסורים ואירועים נמדדים כקצב לימי לימוד,
// כך שחופשה בחלון האחרון לא נראית כשיפור, ושבוע עמוס לא נראה כהידרדרות.

/** עד 3 נקודות נשאר יציב. מעבר לזה ירידה מתונה, ומעבר ל-8 ירידה חדה. */
const GRADE_MODERATE_DROP = 3;
const GRADE_SHARP_DROP = 8;
const RECENT_WINDOW_DAYS = 28;
const BASELINE_MAX_DAYS = 84;
const MIN_TREND_SPAN_DAYS = 10;
const MIN_SCHOOL_DAYS_PER_WINDOW = 3;

/**
 * ספי הפרש (באירועים מעבר לצפוי) לירידה מתונה וחדה. חיסורים נרשמים לפי שיעור,
 * כך שיום מחלה אחד (~6 שיעורים) הוא ירידה מתונה, וחדה רק מעבר ליום שלם.
 */
const ABSENCE_THRESHOLDS = { moderate: 2, sharp: 8 };
const NEGATIVE_THRESHOLDS = { moderate: 2, sharp: 5 };
const POSITIVE_GAIN_FOR_IMPROVEMENT = 3;

export interface TrendContext {
  /** תחילת הטווח המוצג. */
  start: Date;
  /** סוף הטווח — עד התאריך האחרון שיש בו נתונים. */
  end: Date;
  /** ימים (yyyy-mm-dd) שבהם נרשם משהו בכיתה — מקרב את ימי הלימודים בפועל. */
  schoolDays?: ReadonlySet<string>;
}

interface TrendWindows {
  baselineStart: Date;
  recentStart: Date;
  end: Date;
  lastWeekStart: Date | null;
  baselineSchoolDays: number;
  recentSchoolDays: number;
  lastWeekSchoolDays: number;
  recentCalendarDays: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const addLocalDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

const hasRealDate = (date: Date | undefined | null): date is Date => !!date && date.getTime() > 0;

/**
 * ימי לימוד של הכיתה: כל יום שבו נרשם אירוע לתלמיד כלשהו.
 * ביום לימודים רגיל נרשמים אירועים (נוכחות, הערות), בחופשה לא.
 */
export function buildSchoolDays(students: ReadonlyArray<Pick<Student, 'behaviorEvents'>>): Set<string> {
  const days = new Set<string>();
  for (const student of students) {
    for (const event of student.behaviorEvents) {
      if (hasRealDate(event.date)) days.add(dayKey(event.date));
    }
  }
  return days;
}

/** הקשר מגמה לכיתה: הטווח (ברירת מחדל: כל הנתונים) וימי הלימוד. */
export function buildTrendContext(
  students: ReadonlyArray<Pick<Student, 'grades' | 'behaviorEvents'>>,
  range?: { start?: Date; end?: Date }
): TrendContext | undefined {
  let min = Infinity;
  let max = -Infinity;
  for (const student of students) {
    for (const event of student.behaviorEvents) {
      if (!hasRealDate(event.date)) continue;
      min = Math.min(min, event.date.getTime());
      max = Math.max(max, event.date.getTime());
    }
    for (const grade of student.grades) {
      if (!hasRealDate(grade.date)) continue;
      min = Math.min(min, grade.date.getTime());
      max = Math.max(max, grade.date.getTime());
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  const start = range?.start && range.start.getTime() > min ? range.start : new Date(min);
  const end = range?.end && range.end.getTime() < max ? range.end : new Date(max);
  if (end < start) return undefined;
  return { start, end, schoolDays: buildSchoolDays(students) };
}

function countSchoolDays(context: TrendContext, from: Date, toExclusive: Date): number {
  let count = 0;
  for (let day = startOfLocalDay(from); day < toExclusive; day = addLocalDays(day, 1)) {
    if (context.schoolDays && context.schoolDays.size > 0) {
      if (context.schoolDays.has(dayKey(day))) count += 1;
    } else {
      const weekday = day.getDay();
      if (weekday !== 5 && weekday !== 6) count += 1;
    }
  }
  return count;
}

function trendWindows(context: TrendContext): TrendWindows | null {
  const start = startOfLocalDay(context.start);
  const endDay = startOfLocalDay(context.end);
  const end = endOfLocalDay(context.end);
  const spanDays = Math.round((endDay.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  if (spanDays < MIN_TREND_SPAN_DAYS) return null;

  const recentCalendarDays = spanDays >= RECENT_WINDOW_DAYS * 2 ? RECENT_WINDOW_DAYS : Math.floor(spanDays / 2);
  const recentStart = addLocalDays(endDay, -(recentCalendarDays - 1));
  const earliestBaseline = addLocalDays(recentStart, -BASELINE_MAX_DAYS);
  const baselineStart = earliestBaseline > start ? earliestBaseline : start;
  const afterEnd = addLocalDays(endDay, 1);

  const baselineSchoolDays = countSchoolDays(context, baselineStart, recentStart);
  const recentSchoolDays = countSchoolDays(context, recentStart, afterEnd);
  if (baselineSchoolDays < MIN_SCHOOL_DAYS_PER_WINDOW || recentSchoolDays < MIN_SCHOOL_DAYS_PER_WINDOW) return null;

  const lastWeekStart = recentCalendarDays >= 14 ? addLocalDays(endDay, -6) : null;
  const lastWeekSchoolDays = lastWeekStart ? countSchoolDays(context, lastWeekStart, afterEnd) : 0;

  return {
    baselineStart,
    recentStart,
    end,
    lastWeekStart,
    baselineSchoolDays,
    recentSchoolDays,
    lastWeekSchoolDays,
    recentCalendarDays,
  };
}

interface RateDetail {
  recent: number;
  expected: number;
  lastWeek: number | null;
  lastWeekExpected: number | null;
}

function compareRate(dates: readonly Date[], windows: TrendWindows): RateDetail {
  let baseline = 0;
  let recent = 0;
  let lastWeek = 0;
  for (const date of dates) {
    if (date < windows.baselineStart || date > windows.end) continue;
    if (date < windows.recentStart) {
      baseline += 1;
      continue;
    }
    recent += 1;
    if (windows.lastWeekStart && date >= windows.lastWeekStart) lastWeek += 1;
  }
  const perDay = baseline / windows.baselineSchoolDays;
  const hasLastWeek = !!windows.lastWeekStart && windows.lastWeekSchoolDays > 0;
  return {
    recent,
    expected: perDay * windows.recentSchoolDays,
    lastWeek: hasLastWeek ? lastWeek : null,
    lastWeekExpected: hasLastWeek ? perDay * windows.lastWeekSchoolDays : null,
  };
}

/**
 * מסווג אירועים "רעים" (חיסורים, אירועים שליליים): כמה מעבר לצפוי, ובכמה פעמים.
 * הפרש קטן נשאר יציב גם אם היחס גבוה (1 מול 0), ויחס קטן נשאר יציב גם אם ההפרש גדול
 * (15 מול 13). שבוע אחרון חריג מונע "שיפור" ומעלה לפחות לירידה מתונה.
 */
function classifyAdverse(detail: RateDetail, thresholds: { moderate: number; sharp: number }): TrendDirection {
  const { recent, expected } = detail;
  const excess = recent - expected;
  let trend: TrendDirection = 'stable';
  if (excess >= thresholds.sharp && recent >= expected * 2) trend = 'sharp_decline';
  else if (excess >= thresholds.moderate && recent >= expected * 1.5) trend = 'moderate_decline';

  let lastWeekSpike = false;
  if (detail.lastWeek != null && detail.lastWeekExpected != null) {
    const spike = detail.lastWeek - detail.lastWeekExpected;
    const spikeRatio = detail.lastWeek >= detail.lastWeekExpected * 2;
    if (spike >= thresholds.moderate && spikeRatio) lastWeekSpike = true;
    if (spikeRatio && spike >= thresholds.sharp * 2) trend = 'sharp_decline';
    else if (spikeRatio && spike >= thresholds.sharp && trend === 'stable') trend = 'moderate_decline';
  }

  if (trend === 'stable' && !lastWeekSpike) {
    const drop = expected - recent;
    if (drop >= thresholds.moderate && recent <= expected * 0.6) trend = 'improving';
  }
  return trend;
}

function roundDetail(detail: RateDetail): RateComparison {
  return { recent: detail.recent, expected: Math.round(detail.expected * 10) / 10 };
}

/** הצירוף של שתי מגמות: הירידה החמורה גוברת, ושיפור רק אם אין ירידה. */
function combineTrends(a: TrendDirection, b: TrendDirection): TrendDirection {
  if (a === 'sharp_decline' || b === 'sharp_decline') return 'sharp_decline';
  if (a === 'moderate_decline' || b === 'moderate_decline') return 'moderate_decline';
  if (a === 'improving' || b === 'improving') return 'improving';
  return 'stable';
}

export interface StudentTrends {
  gradeTrend: TrendDirection;
  gradeDelta: number;
  absenceTrend: TrendDirection;
  behaviorOnlyTrend: TrendDirection;
  behaviorTrend: TrendDirection;
  details: TrendDetails;
}

function defaultTrendContext(grades: readonly Grade[], events: readonly BehaviorEvent[]): TrendContext | undefined {
  return buildTrendContext([{ grades: [...grades], behaviorEvents: [...events] }]);
}

/**
 * חיסורים והתנהגות: חלון אחרון מול הקצב הרגיל של התלמיד, לפי ימי לימוד.
 * ציונים: בכל מקצוע הציונים האחרונים מול הקודמים (ראו gradeTrendForGrades).
 */
export function computeStudentTrends(
  grades: readonly Grade[],
  events: readonly BehaviorEvent[],
  context?: TrendContext
): StudentTrends {
  const grade = gradeTrendForGrades(grades);
  const ctx = context ?? defaultTrendContext(grades, events);
  const windows = ctx ? trendWindows(ctx) : null;
  const details: TrendDetails = {
    recentDays: windows?.recentCalendarDays ?? 0,
    grades: grade.recentAverage != null && grade.previousAverage != null
      ? { delta: grade.delta, recentAverage: grade.recentAverage, previousAverage: grade.previousAverage }
      : undefined,
  };

  if (!windows) {
    return {
      gradeTrend: grade.trend,
      gradeDelta: grade.delta,
      absenceTrend: 'stable',
      behaviorOnlyTrend: 'stable',
      behaviorTrend: 'stable',
      details,
    };
  }

  const datesOf = (predicate: (e: BehaviorEvent) => boolean) =>
    events.filter((e) => hasRealDate(e.date) && predicate(e)).map((e) => e.date);
  const absences = compareRate(datesOf(isAbsenceEvent), windows);
  const negatives = compareRate(
    datesOf((e) => e.category === EventType.NEGATIVE && !isAbsenceEvent(e)),
    windows
  );
  const positives = compareRate(datesOf((e) => e.category === EventType.POSITIVE), windows);

  const absenceTrend = classifyAdverse(absences, ABSENCE_THRESHOLDS);
  let behaviorOnlyTrend = classifyAdverse(negatives, NEGATIVE_THRESHOLDS);
  if (behaviorOnlyTrend === 'stable') {
    const gain = positives.recent - positives.expected;
    if (gain >= POSITIVE_GAIN_FOR_IMPROVEMENT && positives.recent >= positives.expected * 1.5) {
      behaviorOnlyTrend = 'improving';
    }
  }

  details.absences = roundDetail(absences);
  details.negatives = roundDetail(negatives);
  details.positives = roundDetail(positives);

  return {
    gradeTrend: grade.trend,
    gradeDelta: grade.delta,
    absenceTrend,
    behaviorOnlyTrend,
    behaviorTrend: combineTrends(absenceTrend, behaviorOnlyTrend),
    details,
  };
}

/**
 * מגמת ציונים: בכל מקצוע בנפרד, השליש האחרון של הציונים (1–3 ציונים) מול הציונים שלפניו.
 * המקצועות משוקללים לפי משקל הציונים, כך שבוחן קל לא מכריע מול מבחן.
 * מקצוע עם ציון אחד לא יוצר מגמה. ציון נמוך בודד הוא לכל היותר ירידה מתונה.
 */
export function gradeTrendForGrades(grades: readonly Grade[]): {
  trend: TrendDirection;
  delta: number;
  recentAverage?: number;
  previousAverage?: number;
} {
  const dated = grades.filter((g) => hasRealDate(g.date));
  const usable = dated.length >= 2 ? dated : grades;
  const groups = new Map<string, Grade[]>();
  for (const grade of usable) {
    const key = normalizeSubjectName((grade.subject || '').trim() || 'כללי');
    const list = groups.get(key);
    if (list) list.push(grade);
    else groups.set(key, [grade]);
  }

  let weightedDelta = 0;
  let totalWeight = 0;
  let recentGradeCount = 0;
  const recentAll: Grade[] = [];
  const previousAll: Grade[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.getTime() - b.date.getTime());
    const recentCount = Math.min(3, Math.max(1, Math.ceil(sorted.length / 3)));
    const previous = sorted.slice(0, sorted.length - recentCount);
    const recent = sorted.slice(sorted.length - recentCount);
    const weight = sorted.reduce((sum, g) => sum + (Number(g.weight) || 0), 0) || sorted.length;
    weightedDelta += (weightedGradeAverage(recent) - weightedGradeAverage(previous)) * weight;
    totalWeight += weight;
    recentGradeCount += recent.length;
    recentAll.push(...recent);
    previousAll.push(...previous);
  }

  if (totalWeight <= 0) return { trend: 'stable', delta: 0 };
  const delta = weightedDelta / totalWeight;
  let trend = trendFromGradeDelta(delta);
  if (trend === 'sharp_decline' && recentGradeCount < 2) trend = 'moderate_decline';
  return {
    trend,
    delta,
    recentAverage: weightedGradeAverage(recentAll),
    previousAverage: weightedGradeAverage(previousAll),
  };
}

function trendFromGradeDelta(delta: number): TrendDirection {
  if (delta > GRADE_MODERATE_DROP) return 'improving';
  if (delta < -GRADE_SHARP_DROP) return 'sharp_decline';
  if (delta < -GRADE_MODERATE_DROP) return 'moderate_decline';
  return 'stable';
}

/** "4 השבועות האחרונים", "השבוע האחרון" וכו' — לפי אורך החלון האחרון. */
export function recentWindowLabel(days: number): string {
  if (days === 7) return 'השבוע האחרון';
  if (days > 7 && days % 7 === 0) return `${days / 7} השבועות האחרונים`;
  return `${days} הימים האחרונים`;
}

function formatCount(value: number): string {
  if (value >= 10) return String(Math.round(value));
  return value.toFixed(1).replace(/\.0$/, '');
}

/** משפט שמסביר למורה על מה מבוססת מגמת חיסורים/אירועים. */
export function describeRateComparison(
  comparison: RateComparison | undefined,
  recentDays: number,
  noun: string
): string | null {
  if (!comparison || recentDays <= 0) return null;
  return `${recentWindowLabel(recentDays)}: ${comparison.recent} ${noun}. הקצב הרגיל של התלמיד לתקופה באותו אורך: ${formatCount(comparison.expected)}.`;
}

/** תקציר קצר מתחת לתג: "6 מול ~2 רגיל". */
export function shortRateComparison(comparison: RateComparison | undefined, recentDays: number): string | null {
  if (!comparison || recentDays <= 0) return null;
  return `${comparison.recent} מול ~${formatCount(comparison.expected)} רגיל`;
}

/** תווית בעברית לתג המגמה ולייצוא. */
export function trendLabel(trend: TrendDirection, kind: 'grade' | 'behavior'): string {
  if (trend === 'improving') return kind === 'grade' ? 'שיפור' : 'משתפר';
  if (trend === 'moderate_decline') return 'ירידה מתונה';
  if (trend === 'sharp_decline') return kind === 'grade' ? 'ירידה חדה' : 'מידרדר';
  return 'יציב';
}

/** ציון בלי תאריך מהקובץ. includeUndated שומר אותו בממוצע הכללי, אבל לא בכל חודש בנפרד. */
export function isGradeInRange(
  grade: Pick<Grade, 'date'>,
  start: Date,
  end: Date,
  includeUndated = false
): boolean {
  if (!grade.date || grade.date.getTime() === 0) return includeUndated;
  return grade.date >= start && grade.date <= end;
}

/**
 * מחשבת מחדש את כל הסטטיסטיקות של תלמיד (ממוצע, מגמות, סיכון, קורלציות)
 * לפי grades ו-behaviorEvents הנוכחיים והגדרות הסיכון.
 * פונקציה טהורה – מתאימה לעדכון אחרי עריכה ידנית או שינוי הגדרות.
 * trendContext: הטווח וימי הלימוד של הכיתה. בלעדיו המגמה מחושבת לפי נתוני התלמיד בלבד.
 */
export function calculateStudentStats(
  student: Pick<Student, 'id' | 'name' | 'grades' | 'behaviorEvents'>,
  settings: RiskSettings = DEFAULT_RISK_SETTINGS,
  trendContext?: TrendContext
): Student {
  const sGrades = [...student.grades].sort((a, b) => a.date.getTime() - b.date.getTime());
  const sEvents = [...student.behaviorEvents].sort((a, b) => a.date.getTime() - b.date.getTime());

  const average = weightedGradeAverage(sGrades);

  const negativeCount = sEvents.filter((e) => e.category === EventType.NEGATIVE).length;
  const positiveCount = sEvents.filter((e) => e.category === EventType.POSITIVE).length;
  const absenceCount = sEvents.filter((e) => isAbsenceEvent(e)).length;

  const trends = computeStudentTrends(sGrades, sEvents, trendContext);
  const { gradeTrend, gradeDelta, behaviorTrend, behaviorOnlyTrend, absenceTrend } = trends;

  let recentBehaviorScore = 0;
  if (sEvents.length >= 2) {
    const recentEvents = sEvents.slice(-12);
    const mid = Math.floor(recentEvents.length / 2);
    const currHalf = recentEvents.slice(mid);
    const getScore = (e: BehaviorEvent) => {
      if (e.category === EventType.POSITIVE) return 1;
      if (e.category === EventType.NEGATIVE) return -2;
      return 0;
    };
    recentBehaviorScore = currHalf.reduce((sum, e) => sum + getScore(e), 0);
  }

  const minGT = settings.minGradeThreshold;
  const maxNB = settings.maxNegativeBehaviors;
  const attThr = settings.attendanceThreshold;
  const weights = settings.weights ?? DEFAULT_RISK_WEIGHTS;
  const kG = Math.max(0.2, Math.min(2, (weights.grades ?? 3) / 3));
  const kA = Math.max(0.2, Math.min(2, (weights.absences ?? 3) / 3));
  const kNE = Math.max(0.2, Math.min(2, (weights.negativeEvents ?? 3) / 3));

  /** חלק הציונים: ממוצע + מגמת ציונים */
  let gradePart = 0;
  if (average < minGT) gradePart += 4;
  else if (average < minGT + 10) gradePart += 2;
  else if (average < minGT + 20) gradePart += 1;
  if (gradeTrend === 'sharp_decline') {
    if (gradeDelta <= -10) gradePart += 2;
    else gradePart += 1;
  }
  if (gradeTrend === 'improving') gradePart -= 0.5;

  /** חלק החיסורים */
  let absencePart = 0;
  if (settings.penaltyPerAbsenceAboveThreshold != null && settings.penaltyPerAbsenceAboveThreshold > 0 && absenceCount >= attThr) {
    absencePart = 2 + (absenceCount - attThr) * settings.penaltyPerAbsenceAboveThreshold;
  } else {
    if (absenceCount >= attThr) absencePart += 2;
    else if (absenceCount >= Math.max(1, attThr - 1)) absencePart += 0.5;
  }

  /** חלק אירועים שליליים + מגמת התנהגות */
  let negPart = 0;
  if (recentBehaviorScore <= -12) negPart += 4;
  else if (recentBehaviorScore <= -6) negPart += 2;
  else if (recentBehaviorScore < 0) negPart += 1;
  if (behaviorTrend === 'sharp_decline') negPart += 1;
  if (behaviorTrend === 'improving') negPart -= 0.3;
  if (negativeCount > 15) negPart += 2;
  else if (negativeCount > maxNB) negPart += 1;
  if (positiveCount > negativeCount && negativeCount > 0) negPart -= 0.2;

  let score = 10 - gradePart * kG - absencePart * kA - negPart * kNE;
  score = Math.max(1, Math.min(10, score));
  score = Math.round(score * 10) / 10;

  const highThr = settings.riskScoreHighThreshold ?? 4;
  const medThr = settings.riskScoreMediumThreshold ?? 7;
  let riskLevel: 'high' | 'medium' | 'low';
  if (score <= highThr) riskLevel = 'high';
  else if (score <= medThr) riskLevel = 'medium';
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
        description: `נכשל ב${normalizeSubjectName(grade.subject || 'כללי')} (${grade.score}) בסמיכות ל-${nearby.length} אירועי משמעת.`,
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
    absenceCount,
    gradeTrend,
    behaviorTrend,
    behaviorOnlyTrend,
    absenceTrend,
    trendDetails: trends.details,
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
  absenceCount: number;
  gradeTrend: TrendDirection;
  behaviorTrend: TrendDirection;
  behaviorOnlyTrend: TrendDirection;
  absenceTrend: TrendDirection;
  trendDetails?: TrendDetails;
  riskLevel: 'high' | 'medium' | 'low';
  riskScore: number;
  /** ציונים + אירועים שנכנסו לחלון. 0 = אין בסיס להשוואת תקופה. */
  activityCount: number;
}

export function computeStudentStatsFromData(
  grades: Grade[],
  behaviorEvents: BehaviorEvent[],
  settings: RiskSettings = DEFAULT_RISK_SETTINGS,
  trendContext?: TrendContext
): StudentStatsResult {
  const raw: Pick<Student, 'id' | 'name' | 'grades' | 'behaviorEvents'> = {
    id: '',
    name: '',
    grades,
    behaviorEvents,
  };
  const full = calculateStudentStats(raw, settings, trendContext);
  const absenceCount = behaviorEvents.filter((e) => isAbsenceEvent(e)).length;
  return {
    averageScore: full.averageScore,
    negativeCount: full.negativeCount,
    positiveCount: full.positiveCount,
    absenceCount,
    gradeTrend: full.gradeTrend,
    behaviorTrend: full.behaviorTrend,
    behaviorOnlyTrend: full.behaviorOnlyTrend ?? full.behaviorTrend,
    absenceTrend: full.absenceTrend ?? 'stable',
    trendDetails: full.trendDetails,
    riskLevel: full.riskLevel,
    riskScore: full.riskScore,
    activityCount: grades.length + behaviorEvents.length,
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
מס',ת.ז,שם התלמיד,שכבה,כיתה,שליליים,"מתמטיקה רבקה כהן [101]
בחן 1 02/09/2024
משקל 10","היסטוריה דוד לוי [102]
עבודה 06/09/2024
משקל 20","אנגלית שרה אברהם [103]
מבחן מחצית 14/09/2024
משקל 30"
1,123456789,ישראל ישראלי,ח,1,2,55,80,60
2,987654321,דניאל כהן,ח,1,0,95,90,88
`.trim();

  return { behaviorCSV, gradesCSV };
};