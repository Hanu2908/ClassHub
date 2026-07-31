import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { toast } from 'sonner';
import { getRollNumber } from '../../hooks/useCRAttendance';

export interface ReportStudent {
  id: string;
  name: string;
  classRoll: string | null;
  universityRoll?: string | null;
  subBatch?: '1' | '2' | null;
  status: 'present' | 'absent' | 'od' | 'makeup';
}

export interface AttendanceReportInput {
  sectionName: string;
  subjectCode: string;
  subjectName: string;
  date: string;
  lectureCount: number;
  targetBatch?: '1' | '2' | 'all' | null;
  teacherName?: string | null;
  students: ReportStudent[];
}

/**
 * Helper to sort students by roll number ascending
 */
export function sortReportStudents(students: ReportStudent[]): ReportStudent[] {
  return [...students].sort((a, b) => {
    const rA = getRollNumber(a.classRoll);
    const rB = getRollNumber(b.classRoll);
    if (rA !== rB) return rA - rB;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Generates a clean, plain-text report formatted for WhatsApp / Telegram sharing
 */
export function generateWhatsAppAttendanceReport(input: AttendanceReportInput): string {
  const sorted = sortReportStudents(input.students);
  const total = sorted.length;
  const present = sorted.filter(s => s.status === 'present').length;
  const absentStudents = sorted.filter(s => s.status === 'absent');
  const odStudents = sorted.filter(s => s.status === 'od');
  const makeupStudents = sorted.filter(s => s.status === 'makeup');
  const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';

  const batchText = input.targetBatch && input.targetBatch !== 'all' ? ` (Batch ${input.targetBatch})` : '';
  const dateFormatted = new Date(input.date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  let report = `📊 *CLASS ATTENDANCE REPORT*\n`;
  report += `*Section:* ${input.sectionName || 'Section'}\n`;
  report += `*Subject:* ${input.subjectCode} — ${input.subjectName}\n`;
  report += `*Date:* ${dateFormatted} | *Lectures:* ${input.lectureCount}${batchText}\n`;
  if (input.teacherName) {
    report += `*Instructor:* ${input.teacherName}\n`;
  }
  report += `\n📈 *SUMMARY:* ${present} / ${total} Present (${percentage}%)\n`;
  report += `• Present: ${present}\n`;
  report += `• Absent: ${absentStudents.length}\n`;
  if (odStudents.length > 0) report += `• On-Duty (OD): ${odStudents.length}\n`;
  if (makeupStudents.length > 0) report += `• Makeup: ${makeupStudents.length}\n`;

  report += `\n❌ *ABSENTEES (${absentStudents.length}):*\n`;
  if (absentStudents.length === 0) {
    report += `🎉 None! 100% Attendance!\n`;
  } else {
    absentStudents.forEach((st, idx) => {
      const rollStr = st.classRoll ? `Roll ${st.classRoll}` : `Student #${idx + 1}`;
      report += `${idx + 1}. ${rollStr} — ${st.name}\n`;
    });
  }

  if (odStudents.length > 0) {
    report += `\n🔹 *ON-DUTY (OD) (${odStudents.length}):*\n`;
    odStudents.forEach((st, idx) => {
      const rollStr = st.classRoll ? `Roll ${st.classRoll}` : `Student #${idx + 1}`;
      report += `${idx + 1}. ${rollStr} — ${st.name}\n`;
    });
  }

  report += `\n— Sent via ClassHub PWA`;
  return report;
}

/**
 * Generates CSV string for attendance export
 */
export function generateAttendanceCSV(input: AttendanceReportInput): string {
  const sorted = sortReportStudents(input.students);
  const rows: string[] = [];

  // CSV Metadata headers
  rows.push(`"ClassHub Attendance Register Export"`);
  rows.push(`"Section","${input.sectionName || ''}"`);
  rows.push(`"Subject Code","${input.subjectCode || ''}"`);
  rows.push(`"Subject Name","${input.subjectName || ''}"`);
  rows.push(`"Date","${input.date || ''}"`);
  rows.push(`"Lecture Count","${input.lectureCount || 1}"`);
  rows.push(`""`); // Empty line separator

  // Data Column Headers
  rows.push(`"Roll No","Student Name","Status","Sub-Batch","University Roll"`);

  // Data Rows
  sorted.forEach(s => {
    const roll = `"${s.classRoll || ''}"`;
    const name = `"${s.name.replace(/"/g, '""')}"`;
    const status = `"${s.status.toUpperCase()}"`;
    const batch = `"${s.subBatch ? 'Batch ' + s.subBatch : 'Full Section'}"`;
    const uniRoll = `"${s.universityRoll || ''}"`;
    rows.push(`${roll},${name},${status},${batch},${uniRoll}`);
  });

  return rows.join('\n');
}

/**
 * Generates an official styled PDF Document using pdf-lib and triggers browser download
 */
export async function generateAttendancePDF(input: AttendanceReportInput): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait in points (72 DPI)
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const sorted = sortReportStudents(input.students);
  const total = sorted.length;
  const present = sorted.filter(s => s.status === 'present').length;
  const absentCount = sorted.filter(s => s.status === 'absent').length;
  const odCount = sorted.filter(s => s.status === 'od').length;
  const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';

  let y = 800;

  // Header Banner
  page.drawRectangle({
    x: 35, y: y - 50, width: 525, height: 60,
    color: rgb(0.1, 0.15, 0.25),
  });

  page.drawText('CLASSHUB ATTENDANCE REGISTER', {
    x: 50, y: y - 25, size: 16, font: fontHelveticaBold, color: rgb(0.3, 0.65, 1),
  });

  page.drawText(`Section: ${input.sectionName || 'P2'} | Date: ${input.date}`, {
    x: 50, y: y - 42, size: 10, font: fontHelvetica, color: rgb(0.9, 0.9, 0.9),
  });

  y -= 70;

  // Session Metadata
  page.drawText(`Subject: ${input.subjectCode} — ${input.subjectName}`, {
    x: 35, y, size: 12, font: fontHelveticaBold, color: rgb(0.1, 0.1, 0.1),
  });
  y -= 18;

  page.drawText(`Lecture Count: ${input.lectureCount} period(s) | Target: ${input.targetBatch && input.targetBatch !== 'all' ? 'Batch ' + input.targetBatch : 'Full Section'}`, {
    x: 35, y, size: 10, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4),
  });
  y -= 30;

  // Summary Cards Box
  page.drawRectangle({
    x: 35, y: y - 35, width: 525, height: 45,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  page.drawText(`TOTAL: ${total}`, { x: 50, y: y - 22, size: 10, font: fontHelveticaBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(`PRESENT: ${present}`, { x: 150, y: y - 22, size: 10, font: fontHelveticaBold, color: rgb(0.1, 0.6, 0.3) });
  page.drawText(`ABSENT: ${absentCount}`, { x: 260, y: y - 22, size: 10, font: fontHelveticaBold, color: rgb(0.8, 0.2, 0.2) });
  page.drawText(`OD: ${odCount}`, { x: 360, y: y - 22, size: 10, font: fontHelveticaBold, color: rgb(0.2, 0.4, 0.8) });
  page.drawText(`PCT: ${percentage}%`, { x: 450, y: y - 22, size: 11, font: fontHelveticaBold, color: rgb(0.1, 0.4, 0.8) });

  y -= 60;

  // Table Header
  page.drawRectangle({
    x: 35, y: y - 18, width: 525, height: 22,
    color: rgb(0.2, 0.25, 0.35),
  });

  page.drawText('ROLL NO', { x: 45, y: y - 12, size: 9, font: fontHelveticaBold, color: rgb(1, 1, 1) });
  page.drawText('STUDENT NAME', { x: 130, y: y - 12, size: 9, font: fontHelveticaBold, color: rgb(1, 1, 1) });
  page.drawText('BATCH', { x: 340, y: y - 12, size: 9, font: fontHelveticaBold, color: rgb(1, 1, 1) });
  page.drawText('ATTENDANCE STATUS', { x: 430, y: y - 12, size: 9, font: fontHelveticaBold, color: rgb(1, 1, 1) });

  y -= 25;

  // Table Rows
  for (let i = 0; i < sorted.length; i++) {
    const st = sorted[i];

    // Check if new page needed
    if (y < 40) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 800;
    }

    const rowBg = i % 2 === 0 ? rgb(0.98, 0.98, 0.99) : rgb(1, 1, 1);
    page.drawRectangle({
      x: 35, y: y - 14, width: 525, height: 18,
      color: rowBg,
      borderColor: rgb(0.92, 0.93, 0.95),
      borderWidth: 0.5,
    });

    const statusColor =
      st.status === 'present'
        ? rgb(0.1, 0.6, 0.3)
        : st.status === 'absent'
          ? rgb(0.85, 0.2, 0.2)
          : rgb(0.2, 0.4, 0.8);

    page.drawText(st.classRoll || '—', { x: 45, y: y - 10, size: 9, font: fontHelvetica, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(st.name.substring(0, 32), { x: 130, y: y - 10, size: 9, font: fontHelveticaBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(st.subBatch ? `Batch ${st.subBatch}` : 'Section', { x: 340, y: y - 10, size: 9, font: fontHelvetica, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(st.status.toUpperCase(), { x: 430, y: y - 10, size: 9, font: fontHelveticaBold, color: statusColor });

    y -= 19;
  }

  // Footer stamp
  y -= 20;
  if (y < 30) {
    page = pdfDoc.addPage([595.28, 841.89]);
    y = 800;
  }

  page.drawText(`Generated on ${new Date().toLocaleString()} via ClassHub Academic PWA`, {
    x: 35, y, size: 8, font: fontHelvetica, color: rgb(0.6, 0.6, 0.6),
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Attendance_${input.subjectCode}_${input.date}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers native Web Share API or falls back to Clipboard Copy
 */
export async function shareOrCopyReport(reportText: string, titleStr: string = 'Attendance Report'): Promise<void> {
  if (navigator.share && navigator.canShare && navigator.canShare({ text: reportText })) {
    try {
      await navigator.share({
        title: titleStr,
        text: reportText,
      });
      toast.success('Report shared!');
      return;
    } catch (err: any) {
      if (err.name === 'AbortError') return; // User cancelled share dialog
    }
  }

  // Fallback to Clipboard
  try {
    await navigator.clipboard.writeText(reportText);
    toast.success('WhatsApp report copied to clipboard! 📋');
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    toast.error('Failed to copy to clipboard');
  }
}

/**
 * Triggers CSV file download in browser
 */
export function downloadAttendanceCSV(input: AttendanceReportInput): void {
  const csvContent = generateAttendanceCSV(input);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Attendance_${input.subjectCode}_${input.date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success('CSV register downloaded! 📊');
}
