import { toast } from 'sonner';
import { getRollNumber } from '../../hooks/useCRAttendance';

export interface PendingReportStudent {
  id: string;
  name: string;
  classRoll: string | null;
}

export interface PendingAssignmentReportInput {
  sectionName?: string;
  subjectCode: string;
  subjectName: string;
  assignmentTitle: string;
  dueDate?: string | null;
  totalStudents: number;
  submittedCount: number;
  pendingStudents: PendingReportStudent[];
}

/**
 * Sorts pending students by roll number ascending, placing unrolled students at the end
 */
export function sortPendingStudents(students: PendingReportStudent[]): PendingReportStudent[] {
  return [...students].sort((a, b) => {
    const rA = getRollNumber(a.classRoll);
    const rB = getRollNumber(b.classRoll);
    if (rA !== rB) return rA - rB;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Generates a clean, simplified plain-text pending assignment report formatted for WhatsApp / Telegram
 */
export function generatePendingAssignmentReport(input: PendingAssignmentReportInput): string {
  const sorted = sortPendingStudents(input.pendingStudents);
  const pendingCount = sorted.length;

  let dateFormatted = 'Not specified';
  if (input.dueDate) {
    try {
      const d = new Date(input.dueDate);
      if (!isNaN(d.getTime())) {
        dateFormatted = d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }
    } catch {
      dateFormatted = input.dueDate;
    }
  }

  const subjectHeader = input.subjectCode && input.subjectName && input.subjectCode !== input.subjectName
    ? `${input.subjectCode} — ${input.subjectName}`
    : (input.subjectName || input.subjectCode || 'General');

  if (pendingCount === 0) {
    let report = `✅ *ALL ASSIGNMENTS SUBMITTED!*\n\n`;
    if (input.sectionName) report += `*Section:* ${input.sectionName}\n`;
    report += `📚 *Subject:* ${subjectHeader}\n`;
    report += `📝 *Assignment:* ${input.assignmentTitle}\n\n`;
    report += `🎉 All ${input.totalStudents} students have submitted!\n`;
    report += `— Sent via ClassHub`;
    return report;
  }

  let report = `⚠️ *PENDING ASSIGNMENT REMINDER*\n\n`;
  if (input.sectionName) report += `*Section:* ${input.sectionName}\n`;
  report += `📚 *Subject:* ${subjectHeader}\n`;
  report += `📝 *Assignment:* ${input.assignmentTitle}\n`;
  report += `⏰ *Deadline:* ${dateFormatted} ⚠️\n\n`;
  report += `🚨 *Pending Students (${pendingCount} / ${input.totalStudents}):*\n`;

  sorted.forEach((st, idx) => {
    const rollStr = st.classRoll ? `Roll ${st.classRoll}` : `Student #${idx + 1}`;
    report += `${idx + 1}. ${rollStr} — ${st.name}\n`;
  });

  report += `\n⚠️ Submit your assignment ASAP!\n`;
  report += `— Sent via ClassHub`;
  return report;
}

/**
 * Triggers native Web Share API or falls back seamlessly to Clipboard Copy
 */
export async function shareOrCopyPendingAssignmentReport(
  input: PendingAssignmentReportInput
): Promise<void> {
  const reportText = generatePendingAssignmentReport(input);
  const titleStr = `Pending Assignment: ${input.assignmentTitle}`;

  if (navigator.share && navigator.canShare && navigator.canShare({ text: reportText })) {
    try {
      await navigator.share({
        title: titleStr,
        text: reportText,
      });
      toast.success('Pending list shared!');
      return;
    } catch (err: any) {
      if (err.name === 'AbortError') return; // User cancelled share dialog
    }
  }

  // Fallback to Clipboard
  try {
    await navigator.clipboard.writeText(reportText);
    toast.success('Pending list copied to clipboard! 📋');
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    toast.error('Failed to copy to clipboard');
  }
}
