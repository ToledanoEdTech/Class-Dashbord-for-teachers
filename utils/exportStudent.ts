import ExcelJS from 'exceljs';
import { Student, RiskSettings, EventType, Grade, BehaviorEvent } from '../types';
import { format, eachWeekOfInterval, eachDayOfInterval, isSameWeek, isSameDay, endOfWeek, differenceInDays, startOfDay } from 'date-fns';
import { isAbsenceEvent, isOtherNegativeEvent } from '../types';

/**
 * ייצוא מפורט של תלמיד בודד ל-Excel עם עיצוב מקצועי וגרפים
 */
export async function exportStudentProfileToExcel(
  student: Student,
  classAverage: number,
  riskSettings?: RiskSettings
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ToledanoEdTech';
  workbook.created = new Date();

  // גיליון סיכום
  const summarySheet = workbook.addWorksheet('סיכום');
  
  // כותרת ראשית
  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = `דוח תלמיד - ${student.name}`;
  titleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(1).height = 35;

  // כותרת משנה
  summarySheet.mergeCells('A2:B2');
  const subtitleCell = summarySheet.getCell('A2');
  subtitleCell.value = `נוצר ב-${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
  subtitleCell.font = { name: 'Arial', size: 11, color: { argb: 'FF64748B' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(2).height = 20;

  // נתוני סיכום
  const absenceCount = student.behaviorEvents.filter(isAbsenceEvent).length;
  const otherNegativeCount = student.behaviorEvents.filter(isOtherNegativeEvent).length;
  const gradeTrendText = student.gradeTrend === 'improving' ? 'משתפר ⬆️' : 
                        student.gradeTrend === 'declining' ? 'מידרדר ⬇️' : 'יציב ➡️';
  const behaviorTrendText = student.behaviorTrend === 'improving' ? 'משתפר ⬆️' : 
                           student.behaviorTrend === 'declining' ? 'מידרדר ⬇️' : 'יציב ➡️';
  const riskText = student.riskLevel === 'high' ? 'גבוה' : 
                  student.riskLevel === 'medium' ? 'בינוני' : 'נמוך';

  const summaryData = [
    ['פרטים אישיים', ''],
    ['שם התלמיד', student.name],
    ['ת.ז / מזהה', student.id],
    ['', ''],
    ['ציונים', ''],
    ['ממוצע ציונים', student.averageScore.toFixed(1)],
    ['ממוצע כיתתי', classAverage.toFixed(1)],
    ['הפרש מהממוצע הכיתתי', (student.averageScore - classAverage).toFixed(1)],
    ['מספר ציונים', student.grades.length],
    ['מגמת ציונים', gradeTrendText],
    ['', ''],
    ['התנהגות', ''],
    ['אירועים חיוביים', student.positiveCount],
    ['אירועים שליליים (כולל חיסורים)', student.negativeCount],
    ['מספר חיסורים', absenceCount],
    ['אירועים שליליים (אחר)', otherNegativeCount],
    ['מספר אירועי התנהגות', student.behaviorEvents.length],
    ['מגמת התנהגות', behaviorTrendText],
    ['', ''],
    ['סיכון', ''],
    ['רמת סיכון', riskText],
    ['ציון סיכון', student.riskScore.toFixed(1)],
    ['הסבר', student.riskScore <= 4 ? 'תלמיד בסיכון גבוה - נדרש מעקב צמוד' : 
             student.riskScore <= 7 ? 'תלמיד בסיכון בינוני - נדרש מעקב' : 
             'תלמיד בסיכון נמוך - מצב תקין']
  ];

  summaryData.forEach(([label, value], index) => {
    const row = summarySheet.addRow([label, value]);
    row.height = 25;
    
    // כותרות קטגוריות
    if (value === '') {
      row.getCell(1).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF0C8EE6' } };
      row.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F9FF' }
      };
      row.height = 30;
    } else {
      row.getCell(1).font = { name: 'Arial', size: 11, bold: true };
      row.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
      };
      
      row.getCell(2).font = { name: 'Arial', size: 11 };
      
      // צבעים מיוחדים
      const labelStr = String(label);
      if (labelStr.includes('ממוצע ציונים')) {
        const avg = parseFloat(String(value));
        if (avg < 60) {
          row.getCell(2).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFEF4444' } };
          row.getCell(2).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE5E5' }
          };
        } else if (avg < 80) {
          row.getCell(2).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFF59E0B' } };
          row.getCell(2).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF4E5' }
          };
        } else {
          row.getCell(2).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF22C55E' } };
          row.getCell(2).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE5F5E5' }
          };
        }
      } else if (labelStr.includes('רמת סיכון')) {
        if (student.riskLevel === 'high') {
          row.getCell(2).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFEF4444' } };
          row.getCell(2).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE5E5' }
          };
        } else if (student.riskLevel === 'medium') {
          row.getCell(2).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFF59E0B' } };
          row.getCell(2).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF4E5' }
          };
        }
      } else if (labelStr.includes('אירועים חיוביים')) {
        row.getCell(2).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF22C55E' } };
      } else if (labelStr.includes('אירועים שליליים') || labelStr.includes('חיסורים')) {
        row.getCell(2).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFEF4444' } };
      }
    }
    
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
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
    { width: 35 }
  ];

  // גיליון פירוט ציונים
  const gradesSheet = workbook.addWorksheet('פירוט ציונים');
  
  // כותרת
  gradesSheet.mergeCells('A1:H1');
  const gradesTitleCell = gradesSheet.getCell('A1');
  gradesTitleCell.value = `פירוט ציונים - ${student.name}`;
  gradesTitleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  gradesTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  gradesTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  gradesSheet.getRow(1).height = 30;

  const gradesHeaders = ['מקצוע', 'מורה', 'מטלה', 'תאריך', 'ציון', 'משקל', 'ציון משוקלל', 'הערות'];
  const gradesHeaderRow = gradesSheet.addRow(gradesHeaders);
  gradesHeaderRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  gradesHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  gradesHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  gradesHeaderRow.height = 35;

  student.grades
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .forEach((grade) => {
      const weightedScore = grade.score * (grade.weight / 100);
      const row = gradesSheet.addRow([
        grade.subject,
        grade.teacher,
        grade.assignment,
        format(grade.date, 'dd/MM/yyyy'),
        grade.score,
        grade.weight,
        weightedScore.toFixed(1),
        grade.score < 60 ? 'נכשל' : grade.score < 80 ? 'צריך שיפור' : 'טוב'
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

      // צבע לפי ציון
      const scoreCell = row.getCell(5);
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

      row.height = 22;
    });

  gradesSheet.columns = [
    { width: 20 },
    { width: 20 },
    { width: 25 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 15 },
    { width: 15 }
  ];

  // גיליון פירוט אירועי התנהגות
  const behaviorSheet = workbook.addWorksheet('פירוט אירועי התנהגות');
  
  // כותרת
  behaviorSheet.mergeCells('A1:J1');
  const behaviorTitleCell = behaviorSheet.getCell('A1');
  behaviorTitleCell.value = `פירוט אירועי התנהגות - ${student.name}`;
  behaviorTitleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  behaviorTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  behaviorTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  behaviorSheet.getRow(1).height = 30;

  const behaviorHeaders = ['תאריך', 'סוג אירוע', 'קטגוריה', 'מורה', 'מקצוע', 'שיעור', 'הצדקה', 'הערה', 'חיסור?', 'שלילי אחר?'];
  const behaviorHeaderRow = behaviorSheet.addRow(behaviorHeaders);
  behaviorHeaderRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  behaviorHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  behaviorHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  behaviorHeaderRow.height = 35;

  student.behaviorEvents
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .forEach((event) => {
      const categoryText = event.category === EventType.POSITIVE ? 'חיובי' : 
                          event.category === EventType.NEGATIVE ? 'שלילי' : 'ניטרלי';
      const isAbsence = isAbsenceEvent(event);
      const isOtherNeg = isOtherNegativeEvent(event);
      
      const row = behaviorSheet.addRow([
        format(event.date, 'dd/MM/yyyy'),
        event.type,
        categoryText,
        event.teacher,
        event.subject,
        event.lessonNumber,
        event.justification,
        event.comment,
        isAbsence ? 'כן' : 'לא',
        isOtherNeg ? 'כן' : 'לא'
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

      // צבע לפי קטגוריה
      const categoryCell = row.getCell(3);
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

      row.height = 22;
    });

  behaviorSheet.columns = [
    { width: 12 },
    { width: 25 },
    { width: 12 },
    { width: 20 },
    { width: 20 },
    { width: 10 },
    { width: 30 },
    { width: 40 },
    { width: 10 },
    { width: 12 }
  ];

  // גיליון סיכום לפי מקצועות
  const subjectsSheet = workbook.addWorksheet('סיכום לפי מקצועות');
  
  // כותרת
  subjectsSheet.mergeCells('A1:F1');
  const subjectsTitleCell = subjectsSheet.getCell('A1');
  subjectsTitleCell.value = `סיכום לפי מקצועות - ${student.name}`;
  subjectsTitleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  subjectsTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0C8EE6' }
  };
  subjectsTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  subjectsSheet.getRow(1).height = 30;

  const subjectsHeaders = ['מקצוע', 'מספר ציונים', 'ממוצע ציונים', 'מספר אירועי התנהגות', 'אירועים חיוביים', 'אירועים שליליים'];
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
  const subjectStats: Record<string, { grades: number[], positiveEvents: number, negativeEvents: number }> = {};
  
  student.grades.forEach((grade) => {
    const subject = grade.subject || 'כללי';
    if (!subjectStats[subject]) {
      subjectStats[subject] = { grades: [], positiveEvents: 0, negativeEvents: 0 };
    }
    subjectStats[subject].grades.push(grade.score);
  });
  
  student.behaviorEvents.forEach((event) => {
    const subject = event.subject || 'כללי';
    if (!subjectStats[subject]) {
      subjectStats[subject] = { grades: [], positiveEvents: 0, negativeEvents: 0 };
    }
    if (event.category === EventType.POSITIVE) {
      subjectStats[subject].positiveEvents++;
    } else if (event.category === EventType.NEGATIVE) {
      subjectStats[subject].negativeEvents++;
    }
  });

  Object.entries(subjectStats)
    .sort((a, b) => a[0].localeCompare(b[0], 'he'))
    .forEach(([subject, stats]) => {
      const avg = stats.grades.length > 0 
        ? stats.grades.reduce((sum, g) => sum + g, 0) / stats.grades.length 
        : 0;
      
      const row = subjectsSheet.addRow([
        subject,
        stats.grades.length,
        avg.toFixed(1),
        stats.positiveEvents + stats.negativeEvents,
        stats.positiveEvents,
        stats.negativeEvents
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
          avgCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE5E5' }
          };
        } else if (avg < 80) {
          avgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFF59E0B' } };
          avgCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF4E5' }
          };
        } else {
          avgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
          avgCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE5F5E5' }
          };
        }
      }

      // צבעים לאירועים
      const positiveCell = row.getCell(5);
      if (stats.positiveEvents > 0) {
        positiveCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF22C55E' } };
      }
      
      const negativeCell = row.getCell(6);
      if (stats.negativeEvents > 0) {
        negativeCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
      }

      row.height = 25;
    });

  subjectsSheet.columns = [
    { width: 25 },
    { width: 15 },
    { width: 15 },
    { width: 20 },
    { width: 18 },
    { width: 18 }
  ];

  // שמירת הקובץ
  const fileName = `דוח_תלמיד_${student.name}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}
