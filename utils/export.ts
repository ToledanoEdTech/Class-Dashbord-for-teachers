import ExcelJS from 'exceljs';
import { Student, ClassGroup, RiskSettings, EventType, Grade, BehaviorEvent } from '../types';
import { format, eachWeekOfInterval, eachDayOfInterval, isSameWeek, isSameDay, endOfWeek, differenceInDays } from 'date-fns';
import { isAbsenceEvent, isOtherNegativeEvent } from '../types';
import { normalizeSubjectName } from './processing';
import html2canvas from 'html2canvas';

/**
 * ייצוא רשימת תלמידים בסיכון ל-Excel עם עיצוב מקצועי
 */
export async function exportStudentsAtRiskToExcel(
  students: Student[],
  className: string,
  riskSettings?: RiskSettings
): Promise<void> {
  const atRiskStudents = students.filter((s) => s.riskLevel === 'high');
  
  if (atRiskStudents.length === 0) {
    alert('אין תלמידים בסיכון לייצוא');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ClassMap';
  workbook.created = new Date();

  // גיליון תלמידים בסיכון
  const worksheet = workbook.addWorksheet('תלמידים בסיכון');
  
  // כותרת ראשית
  worksheet.mergeCells('A1:M1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `תלמידים בסיכון - ${className}`;
  titleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEF4444' }
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 30;

  // כותרת משנה
  worksheet.mergeCells('A2:M2');
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = `נוצר ב-${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
  subtitleCell.font = { name: 'Arial', size: 11, color: { argb: 'FF64748B' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 20;

  // כותרות עמודות
  const headers = [
    'מזהה תלמיד',
    'שם התלמיד',
    'ממוצע ציונים',
    'מגמת ציונים',
    'מגמת התנהגות',
    'ציון סיכון',
    'רמת סיכון',
    'מספר חיסורים',
    'אירועים שליליים (אחר)',
    'סה"כ אירועים שליליים',
    'אירועים חיוביים',
    'מספר ציונים',
    'מספר אירועי התנהגות'
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 35;

  // נתוני תלמידים
  atRiskStudents.forEach((student) => {
    const absenceCount = student.behaviorEvents.filter(isAbsenceEvent).length;
    const otherNegativeCount = student.behaviorEvents.filter(isOtherNegativeEvent).length;
    
    const gradeTrendText = student.gradeTrend === 'improving' ? 'משתפר' : 
                          student.gradeTrend === 'declining' ? 'מידרדר' : 'יציב';
    const bTrend = student.behaviorOnlyTrend ?? student.behaviorTrend;
    const behaviorTrendText = bTrend === 'improving' ? 'משתפר' : 
                             bTrend === 'declining' ? 'מידרדר' : 'יציב';
    const riskText = student.riskLevel === 'high' ? 'גבוה' : 
                    student.riskLevel === 'medium' ? 'בינוני' : 'נמוך';

    const row = worksheet.addRow([
      student.id,
      student.name,
      student.averageScore.toFixed(1),
      gradeTrendText,
      behaviorTrendText,
      student.riskScore.toFixed(1),
      riskText,
      absenceCount,
      otherNegativeCount,
      student.negativeCount,
      student.positiveCount,
      student.grades.length,
      student.behaviorEvents.length
    ]);

    // צבע רקע לפי רמת סיכון
    const riskColor = student.riskLevel === 'high' ? 'FFFFE5E5' : 
                     student.riskLevel === 'medium' ? 'FFFFF4E5' : 'FFE5F5E5';
    
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });

    // צבע רקע לשורה
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: riskColor }
    };

    // צבע מיוחד לעמודת ממוצע ציונים
    const avgCell = row.getCell(3);
    if (student.averageScore < 60) {
      avgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
    } else if (student.averageScore < 80) {
      avgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFF59E0B' } };
    } else {
      avgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
    }

    // צבע מיוחד לעמודת רמת סיכון
    const riskCell = row.getCell(7);
    if (student.riskLevel === 'high') {
      riskCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
    } else if (student.riskLevel === 'medium') {
      riskCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFF59E0B' } };
    } else {
      riskCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
    }

    row.height = 25;
  });

  // הגדרת רוחב עמודות
  worksheet.columns = [
    { width: 18 }, // מזהה תלמיד
    { width: 25 }, // שם התלמיד
    { width: 15 }, // ממוצע ציונים
    { width: 15 }, // מגמת ציונים
    { width: 15 }, // מגמת התנהגות
    { width: 12 }, // ציון סיכון
    { width: 15 }, // רמת סיכון
    { width: 15 }, // מספר חיסורים
    { width: 22 }, // אירועים שליליים (אחר)
    { width: 20 }, // סה"כ אירועים שליליים
    { width: 18 }, // אירועים חיוביים
    { width: 15 }, // מספר ציונים
    { width: 22 }  // מספר אירועי התנהגות
  ];

  // גיליון פירוט ציונים – שמות המבחנים/אירועי ההערכה במרכז, מקצוע מנורמל
  const gradesSheet = workbook.addWorksheet('פירוט ציונים');
  const gradesHeaders = ['מזהה תלמיד', 'שם התלמיד', 'אירוע ציון / שם המבחן', 'מקצוע', 'מורה', 'תאריך', 'ציון', 'משקל'];
  const gradesHeaderRow = gradesSheet.addRow(gradesHeaders);
  gradesHeaderRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  gradesHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  gradesHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  gradesHeaderRow.height = 35;

  atRiskStudents.forEach((student) => {
    student.grades.forEach((grade) => {
      const gradeRow = gradesSheet.addRow([
        student.id,
        student.name,
        grade.assignment || 'מטלה',
        normalizeSubjectName(grade.subject || 'כללי'),
        grade.teacher,
        format(grade.date, 'dd/MM/yyyy'),
        grade.score,
        grade.weight
      ]);
      
      gradeRow.eachCell({ includeEmpty: false }, (cell) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      // צבע לפי ציון
      const scoreCell = gradeRow.getCell(7);
      if (grade.score < 60) {
        scoreCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
        scoreCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE5E5' }
        };
      } else if (grade.score < 80) {
        scoreCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFF59E0B' } };
        scoreCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF4E5' }
        };
      } else {
        scoreCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
        scoreCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5F5E5' }
        };
      }

      gradeRow.height = 22;
    });
  });

  gradesSheet.columns = [
    { width: 18 },
    { width: 25 },
    { width: 20 },
    { width: 20 },
    { width: 25 },
    { width: 12 },
    { width: 10 },
    { width: 10 }
  ];

  // גיליון פירוט אירועי התנהגות
  const behaviorSheet = workbook.addWorksheet('פירוט אירועי התנהגות');
  const behaviorHeaders = ['מזהה תלמיד', 'שם התלמיד', 'תאריך', 'סוג אירוע', 'קטגוריה', 'מורה', 'מקצוע', 'שיעור', 'הצדקה', 'הערה'];
  const behaviorHeaderRow = behaviorSheet.addRow(behaviorHeaders);
  behaviorHeaderRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  behaviorHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  behaviorHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  behaviorHeaderRow.height = 35;

  atRiskStudents.forEach((student) => {
    student.behaviorEvents.forEach((event) => {
      const categoryText = event.category === EventType.POSITIVE ? 'חיובי' : 
                          event.category === EventType.NEGATIVE ? 'שלילי' : 'ניטרלי';
      
      const behaviorRow = behaviorSheet.addRow([
        student.id,
        student.name,
        format(event.date, 'dd/MM/yyyy'),
        event.type,
        categoryText,
        event.teacher,
        event.subject,
        event.lessonNumber,
        event.justification,
        event.comment
      ]);
      
      behaviorRow.eachCell({ includeEmpty: false }, (cell) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      // צבע לפי קטגוריה
      const categoryCell = behaviorRow.getCell(5);
      if (event.category === EventType.POSITIVE) {
        categoryCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
        categoryCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5F5E5' }
        };
      } else if (event.category === EventType.NEGATIVE) {
        categoryCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
        categoryCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE5E5' }
        };
      }

      behaviorRow.height = 22;
    });
  });

  behaviorSheet.columns = [
    { width: 18 },
    { width: 25 },
    { width: 12 },
    { width: 25 },
    { width: 12 },
    { width: 20 },
    { width: 20 },
    { width: 10 },
    { width: 30 },
    { width: 40 }
  ];

  // גיליון גרפים ודיאגרמות
  const chartsSheet = workbook.addWorksheet('גרפים ודיאגרמות');
  
  // כותרת
  chartsSheet.mergeCells('A1:F1');
  const chartsTitleCell = chartsSheet.getCell('A1');
  chartsTitleCell.value = `גרפים ודיאגרמות - תלמידים בסיכון`;
  chartsTitleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  chartsTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEF4444' }
  };
  chartsTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  chartsSheet.getRow(1).height = 30;

  // נתונים לגרף התפלגות ציונים
  chartsSheet.addRow([]);
  chartsSheet.addRow(['התפלגות ציונים']);
  const gradeDistHeader = chartsSheet.addRow(['טווח ציונים', 'מספר תלמידים']);
  gradeDistHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  gradeDistHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' }
  };
  
  const gradeDistribution = [
    ['0-59', atRiskStudents.filter((s) => s.averageScore < 60).length],
    ['60-69', atRiskStudents.filter((s) => s.averageScore >= 60 && s.averageScore < 70).length],
    ['70-79', atRiskStudents.filter((s) => s.averageScore >= 70 && s.averageScore < 80).length],
    ['80-89', atRiskStudents.filter((s) => s.averageScore >= 80 && s.averageScore < 90).length],
    ['90-100', atRiskStudents.filter((s) => s.averageScore >= 90).length]
  ];
  
  gradeDistribution.forEach(([range, count]) => {
    const row = chartsSheet.addRow([range, count]);
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  // נתונים לגרף אירועי התנהגות
  chartsSheet.addRow([]);
  chartsSheet.addRow([]);
  chartsSheet.addRow(['התפלגות אירועי התנהגות']);
  const behaviorDistHeader = chartsSheet.addRow(['סוג אירוע', 'מספר']);
  behaviorDistHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  behaviorDistHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' }
  };
  
  const totalAbsencesAtRisk = atRiskStudents.reduce((sum, s) => sum + s.behaviorEvents.filter(isAbsenceEvent).length, 0);
  const totalNegativeAtRisk = atRiskStudents.reduce((sum, s) => sum + s.negativeCount, 0);
  const totalPositiveAtRisk = atRiskStudents.reduce((sum, s) => sum + s.positiveCount, 0);
  
  const behaviorDistribution = [
    ['חיוביים', totalPositiveAtRisk],
    ['שליליים', totalNegativeAtRisk],
    ['חיסורים', totalAbsencesAtRisk]
  ];
  
  behaviorDistribution.forEach(([type, count]) => {
    const row = chartsSheet.addRow([type, count]);
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
    
    // צבע לפי סוג
    const typeCell = row.getCell(1);
    if (type === 'חיוביים') {
      typeCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
      typeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5F5E5' }
      };
    } else if (type === 'שליליים' || type === 'חיסורים') {
      typeCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
      typeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFE5E5' }
      };
    }
  });

  chartsSheet.columns = [
    { width: 25 },
    { width: 18 }
  ];

  // שמירת הקובץ
  const fileName = `תלמידים_בסיכון_${className}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}

/**
 * ייצוא סיכום כיתתי ל-Excel עם עיצוב מקצועי
 */
export async function exportClassSummaryToExcel(
  classGroup: ClassGroup,
  classAverage: number,
  riskSettings?: RiskSettings
): Promise<void> {
  const { students, name } = classGroup;
  
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ClassMap';
  workbook.created = new Date();

  // גיליון סיכום כללי
  const summarySheet = workbook.addWorksheet('סיכום כללי');
  
  // כותרת ראשית
  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = `סיכום כיתתי - ${name}`;
  titleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(1).height = 30;

  // כותרת משנה
  summarySheet.mergeCells('A2:B2');
  const subtitleCell = summarySheet.getCell('A2');
  subtitleCell.value = `נוצר ב-${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
  subtitleCell.font = { name: 'Arial', size: 11, color: { argb: 'FF64748B' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(2).height = 20;

  // כותרות
  const summaryHeaders = ['מדד', 'ערך'];
  const headerRow = summarySheet.addRow(summaryHeaders);
  headerRow.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 30;

  // נתוני סיכום
  const atRiskHigh = students.filter((s) => s.riskLevel === 'high').length;
  const atRiskMedium = students.filter((s) => s.riskLevel === 'medium').length;
  const atRiskLow = students.filter((s) => s.riskLevel === 'low').length;
  const totalAbsences = students.reduce((sum, s) => sum + s.behaviorEvents.filter(isAbsenceEvent).length, 0);
  const totalNegative = students.reduce((sum, s) => sum + s.negativeCount, 0);
  const totalPositive = students.reduce((sum, s) => sum + s.positiveCount, 0);

  const summaryData = [
    ['סה"כ תלמידים', students.length],
    ['ממוצע כיתתי', classAverage.toFixed(1)],
    ['תלמידים בסיכון גבוה', atRiskHigh],
    ['תלמידים בסיכון בינוני', atRiskMedium],
    ['תלמידים בסיכון נמוך', atRiskLow],
    ['סה"כ חיסורים', totalAbsences],
    ['סה"כ אירועים שליליים', totalNegative],
    ['סה"כ אירועים חיוביים', totalPositive],
    ['תאריך עדכון אחרון', format(classGroup.lastUpdated, 'dd/MM/yyyy')]
  ];

  summaryData.forEach(([label, value], index) => {
    const row = summarySheet.addRow([label, value]);
    row.height = 28;
    
    row.getCell(1).font = { name: 'Arial', size: 11, bold: true };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' }
    };
    
    row.getCell(2).font = { name: 'Arial', size: 12, bold: true };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    
    // צבעים מיוחדים
    const labelStr = String(label);
    if (labelStr.includes('סיכון גבוה')) {
      row.getCell(2).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFEF4444' } };
    } else if (labelStr.includes('סיכון בינוני')) {
      row.getCell(2).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFF59E0B' } };
    } else if (labelStr.includes('סיכון נמוך')) {
      row.getCell(2).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF22C55E' } };
    } else if (labelStr.includes('ממוצע')) {
      row.getCell(2).font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0C8EE6' } };
    }
    
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  summarySheet.columns = [
    { width: 30 },
    { width: 20 }
  ];

  // גיליון תלמידים
  const studentsSheet = workbook.addWorksheet('תלמידים');
  
  // כותרת
  studentsSheet.mergeCells('A1:N1');
  const studentsTitleCell = studentsSheet.getCell('A1');
  studentsTitleCell.value = `רשימת תלמידים - ${name}`;
  studentsTitleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  studentsTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  studentsTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  studentsSheet.getRow(1).height = 30;

  const studentsHeaders = [
    'מזהה תלמיד',
    'שם התלמיד',
    'ממוצע ציונים',
    'מגמת ציונים',
    'מגמת התנהגות',
    'ציון סיכון',
    'רמת סיכון',
    'מספר חיסורים',
    'אירועים שליליים (אחר)',
    'סה"כ אירועים שליליים',
    'אירועים חיוביים',
    'מספר ציונים',
    'מספר אירועי התנהגות',
    'ממוצע כיתתי'
  ];

  const studentsHeaderRow = studentsSheet.addRow(studentsHeaders);
  studentsHeaderRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  studentsHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  studentsHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  studentsHeaderRow.height = 35;

  students.forEach((student) => {
    const absenceCount = student.behaviorEvents.filter(isAbsenceEvent).length;
    const otherNegativeCount = student.behaviorEvents.filter(isOtherNegativeEvent).length;
    
    const gradeTrendText = student.gradeTrend === 'improving' ? 'משתפר' : 
                          student.gradeTrend === 'declining' ? 'מידרדר' : 'יציב';
    const bTrend2 = student.behaviorOnlyTrend ?? student.behaviorTrend;
    const behaviorTrendText = bTrend2 === 'improving' ? 'משתפר' : 
                             bTrend2 === 'declining' ? 'מידרדר' : 'יציב';
    const riskText = student.riskLevel === 'high' ? 'גבוה' : 
                    student.riskLevel === 'medium' ? 'בינוני' : 'נמוך';

    const row = studentsSheet.addRow([
      student.id,
      student.name,
      student.averageScore.toFixed(1),
      gradeTrendText,
      behaviorTrendText,
      student.riskScore.toFixed(1),
      riskText,
      absenceCount,
      otherNegativeCount,
      student.negativeCount,
      student.positiveCount,
      student.grades.length,
      student.behaviorEvents.length,
      classAverage.toFixed(1)
    ]);

    // צבע רקע לפי רמת סיכון
    const riskColor = student.riskLevel === 'high' ? 'FFFFE5E5' : 
                     student.riskLevel === 'medium' ? 'FFFFF4E5' : 'FFE5F5E5';
    
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: riskColor }
    };

    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });

    // צבע מיוחד לעמודת ממוצע ציונים
    const avgCell = row.getCell(3);
    if (student.averageScore < 60) {
      avgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
    } else if (student.averageScore < 80) {
      avgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFF59E0B' } };
    } else {
      avgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
    }

    // צבע מיוחד לעמודת רמת סיכון
    const riskCell = row.getCell(7);
    if (student.riskLevel === 'high') {
      riskCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
    } else if (student.riskLevel === 'medium') {
      riskCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFF59E0B' } };
    } else {
      riskCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
    }

    row.height = 25;
  });

  studentsSheet.columns = [
    { width: 18 },
    { width: 25 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 12 },
    { width: 15 },
    { width: 15 },
    { width: 22 },
    { width: 20 },
    { width: 18 },
    { width: 15 },
    { width: 22 },
    { width: 15 }
  ];

  // גיליון פירוט ציונים – שמות המבחנים/אירועי ההערכה במרכז, מקצוע מנורמל
  const gradesSheet = workbook.addWorksheet('פירוט ציונים');
  const gradesHeaders = ['מזהה תלמיד', 'שם התלמיד', 'אירוע ציון / שם המבחן', 'מקצוע', 'מורה', 'תאריך', 'ציון', 'משקל'];
  const gradesHeaderRow = gradesSheet.addRow(gradesHeaders);
  gradesHeaderRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  gradesHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  gradesHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  gradesHeaderRow.height = 35;

  students.forEach((student) => {
    student.grades.forEach((grade) => {
      const gradeRow = gradesSheet.addRow([
        student.id,
        student.name,
        grade.assignment || 'מטלה',
        normalizeSubjectName(grade.subject || 'כללי'),
        grade.teacher,
        format(grade.date, 'dd/MM/yyyy'),
        grade.score,
        grade.weight
      ]);
      
      gradeRow.eachCell({ includeEmpty: false }, (cell) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      // צבע לפי ציון
      const scoreCell = gradeRow.getCell(7);
      if (grade.score < 60) {
        scoreCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
        scoreCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE5E5' }
        };
      } else if (grade.score < 80) {
        scoreCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFF59E0B' } };
        scoreCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF4E5' }
        };
      } else {
        scoreCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
        scoreCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5F5E5' }
        };
      }

      gradeRow.height = 22;
    });
  });

  gradesSheet.columns = [
    { width: 18 },
    { width: 25 },
    { width: 20 },
    { width: 20 },
    { width: 25 },
    { width: 12 },
    { width: 10 },
    { width: 10 }
  ];

  // גיליון פירוט אירועי התנהגות
  const behaviorSheet = workbook.addWorksheet('פירוט אירועי התנהגות');
  const behaviorHeaders = ['מזהה תלמיד', 'שם התלמיד', 'תאריך', 'סוג אירוע', 'קטגוריה', 'מורה', 'מקצוע', 'שיעור', 'הצדקה', 'הערה'];
  const behaviorHeaderRow = behaviorSheet.addRow(behaviorHeaders);
  behaviorHeaderRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  behaviorHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  behaviorHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  behaviorHeaderRow.height = 35;

  students.forEach((student) => {
    student.behaviorEvents.forEach((event) => {
      const categoryText = event.category === EventType.POSITIVE ? 'חיובי' : 
                          event.category === EventType.NEGATIVE ? 'שלילי' : 'ניטרלי';
      
      const behaviorRow = behaviorSheet.addRow([
        student.id,
        student.name,
        format(event.date, 'dd/MM/yyyy'),
        event.type,
        categoryText,
        event.teacher,
        event.subject,
        event.lessonNumber,
        event.justification,
        event.comment
      ]);
      
      behaviorRow.eachCell({ includeEmpty: false }, (cell) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      // צבע לפי קטגוריה
      const categoryCell = behaviorRow.getCell(5);
      if (event.category === EventType.POSITIVE) {
        categoryCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
        categoryCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5F5E5' }
        };
      } else if (event.category === EventType.NEGATIVE) {
        categoryCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
        categoryCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE5E5' }
        };
      }

      behaviorRow.height = 22;
    });
  });

  behaviorSheet.columns = [
    { width: 18 },
    { width: 25 },
    { width: 12 },
    { width: 25 },
    { width: 12 },
    { width: 20 },
    { width: 20 },
    { width: 10 },
    { width: 30 },
    { width: 40 }
  ];

  // גיליון סיכום לפי מקצועות
  const subjectsSheet = workbook.addWorksheet('סיכום לפי מקצועות');
  const subjectsHeaders = ['מקצוע', 'מספר תלמידים', 'ממוצע ציונים', 'מספר ציונים', 'מספר אירועי התנהגות'];
  const subjectsHeaderRow = subjectsSheet.addRow(subjectsHeaders);
  subjectsHeaderRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  subjectsHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  subjectsHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  subjectsHeaderRow.height = 35;

  // חישוב סטטיסטיקות לפי מקצוע
  const subjectStats: Record<string, { students: Set<string>, grades: number[], events: number }> = {};
  
  students.forEach((student) => {
    student.grades.forEach((grade) => {
      const subject = normalizeSubjectName(grade.subject || 'כללי');
      if (!subjectStats[subject]) {
        subjectStats[subject] = { students: new Set(), grades: [], events: 0 };
      }
      subjectStats[subject].students.add(student.id);
      subjectStats[subject].grades.push(grade.score);
    });
    
    student.behaviorEvents.forEach((event) => {
      const subject = normalizeSubjectName(event.subject || 'כללי');
      if (!subjectStats[subject]) {
        subjectStats[subject] = { students: new Set(), grades: [], events: 0 };
      }
      subjectStats[subject].events++;
    });
  });

  Object.entries(subjectStats)
    .sort((a, b) => a[0].localeCompare(b[0], 'he'))
    .forEach(([subject, stats]) => {
      const avg = stats.grades.length > 0 
        ? stats.grades.reduce((sum, g) => sum + g, 0) / stats.grades.length 
        : 0;
      
      const row = subjectsSheet.addRow([
        subject,
        stats.students.size,
        avg.toFixed(1),
        stats.grades.length,
        stats.events
      ]);
      
      row.eachCell({ includeEmpty: false }, (cell) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      // צבע לפי ממוצע
      const avgCell = row.getCell(3);
      if (avg > 0) {
        if (avg < 60) {
          avgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
        } else if (avg < 80) {
          avgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFF59E0B' } };
        } else {
          avgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
        }
      }

      row.height = 25;
    });

  subjectsSheet.columns = [
    { width: 25 },
    { width: 18 },
    { width: 15 },
    { width: 15 },
    { width: 22 }
  ];

  // גיליון גרפים ודיאגרמות
  const chartsSheet = workbook.addWorksheet('גרפים ודיאגרמות');
  
  // כותרת
  chartsSheet.mergeCells('A1:F1');
  const chartsTitleCell = chartsSheet.getCell('A1');
  chartsTitleCell.value = `גרפים ודיאגרמות - ${name}`;
  chartsTitleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  chartsTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  chartsTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  chartsSheet.getRow(1).height = 30;

  // נתונים לגרף התפלגות ציונים
  chartsSheet.addRow([]);
  chartsSheet.addRow(['התפלגות ציונים']);
  const gradeDistHeader = chartsSheet.addRow(['טווח ציונים', 'מספר תלמידים']);
  gradeDistHeader.font = { name: 'Arial', size: 11, bold: true };
  gradeDistHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' }
  };
  gradeDistHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  
  const gradeDistribution = [
    ['0-59', students.filter((s) => s.averageScore < 60).length],
    ['60-69', students.filter((s) => s.averageScore >= 60 && s.averageScore < 70).length],
    ['70-79', students.filter((s) => s.averageScore >= 70 && s.averageScore < 80).length],
    ['80-89', students.filter((s) => s.averageScore >= 80 && s.averageScore < 90).length],
    ['90-100', students.filter((s) => s.averageScore >= 90).length]
  ];
  
  gradeDistribution.forEach(([range, count]) => {
    const row = chartsSheet.addRow([range, count]);
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  // נתונים לגרף התפלגות רמות סיכון
  chartsSheet.addRow([]);
  chartsSheet.addRow([]);
  chartsSheet.addRow(['התפלגות רמות סיכון']);
  const riskDistHeader = chartsSheet.addRow(['רמת סיכון', 'מספר תלמידים']);
  riskDistHeader.font = { name: 'Arial', size: 11, bold: true };
  riskDistHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' }
  };
  riskDistHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  
  const riskDistribution = [
    ['גבוה', atRiskHigh],
    ['בינוני', atRiskMedium],
    ['נמוך', atRiskLow]
  ];
  
  riskDistribution.forEach(([level, count]) => {
    const row = chartsSheet.addRow([level, count]);
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
    
    // צבע לפי רמת סיכון
    const levelCell = row.getCell(1);
    if (level === 'גבוה') {
      levelCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
      levelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFE5E5' }
      };
    } else if (level === 'בינוני') {
      levelCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFF59E0B' } };
      levelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF4E5' }
      };
    } else {
      levelCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
      levelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5F5E5' }
      };
    }
  });

  // נתונים לגרף אירועי התנהגות
  chartsSheet.addRow([]);
  chartsSheet.addRow([]);
  chartsSheet.addRow(['התפלגות אירועי התנהגות']);
  const behaviorDistHeader = chartsSheet.addRow(['סוג אירוע', 'מספר']);
  behaviorDistHeader.font = { name: 'Arial', size: 11, bold: true };
  behaviorDistHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' }
  };
  behaviorDistHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  
  const behaviorDistribution = [
    ['חיוביים', totalPositive],
    ['שליליים', totalNegative],
    ['חיסורים', totalAbsences]
  ];
  
  behaviorDistribution.forEach(([type, count]) => {
    const row = chartsSheet.addRow([type, count]);
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
    
    // צבע לפי סוג
    const typeCell = row.getCell(1);
    if (type === 'חיוביים') {
      typeCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
      typeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5F5E5' }
      };
    } else if (type === 'שליליים' || type === 'חיסורים') {
      typeCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
      typeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFE5E5' }
      };
    }
  });

  chartsSheet.columns = [
    { width: 25 },
    { width: 18 }
  ];

  // שמירת הקובץ
  const fileName = `סיכום_כיתתי_${name}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}

/**
 * ייצוא סיכום כיתתי ל-PDF עם עיצוב משופר
 */
export function exportClassSummaryToPDF(
  classGroup: ClassGroup,
  classAverage: number,
  riskSettings?: RiskSettings
): void {
  const { students, name } = classGroup;
  
  // חישוב סטטיסטיקות
  const atRiskHigh = students.filter((s) => s.riskLevel === 'high').length;
  const atRiskMedium = students.filter((s) => s.riskLevel === 'medium').length;
  const atRiskLow = students.filter((s) => s.riskLevel === 'low').length;
  const totalAbsences = students.reduce((sum, s) => sum + s.behaviorEvents.filter(isAbsenceEvent).length, 0);
  const totalNegative = students.reduce((sum, s) => sum + s.negativeCount, 0);
  const totalPositive = students.reduce((sum, s) => sum + s.positiveCount, 0);

  // חישוב סטטיסטיקות לפי מקצוע
  const subjectStats: Record<string, { students: Set<string>, grades: number[], events: number }> = {};
  
  students.forEach((student) => {
    student.grades.forEach((grade) => {
      const subject = normalizeSubjectName(grade.subject || 'כללי');
      if (!subjectStats[subject]) {
        subjectStats[subject] = { students: new Set(), grades: [], events: 0 };
      }
      subjectStats[subject].students.add(student.id);
      subjectStats[subject].grades.push(grade.score);
    });
    
    student.behaviorEvents.forEach((event) => {
      const subject = normalizeSubjectName(event.subject || 'כללי');
      if (!subjectStats[subject]) {
        subjectStats[subject] = { students: new Set(), grades: [], events: 0 };
      }
      subjectStats[subject].events++;
    });
  });

  // יצירת HTML לתוכן ה-PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          margin: 20mm;
          size: A4;
        }
        body {
          font-family: 'Segoe UI', 'Arial', Tahoma, Geneva, Verdana, sans-serif;
          direction: rtl;
          padding: 0;
          margin: 0;
          color: #1e293b;
          line-height: 1.6;
          background: white;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 4px solid #0c8ee6;
          padding-bottom: 20px;
          background: linear-gradient(135deg, #0c8ee6 0%, #3b82f6 100%);
          color: white;
          padding: 30px 20px;
          border-radius: 8px 8px 0 0;
        }
        .header h1 {
          color: white;
          margin: 0 0 10px 0;
          font-size: 32px;
          font-weight: bold;
        }
        .header p {
          color: rgba(255, 255, 255, 0.9);
          margin: 5px 0;
          font-size: 16px;
        }
        .summary-section {
          margin: 25px 0;
          background: #f8fafc;
          padding: 25px;
          border-radius: 10px;
          border-right: 5px solid #0c8ee6;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .summary-section h2 {
          color: #0c8ee6;
          margin-top: 0;
          font-size: 22px;
          margin-bottom: 20px;
          font-weight: bold;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 10px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 15px;
        }
        .stat-item {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border: 2px solid #e2e8f0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          transition: transform 0.2s;
        }
        .stat-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .stat-label {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .stat-value {
          font-size: 28px;
          font-weight: bold;
          color: #1e293b;
        }
        .risk-high { color: #ef4444 !important; }
        .risk-medium { color: #f59e0b !important; }
        .risk-low { color: #22c55e !important; }
        .students-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          font-size: 11px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .students-table th {
          background: linear-gradient(135deg, #0c8ee6 0%, #3b82f6 100%);
          color: white;
          padding: 14px 10px;
          text-align: right;
          font-weight: bold;
          font-size: 12px;
          border: 1px solid #0c8ee6;
        }
        .students-table td {
          padding: 12px 10px;
          border: 1px solid #e2e8f0;
          text-align: right;
        }
        .students-table tr:nth-child(even) {
          background: #f8fafc;
        }
        .students-table tr:hover {
          background: #f1f5f9;
        }
        .risk-high-cell {
          background: #fee2e2 !important;
          color: #ef4444;
          font-weight: bold;
        }
        .risk-medium-cell {
          background: #fef3c7 !important;
          color: #f59e0b;
          font-weight: bold;
        }
        .risk-low-cell {
          background: #d1fae5 !important;
          color: #22c55e;
          font-weight: bold;
        }
        .grade-low {
          color: #ef4444;
          font-weight: bold;
        }
        .grade-medium {
          color: #f59e0b;
          font-weight: bold;
        }
        .grade-high {
          color: #22c55e;
          font-weight: bold;
        }
        .subjects-section {
          margin-top: 30px;
        }
        .subjects-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
          font-size: 11px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .subjects-table th {
          background: linear-gradient(135deg, #0c8ee6 0%, #3b82f6 100%);
          color: white;
          padding: 12px 10px;
          text-align: right;
          font-weight: bold;
          font-size: 12px;
          border: 1px solid #0c8ee6;
        }
        .subjects-table td {
          padding: 10px;
          border: 1px solid #e2e8f0;
          text-align: right;
        }
        .subjects-table tr:nth-child(even) {
          background: #f8fafc;
        }
        .charts-section {
          margin-top: 30px;
        }
        .chart-container {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border: 2px solid #e2e8f0;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .chart-title {
          font-size: 16px;
          font-weight: bold;
          color: #0c8ee6;
          margin-bottom: 15px;
          text-align: center;
        }
        .chart-svg {
          width: 100%;
          height: 300px;
        }
        .bar-chart {
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          height: 250px;
          padding: 20px;
          background: #f8fafc;
          border-radius: 6px;
        }
        .bar {
          flex: 1;
          margin: 0 5px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
        }
        .bar-rect {
          width: 100%;
          border-radius: 4px 4px 0 0;
          transition: all 0.3s;
        }
        .bar-label {
          margin-top: 8px;
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }
        .bar-value {
          font-size: 12px;
          font-weight: bold;
          color: #1e293b;
          margin-bottom: 5px;
        }
        .pie-chart {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 300px;
          padding: 20px;
        }
        .pie-legend {
          margin-right: 30px;
        }
        .pie-legend-item {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
          font-size: 12px;
        }
        .pie-legend-color {
          width: 16px;
          height: 16px;
          border-radius: 3px;
          margin-left: 8px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #64748b;
          font-size: 12px;
          border-top: 2px solid #e2e8f0;
          padding-top: 20px;
        }
        @media print {
          body { padding: 0; }
          .summary-section { page-break-inside: avoid; }
          .students-table { page-break-inside: auto; }
          .chart-container { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>סיכום כיתתי מפורט</h1>
        <p><strong>כיתה:</strong> ${name}</p>
        <p><strong>תאריך:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
      </div>

      <div class="summary-section">
        <h2>📊 סטטיסטיקות כלליות</h2>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">סה"כ תלמידים</div>
            <div class="stat-value">${students.length}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">ממוצע כיתתי</div>
            <div class="stat-value" style="color: #0c8ee6;">${classAverage.toFixed(1)}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">תלמידים בסיכון גבוה</div>
            <div class="stat-value risk-high">${atRiskHigh}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">תלמידים בסיכון בינוני</div>
            <div class="stat-value risk-medium">${atRiskMedium}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">תלמידים בסיכון נמוך</div>
            <div class="stat-value risk-low">${atRiskLow}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">סה"כ חיסורים</div>
            <div class="stat-value">${totalAbsences}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">סה"כ אירועים שליליים</div>
            <div class="stat-value" style="color: #ef4444;">${totalNegative}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">סה"כ אירועים חיוביים</div>
            <div class="stat-value" style="color: #22c55e;">${totalPositive}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">תאריך עדכון אחרון</div>
            <div class="stat-value" style="font-size: 18px;">${format(classGroup.lastUpdated, 'dd/MM/yyyy')}</div>
          </div>
        </div>
      </div>

      <div class="summary-section charts-section">
        <h2>📈 גרפים ודיאגרמות</h2>
        
        <!-- גרף התפלגות ציונים -->
        <div class="chart-container">
          <div class="chart-title">התפלגות ציונים</div>
          <div class="bar-chart">
            ${[
              { name: '0-59', count: students.filter((s) => s.averageScore < 60).length, color: '#ef4444' },
              { name: '60-69', count: students.filter((s) => s.averageScore >= 60 && s.averageScore < 70).length, color: '#f59e0b' },
              { name: '70-79', count: students.filter((s) => s.averageScore >= 70 && s.averageScore < 80).length, color: '#eab308' },
              { name: '80-89', count: students.filter((s) => s.averageScore >= 80 && s.averageScore < 90).length, color: '#84cc16' },
              { name: '90-100', count: students.filter((s) => s.averageScore >= 90).length, color: '#22c55e' }
            ].map((item) => {
              const maxCount = Math.max(...[
                students.filter((s) => s.averageScore < 60).length,
                students.filter((s) => s.averageScore >= 60 && s.averageScore < 70).length,
                students.filter((s) => s.averageScore >= 70 && s.averageScore < 80).length,
                students.filter((s) => s.averageScore >= 80 && s.averageScore < 90).length,
                students.filter((s) => s.averageScore >= 90).length
              ], 1);
              const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
              return `
                <div class="bar">
                  <div class="bar-value">${item.count}</div>
                  <div class="bar-rect" style="height: ${height}%; background: ${item.color};"></div>
                  <div class="bar-label">${item.name}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- גרף התפלגות רמות סיכון -->
        <div class="chart-container">
          <div class="chart-title">התפלגות רמות סיכון</div>
          <div class="pie-chart">
            <div class="pie-legend">
              ${[
                { label: 'סיכון גבוה', count: atRiskHigh, color: '#ef4444' },
                { label: 'סיכון בינוני', count: atRiskMedium, color: '#f59e0b' },
                { label: 'סיכון נמוך', count: atRiskLow, color: '#22c55e' }
              ].map((item) => `
                <div class="pie-legend-item">
                  <div class="pie-legend-color" style="background: ${item.color};"></div>
                  <span><strong>${item.label}:</strong> ${item.count} תלמידים</span>
                </div>
              `).join('')}
            </div>
            <svg class="chart-svg" viewBox="0 0 200 200">
              ${(() => {
                const total = atRiskHigh + atRiskMedium + atRiskLow;
                if (total === 0) return '<text x="100" y="100" text-anchor="middle" fill="#64748b">אין נתונים</text>';
                
                let currentAngle = -90;
                const radius = 80;
                const centerX = 100;
                const centerY = 100;
                
                const slices = [
                  { count: atRiskHigh, color: '#ef4444', label: 'גבוה' },
                  { count: atRiskMedium, color: '#f59e0b', label: 'בינוני' },
                  { count: atRiskLow, color: '#22c55e', label: 'נמוך' }
                ].filter(s => s.count > 0);
                
                return slices.map((slice, index) => {
                  const percentage = (slice.count / total) * 100;
                  const angle = (percentage / 100) * 360;
                  const startAngle = currentAngle;
                  const endAngle = currentAngle + angle;
                  
                  const x1 = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
                  const y1 = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
                  const x2 = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
                  const y2 = centerY + radius * Math.sin((endAngle * Math.PI) / 180);
                  
                  const largeArc = angle > 180 ? 1 : 0;
                  
                  const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                  
                  const labelAngle = (startAngle + angle / 2) * Math.PI / 180;
                  const labelRadius = radius * 0.7;
                  const labelX = centerX + labelRadius * Math.cos(labelAngle);
                  const labelY = centerY + labelRadius * Math.sin(labelAngle);
                  
                  currentAngle = endAngle;
                  
                  return `
                    <path d="${path}" fill="${slice.color}" stroke="white" stroke-width="2"/>
                    <text x="${labelX}" y="${labelY}" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${slice.count}</text>
                  `;
                }).join('');
              })()}
            </svg>
          </div>
        </div>

        <!-- גרף התפלגות אירועי התנהגות -->
        <div class="chart-container">
          <div class="chart-title">התפלגות אירועי התנהגות</div>
          <div class="bar-chart">
            ${[
              { name: 'חיוביים', count: totalPositive, color: '#22c55e' },
              { name: 'שליליים', count: totalNegative, color: '#ef4444' },
              { name: 'חיסורים', count: totalAbsences, color: '#f59e0b' }
            ].map((item) => {
              const maxCount = Math.max(totalPositive, totalNegative, totalAbsences, 1);
              const height = (item.count / maxCount) * 100;
              return `
                <div class="bar">
                  <div class="bar-value">${item.count}</div>
                  <div class="bar-rect" style="height: ${height}%; background: ${item.color};"></div>
                  <div class="bar-label">${item.name}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="summary-section subjects-section">
        <h2>📚 סיכום לפי מקצועות</h2>
        <table class="subjects-table">
          <thead>
            <tr>
              <th>מקצוע</th>
              <th>מספר תלמידים</th>
              <th>ממוצע ציונים</th>
              <th>מספר ציונים</th>
              <th>מספר אירועי התנהגות</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(subjectStats)
              .sort((a, b) => a[0].localeCompare(b[0], 'he'))
              .map(([subject, stats]) => {
                const avg = stats.grades.length > 0 
                  ? stats.grades.reduce((sum, g) => sum + g, 0) / stats.grades.length 
                  : 0;
                const avgClass = avg < 60 ? 'grade-low' : avg < 80 ? 'grade-medium' : 'grade-high';
                return `
                  <tr>
                    <td><strong>${subject}</strong></td>
                    <td>${stats.students.size}</td>
                    <td class="${avgClass}">${avg.toFixed(1)}</td>
                    <td>${stats.grades.length}</td>
                    <td>${stats.events}</td>
                  </tr>
                `;
              }).join('')}
          </tbody>
        </table>
      </div>

      <div class="summary-section">
        <h2>👥 רשימת תלמידים מפורטת</h2>
        <table class="students-table">
          <thead>
            <tr>
              <th>מזהה</th>
              <th>שם התלמיד</th>
              <th>ממוצע</th>
              <th>מגמת ציונים</th>
              <th>מגמת התנהגות</th>
              <th>ציון סיכון</th>
              <th>רמת סיכון</th>
              <th>חיסורים</th>
              <th>אירועים שליליים</th>
              <th>אירועים חיוביים</th>
              <th>מספר ציונים</th>
              <th>מספר אירועים</th>
            </tr>
          </thead>
          <tbody>
            ${students.map((student) => {
              const absenceCount = student.behaviorEvents.filter(isAbsenceEvent).length;
              const gradeTrendText = student.gradeTrend === 'improving' ? 'משתפר ⬆️' : 
                                    student.gradeTrend === 'declining' ? 'מידרדר ⬇️' : 'יציב ➡️';
              const bTrendHtml = student.behaviorOnlyTrend ?? student.behaviorTrend;
              const behaviorTrendText = bTrendHtml === 'improving' ? 'משתפר ⬆️' : 
                                       bTrendHtml === 'declining' ? 'מידרדר ⬇️' : 'יציב ➡️';
              const riskText = student.riskLevel === 'high' ? 'גבוה' : 
                             student.riskLevel === 'medium' ? 'בינוני' : 'נמוך';
              const riskClass = student.riskLevel === 'high' ? 'risk-high-cell' : 
                               student.riskLevel === 'medium' ? 'risk-medium-cell' : 'risk-low-cell';
              const avgClass = student.averageScore < 60 ? 'grade-low' : 
                              student.averageScore < 80 ? 'grade-medium' : 'grade-high';
              
              return `
                <tr>
                  <td>${student.id}</td>
                  <td><strong>${student.name}</strong></td>
                  <td class="${avgClass}">${student.averageScore.toFixed(1)}</td>
                  <td>${gradeTrendText}</td>
                  <td>${behaviorTrendText}</td>
                  <td>${student.riskScore.toFixed(1)}</td>
                  <td class="${riskClass}">${riskText}</td>
                  <td>${absenceCount}</td>
                  <td>${student.negativeCount}</td>
                  <td>${student.positiveCount}</td>
                  <td>${student.grades.length}</td>
                  <td>${student.behaviorEvents.length}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>נוצר ב-${format(new Date(), 'dd/MM/yyyy HH:mm')} | ClassMap - מערכת מעקב פדגוגית | מבית ToledanoEdTech</p>
      </div>
    </body>
    </html>
  `;

  // פתיחת חלון חדש עם התוכן והדפסה
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // המתן לטעינת התוכן ואז הדפסה/שמירה כ-PDF
    setTimeout(() => {
      printWindow.print();
    }, 500);
  } else {
    alert('לא ניתן לפתוח חלון הדפסה. אנא בדוק את הגדרות הדפדפן.');
  }
}
