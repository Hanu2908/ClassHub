import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ExternalLink, CheckCircle2, Wand2, Trash2, FileText } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { CROnly, EmptyState, deadlineBadgeClass, deadlineLabel } from '../../components/Shared';
import { BottomSheet } from '../../components/BottomSheet';
import { useAppStore } from '../../store/appStore';
import type { Assignment, AssignmentSet } from '../../store/appStore';
import { showToast } from '../../components/Toast';

type Filter = 'all' | 'pending' | 'submitted' | 'overdue';

const SUBJECT_EMOJIS: Record<string, string> = {
  DBMS: '📘', 'Operating Systems': '📗', 'AI Fundamentals': '📕',
};

function getUserSet(classRoll: string, sets: AssignmentSet[]) {
  if (!sets || sets.length === 0) return null;
  const roll = parseInt(classRoll, 10);
  return sets.find(s => roll >= s.rollStart && roll <= s.rollEnd) ?? null;
}

function autoGenerate(totalStudents: number, groupSize: number): AssignmentSet[] {
  const sets: AssignmentSet[] = [];
  let roll = 1, setNum = 1;
  while (roll <= totalStudents) {
    const end = Math.min(roll + groupSize - 1, totalStudents);
    sets.push({
      id: `set-${setNum}-${Date.now()}`,
      label: `Set ${setNum}`,
      rollStart: roll,
      rollEnd: end,
      pageNumbers: String(setNum),
      description: `Complete Page ${setNum} of the attached PDF.`,
      pdfUrl: null,
    });
    roll = end + 1;
    setNum++;
  }
  return sets;
}

