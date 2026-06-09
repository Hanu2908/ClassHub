import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit2, Loader2, Search, Plus, Trash2 } from 'lucide-react';
import {
  useGlobalResources,
  useGlobalPYQs,
  type GlobalResource,
  useUpdateGlobalResource,
  useCreateGlobalResource,
  useDeleteGlobalResource,
  useCreateGlobalPYQ,
  useDeleteGlobalPYQ
} from '../../hooks/useGlobalResources';
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
  fontDisplay: "'Bebas Neue', sans-serif", // Intended bold condensed block style!
  fontMono: "var(--font-mono)",
};

export default function ResourceHubPage() {
  const navigate = useNavigate();
  const { authUser } = useAppStore();
  const isAdmin = authUser?.role === 'cr';

  // ── Database Queries & Mutations ──
  const { data: rawResources = [], isLoading: loadingResources } = useGlobalResources();
  const { data: rawPYQs = [], isLoading: loadingPYQs } = useGlobalPYQs();
  
  const updateResourceMutation = useUpdateGlobalResource();
  const createResourceMutation = useCreateGlobalResource();
  const deleteResourceMutation = useDeleteGlobalResource();
  const createPYQMutation = useCreateGlobalPYQ();
  const deletePYQMutation = useDeleteGlobalPYQ();

  // ── States ──
  const [selectedSemester, setSelectedSemester] = useState<string>('Semester II');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // ── Edit/Add Subject BottomSheet state ──
  const [editingResource, setEditingResource] = useState<GlobalResource | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editSem, setEditSem] = useState('Semester II');
  const [editBranch, setEditBranch] = useState('ALL');
  const [editAccent, setEditAccent] = useState('#8B5CF6');
  const [editSyllabus, setEditSyllabus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPYQs, setEditPYQs] = useState('');
  const [editPractice, setEditPractice] = useState('');
  const [editLab, setEditLab] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Add PYQ BottomSheet state ──
  const [isAddingPYQ, setIsAddingPYQ] = useState(false);
  const [pyqSem, setPyqSem] = useState('Semester II');
  const [pyqYear, setPyqYear] = useState('');
  const [pyqUrl, setPyqUrl] = useState('');
  const [pyqLatest, setPyqLatest] = useState(false);

  // Set form states on edit open
  const handleOpenEdit = (res: GlobalResource) => {
    setEditingResource(res);
    setEditCode(res.subjectCode);
    setEditName(res.subjectName);
    setEditSem(res.semester);
    setEditBranch(res.branch);
    setEditAccent(res.accentColor);
    setEditSyllabus(res.syllabusUrl);
    setEditNotes(res.notesUrl);
    setEditPYQs(res.pyqsUrl);
    setEditPractice(res.practiceUrl);
    setEditLab(res.labUrl);
  };

  // Set form states on adding a new subject
  const handleOpenAddSubject = () => {
    setEditingResource({
      id: 'new',
      subjectCode: '',
      subjectName: '',
      semester: 'Semester II',
      branch: 'ALL',
      accentColor: '#8B5CF6',
      syllabusUrl: '',
      notesUrl: '',
      pyqsUrl: '',
      practiceUrl: '',
      labUrl: '',
      updatedAt: null,
      updatedBy: null
    });
    setEditCode('');
    setEditName('');
    setEditSem('Semester II');
    setEditBranch('ALL');
    setEditAccent('#8B5CF6');
    setEditSyllabus('');
    setEditNotes('');
    setEditPYQs('');
    setEditPractice('');
    setEditLab('');
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResource) return;
    
    if (!editCode.trim() || !editName.trim()) {
      showToast('Subject Code and Name are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingResource.id === 'new') {
        // Create new global subject
        await createResourceMutation.mutateAsync({
          subjectCode: editCode,
          subjectName: editName,
          semester: editSem,
          branch: editBranch,
          accentColor: editAccent,
          syllabusUrl: editSyllabus,
          notesUrl: editNotes,
          pyqsUrl: editPYQs,
          practiceUrl: editPractice,
          labUrl: editLab,
        });
        showToast('Subject created successfully', 'success');
      } else {
        // Update existing global subject
        await updateResourceMutation.mutateAsync({
          id: editingResource.id,
          subjectCode: editCode,
          subjectName: editName,
          semester: editSem,
          branch: editBranch,
          accentColor: editAccent,
          syllabusUrl: editSyllabus,
          notesUrl: editNotes,
          pyqsUrl: editPYQs,
          practiceUrl: editPractice,
          labUrl: editLab,
        });
        showToast('Subject vault updated successfully', 'success');
      }
      setEditingResource(null);
    } catch (err: any) {
      showToast(`Action failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubject = async () => {
    if (!editingResource || editingResource.id === 'new') return;
    if (!confirm(`Are you sure you want to permanently delete ${editingResource.subjectName}?`)) return;
    
    setIsSubmitting(true);
    try {
      await deleteResourceMutation.mutateAsync(editingResource.id);
      showToast('Subject deleted successfully', 'success');
      setEditingResource(null);
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePYQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pyqYear.trim() || !pyqUrl.trim()) {
      showToast('Year and PDF Drive link are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await createPYQMutation.mutateAsync({
        semester: pyqSem,
        year: pyqYear,
        url: pyqUrl,
        isLatest: pyqLatest,
      });
      showToast('PYQ exam paper added', 'success');
      setIsAddingPYQ(false);
      setPyqYear('');
      setPyqUrl('');
      setPyqLatest(false);
    } catch (err: any) {
      showToast(`Failed to add PYQ: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePYQ = async (id: string, year: string) => {
    if (!confirm(`Are you sure you want to delete the ${year} paper?`)) return;
    try {
      await deletePYQMutation.mutateAsync(id);
      showToast('PYQ paper deleted successfully', 'success');
    } catch (err: any) {
      showToast(`Failed to delete PYQ: ${err.message}`, 'error');
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
  const accentColors = ['#8B5CF6', '#f5c518', '#00d4ff', '#ff6b6b', '#a8ff78', '#ff9500', '#c0c0c0', '#70e000'];

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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
              }}>
                <div style={{
                  fontFamily: customTheme.fontMono,
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: customTheme.textMeta,
                  borderLeft: `2.5px solid ${customTheme.accent}`,
                  paddingLeft: '8px'
                }}>
                  RESOURCE VAULT — {filteredResources.length} Subjects
                </div>
                
                {/* Admin Add Subject Button */}
                {isAdmin && (
                  <button
                    onClick={handleOpenAddSubject}
                    style={{
                      background: 'none',
                      border: `1px solid ${customTheme.accent}`,
                      color: customTheme.accent,
                      fontFamily: customTheme.fontMono,
                      fontSize: '10px',
                      padding: '3px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={10} /> [ ADD SUBJECT ]
                  </button>
                )}
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

                        {/* Admin Edit Button */}
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '4px',
              }}>
                <div style={{
                  fontFamily: customTheme.fontMono,
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: customTheme.textMeta,
                  borderLeft: `2.5px solid ${customTheme.accent}`,
                  paddingLeft: '8px'
                }}>
                  PREVIOUS YEAR PAPERS (AUTONOMOUS)
                </div>
                
                {/* Admin Add PYQ Button */}
                {isAdmin && (
                  <button
                    onClick={() => setIsAddingPYQ(true)}
                    style={{
                      background: 'none',
                      border: `1px solid ${customTheme.accent}`,
                      color: customTheme.accent,
                      fontFamily: customTheme.fontMono,
                      fontSize: '10px',
                      padding: '3px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={10} /> [ ADD PYQ ]
                  </button>
                )}
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
                    <div
                      key={paper.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: '6px',
                        border: `1px solid ${customTheme.borderFaint}`,
                        background: 'rgba(255,255,255,0.02)',
                        transition: 'all 0.12s',
                      }}
                    >
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          textDecoration: 'none',
                          flex: 1
                        }}
                      >
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
                      </a>

                      {/* Admin Delete PYQ Button */}
                      {isAdmin ? (
                        <button
                          onClick={() => handleDeletePYQ(paper.id, paper.year)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'rgba(255,255,255,0.2)',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.1s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: customTheme.textDim }}>↗ Open PDF</span>
                      )}
                    </div>
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

      {/* ── ADD/EDIT SUBJECT BOTTOM SHEET (OPTION B ADMIN ONLY) ── */}
      {isAdmin && editingResource && (
        <BottomSheet
          open={!!editingResource}
          onClose={() => setEditingResource(null)}
          title={editingResource.id === 'new' ? 'Add New Subject Vault' : `Edit ${editingResource.subjectName} Vault`}
        >
          <form onSubmit={handleSaveSubject} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: customTheme.fontMono,
              lineHeight: 1.4,
              marginBottom: '6px'
            }}>
              {editingResource.id === 'new' 
                ? 'Create a new global subject entry. Fill in the code, name, branch and links below.' 
                : 'Paste Google Drive folder or PDF viewer links. Clear the field to hide the folder button from students.'}
            </p>

            {/* Render Subject Code and Name fields for editing/adding */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: customTheme.fontMono }}>
                  Subject Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="CSUL201"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  style={{
                    fontSize: '12px',
                    fontFamily: customTheme.fontMono,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 10px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: customTheme.fontMono }}>
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="OOP / C++"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    fontSize: '12px',
                    fontFamily: customTheme.fontMono,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 10px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Semester, Branch and Color Pickers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: customTheme.fontMono }}>
                  Semester *
                </label>
                <select
                  value={editSem}
                  onChange={(e) => setEditSem(e.target.value)}
                  style={{
                    fontSize: '12px',
                    fontFamily: customTheme.fontMono,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 10px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {semestersList.filter(s => s !== 'ALL').map(sem => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: customTheme.fontMono }}>
                  Branch *
                </label>
                <input
                  type="text"
                  placeholder="ALL or CSE/IT/IOT"
                  value={editBranch}
                  onChange={(e) => setEditBranch(e.target.value)}
                  style={{
                    fontSize: '12px',
                    fontFamily: customTheme.fontMono,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 10px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Accent Color Border Glow Picker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: customTheme.fontMono }}>
                Border Glow Theme Color
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                {accentColors.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditAccent(c)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: c,
                      border: editAccent === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                      boxShadow: editAccent === c ? '0 0 8px #fff' : 'none',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Dynamic Folders Grid Link Inputs */}
            {[
              { label: 'Syllabus Drive Link', val: editSyllabus, setVal: setEditSyllabus },
              { label: 'Lecture Notes Link', val: editNotes, setVal: setEditNotes },
              { label: 'PYQs Folder Link', val: editPYQs, setVal: setEditPYQs },
              { label: 'Practice Questions Link', val: editPractice, setVal: setEditPractice },
              { label: 'Lab Manual Link', val: editLab, setVal: setEditLab }
            ].map((field, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: customTheme.fontMono }}>
                  {field.label}
                </label>
                <input
                  type="url"
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
                    padding: '8px 10px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
            ))}

            {/* Actions Panel */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="t-button"
                style={{
                  flex: 2,
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

              {/* Show delete button only when editing an existing subject */}
              {editingResource.id !== 'new' && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDeleteSubject}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontFamily: customTheme.fontMono,
                  }}
                >
                  Delete
                </button>
              )}

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

      {/* ── ADD PYQ BOTTOM SHEET (OPTION B ADMIN ONLY) ── */}
      {isAdmin && isAddingPYQ && (
        <BottomSheet
          open={isAddingPYQ}
          onClose={() => setIsAddingPYQ(false)}
          title="Add PYQ Question Paper"
        >
          <form onSubmit={handleCreatePYQ} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: customTheme.fontMono,
              lineHeight: 1.4
            }}>
              Add a combined PDF paper for the End-Term examinations.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: customTheme.fontMono }}>
                Semester *
              </label>
              <select
                value={pyqSem}
                onChange={(e) => setPyqSem(e.target.value)}
                style={{
                  fontSize: '12px',
                  fontFamily: customTheme.fontMono,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {semestersList.filter(s => s !== 'ALL').map(sem => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: customTheme.fontMono }}>
                Exam Year *
              </label>
              <input
                type="text"
                required
                placeholder="2025"
                value={pyqYear}
                onChange={(e) => setPyqYear(e.target.value)}
                style={{
                  fontSize: '12px',
                  fontFamily: customTheme.fontMono,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: customTheme.fontMono }}>
                PDF Drive Link *
              </label>
              <input
                type="url"
                required
                placeholder="https://drive.google.com/file/d/..."
                value={pyqUrl}
                onChange={(e) => setPyqUrl(e.target.value)}
                style={{
                  fontSize: '12px',
                  fontFamily: customTheme.fontMono,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
              <input
                type="checkbox"
                id="pyq-latest-check"
                checked={pyqLatest}
                onChange={(e) => setPyqLatest(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
              <label htmlFor="pyq-latest-check" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: customTheme.fontMono, cursor: 'pointer' }}>
                Mark as "Latest" paper
              </label>
            </div>

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
                {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Add PYQ'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, fontFamily: customTheme.fontMono }}
                onClick={() => setIsAddingPYQ(false)}
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
