import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit2, Loader2, Search } from 'lucide-react';
import { useGlobalResources, useGlobalPYQs, type GlobalResource } from '../../hooks/useSupabaseQuery';
import { useUpdateGlobalResource } from '../../hooks/useSupabaseMutations';
import { useAppStore } from '../../store/appStore';
import { showToast } from '../../components/Toast';
import { BottomSheet } from '../../components/BottomSheet';
import { NavBar } from '../../components/NavBar';

// ── CUSTOM THEME STYLES (Retaining retro-cyber dark violet style) ──
const customTheme = {
  bgPage: '#0A0A0F',
  bgCard: '#13131C',
  bgHover: '#1A1A28',
  borderFaint: '#1C1C2E',
  borderMid: '#2A2A40',
  borderStrong: '#6B6B9A',
  textPrimary: '#F0F0FF',
  textSecondary: '#9090B8',
  textDim: '#4A4A6A',
  textMeta: '#6060A0',
  accent: '#8B5CF6', // Electric violet
  statusLive: '#4ADE80',
  fontDisplay: "'Bebas Neue', cursive, sans-serif",
  fontMono: "'IBM Plex Mono', monospace",
};

export default function ResourceHubPage() {
  const navigate = useNavigate();
  const { authUser } = useAppStore();
  const isAdmin = authUser?.role === 'cr';

  // ── Database Queries & Mutations ──
  const { data: rawResources = [], isLoading: loadingResources } = useGlobalResources();
  const { data: rawPYQs = [], isLoading: loadingPYQs } = useGlobalPYQs();
  const updateResourceMutation = useUpdateGlobalResource();

  // ── States ──
  const [selectedSemester, setSelectedSemester] = useState<string>('Semester II');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // ── Edit BottomSheet state ──
  const [editingResource, setEditingResource] = useState<GlobalResource | null>(null);
  const [editSyllabus, setEditSyllabus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPYQs, setEditPYQs] = useState('');
  const [editPractice, setEditPractice] = useState('');
  const [editLab, setEditLab] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set initial form states on edit open
  const handleOpenEdit = (res: GlobalResource) => {
    setEditingResource(res);
    setEditSyllabus(res.syllabusUrl);
    setEditNotes(res.notesUrl);
    setEditPYQs(res.pyqsUrl);
    setEditPractice(res.practiceUrl);
    setEditLab(res.labUrl);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResource) return;
    setIsSubmitting(true);
    try {
      await updateResourceMutation.mutateAsync({
        id: editingResource.id,
        subjectCode: editingResource.subjectCode,
        subjectName: editingResource.subjectName,
        semester: editingResource.semester,
        branch: editingResource.branch,
        accentColor: editingResource.accentColor,
        syllabusUrl: editSyllabus,
        notesUrl: editNotes,
        pyqsUrl: editPYQs,
        practiceUrl: editPractice,
        labUrl: editLab,
      });
      showToast('Vault folder updated successfully', 'success');
      setEditingResource(null);
    } catch (err: any) {
      showToast(`Update failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Subject & Branch Filtering ──
  const filteredResources = useMemo(() => {
    return rawResources.filter(r => {
      // 1. Semester matching
      if (selectedSemester !== 'ALL' && r.semester !== selectedSemester) return false;
      
      // 2. Branch matching
      if (selectedBranch !== 'ALL') {
        const matchesAll = r.branch === 'ALL';
        const matchesBranch = r.branch.includes(selectedBranch);
        if (!matchesAll && !matchesBranch) return false;
      }

      // 3. Search query matching
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const codeMatch = r.subjectCode.toLowerCase().includes(query);
        const nameMatch = r.subjectName.toLowerCase().includes(query);
        if (!codeMatch && !nameMatch) return false;
      }

      return true;
    });
  }, [rawResources, selectedSemester, selectedBranch, searchQuery]);

  const semestersList = ['Semester I', 'Semester II', 'Semester III', 'Semester IV', 'ALL'];
  const branchesList = ['ALL', 'IT', 'CSE', 'ME', 'EC'];

  return (
    <div style={{
      background: customTheme.bgPage,
      minHeight: '100vh',
      color: customTheme.textPrimary,
      fontFamily: customTheme.fontMono,
      paddingBottom: '90px',
      overflowX: 'hidden'
    }}>
      
      {/* ── HEADER ── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(10,10,15,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: `2px solid ${customTheme.accent}`,
        padding: '14px 16px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '64px',
      }}>
        {isSearching ? (
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '10px' }}>
            <input
              type="text"
              autoFocus
              placeholder="Search subject code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${customTheme.borderMid}`,
                borderRadius: '4px',
                padding: '6px 12px',
                fontFamily: customTheme.fontMono,
                fontSize: '13px',
                color: customTheme.textPrimary,
                outline: 'none',
              }}
            />
            <button
              onClick={() => { setIsSearching(false); setSearchQuery(''); }}
              style={{
                background: 'none',
                border: `1px solid ${customTheme.borderMid}`,
                color: customTheme.textSecondary,
                padding: '4px 8px',
                fontSize: '11px',
                fontFamily: customTheme.fontMono,
                cursor: 'pointer',
              }}
            >
              [ X ]
            </button>
          </div>
        ) : (
          <>
            {/* Left branding */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                onClick={() => navigate('/app/profile')}
                style={{
                  background: 'none',
                  border: `1px solid ${customTheme.borderMid}`,
                  cursor: 'pointer',
                  color: customTheme.textPrimary,
                  padding: '4px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  fontFamily: customTheme.fontMono,
                  fontSize: '11px',
                }}
              >
                <ChevronLeft size={14} /> BACK
              </button>
              <div>
                <h1 style={{
                  fontFamily: customTheme.fontDisplay,
                  fontSize: '28px',
                  letterSpacing: '2px',
                  color: customTheme.accent,
                  lineHeight: 1,
                }}>
                  Resource Hub
                </h1>
                <p style={{
                  fontFamily: customTheme.fontMono,
                  fontSize: '9px',
                  color: customTheme.textMeta,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  marginTop: '2px'
                }}>
                  SKIT Jaipur · AUTONOMOUS
                </p>
              </div>
            </div>

            {/* Right actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setIsSearching(true)}
                style={{
                  background: 'none',
                  border: `1px solid ${customTheme.borderMid}`,
                  cursor: 'pointer',
                  color: customTheme.textPrimary,
                  fontFamily: customTheme.fontMono,
                  fontSize: '11px',
                  fontWeight: 400,
                  letterSpacing: '1px',
                  padding: '5px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Search size={12} /> SEARCH
              </button>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '9px',
                letterSpacing: '2px',
                color: customTheme.statusLive,
              }}>
                <span className="live-dot" style={{
                  width: '6px',
                  height: '6px',
                  background: customTheme.statusLive,
                  borderRadius: '50%',
                  display: 'inline-block',
                }} />
                LIVE
              </div>
            </div>
          </>
        )}
      </header>

      {/* ── FILTER CONTAINER ── */}
      <div style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${customTheme.borderFaint}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        overflowX: 'auto'
      }}>
        {/* Semester selector */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', flex: 1, paddingBottom: '2px' }}>
          {semestersList.map(sem => {
            const shortLabel = sem === 'ALL' ? 'ALL' : sem.replace('Semester ', 'Sem ');
            const isActive = selectedSemester === sem;
            return (
              <button
                key={sem}
                onClick={() => setSelectedSemester(sem)}
                style={{
                  background: 'none',
                  border: `1.5px solid ${isActive ? customTheme.accent : customTheme.borderMid}`,
                  color: isActive ? customTheme.accent : customTheme.textSecondary,
                  fontFamily: customTheme.fontMono,
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>

        {/* Branch selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: customTheme.textDim }}>BRANCH:</span>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{
              background: customTheme.bgCard,
              border: `1px solid ${customTheme.borderMid}`,
              color: customTheme.textPrimary,
              fontFamily: customTheme.fontMono,
              fontSize: '11px',
              padding: '4px 6px',
              borderRadius: '4px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {branchesList.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── CORE VAULT CONTENT ── */}
      <main style={{ padding: '20px 16px' }}>
        
        {/* Loading indicator */}
        {(loadingResources || loadingPYQs) && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Loader2 className="animate-spin" size={24} color={customTheme.accent} />
          </div>
        )}

        {!loadingResources && !loadingPYQs && (
          <>
            {/* 📚 1. SUBJECTS VAULT */}
            <section style={{ marginBottom: '32px' }}>
              <div style={{
                fontFamily: customTheme.fontMono,
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: customTheme.textMeta,
                marginBottom: '14px',
                borderLeft: `2.5px solid ${customTheme.accent}`,
                paddingLeft: '8px'
              }}>
                RESOURCE VAULT — {filteredResources.length} Subjects
              </div>

              {filteredResources.length === 0 ? (
                <div style={{
                  border: `1px dashed ${customTheme.borderMid}`,
                  padding: '32px',
                  textAlign: 'center',
                  color: customTheme.textDim,
                  fontSize: '12px'
                }}>
                  No subjects found matching filters
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: '16px'
                }}>
                  {filteredResources.map((subject) => (
                    <div
                      key={subject.id}
                      style={{
                        border: `1.5px solid ${subject.accentColor}25`,
                        background: customTheme.bgCard,
                        padding: '16px 14px',
                        borderRadius: '4px',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.35)'
                      }}
                    >
                      {/* Card Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{
                            fontFamily: customTheme.fontMono,
                            fontSize: '9px',
                            color: `${subject.accentColor}75`,
                            marginBottom: '2px',
                          }}>
                            {subject.subjectCode}
                          </div>
                          <h3 style={{
                            fontFamily: customTheme.fontDisplay,
                            fontSize: '24px',
                            letterSpacing: '1px',
                            color: subject.accentColor,
                            lineHeight: 1.05,
                          }}>
                            {subject.subjectName}
                          </h3>
                          <div style={{
                            fontFamily: customTheme.fontMono,
                            fontSize: '11px',
                            color: customTheme.textDim,
                            marginTop: '4px'
                          }}>
                            {subject.branch} · {subject.semester}
                          </div>
                        </div>

                        {/* Admin Action (Option B) */}
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenEdit(subject)}
                            style={{
                              background: 'none',
                              border: `1px solid ${customTheme.borderMid}`,
                              cursor: 'pointer',
                              color: customTheme.accent,
                              fontSize: '10px',
                              fontFamily: customTheme.fontMono,
                              padding: '3px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Edit2 size={10} /> [ EDIT ]
                          </button>
                        )}
                      </div>

                      {/* Launch Buttons Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '6px',
                        marginTop: '12px'
                      }}>
                        {[
                          { key: 'syllabus', label: 'Syllabus', url: subject.syllabusUrl },
                          { key: 'notes', label: 'Notes', url: subject.notesUrl },
                          { key: 'pyqs', label: 'PYQs', url: subject.pyqsUrl },
                          { key: 'practice', label: 'Practice Qs', url: subject.practiceUrl },
                          { key: 'lab', label: 'Lab Manual', url: subject.labUrl }
                        ].map(ft => {
                          const hasLink = !!ft.url;
                          if (hasLink) {
                            return (
                              <a
                                key={ft.key}
                                href={ft.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontFamily: customTheme.fontMono,
                                  fontSize: '11px',
                                  color: customTheme.textSecondary,
                                  background: 'rgba(255,255,255,0.02)',
                                  border: `1px solid ${customTheme.borderFaint}`,
                                  padding: '8px 10px',
                                  textDecoration: 'none',
                                  transition: 'all 0.12s',
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.borderColor = subject.accentColor;
                                  e.currentTarget.style.color = subject.accentColor;
                                  e.currentTarget.style.background = `${subject.accentColor}05`;
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.borderColor = customTheme.borderFaint;
                                  e.currentTarget.style.color = customTheme.textSecondary;
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                }}
                              >
                                <span>↗ {ft.label}</span>
                              </a>
                            );
                          } else {
                            // Greyed out if no resource exists
                            return (
                              <div
                                key={ft.key}
                                style={{
                                  fontFamily: customTheme.fontMono,
                                  fontSize: '11px',
                                  color: customTheme.textDim,
                                  border: `1px dashed ${customTheme.borderFaint}`,
                                  padding: '8px 10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  cursor: 'default',
                                }}
                              >
                                🔒 {ft.label}
                              </div>
                            );
                          }
                        })}
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 📝 2. PREVIOUS YEAR PAPERS */}
            <section style={{
              borderTop: `1px solid ${customTheme.borderFaint}`,
              paddingTop: '24px',
            }}>
              <div style={{
                fontFamily: customTheme.fontMono,
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: customTheme.textMeta,
                marginBottom: '4px',
                borderLeft: `2.5px solid ${customTheme.accent}`,
                paddingLeft: '8px'
              }}>
                PREVIOUS YEAR PAPERS (AUTONOMOUS)
              </div>
              <p style={{
                fontSize: '12px',
                color: customTheme.textDim,
                marginBottom: '16px',
                paddingLeft: '10px'
              }}>
                End-term question papers — all subjects combined
              </p>

              {rawPYQs.length === 0 ? (
                <div style={{
                  border: `1px dashed ${customTheme.borderMid}`,
                  padding: '24px',
                  textAlign: 'center',
                  color: customTheme.textDim,
                  fontSize: '12px'
                }}>
                  No PYQ papers available yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rawPYQs.map(paper => (
                    <a
                      key={paper.id}
                      href={paper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: '6px',
                        border: `1px solid ${customTheme.borderFaint}`,
                        background: 'rgba(255,255,255,0.02)',
                        textDecoration: 'none',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = customTheme.accent;
                        e.currentTarget.style.background = 'rgba(139,92,246,0.05)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = customTheme.borderFaint;
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          background: 'rgba(255,255,255,0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: customTheme.accent }}>
                              End-Term {paper.year}
                            </span>
                            {paper.isLatest && (
                              <span style={{
                                fontSize: '9px',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: '10px',
                                background: 'rgba(74,222,128,0.15)',
                                color: customTheme.statusLive,
                              }}>
                                Latest
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '11px', color: customTheme.textDim }}>{paper.semester}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: customTheme.textDim }}>↗ Open PDF</span>
                    </a>
                  ))}
                </div>
              )}
            </section>

            {/* 💬 footer notes */}
            <footer style={{
              textAlign: 'center',
              padding: '32px 0 10px',
              fontSize: '10px',
              color: customTheme.textDim,
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              LINKS OPEN IN GOOGLE DRIVE · MAINTAINED BY Hub Admin
            </footer>
          </>
        )}
      </main>

      {/* ── EDIT BOTTOM SHEET (OPTION B ADMIN ONLY) ── */}
      {isAdmin && editingResource && (
        <BottomSheet
          open={!!editingResource}
          onClose={() => setEditingResource(null)}
          title={`Edit ${editingResource.subjectName} Vault`}
        >
          <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: customTheme.fontMono,
              lineHeight: 1.4
            }}>
              Paste Google Drive folder or PDF viewer links. Clear the field to hide the folder button from students.
            </p>

            {[
              { label: 'Syllabus Drive Link', val: editSyllabus, setVal: setEditSyllabus },
              { label: 'Lecture Notes Link', val: editNotes, setVal: setEditNotes },
              { label: 'PYQ Folders Link', val: editPYQs, setVal: setEditPYQs },
              { label: 'Practice Questions Link', val: editPractice, setVal: setEditPractice },
              { label: 'Lab Manual Link', val: editLab, setVal: setEditLab }
            ].map((field, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: customTheme.fontMono }}>
                  {field.label}
                </label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://drive.google.com/..."
                  value={field.val}
                  onChange={(e) => field.setVal(e.target.value)}
                  style={{
                    fontSize: '12px',
                    fontFamily: customTheme.fontMono,
                    width: '100%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="t-button"
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontFamily: customTheme.fontMono,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Save Changes'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, fontFamily: customTheme.fontMono }}
                onClick={() => setEditingResource(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </BottomSheet>
      )}

      <NavBar />
    </div>
  );
}
