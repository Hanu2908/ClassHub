import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Loader2, AlertCircle, GraduationCap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/appStore';
import { toast } from 'sonner';
import OnboardingLoader from '../../components/OnboardingLoader';

const classRollRegex = /^\d{2}$/;
const uniRollRegex = /^[0-9]{2}[A-Z]{5}[0-9]{3}$/;
const hubCodeRegex = /^[A-Z0-9]{2}[A-Z]{4}$/;

interface FormErrors {
  hubCode?: string;
  classRoll?: string;
  universityRoll?: string;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="t-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-critical)', marginTop: 8 }}>
      <AlertCircle size={14} />
      {msg}
    </p>
  );
}

export default function JoinHubPage() {
  const navigate = useNavigate();
  const { setRole, setHub, refreshProfile, authUser } = useAppStore();
  const setAuthUser = useAppStore(s => s.setAuthUser);

  const [isTeacherFlow] = useState(() => new URLSearchParams(window.location.search).get('role') === 'teacher');
  const [hubCode, setHubCode] = useState('');
  const [classRoll, setClassRoll] = useState('');
  const [universityRoll, setUniversityRoll] = useState('');
  const [dayScholar, setDayScholar] = useState(true);
  const [batch, setBatch] = useState('1');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const [showCourseLinking, setShowCourseLinking] = useState(false);
  const [joinedSectionId, setJoinedSectionId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [fetchingSubjects, setFetchingSubjects] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, { linked: boolean; applyAll: boolean }>>({});
  const [savingCourses, setSavingCourses] = useState(false);

  useEffect(() => {
    if (!showCourseLinking || !joinedSectionId) return;

    const fetchSectionSubjects = async () => {
      setFetchingSubjects(true);
      try {
        if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
          setSubjects([
            { id: 'sub-1', code: 'CS-301', name: 'Computer Networks', semester: 5, accent: '#4A9EFF' },
            { id: 'sub-2', code: 'CS-302', name: 'Compiler Design', semester: 5, accent: '#6366F1' },
            { id: 'sub-3', code: 'CS-303', name: 'Software Engineering', semester: 5, accent: '#10B981' },
          ]);
        } else {
          const { data, error } = await supabase
            .from('subjects')
            .select('*')
            .eq('section_id', joinedSectionId)
            .order('code');
          if (error) throw error;
          setSubjects(data || []);
        }
      } catch (err: any) {
        toast.error('Failed to load subjects: ' + err.message);
      } finally {
        setFetchingSubjects(false);
      }
    };

    fetchSectionSubjects();
  }, [showCourseLinking, joinedSectionId]);

  // Load and pre-fill pending invite code from URL parameters or sessionStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('invite') || params.get('code');
    const storedCode = sessionStorage.getItem('classhub-pending-invite-code');
    const activeCode = urlCode || storedCode;

    if (activeCode) {
      if (isTeacherFlow) {
        setHubCode(activeCode.toUpperCase());
      } else if (hubCodeRegex.test(activeCode.toUpperCase())) {
        setHubCode(activeCode.toUpperCase());
      }
      
      // Clean up sessionStorage
      sessionStorage.removeItem('classhub-pending-invite-code');
      
      // Clean up URL parameters to keep the URL address bar clean
      if (urlCode) {
        const newParams = new URLSearchParams(window.location.search);
        newParams.delete('invite');
        newParams.delete('code');
        const cleanSearch = newParams.toString();
        const cleanUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
        window.history.replaceState(null, '', cleanUrl);
      }
    }
  }, [isTeacherFlow]);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (isTeacherFlow) {
      if (!hubCode.trim() || hubCode.trim().length < 6) {
        e.hubCode = 'Enter a valid teacher invite code (minimum 6 characters)';
      }
    } else {
      if (!hubCodeRegex.test(hubCode)) e.hubCode = 'Enter a valid 6-character hub code (e.g. P2WXYZ)';
      if (!classRollRegex.test(classRoll)) e.classRoll = 'Class roll must be exactly 2 digits (01–99)';
      if (!uniRollRegex.test(universityRoll.toUpperCase())) e.universityRoll = 'Enter a valid university roll (e.g. 25ESKCX089)';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setIsComplete(false);

    if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
      localStorage.setItem('demo_section_id', 'demo-section');
      if (isTeacherFlow) {
        setRole('teacher');
        if (authUser) {
          setAuthUser({
            ...authUser,
            role: 'teacher',
            sectionId: 'demo-section',
            isCounsellorForBatch: '1'
          });
        }
        setHub({
          hubCode: hubCode,
          section: 'Demo Section',
          hubName: 'Demo Hub',
          institution: 'SKIT',
          classRoll: '00',
          universityRoll: 'TEACHER',
        });
        setJoinedSectionId('demo-section');
      } else {
        setRole('student');
        const parsedSectionName = hubCode.length >= 2 ? hubCode.slice(0, 1).toUpperCase() : 'Demo Section';
        if (authUser) {
          setAuthUser({ ...authUser, role: 'student', sectionId: 'demo-section', dayScholar, subBatch: batch });
        }
        setHub({
          hubCode: hubCode,
          section: parsedSectionName,
          hubName: `${parsedSectionName} Section Hub`,
          institution: 'SKIT',
          classRoll: classRoll,
          universityRoll: universityRoll.toUpperCase(),
        });
      }
      const parsedSectionName = isTeacherFlow
        ? 'Demo Section'
        : (hubCode.length >= 2 ? hubCode.slice(0, 1).toUpperCase() : 'Demo Section');
      useAppStore.getState().setOfflineCache('section', {
        id: 'demo-section',
        name: parsedSectionName,
        college: 'SKIT',
        inviteCode: hubCode,
        teacherInviteCode: 'T-DEMOCO',
        createdBy: 'demo-creator-id',
      });
      setIsComplete(true);
      return;
    }

    try {
      if (isTeacherFlow) {
        const { data, error } = await supabase.rpc('join_section_as_teacher', {
          invite: hubCode.trim().toUpperCase(),
        });
        if (error) throw error;
        if (data) {
          setJoinedSectionId((data as any).section_id);
        }
      } else {
        const { error } = await supabase.rpc('join_section', {
          invite: hubCode.trim().toUpperCase(),
          class_roll: classRoll.trim(),
          uni_roll: universityRoll.trim().toUpperCase(),
        });

        if (error) throw error;

        // Update day_scholar and sub_batch status in profile
        const { data: { user: authUserObj } } = await supabase.auth.getUser();
        if (authUserObj) {
          await supabase
            .from('users')
            .update({ day_scholar: dayScholar, sub_batch: batch })
            .eq('id', authUserObj.id);
        }
      }

      // Refresh profile from backend so route guard sees new sectionId
      await refreshProfile();
      setIsComplete(true);
    } catch (err: unknown) {
      setLoading(false);
      const message = err instanceof Error 
        ? err.message 
        : (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
            ? (err as any).message
            : 'Failed to join hub');
      if (message.includes('Invalid invite code') || message.includes('Invalid teacher invite code')) {
        setErrors({ hubCode: isTeacherFlow ? 'Invalid teacher code. Double-check with the CR.' : 'Invalid invite code. Double-check with your CR.' });
      } else {
        toast.error(message);
      }
    }
  };

  const handleSaveCourses = async () => {
    const sectionId = joinedSectionId;
    if (!sectionId) {
      toast.error('No section associated. Please try again.');
      return;
    }
    setSavingCourses(true);
    try {
      const selectedEntries = Object.entries(selectedSubjects).filter(([, val]) => val.linked);
      if (selectedEntries.length === 0) {
        toast.success('Joined successfully! Welcome 🎓');
        navigate('/app/teacher-dashboard');
        return;
      }

      if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
        toast.success('Demo: Subjects linked successfully!');
        navigate('/app/teacher-dashboard');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // 1. Fetch other sections linked to teacher
      const { data: stData } = await supabase
        .from('section_teachers')
        .select('section_id')
        .eq('teacher_id', user.id);
      const otherSections = Array.from(new Set((stData || []).map(x => x.section_id).filter(id => id !== sectionId)));

      for (const [subId, val] of selectedEntries) {
        // Link to current section
        await supabase
          .from('section_teachers')
          .insert({
            section_id: sectionId,
            teacher_id: user.id,
            subject_id: subId
          });
        
        // If applyAll and there are other sections
        if (val.applyAll && otherSections.length > 0) {
          const currentSubject = subjects.find(s => s.id === subId);
          if (currentSubject) {
            // Find subject IDs with same code in other sections
            const { data: matchSubjects } = await supabase
              .from('subjects')
              .select('id, section_id')
              .eq('code', currentSubject.code)
              .in('section_id', otherSections);

            if (matchSubjects && matchSubjects.length > 0) {
              const insertRows = matchSubjects.map(ms => ({
                section_id: ms.section_id,
                teacher_id: user.id,
                subject_id: ms.id
              }));
              await supabase.from('section_teachers').insert(insertRows);
            }
          }
        }
      }

      toast.success('Courses linked successfully!');
      navigate('/app/teacher-dashboard');
    } catch (err: any) {
      toast.error('Failed to link courses: ' + err.message);
    } finally {
      setSavingCourses(false);
    }
  };

  if (showCourseLinking) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', padding: '24px 20px 48px' }}>
        <div style={{ maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header info */}
          <div style={{ textAlign: 'center', margin: '24px 0 12px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <GraduationCap size={24} color="var(--accent-primary)" />
            </div>
            <h1 className="t-page-title" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Link Your Courses</h1>
            <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
              Select the subjects you teach in this section. You can also edit these later in your profile.
            </p>
          </div>

          {/* Subjects list */}
          {fetchingSubjects ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Loader2 size={32} className="animate-spin" color="var(--text-secondary)" />
            </div>
          ) : subjects.length === 0 ? (
            <div style={{
              padding: 24, textAlign: 'center', background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)'
            }}>
              <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>No subjects found</p>
              <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
                This section Rep has not added any subjects to this hub yet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {subjects.map(subject => {
                const isSelected = !!selectedSubjects[subject.id]?.linked;
                const applyAll = !!selectedSubjects[subject.id]?.applyAll;
                return (
                  <div key={subject.id} style={{
                    padding: '14px 16px',
                    background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-base)',
                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    transition: 'all 0.2s ease',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedSubjects(prev => ({
                            ...prev,
                            [subject.id]: {
                              linked: !prev[subject.id]?.linked,
                              applyAll: prev[subject.id]?.applyAll ?? false,
                            }
                          }));
                        }}
                        style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            padding: '2px 6px', borderRadius: 4, background: `${subject.accent}20`,
                            color: subject.accent, fontSize: 11, fontWeight: 600, fontFamily: 'monospace'
                          }}>{subject.code}</span>
                          <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Sem {subject.semester}</span>
                        </div>
                        <p className="t-card-title" style={{ color: 'var(--text-primary)', marginTop: 4, fontSize: 15 }}>
                          {subject.name}
                        </p>
                      </div>
                    </label>

                    {isSelected && (
                      <div style={{
                        paddingTop: 8,
                        borderTop: '1px solid var(--border-default)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                      }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={applyAll}
                            onChange={() => {
                              setSelectedSubjects(prev => ({
                                ...prev,
                                [subject.id]: {
                                  ...prev[subject.id],
                                  applyAll: !prev[subject.id]?.applyAll,
                                }
                              }));
                            }}
                            style={{ width: 14, height: 14, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                          />
                          <span className="t-mono-sm" style={{ color: 'var(--text-secondary)' }}>Apply to all my sections</span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <button
              onClick={handleSaveCourses}
              disabled={savingCourses}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {savingCourses ? <Loader2 size={18} className="animate-spin" /> : 'Save & Continue'}
            </button>
            <button
              onClick={() => {
                toast.success('Joined successfully! Welcome 🎓');
                navigate('/app/teacher-dashboard');
              }}
              disabled={savingCourses}
              style={{
                width: '100%', padding: '12px', background: 'transparent',
                border: '1px solid var(--border-default)', color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-md)', fontWeight: 500, cursor: 'pointer',
                textAlign: 'center', transition: 'all 0.2s ease',
              }}
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', padding: '0 0 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 0' }}>
        <button
          id="join-back-btn"
          onClick={() => navigate('/onboarding/choice')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 8, marginLeft: -8, display: 'flex' }}
          aria-label="Go back"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>{isTeacherFlow ? 'Join as Teacher' : 'Join a Hub'}</h1>
      </div>

      {/* Icon + subtitle */}
      <div style={{ textAlign: 'center', padding: '32px 24px 24px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <Lock size={26} color="var(--accent-primary)" />
        </div>
        <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 6 }}>
          {isTeacherFlow ? 'Enter Teacher Invite Code' : 'Enter your hub details'}
        </p>
        <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
          {isTeacherFlow ? 'Get the teacher code from the Class Rep' : 'Get the code from your Class Rep'}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Hub Code */}
        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
            {isTeacherFlow ? 'Teacher Invite Code' : 'Hub Code'} <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <input
            id="hub-code-input"
            className={`input mono${errors.hubCode ? ' input-error' : ''}`}
            placeholder={isTeacherFlow ? "T-P2WXYZ" : "P2WXYZ"}
            maxLength={isTeacherFlow ? 10 : 6}
            value={hubCode}
            onChange={e => setHubCode(e.target.value.toUpperCase())}
            onBlur={() => {
              if (isTeacherFlow) {
                if (hubCode && hubCode.length < 6) {
                  setErrors(p => ({ ...p, hubCode: 'Enter a valid teacher code (min 6 characters)' }));
                } else setErrors(p => ({ ...p, hubCode: undefined }));
              } else {
                if (hubCode && !hubCodeRegex.test(hubCode))
                  setErrors(p => ({ ...p, hubCode: 'Enter a valid 6-character hub code (e.g. P2WXYZ)' }));
                else setErrors(p => ({ ...p, hubCode: undefined }));
              }
            }}
            style={{ letterSpacing: '0.2em', fontSize: 20, textAlign: 'center' }}
          />
          <FieldError msg={errors.hubCode} />
          <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
            {isTeacherFlow ? 'e.g. T-P2WXYZ — get this from the CR' : 'e.g. P2WXYZ — get this from your CR'}
          </p>
        </div>

        {!isTeacherFlow && (
          <>
            {/* Class Roll */}
            <div>
              <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
                Class Roll Number <span style={{ color: 'var(--status-critical)' }}>*</span>
              </label>
              <input
                id="class-roll-input"
                className={`input${errors.classRoll ? ' input-error' : ''}`}
                placeholder="17"
                maxLength={2}
                inputMode="numeric"
                value={classRoll}
                onChange={e => setClassRoll(e.target.value.replace(/\D/g, ''))}
                onBlur={() => {
                  if (classRoll && !classRollRegex.test(classRoll))
                    setErrors(p => ({ ...p, classRoll: 'Class roll must be exactly 2 digits (01–99)' }));
                  else setErrors(p => ({ ...p, classRoll: undefined }));
                }}
              />
              <FieldError msg={errors.classRoll} />
              <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                Your 2-digit class roll (e.g. 17)
              </p>
            </div>

            {/* University Roll */}
            <div>
              <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
                University Roll Number <span style={{ color: 'var(--status-critical)' }}>*</span>
              </label>
              <input
                id="uni-roll-input"
                className={`input mono${errors.universityRoll ? ' input-error' : ''}`}
                placeholder="25ESKCX089"
                maxLength={12}
                value={universityRoll}
                onChange={e => setUniversityRoll(e.target.value.toUpperCase())}
                onBlur={() => {
                  const v = universityRoll.toUpperCase();
                  if (v && !uniRollRegex.test(v))
                    setErrors(p => ({ ...p, universityRoll: 'Enter a valid university roll (e.g. 25ESKCX089)' }));
                  else setErrors(p => ({ ...p, universityRoll: undefined }));
                }}
              />
              <FieldError msg={errors.universityRoll} />
              <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                e.g. 25ESKCX089
              </p>
            </div>

            {/* Commuter Status (Day Scholar vs. Hosteler) */}
            <div>
              <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
                Commuter Status <span style={{ color: 'var(--status-critical)' }}>*</span>
              </label>
              <div style={{
                display: 'flex',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: 4,
                gap: 4
              }}>
                <button
                  type="button"
                  onClick={() => setDayScholar(true)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: dayScholar ? 'var(--accent-primary)' : 'transparent',
                    color: dayScholar ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>🚌</span> Day Scholar
                </button>
                <button
                  type="button"
                  onClick={() => setDayScholar(false)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: !dayScholar ? 'var(--accent-primary)' : 'transparent',
                    color: !dayScholar ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>🏠</span> Hosteler
                </button>
              </div>
            </div>

            {/* Batch Selection (Batch 1 vs. Batch 2) */}
            <div>
              <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
                Batch <span style={{ color: 'var(--status-critical)' }}>*</span>
              </label>
              <div style={{
                display: 'flex',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: 4,
                gap: 4
              }}>
                <button
                  type="button"
                  onClick={() => setBatch('1')}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: batch === '1' ? 'var(--accent-primary)' : 'transparent',
                    color: batch === '1' ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease'
                  }}
                >
                  Batch 1
                </button>
                <button
                  type="button"
                  onClick={() => setBatch('2')}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: batch === '2' ? 'var(--accent-primary)' : 'transparent',
                    color: batch === '2' ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease'
                  }}
                >
                  Batch 2
                </button>
              </div>
            </div>
          </>
        )}

        <button
          id="join-hub-btn"
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {loading ? <><Loader2 size={18} className="animate-spin" /> {isTeacherFlow ? 'Joining as Teacher…' : 'Joining…'}</> : isTeacherFlow ? 'Join as Teacher' : 'Join Hub'}
        </button>
      </form>

      {loading && (
        <OnboardingLoader
          type={isTeacherFlow ? "create" : "join"}
          isComplete={isComplete}
          onFinished={() => {
            if (isTeacherFlow && joinedSectionId) {
              setLoading(false);
              setShowCourseLinking(true);
            } else {
              toast.success('Joined hub successfully! Welcome 🎉');
              navigate('/app/home');
            }
          }}
        />
      )}
    </div>
  );
}
