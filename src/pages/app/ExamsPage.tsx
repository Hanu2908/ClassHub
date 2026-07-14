import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Calendar, MapPin, Plus, Trash2, Edit2,
  ChevronDown, ChevronUp, FileText, CheckSquare, Square,
  Loader2, CalendarDays, BookOpen, AlertCircle, Upload
} from 'lucide-react';
import { useExams, useStudentExamPrep, useUpsertExam, useDeleteExam, useUpsertExamOverride, useUpsertStudentExamPrep } from '../../hooks/useExams';
import { useSubjects } from '../../hooks/useSubjects';
import { useAppStore } from '../../store/appStore';
import { toast } from 'sonner';
import { BottomSheet } from '../../components/BottomSheet';
import { NavBar } from '../../components/NavBar';
import { supabase } from '../../lib/supabase';
import { DatePicker } from '../../components/ui/DatePicker';
import { generateGradient } from '../../lib/utils';


// Syllabus text extractor heuristics
function parseSyllabusText(rawText: string): string {
  if (!rawText) return '';
  const lines = rawText.split('\n');
  const extractedUnits: string[] = [];
  
  // Heuristic Regex to match units, parts, or chapters (concatenated to bypass Tailwind static class scanner)
  const unitRegex = new RegExp('^\\s*(unit|module|chapter|part)\\s*[' + '-:–—\\dIIVX' + ']+\\s*[:–—\\s]?', 'i');
  
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (unitRegex.test(trimmed) && trimmed.length > 8 && trimmed.length < 150) {
      extractedUnits.push(trimmed);
    }
  });

  // Fallback: If no Unit headers are found, gather substantial lines
  if (extractedUnits.length === 0) {
    const cleanParagraphs = lines
      .map(l => l.trim())
      .filter(l => l.length > 25 && l.length < 180)
      .slice(0, 5);
    extractedUnits.push(...cleanParagraphs);
  }

  return extractedUnits.slice(0, 6).join('\n');
}

// Helper to build a unique storage path outside render lifecycle to ensure component purity
function buildExamStoragePath(sectionId: string, examId: string, prefix: string, fileExt: string): string {
  return `${sectionId}/exams/${examId}/${prefix}_${Date.now()}.${fileExt}`;
}

// Zero-dependency premium particle explosion confetti
function triggerConfetti() {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '99999';
  document.body.appendChild(container);

  const colors = ['#a78bfa', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
  const particleCount = 75;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    const isCircle = Math.random() > 0.5;
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    particle.style.position = 'absolute';
    particle.style.width = `${Math.random() * 8 + 6}px`;
    particle.style.height = `${Math.random() * 8 + 6}px`;
    particle.style.backgroundColor = color;
    if (isCircle) {
      particle.style.borderRadius = '50%';
    }
    
    // Position at cursor/center of screen
    particle.style.left = '50vw';
    particle.style.top = '40vh';
    
    container.appendChild(particle);
    
    const velocity = Math.random() * 12 + 6;
    let x = 0;
    let y = 0;
    let velY = -Math.random() * 12 - 4; // Upward burst
    const velX = (Math.random() - 0.5) * velocity;
    
    let opacity = 1.0;
    const gravity = 0.35;
    
    const animate = () => {
      velY += gravity;
      x += velX;
      y += velY;
      opacity -= 0.012;
      
      particle.style.transform = `translate(${x}px, ${y}px) rotate(${y * 2.5}deg)`;
      particle.style.opacity = `${opacity}`;
      
      if (opacity > 0) {
        requestAnimationFrame(animate);
      } else {
        particle.remove();
      }
    };
    
    requestAnimationFrame(animate);
  }

  setTimeout(() => {
    container.remove();
  }, 2200);
}

