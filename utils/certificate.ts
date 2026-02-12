import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Student, Grade, BehaviorEvent, isAbsenceEvent, EventType } from '../types';
import { format } from 'date-fns';

interface CertificateOptions {
  selectedSubjects?: string[];
}

/**
 * מחשב ממוצע ציונים למקצוע מסוים
 */
function calculateSubjectAverage(grades: Grade[], subject: string): number {
  const subjectGrades = grades.filter(g => g.subject === subject);
  if (subjectGrades.length === 0) return 0;
  
  const totalWeight = subjectGrades.reduce((sum, g) => sum + g.weight, 0);
  const weightedSum = subjectGrades.reduce((sum, g) => sum + g.score * g.weight, 0);
  
  if (totalWeight > 0) {
    return weightedSum / totalWeight;
  }
  
  return subjectGrades.reduce((sum, g) => sum + g.score, 0) / subjectGrades.length;
}

/**
 * מחזיר רשימת חיסורים לפי מקצוע
 */
function getAbsencesBySubject(events: BehaviorEvent[]): Record<string, number> {
  const absences: Record<string, number> = {};
  events.filter(isAbsenceEvent).forEach(e => {
    const subject = e.subject || 'כללי';
    absences[subject] = (absences[subject] || 0) + 1;
  });
  return absences;
}

/**
 * מחזיר סיכום אירועי משמעת לפי סוג (type)
 */
function getDisciplineEventsSummary(events: BehaviorEvent[]): {
  positive: Array<{ type: string; count: number }>;
  negative: Array<{ type: string; count: number }>;
} {
  const positiveMap: Record<string, number> = {};
  const negativeMap: Record<string, number> = {};
  
  events.forEach(e => {
    if (isAbsenceEvent(e)) return; // חיסורים נכללים בנפרד
    
    const eventType = e.type?.trim() || 'אירוע לא מזוהה';
    
    if (e.category === EventType.POSITIVE) {
      positiveMap[eventType] = (positiveMap[eventType] || 0) + 1;
    } else if (e.category === EventType.NEGATIVE) {
      negativeMap[eventType] = (negativeMap[eventType] || 0) + 1;
    }
  });
  
  const positive = Object.entries(positiveMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count); // סדר יורד
  
  const negative = Object.entries(negativeMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count); // סדר יורד
  
  return { positive, negative };
}

/**
 * יוצר HTML מעוצב לתעודה
 */