// ── CR Wizard ─────────────────────────────────────────────────────────────────
function CreateAssignmentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addAssignment = useAppStore(s => s.addAssignment);
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [hasSets, setHasSets] = useState(false);

  // Step 2 fields
  const [totalStudents, setTotalStudents] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [sets, setSets] = useState<AssignmentSet[]>([]);

  const reset = () => {
    setStep(1); setTitle(''); setSubject(''); setSubjectCode('');
    setDueDate(''); setDescription(''); setPdfUrl(''); setHasSets(false);
    setTotalStudents(''); setGroupSize(''); setSets([]);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleGenerate = () => {
    const t = parseInt(totalStudents), g = parseInt(groupSize);
    if (!t || !g || t < 1 || g < 1) { showToast('Enter valid numbers', 'error'); return; }
    setSets(autoGenerate(t, g));
    showToast(`Generated ${autoGenerate(t, g).length} sets`, 'info');
  };

  const updateSet = (idx: number, field: keyof AssignmentSet, value: string) => {
    setSets(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const isNumeric = field === 'rollStart' || field === 'rollEnd';
      const updated = {
        ...s,
        [field]: isNumeric ? (parseInt(value) || 0) : value,
      };
      if (field === 'pageNumbers') {
        updated.description = `Complete Pages ${value} of the attached PDF.`;
      }
      return updated;
    }));
  };

  const deleteSet = (idx: number) => setSets(prev => prev.filter((_, i) => i !== idx));

  const addRow = () => {
    const last = sets[sets.length - 1];
    const nextRoll = last ? last.rollEnd + 1 : 1;
    setSets(prev => [...prev, {
      id: `set-custom-${Date.now()}`,
      label: `Set ${prev.length + 1}`,
      rollStart: nextRoll, rollEnd: nextRoll,
      pageNumbers: '', description: '', pdfUrl: null,
    }]);
  };

  const handlePublish = () => {
    if (!title.trim() || !subject.trim() || !dueDate) {
      showToast('Fill in all required fields', 'error'); return;
    }
    if (hasSets && sets.length === 0) {
      showToast('Generate or add at least one set', 'error'); return;
    }
    const newAssignment: Assignment = {
      id: `as-${Date.now()}`,
      title: title.trim(),
      subject: subject.trim(),
      subjectCode: subjectCode.trim(),
      dueDate: new Date(dueDate).toISOString(),
      description: description.trim(),
      status: 'pending',
      pdfUrl: pdfUrl.trim() || null,
      hasSets,
      sets: hasSets ? sets : [],
      submittedLink: null,
    };
    addAssignment(newAssignment);
    showToast('Assignment published! ✓', 'success');
    handleClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
    font: '400 13px var(--font-body)', color: 'var(--text-primary)',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    font: '500 12px var(--font-body)', color: 'var(--text-secondary)',
    display: 'block', marginBottom: 6,
  };

  return (
    <BottomSheet open={open} onClose={handleClose} title={step === 1 ? 'New Assignment' : 'Configure Sets'}>
      {step === 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Title <span style={{ color: 'var(--status-critical)' }}>*</span></label>
            <input style={inputStyle} placeholder="e.g. DBMS Unit 3 Assignment" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Subject <span style={{ color: 'var(--status-critical)' }}>*</span></label>
              <input style={inputStyle} placeholder="DBMS" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Code</label>
              <input style={inputStyle} placeholder="CS-304" value={subjectCode} onChange={e => setSubjectCode(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Due Date & Time <span style={{ color: 'var(--status-critical)' }}>*</span></label>
            <input style={inputStyle} type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} placeholder="Instructions for students…" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Master PDF URL</label>
            <input style={inputStyle} type="url" placeholder="https://drive.google.com/…" value={pdfUrl} onChange={e => setPdfUrl(e.target.value)} />
          </div>

          {/* Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: `1px solid ${hasSets ? 'rgba(74,158,255,0.35)' : 'var(--border-default)'}` }}>
            <div>
              <p style={{ font: '600 13px var(--font-body)', color: 'var(--text-primary)' }}>Split by Roll Numbers</p>
              <p style={{ font: '400 11px var(--font-body)', color: 'var(--text-muted)', marginTop: 2 }}>Assign different pages to different roll ranges</p>
            </div>
            <button
              onClick={() => setHasSets(v => !v)}
              style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: hasSets ? 'var(--accent-primary)' : 'var(--border-default)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
            >
              <span style={{ position: 'absolute', top: 3, left: hasSets ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={handleClose}>Cancel</button>
            {hasSets
              ? <button className="btn-primary" style={{ flex: 1 }} onClick={() => { if (!title.trim() || !subject.trim() || !dueDate) { showToast('Fill required fields first', 'error'); return; } setStep(2); }}>Next →</button>
              : <button className="btn-primary" style={{ flex: 1 }} onClick={handlePublish}>Publish</button>
            }
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Auto-generate controls */}
          <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
            <p style={{ font: '600 12px var(--font-mono)', color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.05em' }}>AUTO-GENERATE</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Total Students</label>
                <input style={inputStyle} type="number" min="1" placeholder="e.g. 68" value={totalStudents} onChange={e => setTotalStudents(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Group Size</label>
                <input style={inputStyle} type="number" min="1" placeholder="e.g. 6" value={groupSize} onChange={e => setGroupSize(e.target.value)} />
              </div>
            </div>
            <button
              onClick={handleGenerate}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.3)', borderRadius: 'var(--radius-pill)', font: '600 12px var(--font-body)', color: 'var(--accent-primary)', cursor: 'pointer' }}
            >
              <Wand2 size={13} /> Auto-Generate
            </button>
          </div>

          {/* Sets table */}
          {sets.length > 0 && (
            <div>
              <p style={{ font: '600 12px var(--font-mono)', color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.05em' }}>SETS — ALL FIELDS EDITABLE</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '64px 72px 72px 80px 28px', gap: 5, padding: '0 4px' }}>
                  {['Label', 'Roll From', 'Roll To', 'Pages', ''].map(h => (
                    <p key={h} style={{ font: '600 10px var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{h}</p>
                  ))}
                </div>
                {sets.map((s, idx) => {
                  const cellInput: React.CSSProperties = { ...inputStyle, padding: '5px 7px', font: '400 12px var(--font-mono)', minWidth: 0 };
                  return (
                    <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '64px 72px 72px 80px 28px', gap: 5, alignItems: 'center', padding: '6px 4px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                      {/* Label */}
                      <input
                        value={s.label}
                        onChange={e => updateSet(idx, 'label', e.target.value)}
                        placeholder="Set 1"
                        style={{ ...cellInput, color: 'var(--accent-primary)', fontWeight: 600 }}
                      />
                      {/* Roll Start */}
                      <input
                        type="number"
                        min="1"
                        value={s.rollStart}
                        onChange={e => updateSet(idx, 'rollStart', e.target.value)}
                        placeholder="1"
                        style={cellInput}
                      />
                      {/* Roll End */}
                      <input
                        type="number"
                        min="1"
                        value={s.rollEnd}
                        onChange={e => updateSet(idx, 'rollEnd', e.target.value)}
                        placeholder="10"
                        style={cellInput}
                      />
                      {/* Pages */}
                      <input
                        value={s.pageNumbers}
                        onChange={e => updateSet(idx, 'pageNumbers', e.target.value)}
                        placeholder="e.g. 1-3"
                        style={cellInput}
                      />
                      <button onClick={() => deleteSet(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={addRow}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'none', border: '1px dashed var(--border-active)', borderRadius: 'var(--radius-md)', font: '500 12px var(--font-body)', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <Plus size={13} /> Add Row Manually
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handlePublish}>Publish Assignment</button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AssignmentsPage() {
  const navigate = useNavigate();
  const { submissions, submit, hub, assignments } = useAppStore();
  const classRoll = hub?.classRoll ?? '17';

  const [filter, setFilter] = useState<Filter>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const handleMarkSubmitted = (id: string) => {
    submit(id, 'marked-submitted');
    showToast('Marked as submitted ✓', 'success');
  };

  const enriched = assignments.map(a => {
    const isSubmitted = !!submissions[a.id] || a.status === 'submitted';
    const diff = new Date(a.dueDate).getTime() - Date.now();
    const isOverdue = diff < 0 && !isSubmitted;
    return { ...a, isSubmitted, isOverdue };
  });

  const filtered = enriched.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'submitted') return a.isSubmitted;
    if (filter === 'overdue') return a.isOverdue;
    if (filter === 'pending') return !a.isSubmitted && !a.isOverdue;
    return true;
  });

  return (
    <div className="page-shell">
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-default)', padding: '16px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button id="assign-back-btn" onClick={() => navigate('/app/home')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ font: '600 18px var(--font-display)', color: 'var(--text-primary)' }}>Assignments</h1>
        </div>
        <div className="filter-tabs">
          {(['all', 'pending', 'submitted', 'overdue'] as Filter[]).map(f => (
            <button key={f} id={`assign-filter-${f}`} className={`filter-tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>{f}</button>
          ))}
        </div>
      </header>

      <main className="page-content">
        {filtered.length === 0
          ? <EmptyState emoji="🎉" title="All clear!" subtitle="No assignments in this category" />
          : filtered.map(a => {
            const userSet = getUserSet(classRoll, a.sets ?? []);
            const isSubmitted = a.isSubmitted;
            const bdg = isSubmitted ? 'badge-safe' : a.isOverdue ? 'badge-critical' : deadlineBadgeClass(a.dueDate);
            const lbl = isSubmitted ? 'Submitted' : a.isOverdue ? 'Overdue' : deadlineLabel(a.dueDate);

            return (
              <article key={a.id} className="card" style={{ animation: 'fadeSlideUp 0.35s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 28 }}>{SUBJECT_EMOJIS[a.subject] ?? '📄'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ font: '600 15px var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>{a.title}</h2>
                    <p style={{ font: '400 12px var(--font-body)', color: 'var(--text-muted)', marginBottom: 8 }}>{a.subject} · {a.subjectCode}</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className={`badge ${bdg}`}>{lbl}</span>
                      {!isSubmitted && (
                        <span style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)' }}>
                          Due {new Date(a.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {a.description && (
                  <p style={{ font: '400 13px var(--font-body)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{a.description}</p>
                )}

                {/* ── Student set banner ── */}
                {a.hasSets && userSet && (
                  <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,171,64,0.35)', background: 'rgba(255,171,64,0.07)', padding: '14px 14px 12px', marginBottom: 12 }}>
                    <p style={{ font: '600 10px var(--font-mono)', color: 'rgba(255,171,64,0.9)', letterSpacing: '0.08em', marginBottom: 6 }}>⚠ YOUR ASSIGNMENT</p>
                    <p style={{ font: '700 15px var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
                      Based on Roll #{classRoll}, you are in{' '}
                      <span style={{ color: 'var(--accent-primary)' }}>{userSet.label}</span>
                    </p>
                    <p style={{ font: '400 13px var(--font-body)', color: 'var(--text-secondary)', marginBottom: userSet.pdfUrl || a.pdfUrl ? 10 : 0 }}>
                      Complete the questions on{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>
                        Pages {userSet.pageNumbers || '—'}
                      </strong>{' '}
                      of the attached PDF.
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {userSet.pdfUrl && (
                        <a href={userSet.pdfUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.3)', borderRadius: 'var(--radius-pill)', font: '500 12px var(--font-body)', color: 'var(--accent-primary)', textDecoration: 'none' }}>
                          <ExternalLink size={11} /> Open Set PDF
                        </a>
                      )}
                      {a.pdfUrl && !userSet.pdfUrl && (
                        <a href={a.pdfUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.3)', borderRadius: 'var(--radius-pill)', font: '500 12px var(--font-body)', color: 'var(--accent-primary)', textDecoration: 'none' }}>
                          <FileText size={11} /> Open Master PDF
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Non-set PDF link */}
                {!a.hasSets && a.pdfUrl && (
                  <a href={a.pdfUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-pill)', font: '500 12px var(--font-body)', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 12 }}>
                    <FileText size={11} /> View PDF
                  </a>
                )}

                {/* Submit area */}
                {isSubmitted ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--status-safe-bg)', border: '1px solid rgba(52,201,123,0.35)', borderRadius: 'var(--radius-md)', transition: 'all 0.3s ease' }}>
                    <CheckCircle2 size={15} color="var(--status-safe)" />
                    <p style={{ font: '600 13px var(--font-body)', color: 'var(--status-safe)' }}>Submitted ✓</p>
                  </div>
                ) : (
                  <button
                    id={`submit-btn-${a.id}`}
                    onClick={() => handleMarkSubmitted(a.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.4)', borderRadius: 'var(--radius-md)', cursor: 'pointer', font: '600 13px var(--font-body)', color: 'var(--accent-primary)', width: '100%', transition: 'all 0.2s ease' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(74,158,255,0.18)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-primary-glow)'; }}
                  >
                    <CheckCircle2 size={15} /> Mark as Submitted
                  </button>
                )}
              </article>
            );
          })
        }
      </main>

      {/* Create assignment sheet (CR only) */}
      <CreateAssignmentSheet open={createOpen} onClose={() => setCreateOpen(false)} />

      <CROnly>
        <button id="add-assign-fab" className="fab" aria-label="Add assignment" onClick={() => setCreateOpen(true)}>
          <Plus size={22} />
        </button>
      </CROnly>

      <NavBar />
    </div>
  );
}