// Inner syllabus list component to isolate query rendering cleanly
function SyllabusChecklist({ examId, syllabusUnits }: { examId: string; syllabusUnits: string[] }) {
  const { data: prepData = [], isLoading } = useStudentExamPrep(examId);
  const togglePrep = useUpsertStudentExamPrep();

  const preparedMap = useMemo(() => {
    const map = new Map<number, boolean>();
    prepData.forEach(p => map.set(p.unitIndex, p.isPrepared));
    return map;
  }, [prepData]);

  const handleToggle = async (unitIndex: number, currentStatus: boolean) => {
    try {
      const nextStatus = !currentStatus;
      await togglePrep.mutateAsync({
        examId,
        unitIndex,
        isPrepared: nextStatus
      });
      if (nextStatus) {
        triggerConfetti();
        toast.success(`Unit ${unitIndex + 1} prepared! Keep it up! 🎯`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update preparation status');
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px', color: 'var(--text-muted)' }}>
        <Loader2 className="spin" size={14} />
        <span className="t-mono-sm">Syncing prep syllabus...</span>
      </div>
    );
  }

  if (syllabusUnits.length === 0) {
    return (
      <p className="t-caption" style={{ color: 'var(--text-muted)', padding: '4px 0' }}>
        No syllabus units specified for this exam yet.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
      {syllabusUnits.map((unit, idx) => {
        const isPrepared = preparedMap.get(idx) || false;
        return (
          <div
            key={idx}
            onClick={() => handleToggle(idx, isPrepared)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: isPrepared ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.02)',
              border: isPrepared ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              {isPrepared ? (
                <CheckSquare size={16} color="var(--status-safe)" />
              ) : (
                <Square size={16} color="var(--text-muted)" />
              )}
              <span
                className="t-body-medium truncate"
                style={{
                  color: isPrepared ? 'var(--status-safe)' : 'var(--text-primary)',
                  textDecoration: isPrepared ? 'line-through' : 'none',
                  opacity: isPrepared ? 0.75 : 1
                }}
              >
                {unit}
              </span>
            </div>
            <span className="t-mono-sm" style={{ color: isPrepared ? 'var(--status-safe)' : 'var(--text-muted)' }}>
              Unit {idx + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ExamsPage() {
  const navigate = useNavigate();
  const authUser = useAppStore(s => s.authUser);
  const hub = useAppStore(s => s.hub);
  const isCR = authUser?.role === 'cr';

  // State triggers
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<any | null>(null);

  // Form Field States
  const [semesterVal, setSemesterVal] = useState<number>(1);
  const [subjCodeVal, setSubjCodeVal] = useState('');
  const [subjNameVal, setSubjNameVal] = useState('');
  const [examTypeVal, setExamTypeVal] = useState('MST-1');
  const [dateVal, setDateVal] = useState('');
  const [startTimeVal, setStartTimeVal] = useState('');
  const [endTimeVal, setEndTimeVal] = useState('');
  const [maxMarksVal, setMaxMarksVal] = useState<string>('');
  const [roomVal, setRoomVal] = useState('');
  const [syllabusUnitsText, setSyllabusUnitsText] = useState('');
  
  // Overrides section inside form
  const [isOverrideOnly, setIsOverrideOnly] = useState(false);
  const [overrideRoomVal, setOverrideRoomVal] = useState('');
  const [overrideSeatingPlanVal, setOverrideSeatingPlanVal] = useState('');

  // Attachment & Extractor States
  const [seatingFile, setSeatingFile] = useState<File | null>(null);
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Fetch Exams & Subjects
  const { data: exams = [], isLoading, error: loadError } = useExams();
  const { data: subjects = [], isLoading: loadingSubjects } = useSubjects();
  const upsertExam = useUpsertExam();
  const deleteExam = useDeleteExam();
  const upsertOverride = useUpsertExamOverride();

  // Load pdfjsLib dynamically for background syllabus extraction
  useEffect(() => {
    if (window.pdfjsLib) return;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
    };
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleSyllabusFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSyllabusFile(file);
    setIsExtracting(true);

    const reader = new FileReader();

    if (file.name.toLowerCase().endsWith('.txt')) {
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          const parsed = parseSyllabusText(text);
          setSyllabusUnitsText(parsed);
          triggerConfetti();
          toast.success('✨ Text syllabus topics auto-extracted!');
        } catch {
          toast.warning('Failed to parse text file.');
        } finally {
          setIsExtracting(false);
        }
      };
      reader.readAsText(file);
    } else if (file.name.toLowerCase().endsWith('.pdf')) {
      reader.onload = async (evt) => {
        try {
          const arrayBuffer = evt.target?.result as ArrayBuffer;
          if (!window.pdfjsLib) {
            throw new Error('PDF parsing engine is still loading. Please try again in a few seconds.');
          }

          const pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let fullText = '';
          const pagesToParse = Math.min(pdfDoc.numPages, 6);

          for (let i = 1; i <= pagesToParse; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
          }

          const parsed = parseSyllabusText(fullText);
          setSyllabusUnitsText(parsed);
          triggerConfetti();
          toast.success('✨ PDF syllabus topics auto-extracted successfully!');
        } catch (err: any) {
          toast.warning(err.message || 'Failed to parse PDF syllabus. Please enter manually.');
        } finally {
          setIsExtracting(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error('Please upload a valid PDF or TXT file.');
      setIsExtracting(false);
    }
  };

  const handleSeatingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File is too large. Max size is 10MB.');
        return;
      }
      setSeatingFile(file);
      toast.info(`Selected seating plan: ${file.name}`);
    }
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjCodeVal || !subjNameVal || !dateVal || !startTimeVal || !endTimeVal) {
      toast.error('Please fill all mandatory fields');
      return;
    }

    try {
      const units = syllabusUnitsText
        .split('\n')
        .map(u => u.trim())
        .filter(Boolean);

      const sectionId = authUser?.sectionId;
      const userId = authUser?.id;
      if (!sectionId || !userId) throw new Error('Missing active section or user context');

      // Generate a deterministic UUID if creating a new exam so we can use it in the storage path
      const examId = editingExam?.id || crypto.randomUUID();

      let seatingPath = isOverrideOnly ? (editingExam?.activeSeatingPlan || null) : (editingExam?.seatingPlanPath || null);
      let syllabusPath = editingExam?.syllabusPdfPath || null;

      // 1. Upload seating plan file if selected
      if (seatingFile) {
        const fileExt = seatingFile.name.split('.').pop() || '';
        const prefix = isOverrideOnly ? 'override_seating' : 'base_seating';
        const storagePath = buildExamStoragePath(sectionId, examId, prefix, fileExt);
        
        const { error: uploadErr } = await supabase.storage
          .from('attachments')
          .upload(storagePath, seatingFile, { cacheControl: '3600', upsert: true });

        if (uploadErr) throw uploadErr;
        seatingPath = storagePath;
      }

      // 2. Upload syllabus file if selected
      if (syllabusFile) {
        const fileExt = syllabusFile.name.split('.').pop() || '';
        const storagePath = buildExamStoragePath(sectionId, examId, 'syllabus', fileExt);

        const { error: uploadErr } = await supabase.storage
          .from('attachments')
          .upload(storagePath, syllabusFile, { cacheControl: '3600', upsert: true });

        if (uploadErr) throw uploadErr;
        syllabusPath = storagePath;
      }

      if (isOverrideOnly && editingExam) {
        // Save only Local Section Override
        await upsertOverride.mutateAsync({
          examId: examId,
          room: overrideRoomVal || null,
          seatingPlanPath: seatingPath
        });
        toast.success('Section room & seating override published!');
      } else {
        // Save Base Exam
        await upsertExam.mutateAsync({
          id: examId,
          isEdit: !!editingExam,
          semester: Number(semesterVal),
          subjectCode: subjCodeVal.trim().toUpperCase(),
          subjectName: subjNameVal.trim(),
          examType: examTypeVal,
          examDate: dateVal,
          startTime: startTimeVal,
          endTime: endTimeVal,
          maxMarks: maxMarksVal ? Number(maxMarksVal) : null,
          room: roomVal.trim() || null,
          syllabusUnits: units,
          syllabusPdfPath: syllabusPath,
          seatingPlanPath: seatingPath
        });
        toast.success(editingExam ? 'Exam details updated successfully!' : 'Central base exam published!');
      }

      setFormOpen(false);
      setEditingExam(null);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const resetForm = () => {
    setSubjCodeVal('');
    setSubjNameVal('');
    setExamTypeVal('MST-1');
    setDateVal('');
    setStartTimeVal('');
    setEndTimeVal('');
    setMaxMarksVal('');
    setRoomVal('');
    setSyllabusUnitsText('');
    setIsOverrideOnly(false);
    setOverrideRoomVal('');
    setOverrideSeatingPlanVal('');
    setSeatingFile(null);
    setSyllabusFile(null);
  };

  const handleEdit = (exam: any, overrideMode = false) => {
    setEditingExam(exam);
    setIsOverrideOnly(overrideMode);
    
    setSemesterVal(exam.semester);
    setSubjCodeVal(exam.subjectCode);
    setSubjNameVal(exam.subjectName);
    setExamTypeVal(exam.examType);
    setDateVal(exam.examDate);
    setStartTimeVal(exam.startTime);
    setEndTimeVal(exam.endTime);
    setMaxMarksVal(exam.maxMarks?.toString() || '');
    setRoomVal(exam.room || '');
    setSyllabusUnitsText(exam.syllabusUnits?.join('\n') || '');

    // Set overrides
    setOverrideRoomVal(exam.activeRoom || '');
    setOverrideSeatingPlanVal(exam.activeSeatingPlan || '');

    setFormOpen(true);
  };

  const handleDelete = async (examId: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this college base exam? It will remove it for all sections taking this subject.')) return;
    try {
      await deleteExam.mutateAsync(examId);
      toast.success('Exam deleted successfully');
      if (expandedExamId === examId) setExpandedExamId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete exam');
    }
  };

  const openPdf = async (path: string, titleStr: string) => {
    try {
      if (path.startsWith('http://') || path.startsWith('https://')) {
        navigate(`/app/pdf-viewer?url=${encodeURIComponent(path)}&title=${encodeURIComponent(titleStr)}`);
        return;
      }
      
      const { data, error } = await supabase.storage
        .from('attachments')
        .createSignedUrl(path, 300);
        
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('Could not authorize access.');
      
      navigate(`/app/pdf-viewer?url=${encodeURIComponent(data.signedUrl)}&title=${encodeURIComponent(titleStr)}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to open PDF');
    }
  };

  // Divide into upcoming and past
  const todayStr = new Date().toISOString().split('T')[0];
  const sortedExams = useMemo(() => {
    return [...exams].sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
  }, [exams]);

  const upcomingExams = useMemo(() => {
    return sortedExams.filter(e => e.examDate >= todayStr);
  }, [sortedExams, todayStr]);

  const pastExams = useMemo(() => {
    return sortedExams.filter(e => e.examDate < todayStr);
  }, [sortedExams, todayStr]);

  return (
    <div className="page-shell">
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13, 15, 20, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }}>
        <button 
          id="exams-back-btn"
          onClick={() => navigate(-1)} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 2, marginLeft: -4 }} 
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="t-page-title" style={{ color: 'var(--text-primary)', flex: 1, margin: 0, fontSize: 17, fontWeight: 600 }}>Exams Hub</h1>
      </header>

      <main className="page-content">
        {/* Hub Welcome/Summary Banner */}
        <div className="card" style={{
          padding: 16,
          background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.08) 0%, rgba(236, 72, 153, 0.02) 100%)',
          border: '1px solid rgba(167, 139, 250, 0.15)',
          display: 'flex',
          gap: 14,
          alignItems: 'center'
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CalendarDays size={20} color="#fff" />
          </div>
          <div>
            <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>Shared Exam Timetable</p>
            <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
              Schedules sync automatically across same-year branches, with section overrides for custom rooms.
            </p>
          </div>
        </div>

        {/* LOADING & ERROR HANDLING */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
            <Loader2 className="spin" size={28} color="var(--accent-primary)" />
            <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Retrieving exam schedules...</span>
          </div>
        )}

        {loadError && (
          <div className="card" style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
            <AlertCircle size={24} color="#ef4444" />
            <div>
              <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>Error loading schedules</p>
              <p className="t-body" style={{ color: 'var(--text-secondary)' }}>{loadError instanceof Error ? loadError.message : 'Failed to query Supabase database.'}</p>
            </div>
          </div>
        )}

        {!isLoading && !loadError && exams.length === 0 && (
          <div className="card" style={{ padding: '48px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-default)' }}>
              <BookOpen size={24} color="var(--text-muted)" />
            </div>
            <div>
              <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>No Exams Scheduled</p>
              <p className="t-body" style={{ color: 'var(--text-secondary)', maxWidth: 280, margin: '0 auto' }}>
                Your curriculum timetable is completely quiet. {isCR ? 'Tap the Floating Button below to publish the first exam date sheet!' : 'Check back later once your CR schedules midterms.'}
              </p>
            </div>
            {isCR && (
              <button className="btn-primary" onClick={() => { resetForm(); setFormOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={15} /> Publish Exam
              </button>
            )}
          </div>
        )}

        {/* TIMELINE VIEWPORT */}
        {!isLoading && !loadError && exams.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* 1. UPCOMING TIMELINE */}
            {upcomingExams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)', boxShadow: '0 0 10px var(--accent-primary)' }} />
                  <span className="t-mono-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>UPCOMING EXAMS ({upcomingExams.length})</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {upcomingExams.map(exam => {
                    const isExpanded = expandedExamId === exam.id;
                    const dateObj = new Date(exam.examDate);
                    const dayString = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                    const weekday = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });

                    return (
                      <div
                        key={exam.id}
                        className="card"
                        style={{
                          padding: 0,
                          overflow: 'hidden',
                          border: isExpanded ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid var(--border-default)',
                          boxShadow: isExpanded ? '0 12px 40px rgba(0,0,0,0.5)' : 'none',
                          transition: 'all 0.25s cubic-bezier(0.25, 1, 0.5, 1)'
                        }}
                      >
                        {/* Summary Header bar */}
                        <div
                          onClick={() => setExpandedExamId(isExpanded ? null : exam.id)}
                          style={{
                            padding: '14px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                            {/* Date Badge */}
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 46,
                              height: 46,
                              borderRadius: 10,
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border-default)',
                              flexShrink: 0
                            }}>
                              <span className="t-mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{dayString}</span>
                              <span className="t-mono-sm" style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{weekday}</span>
                            </div>

                            {/* Subject Avatar */}
                            <div style={{ 
                              width: 42, 
                              height: 42, 
                              borderRadius: 10, 
                              background: generateGradient(exam.subjectCode), 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              flexShrink: 0,
                              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)'
                            }}>
                              <span className="t-mono" style={{ color: '#fff', fontSize: 13, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                                {exam.subjectCode.slice(0, 2).toUpperCase()}
                              </span>
                            </div>

                            {/* Info block */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <span className="t-badge" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>{exam.examType}</span>
                                <span className="t-mono-sm truncate" style={{ color: 'var(--text-muted)' }}>{exam.subjectCode}</span>
                              </div>
                              <h3 className="t-subtitle truncate" style={{ color: 'var(--text-primary)', margin: 0 }}>{exam.subjectName}</h3>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {/* Room Info */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12 }}>ROOM</span>
                              <span className="t-mono" style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: 13 }}>{exam.activeRoom || 'N/A'}</span>
                            </div>
                            {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                          </div>
                        </div>

                        {/* Collapsible syllabus checklist & resources details */}
                        {isExpanded && (
                          <div style={{
                            padding: '16px',
                            background: 'rgba(255,255,255,0.01)',
                            borderTop: '1px solid var(--border-default)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 14
                          }}>
                            {/* Details meta mapping */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--border-default)' }}>
                              <div>
                                <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12, display: 'block', marginBottom: 2 }}>TIMINGS</span>
                                <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>
                                  {exam.startTime.substring(0, 5)} - {exam.endTime.substring(0, 5)}
                                </span>
                              </div>
                              <div>
                                <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12, display: 'block', marginBottom: 2 }}>MAX MARKS</span>
                                <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>
                                  {exam.maxMarks ? `${exam.maxMarks} Marks` : 'N/A'}
                                </span>
                              </div>
                            </div>

                            {/* Resources bar (Date sheet and seating plan links) */}
                            {(exam.activeSeatingPlan || exam.syllabusPdfPath) && (
                              <div style={{ display: 'flex', gap: 10 }}>
                                {exam.syllabusPdfPath && (
                                  <button
                                    className="btn-secondary"
                                    onClick={() => openPdf(exam.syllabusPdfPath!, `Syllabus - ${exam.subjectCode}`)}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, padding: '8px 10px' }}
                                  >
                                    <FileText size={13} /> Syllabus PDF
                                  </button>
                                )}
                                {exam.activeSeatingPlan && (
                                  <button
                                    className="btn-secondary"
                                    onClick={() => openPdf(exam.activeSeatingPlan!, `Seating Plan - ${exam.subjectCode}`)}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, padding: '8px 10px' }}
                                  >
                                    <MapPin size={13} /> Seating Plan
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Preparation Syllabus Checklist block */}
                            <div>
                              <span className="t-mono-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 6 }}>
                                SYLLABUS PREPARATION TRACKER
                              </span>
                              <SyllabusChecklist examId={exam.id} syllabusUnits={exam.syllabusUnits} />
                            </div>

                            {/* CR Action bar */}
                            {isCR && (
                              <div style={{ display: 'flex', gap: 8, marginTop: 6, paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
                                <button
                                  className="btn-secondary"
                                  onClick={() => handleEdit(exam, false)}
                                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, padding: '6px' }}
                                >
                                  <Edit2 size={12} /> Edit Base
                                </button>
                                <button
                                  className="btn-secondary"
                                  onClick={() => handleEdit(exam, true)}
                                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, padding: '6px', color: 'var(--accent-primary)', borderColor: 'var(--accent-primary-glow)' }}
                                >
                                  <MapPin size={12} /> Override Local
                                </button>
                                {exam.createdBy === authUser?.id && (
                                  <button
                                    className="btn-secondary"
                                    onClick={() => handleDelete(exam.id)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px', color: 'var(--status-critical)', borderColor: 'rgba(239,68,68,0.2)' }}
                                    aria-label="Delete"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. PAST TIMELINE */}
            {pastExams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.6 }}>
                <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontWeight: 700, paddingLeft: 4 }}>PAST EXAMS ({pastExams.length})</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {pastExams.map(exam => {
                    const isExpanded = expandedExamId === exam.id;
                    const dateObj = new Date(exam.examDate);
                    const dayString = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                    const weekday = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });

                    return (
                      <div
                        key={exam.id}
                        className="card"
                        style={{
                          padding: 0,
                          overflow: 'hidden',
                          border: '1px solid var(--border-default)'
                        }}
                      >
                        <div
                          onClick={() => setExpandedExamId(isExpanded ? null : exam.id)}
                          style={{
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 44,
                              height: 44,
                              borderRadius: 10,
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border-default)',
                              flexShrink: 0
                            }}>
                              <span className="t-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{dayString}</span>
                              <span className="t-mono-sm" style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{weekday}</span>
                            </div>

                            {/* Subject Avatar */}
                            <div style={{ 
                              width: 40, 
                              height: 40, 
                              borderRadius: 10, 
                              background: generateGradient(exam.subjectCode), 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              flexShrink: 0,
                              opacity: 0.5,
                              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)'
                            }}>
                              <span className="t-mono" style={{ color: '#fff', fontSize: 12, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                                {exam.subjectCode.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                                <span className="t-badge" style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}>{exam.examType}</span>
                                <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>{exam.subjectCode}</span>
                              </div>
                              <h3 className="t-subtitle truncate" style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>{exam.subjectName}</h3>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Completed</span>
                            {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{
                            padding: '14px 16px',
                            background: 'rgba(255,255,255,0.01)',
                            borderTop: '1px solid var(--border-default)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12
                          }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              <div>
                                <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12, display: 'block', marginBottom: 2 }}>TIMINGS</span>
                                <span className="t-body-medium" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{exam.startTime.substring(0, 5)} - {exam.endTime.substring(0, 5)}</span>
                              </div>
                              <div>
                                <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12, display: 'block', marginBottom: 2 }}>ROOM</span>
                                <span className="t-body-medium" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{exam.activeRoom || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </main>

      {/* CR FLOATING ACTION BUTTON */}
      {isCR && (
        <button
          id="add-exam-fab"
          className="fab"
          onClick={() => { resetForm(); setEditingExam(null); setFormOpen(true); }}
          aria-label="Publish Exam"
        >
          <Plus size={22} />
        </button>
      )}

      {/* BOTTOM SHEET CREATION FORM & SECTION OVERRIDE SHEET */}
      <BottomSheet
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingExam(null); resetForm(); }}
        title={
          <span className="t-card-title" style={{ color: 'var(--text-primary)' }}>
            {editingExam
              ? (isOverrideOnly ? 'Local Section Override' : 'Edit Base Exam details')
              : 'Publish College-wide Exam'
            }
          </span>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isOverrideOnly ? (
            <>
              {/* LOCAL OVERRIDES FORM ELEMENT SECTION ONLY */}
              <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
                Customize room number or seating plan PDF for your section **{hub?.section || 'P2'}** without changing details for other branches.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Section Override Room:</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. D-302, C-404"
                  value={overrideRoomVal}
                  onChange={e => setOverrideRoomVal(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Section Seating Plan:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label 
                    className="btn-secondary" 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      fontSize: 12, 
                      padding: '8px 10px', 
                      cursor: 'pointer',
                      flex: 1,
                      justifyContent: 'center'
                    }}
                  >
                    <Upload size={13} /> {seatingFile ? 'Change Seating Plan' : 'Upload Seating Plan'}
                    <input 
                      type="file" 
                      accept="application/pdf,image/*" 
                      onChange={handleSeatingFileChange} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>
                {seatingFile && (
                  <span className="t-caption truncate" style={{ color: 'var(--accent-primary)', fontSize: 12 }}>
                    📎 {seatingFile.name}
                  </span>
                )}
                {overrideSeatingPlanVal && !seatingFile && (
                  <span className="t-caption truncate" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    Active Override: {overrideSeatingPlanVal.split('/').pop()}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              {/* CORE EXAMS FORM ELEMENTS SECTION */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Semester:</label>
                  <select
                    className="input"
                    value={semesterVal}
                    onChange={e => setSemesterVal(Number(e.target.value))}
                    style={{ fontSize: 13, background: 'rgba(255,255,255,0.03)' }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                      <option key={sem} value={sem} style={{ background: 'var(--bg-base)' }}>Sem {sem}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Exam Type:</label>
                  <select
                    className="input"
                    value={examTypeVal}
                    onChange={e => setExamTypeVal(e.target.value)}
                    style={{ fontSize: 13, background: 'rgba(255,255,255,0.03)' }}
                  >
                    {['MST-1', 'MST-2', 'End-Sem', 'Lab External', 'Quiz', 'Lab Internal'].map(type => (
                      <option key={type} value={type} style={{ background: 'var(--bg-base)' }}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Select Active Subject *:</label>
                {loadingSubjects ? (
                  <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)' }}>
                    <Loader2 className="spin" size={14} color="var(--text-muted)" />
                    <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Loading section subjects...</span>
                  </div>
                ) : subjects.length === 0 ? (
                  <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 'var(--radius-sm)' }}>
                    <p className="t-caption" style={{ color: 'var(--status-critical)', margin: 0 }}>
                      No subjects set up in this hub yet. Please add subjects first.
                    </p>
                  </div>
                ) : (
                  <select
                    className="input select-custom"
                    value={subjCodeVal ? `${subjCodeVal}|${subjNameVal}` : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const [code, name] = val.split('|');
                        setSubjCodeVal(code);
                        setSubjNameVal(name);
                      } else {
                        setSubjCodeVal('');
                        setSubjNameVal('');
                      }
                    }}
                    style={{ fontSize: 13, background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)' }}
                    required
                  >
                    <option value="" style={{ background: 'var(--bg-base)' }}>-- Select Hub Subject --</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={`${s.code}|${s.name}`} style={{ background: 'var(--bg-base)' }}>
                        [{s.code}] {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Exam Date *:</label>
                <DatePicker
                  value={dateVal}
                  onChange={setDateVal}
                  placeholder="Select exam date..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Start Time *:</label>
                  <input
                    type="time"
                    className="input"
                    value={startTimeVal}
                    onChange={e => setStartTimeVal(e.target.value)}
                    style={{ fontSize: 13 }}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>End Time *:</label>
                  <input
                    type="time"
                    className="input"
                    value={endTimeVal}
                    onChange={e => setEndTimeVal(e.target.value)}
                    style={{ fontSize: 13 }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Max Marks:</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="30"
                    value={maxMarksVal}
                    onChange={e => setMaxMarksVal(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Seating Notice Physical Location:</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <MapPin size={14} style={{ position: 'absolute', left: 12, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="input"
                      style={{ paddingLeft: 34 }}
                      placeholder="e.g. D-Block Central Notice Board"
                      value={roomVal}
                      onChange={e => setRoomVal(e.target.value)}
                    />
                  </div>
                  <span className="t-caption" style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                    Where printouts are physically pasted in college. Overridable later.
                  </span>
                </div>
              </div>

              {/* Central base exam file attachments */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Syllabus PDF/TXT:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label 
                      className="btn-secondary" 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 6, 
                        fontSize: 12, 
                        padding: '8px 10px', 
                        cursor: 'pointer',
                        flex: 1,
                        justifyContent: 'center'
                      }}
                    >
                      <Upload size={13} /> {syllabusFile ? 'Change Syllabus' : 'Upload Syllabus'}
                      <input 
                        type="file" 
                        accept="application/pdf,text/plain" 
                        onChange={handleSyllabusFileChange} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                  </div>
                  {syllabusFile && (
                    <span className="t-caption truncate" style={{ color: 'var(--accent-primary)', fontSize: 12 }}>
                      📎 {syllabusFile.name}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Seating Plan Notice:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label 
                      className="btn-secondary" 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 6, 
                        fontSize: 12, 
                        padding: '8px 10px', 
                        cursor: 'pointer',
                        flex: 1,
                        justifyContent: 'center'
                      }}
                    >
                      <Upload size={13} /> {seatingFile ? 'Change Seating' : 'Upload Plan'}
                      <input 
                        type="file" 
                        accept="application/pdf,image/*" 
                        onChange={handleSeatingFileChange} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                  </div>
                  {seatingFile && (
                    <span className="t-caption truncate" style={{ color: 'var(--accent-primary)', fontSize: 12 }}>
                      📎 {seatingFile.name}
                    </span>
                  )}
                </div>
              </div>

              {isExtracting && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(167, 139, 250, 0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(167, 139, 250, 0.15)' }}>
                  <Loader2 className="spin" size={14} color="var(--accent-primary)" />
                  <span className="t-mono-sm" style={{ color: 'var(--accent-primary)', fontSize: 12 }}>
                    Extracting units & topics dynamically from PDF...
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Syllabus checklist units (One per line):</label>
                <textarea
                  className="input"
                  rows={4}
                  placeholder="e.g. Unit 1: CPU Scheduling algorithms&#10;Unit 2: Semaphore and Deadlocks"
                  value={syllabusUnitsText}
                  onChange={e => setSyllabusUnitsText(e.target.value)}
                  style={{ resize: 'vertical', fontSize: 13 }}
                />
              </div>
            </>
          )}

          <button type="submit" className="btn-primary" style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {upsertExam.isPending || upsertOverride.isPending ? (
              <Loader2 className="spin" size={15} />
            ) : (
              <Calendar size={15} />
            )}
            {editingExam ? 'Save Changes' : 'Publish Schedule'}
          </button>
        </form>
      </BottomSheet>

      <NavBar />
    </div>
  );
}
