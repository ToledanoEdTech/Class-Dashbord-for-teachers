import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type { PedagogicalMeeting, StudentMeetingNote, MeetingDecision } from '../types';

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF0C8EE6' } };
const TITLE_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF6366F1' } };
const BORDER = {
  top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
};

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 30;
}

function styleDataRow(row: ExcelJS.Row, alt = false) {
  row.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { name: 'Arial', size: 10 };
    cell.alignment = { vertical: 'top', horizontal: 'right', wrapText: true };
    cell.border = BORDER;
    if (alt) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
  });
}

function riskLabel(level?: string): string {
  if (level === 'high') return 'גבוה';
  if (level === 'medium') return 'בינוני';
  if (level === 'low') return 'נמוך';
  return '';
}

function statusLabel(status: PedagogicalMeeting['status']): string {
  const map: Record<PedagogicalMeeting['status'], string> = {
    draft: 'טיוטה',
    collecting: 'איסוף הערות',
    in_progress: 'בישיבה',
    completed: 'הושלמה',
  };
  return map[status] ?? status;
}

export async function exportPedagogicalMeetingToExcel(
  meeting: PedagogicalMeeting,
  notes: StudentMeetingNote[],
  decisions: MeetingDecision[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ClassMap';
  workbook.created = new Date();

  const participants = meeting.participants;
  const students = meeting.studentSnapshot;

  // ── גיליון 1: סיכום ישיבה ──
  const summary = workbook.addWorksheet('סיכום ישיבה');
  summary.mergeCells('A1:D1');
  const titleCell = summary.getCell('A1');
  titleCell.value = `ישיבה פדגוגית – ${meeting.title}`;
  titleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = TITLE_FILL;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summary.getRow(1).height = 35;

  const infoRows: [string, string][] = [
    ['כיתה', meeting.className],
    ['מחנך/ת', meeting.homeroomTeacherName],
    ['תאריך יצירה', format(new Date(meeting.createdAt), 'dd/MM/yyyy HH:mm')],
    ['סטטוס', statusLabel(meeting.status)],
    ['מספר תלמידים', String(students.length)],
    ['מספר מורים משתתפים', String(participants.length)],
  ];
  if (meeting.completedAt) {
    infoRows.push(['תאריך סיום', format(new Date(meeting.completedAt), 'dd/MM/yyyy HH:mm')]);
  }
  infoRows.forEach(([label, value]) => {
    const row = summary.addRow([label, value]);
    row.getCell(1).font = { name: 'Arial', size: 11, bold: true };
    row.getCell(2).font = { name: 'Arial', size: 11 };
    row.getCell(1).alignment = { horizontal: 'right' };
    row.getCell(2).alignment = { horizontal: 'right' };
  });

  summary.addRow([]);
  const partHeader = summary.addRow(['מורה', 'מקצוע', 'סטטוס']);
  styleHeaderRow(partHeader);
  participants.forEach((p, i) => {
    const row = summary.addRow([p.teacherName, p.subject, p.submittedAt ? 'הגיש/ה הערות' : 'טרם הגיש/ה']);
    styleDataRow(row, i % 2 === 1);
  });
  summary.getColumn(1).width = 25;
  summary.getColumn(2).width = 20;
  summary.getColumn(3).width = 18;

  // ── גיליון 2: הערות לפי תלמיד ──
  const notesSheet = workbook.addWorksheet('הערות לפי תלמיד');
  notesSheet.mergeCells(1, 1, 1, 3 + participants.length);
  const notesTitle = notesSheet.getCell('A1');
  notesTitle.value = `הערות מורים – ${meeting.className}`;
  notesTitle.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  notesTitle.fill = TITLE_FILL;
  notesTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  notesSheet.getRow(1).height = 30;

  const noteHeaders = ['שם תלמיד', 'ממוצע', 'רמת סיכון', ...participants.map((p) => `${p.subject} (${p.teacherName})`)];
  const noteHeaderRow = notesSheet.addRow(noteHeaders);
  styleHeaderRow(noteHeaderRow);

  students.forEach((student, i) => {
    const rowData: (string | number)[] = [
      student.name,
      student.averageScore != null ? student.averageScore.toFixed(1) : '',
      riskLabel(student.riskLevel),
    ];
    participants.forEach((p) => {
      const note = notes.find((n) => n.studentId === student.id && n.participantId === p.id);
      rowData.push(note?.note ?? '');
    });
    const row = notesSheet.addRow(rowData);
    styleDataRow(row, i % 2 === 1);
  });
  notesSheet.getColumn(1).width = 22;
  notesSheet.getColumn(2).width = 10;
  notesSheet.getColumn(3).width = 12;
  for (let c = 4; c <= 3 + participants.length; c++) {
    notesSheet.getColumn(c).width = 30;
  }

  // ── גיליון 3: החלטות והמלצות ──
  const decSheet = workbook.addWorksheet('החלטות והמלצות');
  decSheet.mergeCells('A1:D1');
  const decTitle = decSheet.getCell('A1');
  decTitle.value = 'החלטות והמלצות להמשך';
  decTitle.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  decTitle.fill = TITLE_FILL;
  decTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  decSheet.getRow(1).height = 30;

  const decHeader = decSheet.addRow(['תלמיד', 'החלטה / המלצה', 'נכתב על ידי', 'תפקיד']);
  styleHeaderRow(decHeader);

  if (decisions.length === 0) {
    const row = decSheet.addRow(['', 'לא נרשמו החלטות', '', '']);
    styleDataRow(row);
  } else {
    decisions.forEach((d, i) => {
      const roleText = d.authorRole === 'coordinator' ? 'רכז/ת' : 'מחנך/ת';
      const row = decSheet.addRow([d.studentName ?? 'כללי (כיתה)', d.text, d.authorName, roleText]);
      styleDataRow(row, i % 2 === 1);
    });
  }
  decSheet.getColumn(1).width = 22;
  decSheet.getColumn(2).width = 50;
  decSheet.getColumn(3).width = 20;
  decSheet.getColumn(4).width = 12;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ישיבה_פדגוגית_${meeting.className}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