function createCertificateHTML(student: Student, options: CertificateOptions = {}): string {
  const allSubjects = new Set<string>();
  student.grades.forEach(g => {
    if (g.subject && g.subject.trim() && !/^\d+$/.test(g.subject.trim())) {
      allSubjects.add(g.subject);
    }
  });
  
  const subjectsToShow = options.selectedSubjects && options.selectedSubjects.length > 0
    ? options.selectedSubjects.filter(s => allSubjects.has(s))
    : Array.from(allSubjects).sort();
  
  const absencesBySubject = getAbsencesBySubject(student.behaviorEvents);
  // מציגים את כל החיסורים בכל המקצועות, לא רק במקצועות שנבחרו
  // מיון בסדר יורד - מהכי הרבה חיסורים להכי מעט
  const relevantAbsences = Object.entries(absencesBySubject)
    .sort((a, b) => b[1] - a[1]); // סדר יורד לפי מספר חיסורים
  
  const disciplineEvents = getDisciplineEventsSummary(student.behaviorEvents);
  
  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap');
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Assistant', 'Segoe UI', 'Arial Hebrew', 'Arial', sans-serif;
          direction: rtl;
          background: #f8fafc;
          padding: 20px;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          font-feature-settings: "kern" 1;
          text-rendering: optimizeLegibility;
          font-size: 16px;
        }
        .certificate-container {
          width: 210mm;
          min-height: 297mm;
          background: #ffffff;
          margin: 0 auto;
          padding: 20mm;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          position: relative;
          overflow: hidden;
        }
        .certificate-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 8mm;
          background: linear-gradient(135deg, #0C8EE6 0%, #0ea5e9 100%);
        }
        .certificate-border {
          position: absolute;
          top: 12mm;
          left: 12mm;
          right: 12mm;
          bottom: 12mm;
          border: 4px solid #0C8EE6;
          border-radius: 12px;
          pointer-events: none;
          box-shadow: inset 0 0 20px rgba(12, 142, 230, 0.1);
        }
        .certificate-inner-border {
          position: absolute;
          top: 16mm;
          left: 16mm;
          right: 16mm;
          bottom: 16mm;
          border: 2px solid rgba(12, 142, 230, 0.3);
          border-radius: 8px;
          pointer-events: none;
        }
        .header {
          text-align: center;
          margin-bottom: 35px;
          padding-bottom: 25px;
          border-bottom: 3px solid #e2e8f0;
          position: relative;
          padding-top: 15px;
        }
        .header::after {
          content: '';
          position: absolute;
          bottom: -3px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 3px;
          background: linear-gradient(135deg, #0C8EE6 0%, #0ea5e9 100%);
        }
        .title {
          font-size: 36px;
          font-weight: 700;
          color: #0C8EE6;
          margin-bottom: 12px;
          letter-spacing: 0.5px;
          line-height: 1.3;
          text-shadow: 0 2px 4px rgba(12, 142, 230, 0.15);
        }
        .student-name {
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 10px;
          padding: 10px 24px;
          display: inline-block;
          background: #ffffff;
          border-radius: 8px;
          border: 3px solid #0C8EE6;
          box-shadow: 0 2px 8px rgba(12, 142, 230, 0.15);
          letter-spacing: 0.3px;
          line-height: 1.4;
        }
        .date {
          font-size: 13px;
          color: #475569;
          margin-top: 8px;
          font-weight: 500;
          letter-spacing: 0.2px;
          line-height: 1.5;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 18px;
          padding-bottom: 10px;
          border-bottom: 3px solid #0C8EE6;
          letter-spacing: 0.4px;
          line-height: 1.5;
        }
        .grades-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-bottom: 25px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .grades-table thead {
          background: linear-gradient(135deg, #0C8EE6 0%, #0ea5e9 100%);
          color: white;
        }
        .grades-table th {
          padding: 16px 18px;
          text-align: right;
          font-weight: 600;
          font-size: 17px;
          letter-spacing: 0.5px;
          line-height: 1.6;
        }
        .grades-table th:first-child {
          border-top-right-radius: 8px;
        }
        .grades-table th:last-child {
          border-top-left-radius: 8px;
        }
        .grades-table td {
          padding: 16px 18px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 15px;
          background: white;
          vertical-align: top;
          letter-spacing: 0.3px;
          line-height: 1.7;
        }
        .grades-table tbody tr:last-child td {
          border-bottom: none;
        }
        .grades-table tbody tr:nth-child(even) td {
          background: #f8fafc;
        }
        .grades-table tbody tr:nth-child(even) td .grade-item {
          background: #ffffff;
        }
        .subject-name {
          font-weight: 700;
          color: #0f172a;
          font-size: 18px;
          letter-spacing: 0.4px;
          line-height: 1.6;
        }
        .grades-list {
          color: #1e293b;
          font-size: 14px;
          line-height: 1.9;
          letter-spacing: 0.3px;
        }
        .grade-item {
          margin-bottom: 10px;
          padding: 8px 12px;
          background: #f8fafc;
          border-radius: 6px;
          border-right: 3px solid #0C8EE6;
        }
        .grade-item:last-child {
          margin-bottom: 0;
        }
        .grade-score {
          font-weight: 700;
          color: #0f172a;
          font-size: 16px;
          margin-left: 8px;
          letter-spacing: 0.3px;
        }
        .grade-type {
          color: #475569;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.3px;
        }
        .grade-date {
          color: #64748b;
          font-size: 11px;
          margin-top: 4px;
          letter-spacing: 0.2px;
        }
        .average-grade {
          font-weight: 700;
          font-size: 22px;
          text-align: center;
          padding: 12px;
          border-radius: 8px;
          letter-spacing: 0.5px;
        }
        .average-excellent {
          color: #065f46;
          background: #d1fae5;
        }
        .average-good {
          color: #92400e;
          background: #fef3c7;
        }
        .average-poor {
          color: #991b1b;
          background: #fee2e2;
        }
        .absences-list {
          list-style: none;
          padding: 0;
        }
        .absences-list li {
          padding: 12px 14px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 16px;
          color: #1e293b;
          background: #f8fafc;
          margin-bottom: 6px;
          border-radius: 6px;
          border-right: 3px solid #f59e0b;
          letter-spacing: 0.3px;
          line-height: 1.7;
        }
        .absences-list li strong {
          color: #0f172a;
          font-weight: 700;
          letter-spacing: 0.4px;
          font-size: 17px;
        }
        .absences-list li:last-child {
          border-bottom: none;
        }
        .events-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 15px;
        }
        .events-positive, .events-negative {
          padding: 15px;
          border-radius: 8px;
        }
        .events-positive {
          background: #ecfdf5;
          border: 2px solid #10b981;
        }
        .events-negative {
          background: #fef2f2;
          border: 2px solid #ef4444;
        }
        .events-title {
          font-weight: 700;
          font-size: 18px;
          margin-bottom: 14px;
          letter-spacing: 0.4px;
          line-height: 1.5;
        }
        .events-positive .events-title {
          color: #065f46;
        }
        .events-negative .events-title {
          color: #991b1b;
        }
        .event-summary-item {
          padding: 12px 14px;
          font-size: 15px;
          color: #1e293b;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          background: white;
          margin-bottom: 8px;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          letter-spacing: 0.3px;
          line-height: 1.6;
        }
        .event-summary-item:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }
        .event-type-name {
          color: #0f172a;
          font-weight: 600;
          flex: 1;
          font-size: 16px;
        }
        .event-count {
          font-weight: 700;
          font-size: 18px;
          padding: 6px 12px;
          border-radius: 6px;
          min-width: 45px;
          text-align: center;
          letter-spacing: 0.3px;
        }
        .events-positive .event-count {
          color: #065f46;
          background: #d1fae5;
        }
        .events-negative .event-count {
          color: #991b1b;
          background: #fee2e2;
        }
        .no-data {
          text-align: center;
          color: #64748b;
          font-style: italic;
          padding: 20px;
          font-size: 16px;
          background: #f8fafc;
          border-radius: 6px;
          letter-spacing: 0.3px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #e2e8f0;
          text-align: center;
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="certificate-container">
        <div class="certificate-border"></div>
        <div class="certificate-inner-border"></div>
        
        <div class="header">
          <div class="title">תעודת תלמיד</div>
          <div class="title" style="font-size: 20px; margin-top: 5px; color: #64748b;">לקראת אסיפת הורים</div>
          <div class="student-name">${student.name}</div>
          <div class="date">נוצר ב-${format(new Date(), 'dd/MM/yyyy')}</div>
        </div>
        
        ${subjectsToShow.length > 0 ? `
        <div class="section">
          <div class="section-title">ציונים שוטפים וממוצע תקופתי</div>
          <table class="grades-table">
            <thead>
              <tr>
                <th style="width: 30%;">מקצוע</th>
                <th style="width: 45%;">ציונים שוטפים</th>
                <th style="width: 25%;">ממוצע תקופתי</th>
              </tr>
            </thead>
            <tbody>
              ${subjectsToShow.map(subject => {
                const subjectGrades = student.grades
                  .filter(g => g.subject === subject)
                  .sort((a, b) => b.date.getTime() - a.date.getTime())
                  .slice(0, 8); // עד 8 ציונים אחרונים
                const average = calculateSubjectAverage(student.grades, subject);
                const averageClass = average >= 80 ? 'average-excellent' : average >= 60 ? 'average-good' : 'average-poor';
                
                const gradesHTML = subjectGrades.length > 0
                  ? subjectGrades.map(g => {
                      const assignmentText = g.assignment && g.assignment.trim() ? g.assignment.trim() : 'מטלה';
                      const dateText = format(g.date, 'dd/MM/yyyy');
                      return `
                        <div class="grade-item">
                          <div>
                            <span class="grade-score">${g.score}</span>
                            <span class="grade-type">- ${assignmentText}</span>
                          </div>
                          <div class="grade-date">${dateText}</div>
                        </div>
                      `;
                    }).join('')
                  : '<div class="no-data" style="text-align: right; padding: 10px;">אין ציונים</div>';
                
                return `
                  <tr>
                    <td class="subject-name">${subject}</td>
                    <td class="grades-list">${gradesHTML}</td>
                    <td class="average-grade ${averageClass}">${average.toFixed(1)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
        
        <div class="section">
          <div class="section-title">חיסורים לפי מקצוע</div>
          ${relevantAbsences.length > 0 ? `
            <ul class="absences-list">
              ${relevantAbsences.map(([subject, count]) => `
                <li><strong>${subject}:</strong> ${count} חיסור${count !== 1 ? 'ים' : ''}</li>
              `).join('')}
            </ul>
          ` : `
            <div class="no-data">אין חיסורים רשומים</div>
          `}
        </div>
        
        <div class="section">
          <div class="section-title">אירועי משמעת</div>
          ${disciplineEvents.positive.length > 0 || disciplineEvents.negative.length > 0 ? `
            <div class="events-section">
              ${disciplineEvents.positive.length > 0 ? `
                <div class="events-positive">
                  <div class="events-title">חיוביים</div>
                  ${disciplineEvents.positive.map(event => `
                    <div class="event-summary-item">
                      <span class="event-type-name">${event.type}</span>
                      <span class="event-count">${event.count}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              ${disciplineEvents.negative.length > 0 ? `
                <div class="events-negative">
                  <div class="events-title">שליליים</div>
                  ${disciplineEvents.negative.map(event => `
                    <div class="event-summary-item">
                      <span class="event-type-name">${event.type}</span>
                      <span class="event-count">${event.count}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          ` : `
            <div class="no-data">אין אירועי משמעת רשומים</div>
          `}
        </div>
        
        <div class="footer">
          תעודה זו נוצרה אוטומטית על ידי מערכת ניהול כיתה
        </div>
      </div>
    </body>
    </html>
  `;
  
  return html;
}

/**
 * טוען פונט עברי
 */
function loadHebrewFont(): Promise<void> {
  return new Promise((resolve) => {
    // בדוק אם הפונט כבר נטען
    const existingLink = document.querySelector('link[href*="fonts.googleapis.com/css2?family=Assistant"]');
    if (existingLink) {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => setTimeout(resolve, 300));
      } else {
        setTimeout(resolve, 500);
      }
      return;
    }
    
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap';
    link.rel = 'stylesheet';
    link.onload = () => {
      // המתן שהפונט יטען
      setTimeout(() => {
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => {
            // המתן עוד קצת כדי לוודא שהפונט נטען
            setTimeout(resolve, 500);
          });
        } else {
          setTimeout(resolve, 1500);
        }
      }, 300);
    };
    link.onerror = () => {
      // גם אם יש שגיאה, נמשיך
      setTimeout(resolve, 500);
    };
    document.head.appendChild(link);
  });
}

/**
 * יוצר תעודה ב-PDF לתלמיד בודד
 */
export async function generateStudentCertificate(
  student: Student,
  options: CertificateOptions = {}
): Promise<void> {
  // טעינת פונט עברי
  await loadHebrewFont();
  
  // יצירת HTML מעוצב
  const html = createCertificateHTML(student, options);
  
  // יצירת div זמני להצגת ה-HTML
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'fixed';
  tempDiv.style.left = '-10000px';
  tempDiv.style.top = '0';
  tempDiv.style.width = '794px'; // A4 width in pixels
  tempDiv.style.height = 'auto';
  tempDiv.style.overflow = 'hidden';
  tempDiv.innerHTML = html;
  document.body.appendChild(tempDiv);
  
  try {
    // המתן לטעינת הפונטים והתמונות
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    const certificateElement = tempDiv.querySelector('.certificate-container') as HTMLElement;
    if (!certificateElement) {
      throw new Error('לא נמצא אלמנט התעודה');
    }
    
    const canvas = await html2canvas(certificateElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      height: certificateElement.scrollHeight,
      windowWidth: 794,
      windowHeight: certificateElement.scrollHeight,
    } as any);
    
    const imgData = canvas.toDataURL('image/png', 0.95);
    
    // יצירת PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = Math.min((canvas.height * pdfWidth) / canvas.width, pdfHeight);
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    
    // שמירת הקובץ
    const fileName = `תעודה_${student.name}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    pdf.save(fileName);
    
    // ניקוי
    document.body.removeChild(tempDiv);
  } catch (error) {
    if (document.body.contains(tempDiv)) {
      document.body.removeChild(tempDiv);
    }
    throw error;
  }
}

/**
 * יוצר קובץ PDF אחד עם תעודות לכל התלמידים בכיתה
 */
export async function generateClassCertificates(
  students: Student[],
  options: CertificateOptions = {}
): Promise<void> {
  // טעינת פונט עברי
  await loadHebrewFont();
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  for (let i = 0; i < students.length; i++) {
    if (i > 0) {
      pdf.addPage();
    }
    
    const student = students[i];
    const html = createCertificateHTML(student, options);
    
    // יצירת div זמני
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-10000px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '794px';
    tempDiv.style.height = 'auto';
    tempDiv.style.overflow = 'hidden';
    tempDiv.innerHTML = html;
    document.body.appendChild(tempDiv);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const certificateElement = tempDiv.querySelector('.certificate-container') as HTMLElement;
      if (!certificateElement) {
        throw new Error('לא נמצא אלמנט התעודה');
      }
      
      const canvas = await html2canvas(certificateElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: certificateElement.scrollHeight,
        windowWidth: 794,
        windowHeight: certificateElement.scrollHeight,
      } as any);
      
      const imgData = canvas.toDataURL('image/png', 0.95);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = Math.min((canvas.height * pdfWidth) / canvas.width, pdfHeight);
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      if (document.body.contains(tempDiv)) {
        document.body.removeChild(tempDiv);
      }
    } catch (error) {
      if (document.body.contains(tempDiv)) {
        document.body.removeChild(tempDiv);
      }
      throw error;
    }
  }
  
  // שמירת הקובץ
  const fileName = `תעודות_כיתה_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  pdf.save(fileName);
}
