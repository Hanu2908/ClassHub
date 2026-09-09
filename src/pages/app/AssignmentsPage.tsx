import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, PartyPopper, ClipboardList, Archive, ChevronDown, Check, ArrowUpDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { NavBar } from '../../components/NavBar';
import { CROnly, EmptyState } from '../../components/Shared';
import { useAppStore, isAssignmentExpired } from '../../store/appStore';
import type { Assignment } from '../../store/appStore';
import { toast } from 'sonner';
import { useAssignments, useDeleteAssignment, useSubmitAssignment, useUnsubmitAssignment } from '../../hooks/useAssignments';
import { useToggleArchiveAssignment } from '../../hooks/useSectionAdmin';
import { haptics } from '../../lib/haptics';
import { logEvent } from '../../lib/analytics';

import { UnitTestsTab } from './assignments/UnitTestsTab';
import { CreateUnitTestModal } from './assignments/CreateUnitTestModal';
import { useUnitTests } from '../../hooks/useUnitTests';
import { getSubjectAcronym } from './assignments/assignmentUtils';
import { AssignmentsSkeleton } from './assignments/AssignmentsSkeleton';
import { CreateAssignmentSheet } from './assignments/CreateAssignmentSheet';
import { EditAssignmentSheet } from './assignments/EditAssignmentSheet';
import { AssignmentCard } from './assignments/AssignmentCard';
import { AssignmentFilters, type Filter } from './assignments/AssignmentFilters';

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAppStore(s => s.role);
  const authUser = useAppStore(s => s.authUser);
  const classRoll = authUser?.sectionRoll ?? '17';
  const { data: assignments = [], isLoading } = useAssignments({ limit: 100 });
  const { data: unitTests = [] } = useUnitTests();
  const deleteAssignmentMutation = useDeleteAssignment();
  const toggleArchiveMutation = useToggleArchiveAssignment();
  const submitMutation = useSubmitAssignment();
  const unsubmitMutation = useUnsubmitAssignment();

  const [courseworkTab, setCourseworkTab] = useState<'assignments' | 'unit_tests'>('assignments');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'due' | 'created'>('due');

  const [utFilter, setUtFilter] = useState<'active' | 'past' | 'all'>('all');
  const [utSubject, setUtSubject] = useState<string>('all');
  const [utSortBy, setUtSortBy] = useState<'due' | 'created'>('due');

  const utUniqueSubjects = useMemo(() => {
    const set = new Set<string>();
    unitTests.forEach(t => set.add(t.subject));
    return Array.from(set);
  }, [unitTests]);

  const [createOpen, setCreateOpen] = useState(() => Boolean(location.state?.openCreate));
  const [createUnitTestOpen, setCreateUnitTestOpen] = useState(false);

  useEffect(() => {
    if (location.state?.openCreate) {
      setCreateOpen(true);
    }
  }, [location.state?.openCreate]);

  const [editOpen, setEditOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [now] = useState(() => Date.now());
  const [highlightId] = useState<string | null>(() => new URLSearchParams(location.search).get('highlight'));
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (authUser?.id && authUser?.sectionId) {
      logEvent('assignment_viewed', authUser.id, authUser.sectionId);
    }
  }, [authUser]);

  // Scroll to highlighted assignment when data loads
  useEffect(() => {
    if (!highlightId || !assignments.length) return;
    const timer = setTimeout(() => {
      if (highlightRef.current) {
        highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      window.history.replaceState({}, '', location.pathname);
    }, 400);
    return () => clearTimeout(timer);
  }, [highlightId, assignments, location.pathname]);

  const handleFilterChange = (f: Filter) => {
    setFilter(f);
    setSelectedSubject('all');
  };

  const handleOpenPdfUrl = async (urlOrPath: string, title: string, pageRange?: string) => {
    if (authUser?.id && authUser?.sectionId) {
      logEvent('assignment_viewed', authUser.id, authUser.sectionId, { urlOrPath, title, pageRange });
    }
    
    const firstPage = pageRange ? (pageRange.match(/\d+/)?.[0] || '1') : '1';

    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      navigate(`/app/pdf-viewer?url=${encodeURIComponent(urlOrPath)}&page=${firstPage}&range=${encodeURIComponent(pageRange || '')}&title=${encodeURIComponent(title)}`);
      return;
    }
    
    // Pass storage path directly to enable on-demand 3600s signed URL resolution and self-healing refresh
    navigate(`/app/pdf-viewer?path=${encodeURIComponent(urlOrPath)}&page=${firstPage}&range=${encodeURIComponent(pageRange || '')}&title=${encodeURIComponent(title)}`);
  };

  const handleMarkSubmitted = async (id: string) => {
    try {
      haptics.doublePulse();
      await submitMutation.mutateAsync({ assignmentId: id, link: 'marked-submitted' });
      if (authUser?.id && authUser?.sectionId) {
        logEvent('assignment_submitted', authUser.id, authUser.sectionId, { assignmentId: id });
      }
      toast.success('Marked as submitted', {
        duration: 4000,
        action: {
          label: 'Undo',
          onClick: () => handleUndo(id),
        },
      });
    } catch {
      toast.error('Failed to submit');
    }
  };

  const handleUndo = async (id: string) => {
    haptics.lightClick();
    try {
      await unsubmitMutation.mutateAsync({ assignmentId: id });
      toast.success('Submission undone');
    } catch {
      toast.error('Failed to undo submission');
    }
  };

  // 5-day post-deadline expiry & archive mapping
  const enriched = useMemo(() => {
    return assignments.map(a => {
      const isSubmitted = a.status === 'submitted';
      const diff = new Date(a.dueDate).getTime() - now;
      const isOverdue = diff < 0 && !isSubmitted;
      const isExpired = isAssignmentExpired(a.dueDate);
      return { ...a, isSubmitted, isOverdue, isExpired };
    });
  }, [assignments, now]);

  // Calculate subject counts based on current status filter
  const subjectCounts = useMemo(() => {
    return enriched.reduce((acc, a) => {
      let passes = true;
      if (filter === 'archived') passes = Boolean(a.isArchived) || a.isExpired;
      else if (a.isArchived) passes = false;
      else if (filter === 'submitted') passes = a.isSubmitted;
      else if (filter === 'overdue') passes = a.isOverdue && !a.isExpired;
      else if (filter === 'pending') passes = !a.isSubmitted && !a.isOverdue && !a.isExpired;

      if (passes) {
        acc[a.subject] = (acc[a.subject] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [enriched, filter]);

  const uniqueSubjects = useMemo(() => Object.keys(subjectCounts).sort(), [subjectCounts]);

  const statusFiltered = useMemo(() => {
    return enriched.filter(a => {
      if (filter === 'archived') return Boolean(a.isArchived) || a.isExpired;
      if (a.isArchived) return false;
      if (filter === 'all') return true;
      if (filter === 'submitted') return a.isSubmitted;
      if (filter === 'overdue') return a.isOverdue && !a.isExpired;
      if (filter === 'pending') return !a.isSubmitted && !a.isOverdue && !a.isExpired;
      return true;
    });
  }, [enriched, filter]);

  const filtered = useMemo(() => {
    return statusFiltered.filter(a => {
      if (selectedSubject === 'all') return true;
      return a.subject === selectedSubject;
    });
  }, [statusFiltered, selectedSubject]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'due') {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [filtered, sortBy]);

  return (
    <div className="page-shell">
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-default)', padding: '16px 0 10px' }}>
        {/* Top App Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button id="assign-back-btn" onClick={() => navigate('/app/home')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }} aria-label="Back">
              <ArrowLeft size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={18} color="var(--accent-primary)" />
              <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>Coursework</h1>
            </div>
          </div>
        </div>

        {/* Coursework Hub Segmented Switch */}
        <div style={{ padding: '0 20px 10px', display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setCourseworkTab('assignments')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-pill)',
              border: courseworkTab === 'assignments' ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
              background: courseworkTab === 'assignments' ? 'var(--accent-primary-glow)' : 'rgba(255, 255, 255, 0.03)',
              color: courseworkTab === 'assignments' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <span>Assignments</span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>({assignments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setCourseworkTab('unit_tests')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-pill)',
              border: courseworkTab === 'unit_tests' ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
              background: courseworkTab === 'unit_tests' ? 'var(--accent-primary-glow)' : 'rgba(255, 255, 255, 0.03)',
              color: courseworkTab === 'unit_tests' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <span>Unit Tests</span>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>({unitTests.length})</span>
          </button>
        </div>
        
        {/* Assignment Specific Filter Sub-bar */}
        {courseworkTab === 'assignments' && (
          <AssignmentFilters
            filter={filter}
            onFilterChange={handleFilterChange}
            selectedSubject={selectedSubject}
            onSubjectChange={setSelectedSubject}
            uniqueSubjects={uniqueSubjects}
            subjectCounts={subjectCounts}
            statusFilteredCount={statusFiltered.length}
            sortBy={sortBy}
            onSortByChange={setSortBy}
          />
        )}

        {/* Unit Tests Specific Filter Sub-bar in Header */}
        {courseworkTab === 'unit_tests' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 0', gap: 12 }}>
            {/* Status Dropdown Filter */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className="filter-tab"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0 14px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    height: '38px',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>
                    {utFilter === 'active' ? 'Active' : utFilter === 'past' ? 'Past & Submitted' : 'All'}
                  </span>
                  <ChevronDown size={14} style={{ opacity: 0.6 }} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="start"
                  sideOffset={6}
                  className="dropdown-content animate-slide-up"
                  style={{ zIndex: 10000, minWidth: '180px' }}
                >
                  {[
                    { key: 'active', label: 'Active Tests' },
                    { key: 'past', label: 'Past & Submitted' },
                    { key: 'all', label: 'All Tests' },
                  ].map(item => {
                    const isSelected = utFilter === item.key;
                    return (
                      <DropdownMenu.Item
                        key={item.key}
                        onClick={() => setUtFilter(item.key as any)}
                        className="dropdown-item"
                        style={{
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          background: isSelected ? 'rgba(74, 158, 255, 0.08)' : undefined,
                          fontWeight: isSelected ? 600 : 400,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <span>{item.label}</span>
                        {isSelected && <Check size={14} />}
                      </DropdownMenu.Item>
                    );
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Right Filters Container */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Subject Dropdown Selector */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '0 14px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      height: '38px',
                      maxWidth: '160px',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {utSubject === 'all' ? 'All Subjects' : getSubjectAcronym(utSubject)}
                    </span>
                    <ChevronDown size={14} style={{ opacity: 0.6 }} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="dropdown-content animate-slide-up no-scrollbar"
                    style={{ zIndex: 10000, minWidth: '220px', maxWidth: '300px', maxHeight: '300px', overflowY: 'auto' }}
                  >
                    <DropdownMenu.Item
                      onClick={() => setUtSubject('all')}
                      className="dropdown-item"
                      style={{
                        color: utSubject === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        background: utSubject === 'all' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                        fontWeight: utSubject === 'all' ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span>All Subjects</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="t-mono-sm" style={{ opacity: 0.6, fontSize: '12px' }}>
                          {unitTests.length}
                        </span>
                        {utSubject === 'all' && <Check size={14} />}
                      </div>
                    </DropdownMenu.Item>

                    {utUniqueSubjects.map(subj => {
                      const isSelected = utSubject === subj;
                      const count = unitTests.filter(t => t.subject === subj).length;
                      return (
                        <DropdownMenu.Item
                          key={subj}
                          onClick={() => setUtSubject(subj)}
                          className="dropdown-item"
                          style={{
                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            background: isSelected ? 'rgba(74, 158, 255, 0.08)' : undefined,
                            fontWeight: isSelected ? 600 : 400,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                            {subj}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span className="t-mono-sm" style={{ opacity: 0.6, fontSize: '12px' }}>
                              {count}
                            </span>
                            {isSelected && <Check size={14} />}
                          </div>
                        </DropdownMenu.Item>
                      );
                    })}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              {/* Sort Dropdown Selector */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '0 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      height: '38px',
                      userSelect: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <ArrowUpDown size={14} color="var(--accent-primary)" />
                    <span>Sort: {utSortBy === 'due' ? 'Due' : 'Created'}</span>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="dropdown-content animate-slide-up"
                    style={{ zIndex: 10000, minWidth: '150px' }}
                  >
                    <DropdownMenu.Item
                      onClick={() => setUtSortBy('due')}
                      className="dropdown-item"
                      style={{
                        color: utSortBy === 'due' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        background: utSortBy === 'due' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                        fontWeight: utSortBy === 'due' ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span>Due Date</span>
                      {utSortBy === 'due' && <Check size={14} />}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={() => setUtSortBy('created')}
                      className="dropdown-item"
                      style={{
                        color: utSortBy === 'created' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        background: utSortBy === 'created' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                        fontWeight: utSortBy === 'created' ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span>Date Created</span>
                      {utSortBy === 'created' && <Check size={14} />}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>
        )}
      </header>

      <main className="page-content">
        {courseworkTab === 'unit_tests' ? (
          <UnitTestsTab filter={utFilter} selectedSubject={utSubject} sortBy={utSortBy} />
        ) : isLoading ? (
          <AssignmentsSkeleton />
        ) : sorted.length === 0 ? (
          <EmptyState icon={<PartyPopper size={36} color="var(--text-muted)" />} title="All clear!" subtitle="No assignments in this category" />
        ) : (() => {
          const renderCard = (a: (typeof sorted)[number]) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              classRoll={classRoll}
              now={now}
              role={role}
              isHighlighted={highlightId === a.id}
              highlightRef={highlightRef}
              onEdit={(assign) => {
                setSelectedAssignment(assign);
                setEditOpen(true);
              }}
              onToggleArchive={async (assign) => {
                try {
                  await toggleArchiveMutation.mutateAsync({
                    assignmentId: assign.id,
                    isArchived: !assign.isArchived,
                  });
                  toast.success(assign.isArchived ? 'Assignment restored' : 'Assignment archived');
                } catch {
                  toast.error('Failed to update archive status');
                }
              }}
              onDelete={async (assign) => {
                if (confirm('Are you sure you want to delete this assignment?')) {
                  try {
                    await deleteAssignmentMutation.mutateAsync(assign.id);
                    toast.info('Assignment deleted');
                  } catch {
                    toast.error('Failed to delete');
                  }
                }
              }}
              onOpenPdf={handleOpenPdfUrl}
              onSubmit={handleMarkSubmitted}
              isSubmitting={submitMutation.isPending && submitMutation.variables?.assignmentId === a.id}
            />
          );

          if (filter === 'all' && sorted.some(a => (a as any).isExpired)) {
            const active = sorted.filter(a => !(a as any).isExpired);
            const expired = sorted.filter(a => (a as any).isExpired);
            return (
              <>
                {active.map(renderCard)}
                <div style={{ margin: '18px 0 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ height: 1, flex: 1, background: 'var(--border-default)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    <Archive size={13} color="var(--text-muted)" />
                    <span>Past ({expired.length})</span>
                  </div>
                  <div style={{ height: 1, flex: 1, background: 'var(--border-default)' }} />
                </div>
                {expired.map(renderCard)}
              </>
            );
          }

          return sorted.map(renderCard);
        })()}
      </main>

      {/* Create assignment sheet (CR only) */}
      <CreateAssignmentSheet 
        open={createOpen} 
        shareInboxId={location.state?.shareInboxId} 
        onClose={() => {
          setCreateOpen(false);
          if (location.state?.openCreate || location.state?.shareInboxId) {
            navigate(location.pathname, { replace: true, state: {} });
          }
        }} 
      />

      {/* Create Unit Test sheet (CR only) */}
      <CreateUnitTestModal
        open={createUnitTestOpen}
        onClose={() => setCreateUnitTestOpen(false)}
      />

      {/* Edit assignment sheet (CR only) */}
      {editOpen && selectedAssignment && (
        <EditAssignmentSheet open={editOpen} onClose={() => { setEditOpen(false); setSelectedAssignment(null); }} assignment={selectedAssignment} />
      )}

      <CROnly>
        <button
          id="add-assign-fab"
          className="fab"
          aria-label={courseworkTab === 'assignments' ? 'Add assignment' : 'Add unit test'}
          onClick={() => courseworkTab === 'assignments' ? setCreateOpen(true) : setCreateUnitTestOpen(true)}
        >
          <Plus size={22} />
        </button>
      </CROnly>

      <NavBar />
    </div>
  );
}
