import { useState, useMemo, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { useSubjects } from '../hooks/useSubjects';
import { useSectionRosterForAttendance, useLogCRAttendanceMutation } from '../hooks/useCRAttendance';
import { useAppStore } from '../store/appStore';
import { toast } from 'sonner';
import { haptics } from '../lib/haptics';
import {
  Check, Search, Loader2, Calendar, BookOpen, Clock, UserCheck, Filter, RotateCcw,
  FileText, Download, Copy, CheckCircle2, MessageSquare, X
} from 'lucide-react';
import {
  generateWhatsAppAttendanceReport,
  createAttendancePDFBlob,
  shareOrCopyReport,
  downloadAttendanceCSV,
  type ReportStudent,
} from '../lib/utils/attendanceReport';

export interface CRAttendanceRegisterModalProps {
  open: boolean;
  onClose: () => void;
  initialSubjectId?: string;
  initialTimetableSlotId?: string;
  initialTargetBatch?: '1' | '2' | 'all';
}

type AttendanceStatus = 'present' | 'absent' | 'od' | 'makeup';

export function CRAttendanceRegisterModal({
  open,
  onClose,
  initialSubjectId,
  initialTimetableSlotId,
  initialTargetBatch = 'all',
}: CRAttendanceRegisterModalProps) {
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;

  const { data: subjects = [] } = useSubjects();
  const { data: roster = [], isLoading: isRosterLoading } = useSectionRosterForAttendance(sectionId);
  const logAttendanceMutation = useLogCRAttendanceMutation();

  const [subjectId, setSubjectId] = useState(initialSubjectId || '');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [lectureCount, setLectureCount] = useState<number>(1);
  const [targetBatch, setTargetBatch] = useState<'all' | '1' | '2'>(initialTargetBatch);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuccessSheet, setShowSuccessSheet] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfPreviewData, setPdfPreviewData] = useState<{ blobUrl: string; filename: string; download: () => void } | null>(null);

  // Markings state: Map studentId -> status ('present' | 'absent' | 'od' | 'makeup')
  const [markings, setMarkings] = useState<Record<string, AttendanceStatus>>({});

  // Sync state when modal opens or initial values change
  useEffect(() => {
    if (open) {
      setShowSuccessSheet(false);
      setIsSaved(false);
      setPdfPreviewData(null);
      if (initialSubjectId) setSubjectId(initialSubjectId);
      else if (subjects.length > 0 && !subjectId) setSubjectId(subjects[0].id);
      if (initialTargetBatch) setTargetBatch(initialTargetBatch);
    }
  }, [open, initialSubjectId, initialTargetBatch, subjects]);

  const getReportInputData = () => {
    const selectedSubject = subjects.find(s => s.id === subjectId);
    const reportStudents: ReportStudent[] = targetStudents.map(s => ({
      id: s.id,
      name: s.name,
      classRoll: s.classRoll,
      universityRoll: s.universityRoll,
      subBatch: s.subBatch,
      status: markings[s.id] || 'present',
    }));

    return {
      sectionName: 'P2',
      subjectCode: selectedSubject?.code || 'SUBJECT',
      subjectName: selectedSubject?.name || 'Class Subject',
      date,
      lectureCount,
      targetBatch,
      students: reportStudents,
    };
  };

  // Initialize markings with 'present' default whenever roster updates
  useEffect(() => {
    if (roster.length > 0) {
      const initialMap: Record<string, AttendanceStatus> = {};
      roster.forEach(s => {
        initialMap[s.id] = 'present';
      });
      setMarkings(initialMap);
    }
  }, [roster]);

  // Filter roster by target batch, search query, and status filter
  const filteredRoster = useMemo(() => {
    return roster.filter(student => {
      // Batch filter
      if (targetBatch !== 'all' && student.subBatch && student.subBatch !== targetBatch) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = student.name.toLowerCase().includes(q);
        const rollMatch = student.classRoll?.toLowerCase().includes(q) || student.universityRoll?.toLowerCase().includes(q);
        if (!nameMatch && !rollMatch) return false;
      }

      return true;
    });
  }, [roster, targetBatch, searchQuery]);

  // Counts summary
  const targetStudents = useMemo(() => {
    if (targetBatch === 'all') return roster;
    return roster.filter(s => !s.subBatch || s.subBatch === targetBatch);
  }, [roster, targetBatch]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let od = 0;
    let makeup = 0;

    targetStudents.forEach(s => {
      const st = markings[s.id] || 'present';
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'od') od++;
      else if (st === 'makeup') makeup++;
    });

    return { present, absent, od, makeup, total: targetStudents.length };
  }, [targetStudents, markings]);

  const handleToggleStatus = (studentId: string, newStatus: AttendanceStatus) => {
    haptics.lightClick();
    setMarkings(prev => ({
      ...prev,
      [studentId]: newStatus,
    }));
  };

  const handleMarkAllPresent = () => {
    haptics.doublePulse();
    const updated = { ...markings };
    targetStudents.forEach(s => {
      updated[s.id] = 'present';
    });
    setMarkings(updated);
    toast.info('All students marked Present');
  };

  const handleClearAbsentees = () => {
    haptics.lightClick();
    const updated = { ...markings };
    targetStudents.forEach(s => {
      if (updated[s.id] === 'absent') {
        updated[s.id] = 'present';
      }
    });
    setMarkings(updated);
    toast.info('Absentees cleared to Present');
  };

  const handleSaveAttendance = async () => {
    if (!sectionId) {
      toast.error('Section ID not found');
      return;
    }
    if (!subjectId) {
      toast.error('Please select a subject');
      return;
    }

    const sessionId = crypto.randomUUID();
    const finalMarkings = targetStudents.map(s => ({
      studentId: s.id,
      status: markings[s.id] || 'present',
    }));

    try {
      haptics.heavyClick();
      await logAttendanceMutation.mutateAsync({
        sessionId,
        sectionId,
        subjectId,
        date,
        timetableSlotId: initialTimetableSlotId || null,
        targetBatch: targetBatch === 'all' ? null : targetBatch,
        lectureCount,
        markings: finalMarkings,
      });

      const selectedSubject = subjects.find(s => s.id === subjectId);
      toast.success(
        `Attendance recorded for ${selectedSubject?.code || 'Subject'}! (${counts.present} Present, ${counts.absent} Absent)`
      );
      setIsSaved(true);
      setShowSuccessSheet(true);
    } catch (err: any) {
      console.error('Failed to log CR attendance:', err);
      toast.error(err.message || 'Failed to save attendance register');
    }
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={showSuccessSheet ? (isSaved ? 'Share Attendance Report' : 'Pre-Save Report Share') : 'Take Class Attendance Register'}>
        {showSuccessSheet ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 20px' }}>
            {/* Status Banner */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 'var(--radius-md)',
              background: isSaved ? 'rgba(52, 211, 153, 0.1)' : 'rgba(251, 191, 36, 0.1)',
              border: isSaved ? '1px solid rgba(52, 211, 153, 0.25)' : '1px solid rgba(251, 191, 36, 0.3)',
            }}>
              <CheckCircle2 size={20} color={isSaved ? 'var(--status-safe)' : '#fbbf24'} style={{ flexShrink: 0 }} />
              <div>
                <p className="t-subtitle" style={{ color: isSaved ? 'var(--status-safe)' : '#fbbf24', fontWeight: 600, margin: 0 }}>
                  {isSaved ? 'Attendance Register Recorded!' : 'Pre-Save Attendance Report'}
                </p>
                <p className="t-caption" style={{ color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  {counts.present} Present · {counts.absent} Absent · {counts.od} OD {!isSaved && '(Unsaved Draft)'}
                </p>
              </div>
            </div>

            {/* Share Format Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 11 }}>EXPORT & SHARE FORMATS</p>

              {/* WhatsApp Share Button */}
              <button
                onClick={() => {
                  const report = generateWhatsAppAttendanceReport(getReportInputData());
                  shareOrCopyReport(report, `Attendance Report - ${getReportInputData().subjectCode}`);
                }}
                className="t-button"
                style={{
                  width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                  background: '#25D366', border: 'none', color: '#fff',
                  fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
                }}
              >
                <MessageSquare size={16} /> Share to WhatsApp / Copy Text
              </button>

            {/* Single Simplified PDF Export & View Button */}
            <button
              onClick={async () => {
                setGeneratingPdf(true);
                try {
                  const result = await createAttendancePDFBlob(getReportInputData());
                  result.download();
                  setPdfPreviewData(result);
                  toast.success(`Exported ${result.filename}! 📄`, {
                    duration: 10000,
                    description: 'Downloaded to device & opened in-app preview.',
                    action: {
                      label: 'Open PDF 👁️',
                      onClick: () => setPdfPreviewData(result),
                    },
                  });
                } catch (err) {
                  console.error('PDF export failed:', err);
                  toast.error('Failed to export PDF');
                } finally {
                  setGeneratingPdf(false);
                }
              }}
              disabled={generatingPdf}
              className="t-button"
              style={{
                width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                background: 'rgba(96, 165, 250, 0.12)', border: '1px solid rgba(96, 165, 250, 0.3)',
                color: 'var(--accent-primary)', fontWeight: 600, cursor: generatingPdf ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {generatingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {generatingPdf ? 'Generating PDF…' : 'Export & View PDF Document'}
            </button>

              {/* CSV Export Button */}
              <button
                onClick={() => {
                  downloadAttendanceCSV(getReportInputData());
                }}
                className="t-button"
                style={{
                  width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Download size={16} color="var(--text-secondary)" /> Export CSV Spreadsheet
              </button>
            </div>

            {/* Text Report Preview Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 11 }}>WHATSAPP REPORT PREVIEW</span>
                <button
                  onClick={() => {
                    const report = generateWhatsAppAttendanceReport(getReportInputData());
                    navigator.clipboard.writeText(report);
                    toast.success('Text copied to clipboard!');
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--accent-primary)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
              <pre style={{
                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 150, overflowY: 'auto',
              }}>
                {generateWhatsAppAttendanceReport(getReportInputData())}
              </pre>
            </div>

            {isSaved ? (
              <button
                onClick={onClose}
                className="t-button"
                style={{
                  width: '100%', padding: '12px', background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, marginTop: 6,
                }}
              >
                Done
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  onClick={() => setShowSuccessSheet(false)}
                  className="t-button"
                  style={{
                    padding: '12px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-secondary)',
                  }}
                >
                  Back to Register
                </button>

                <button
                  onClick={handleSaveAttendance}
                  disabled={logAttendanceMutation.isPending}
                  className="t-button"
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px', background: 'var(--accent-primary)',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    cursor: logAttendanceMutation.isPending ? 'not-allowed' : 'pointer',
                    color: '#fff', fontWeight: 600,
                  }}
                >
                  {logAttendanceMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Save Register to ClassHub
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 20px' }}>
            {/* Controls Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Subject & Date Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label htmlFor="cr-att-subject-select" className="t-label" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, color: 'var(--text-muted)' }}>
                    <BookOpen size={13} color="var(--accent-primary)" /> Subject *
                  </label>
                  <select
                    id="cr-att-subject-select"
                    value={subjectId}
                    onChange={e => setSubjectId(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                      fontSize: 13, outline: 'none',
                    }}
                  >
                    <option value="">Select subject…</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="cr-att-date-input" className="t-label" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, color: 'var(--text-muted)' }}>
                    <Calendar size={13} color="var(--accent-primary)" /> Date *
                  </label>
                  <input
                    id="cr-att-date-input"
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                      fontSize: 13, outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Batch & Lecture Count */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label htmlFor="cr-att-batch-select" className="t-label" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, color: 'var(--text-muted)' }}>
                    <Filter size={13} color="var(--accent-primary)" /> Target Batch
                  </label>
                  <select
                    id="cr-att-batch-select"
                    value={targetBatch}
                    onChange={e => setTargetBatch(e.target.value as 'all' | '1' | '2')}
                    style={{
                      width: '100%', padding: '9px 12px',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                      fontSize: 13, outline: 'none',
                    }}
                  >
                    <option value="all">Full Section (All)</option>
                    <option value="1">Batch 1 Only</option>
                    <option value="2">Batch 2 Only</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="cr-att-count-select" className="t-label" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, color: 'var(--text-muted)' }}>
                    <Clock size={13} color="var(--accent-primary)" /> Lecture Count
                  </label>
                  <select
                    id="cr-att-count-select"
                    value={lectureCount}
                    onChange={e => setLectureCount(Number(e.target.value))}
                    style={{
                      width: '100%', padding: '9px 12px',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                      fontSize: 13, outline: 'none',
                    }}
                  >
                    <option value={1}>1 Lecture (Standard)</option>
                    <option value={2}>2 Lectures (Double / Lab)</option>
                    <option value={3}>3 Lectures (Triple Lab)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Live Counters Summary Strip */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-default)',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="t-mono-sm" style={{ color: 'var(--status-safe)', fontWeight: 700 }}>
                    {counts.present}
                  </span>
                  <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>Present</span>
                </div>

                <div style={{ width: 1, height: 14, background: 'var(--border-default)' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="t-mono-sm" style={{ color: 'var(--status-critical)', fontWeight: 700 }}>
                    {counts.absent}
                  </span>
                  <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>Absent</span>
                </div>

                {counts.od > 0 && (
                  <>
                    <div style={{ width: 1, height: 14, background: 'var(--border-default)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="t-mono-sm" style={{ color: '#60a5fa', fontWeight: 700 }}>
                        {counts.od}
                      </span>
                      <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>OD</span>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleMarkAllPresent}
                  style={{
                    padding: '4px 8px', fontSize: 11, fontWeight: 600,
                    background: 'rgba(52, 211, 153, 0.12)', border: '1px solid rgba(52, 211, 153, 0.25)',
                    color: 'var(--status-safe)', borderRadius: 6, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  title="Set all to Present"
                >
                  <UserCheck size={12} /> All Present
                </button>

                {counts.absent > 0 && (
                  <button
                    onClick={handleClearAbsentees}
                    style={{
                      padding: '4px 8px', fontSize: 11, fontWeight: 600,
                      background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-default)',
                      color: 'var(--text-muted)', borderRadius: 6, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                    title="Reset Absentees"
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: 11 }} />
              <input
                type="text"
                placeholder="Search student by name or roll number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px 8px 32px', boxSizing: 'border-box',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                  fontSize: 12, outline: 'none',
                }}
              />
            </div>

            {/* Student Roster List */}
            {isRosterLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8, color: 'var(--text-muted)' }}>
                <Loader2 size={18} className="animate-spin" />
                <span className="t-body">Loading section roster…</span>
              </div>
            ) : filteredRoster.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                <p className="t-body">No students found matching filters.</p>
              </div>
            ) : (
              <div style={{
                maxHeight: 320, overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: 6,
                paddingRight: 4,
              }}>
                {filteredRoster.map(student => {
                  const currentStatus = markings[student.id] || 'present';
                  const isAbsent = currentStatus === 'absent';
                  const isOD = currentStatus === 'od';

                  return (
                    <div
                      key={student.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 8,
                        background: isAbsent
                          ? 'rgba(248, 113, 113, 0.06)'
                          : isOD
                            ? 'rgba(96, 165, 250, 0.06)'
                            : 'rgba(255, 255, 255, 0.02)',
                        border: isAbsent
                          ? '1px solid rgba(248, 113, 113, 0.2)'
                          : isOD
                            ? '1px solid rgba(96, 165, 250, 0.2)'
                            : '1px solid var(--border-default)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        {/* Roll Pill */}
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <span className="t-mono-sm" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 11 }}>
                            {student.classRoll || '—'}
                          </span>
                        </div>

                        {/* Student Name */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="t-body-medium" style={{ color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {student.name}
                          </p>
                          {student.subBatch && (
                            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                              Batch B{student.subBatch}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Toggle Button Group */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {/* Present Pill */}
                        <button
                          onClick={() => handleToggleStatus(student.id, 'present')}
                          style={{
                            padding: '4px 10px', fontSize: 12, fontWeight: 700,
                            borderRadius: 6, cursor: 'pointer',
                            background: currentStatus === 'present' ? 'var(--status-safe)' : 'transparent',
                            color: currentStatus === 'present' ? '#fff' : 'var(--text-muted)',
                            border: currentStatus === 'present' ? '1px solid var(--status-safe)' : '1px solid var(--border-default)',
                            transition: 'all 0.15s ease',
                          }}
                          title="Mark Present"
                        >
                          P
                        </button>

                        {/* Absent Pill */}
                        <button
                          onClick={() => handleToggleStatus(student.id, 'absent')}
                          style={{
                            padding: '4px 10px', fontSize: 12, fontWeight: 700,
                            borderRadius: 6, cursor: 'pointer',
                            background: currentStatus === 'absent' ? 'var(--status-critical)' : 'transparent',
                            color: currentStatus === 'absent' ? '#fff' : 'var(--text-muted)',
                            border: currentStatus === 'absent' ? '1px solid var(--status-critical)' : '1px solid var(--border-default)',
                            transition: 'all 0.15s ease',
                          }}
                          title="Mark Absent"
                        >
                          A
                        </button>

                        {/* OD Pill */}
                        <button
                          onClick={() => handleToggleStatus(student.id, 'od')}
                          style={{
                            padding: '4px 10px', fontSize: 12, fontWeight: 700,
                            borderRadius: 6, cursor: 'pointer',
                            background: currentStatus === 'od' ? '#3b82f6' : 'transparent',
                            color: currentStatus === 'od' ? '#fff' : 'var(--text-muted)',
                            border: currentStatus === 'od' ? '1px solid #3b82f6' : '1px solid var(--border-default)',
                            transition: 'all 0.15s ease',
                          }}
                          title="Mark On-Duty (OD)"
                        >
                          OD
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button
                onClick={onClose}
                className="t-button"
                style={{
                  padding: '12px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  if (!subjectId) {
                    toast.error('Please select a subject first');
                    return;
                  }
                  setShowSuccessSheet(true);
                }}
                disabled={!subjectId}
                className="t-button"
                style={{
                  padding: '12px 14px', background: 'rgba(37, 211, 102, 0.12)',
                  border: '1px solid rgba(37, 211, 102, 0.3)', borderRadius: 'var(--radius-md)',
                  cursor: !subjectId ? 'not-allowed' : 'pointer', color: !subjectId ? 'var(--text-muted)' : '#25D366',
                  fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                }}
                title="Share attendance report without saving"
              >
                <MessageSquare size={16} /> Share
              </button>

              <button
                onClick={handleSaveAttendance}
                disabled={logAttendanceMutation.isPending || !subjectId}
                className="t-button"
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px',
                  background: logAttendanceMutation.isPending || !subjectId ? 'var(--bg-elevated)' : 'var(--accent-primary)',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  cursor: logAttendanceMutation.isPending || !subjectId ? 'not-allowed' : 'pointer',
                  color: logAttendanceMutation.isPending || !subjectId ? 'var(--text-muted)' : '#fff',
                  fontWeight: 600,
                }}
              >
                {logAttendanceMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {logAttendanceMutation.isPending ? 'Saving Register…' : `Save (${counts.present}/${counts.total})`}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* In-App PDF Preview Viewer Overlay */}
      {pdfPreviewData && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(10, 15, 25, 0.92)', backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', padding: '16px 16px 20px',
          boxSizing: 'border-box', animation: 'fadeIn 0.2s ease',
        }}>
          {/* Viewer Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: 'rgba(96, 165, 250, 0.15)', border: '1px solid rgba(96, 165, 250, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa',
              }}>
                <FileText size={18} />
              </div>
              <div>
                <h3 className="t-subtitle" style={{ color: '#fff', margin: 0, fontSize: 15, fontWeight: 700 }}>
                  Attendance PDF Document
                </h3>
                <p className="t-caption" style={{ color: 'var(--text-secondary)', margin: '2px 0 0', fontSize: 11 }}>
                  {pdfPreviewData.filename}
                </p>
              </div>
            </div>

            <button
              onClick={() => setPdfPreviewData(null)}
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                borderRadius: '50%', width: 34, height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-primary)', cursor: 'pointer',
              }}
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>

          {/* PDF iFrame Container */}
          <iframe
            src={pdfPreviewData.blobUrl}
            title="Attendance PDF Document Preview"
            style={{
              width: '100%', flex: 1, border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', background: '#ffffff',
            }}
          />

          {/* Action Bar */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              onClick={() => setPdfPreviewData(null)}
              className="t-button"
              style={{
                padding: '12px 20px', background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600,
              }}
            >
              Close
            </button>

            <button
              onClick={() => pdfPreviewData.download()}
              className="t-button"
              style={{
                flex: 1, padding: '12px', background: 'var(--accent-primary)',
                border: 'none', borderRadius: 'var(--radius-md)',
                color: '#fff', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: 'pointer',
              }}
            >
              <Download size={16} /> Download PDF File
            </button>
          </div>
        </div>
      )}
    </>
  );
}
