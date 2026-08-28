import { useState, useMemo } from 'react';
import { useUnitTests, useDeleteUnitTest, useUpdateUnitTest, useToggleUnitTestSubmission, type UnitTest } from '../../../hooks/useUnitTests';
import { useAppStore } from '../../../store/appStore';
import { generateGradient } from '../../../lib/utils';
import {
  ExternalLink, CheckCircle2, Circle, MoreVertical,
  Trash2, Users, Loader2, Sparkles, Link2
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { UnitTestRosterModal } from './UnitTestRosterModal';
import { BottomSheet } from '../../../components/BottomSheet';
import { toast } from 'sonner';

function getSubjectAcronym(name: string) {
  if (!name) return '??';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 2).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
}

function getDeadlineBadge(dueDate: string, isSubmitted: boolean, now: number) {
  if (isSubmitted) {
    return { cls: 'badge-safe', label: 'Submitted ✓' };
  }
  const diff = new Date(dueDate).getTime() - now;
  const hours = diff / (1000 * 60 * 60);
  const days = hours / 24;

  if (diff < 0) {
    return { cls: 'badge-critical', label: 'Closed' };
  }
  if (hours < 2) {
    return { cls: 'badge-critical', label: 'Closes soon' };
  }
  if (days < 1) {
    return { cls: 'badge-warning', label: 'Due today' };
  }
  if (days < 2) {
    return { cls: 'badge-warning', label: 'Due tomorrow' };
  }
  return {
    cls: 'badge-neutral',
    label: new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  };
}

interface UnitTestsTabProps {
  filter?: 'active' | 'past' | 'all';
  selectedSubject?: string;
  sortBy?: 'due' | 'created';
}

export function UnitTestsTab({
  filter = 'active',
  selectedSubject = 'all',
  sortBy = 'due',
}: UnitTestsTabProps) {
  const role = useAppStore(s => s.role);
  const isCRorTeacher = role === 'cr' || role === 'teacher';

  const { data: unitTests = [], isLoading } = useUnitTests();
  const deleteUnitTestMutation = useDeleteUnitTest();
  const updateUnitTestMutation = useUpdateUnitTest();
  const toggleSubmissionMutation = useToggleUnitTestSubmission();

  const [rosterTest, setRosterTest] = useState<UnitTest | null>(null);
  const [scoringTestId, setScoringTestId] = useState<string | null>(null);
  const [marksInput, setMarksInput] = useState<string>('');

  const [editingLinkTest, setEditingLinkTest] = useState<UnitTest | null>(null);
  const [linkInput, setLinkInput] = useState<string>('');

  const [now] = useState(() => Date.now());

  const handleSaveLink = async () => {
    if (!editingLinkTest) return;
    const trimmed = linkInput.trim();
    if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      toast.error('Please enter a valid URL starting with https://');
      return;
    }
    await updateUnitTestMutation.mutateAsync({
      id: editingLinkTest.id,
      formUrl: trimmed || null,
    });
    setEditingLinkTest(null);
  };

  const filteredTests = useMemo(() => {
    const list = unitTests.filter(t => {
      const isPast = new Date(t.dueDate).getTime() < now || t.isSubmitted;
      let matchesTab = true;
      if (filter === 'active') matchesTab = !isPast;
      else if (filter === 'past') matchesTab = isPast;

      const matchesSubject = selectedSubject === 'all' || t.subject === selectedSubject;
      return matchesTab && matchesSubject;
    });

    return list.sort((a, b) => {
      if (sortBy === 'due') {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [unitTests, filter, selectedSubject, sortBy, now]);

  const handleToggleSubmit = (test: UnitTest) => {
    const nextState = !test.isSubmitted;
    toggleSubmissionMutation.mutate({
      unitTestId: test.id,
      isSubmitted: nextState,
      marksObtained: nextState ? test.marksObtained : null,
    });
  };

  const handleSaveMarks = (test: UnitTest) => {
    const marksNum = marksInput.trim() ? parseFloat(marksInput) : null;
    if (marksNum !== null && (isNaN(marksNum) || marksNum < 0 || marksNum > test.maxMarks)) {
      toast.error(`Marks must be between 0 and ${test.maxMarks}`);
      return;
    }
    toggleSubmissionMutation.mutate({
      unitTestId: test.id,
      isSubmitted: true,
      marksObtained: marksNum,
    });
    setScoringTestId(null);
  };

  const handleDeleteTest = async (testId: string) => {
    if (confirm('Are you sure you want to delete this Unit Test?')) {
      await deleteUnitTestMutation.mutateAsync(testId);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tests List */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
          <Loader2 className="animate-spin" size={28} color="var(--accent-primary)" />
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="card" style={{ padding: '36px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(74, 158, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} color="var(--accent-primary)" />
          </div>
          <p className="t-card-title" style={{ color: 'var(--text-primary)', margin: 0 }}>
            {filter === 'active' ? 'No active unit tests!' : 'No unit tests found'}
          </p>
          <p className="t-body" style={{ color: 'var(--text-muted)', margin: 0, fontSize: '13px' }}>
            {filter === 'active' ? 'You are all caught up on pre-midterm tests.' : 'Submitted tests will appear here.'}
          </p>
        </div>
      ) : (
        filteredTests.map(t => {
          const badge = getDeadlineBadge(t.dueDate, t.isSubmitted, now);
          const isScoring = scoringTestId === t.id;

          return (
            <article
              key={t.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                animation: 'fadeSlideUp 0.25s ease both',
              }}
            >
              {/* Simplified Card Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: generateGradient(t.subjectCode || t.subject),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
                    }}
                  >
                    <span className="t-mono" style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
                      {getSubjectAcronym(t.subject)}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <h3 className="t-card-title truncate" style={{ color: 'var(--text-primary)', margin: 0, fontSize: '15px' }} title={t.subject}>
                        {t.subject}
                      </h3>
                      {/* Simplified Tag: UT-1 / UT-2 */}
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: t.testType === 'UT1' ? 'rgba(74, 158, 255, 0.12)' : 'rgba(192, 132, 252, 0.12)',
                          color: t.testType === 'UT1' ? 'var(--accent-primary)' : '#C084FC',
                          border: `1px solid ${t.testType === 'UT1' ? 'rgba(74, 158, 255, 0.25)' : 'rgba(192, 132, 252, 0.25)'}`,
                        }}
                      >
                        {t.testType === 'UT1' ? 'UT-1' : 'UT-2'}
                      </span>
                      <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        · {t.maxMarks} Marks
                      </span>
                    </div>
                    <p className="t-body-medium truncate" style={{ color: 'var(--text-secondary)', margin: '2px 0 0 0', fontWeight: 500, fontSize: '13px' }}>
                      {t.title}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span className={`badge ${badge.cls}`} style={{ fontSize: '11px' }}>
                    {badge.label}
                  </span>

                  {isCRorTeacher && (
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            padding: 4,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          align="end"
                          sideOffset={5}
                          className="dropdown-content"
                          style={{ zIndex: 10000, minWidth: 140 }}
                        >
                          <DropdownMenu.Item
                            onClick={() => {
                              setEditingLinkTest(t);
                              setLinkInput(t.formUrl || '');
                            }}
                            className="dropdown-item"
                            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px' }}
                          >
                            <Link2 size={14} color="var(--accent-primary)" />
                            <span>{t.formUrl ? 'Edit Test Link' : 'Add Test Link'}</span>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            onClick={() => setRosterTest(t)}
                            className="dropdown-item"
                            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px' }}
                          >
                            <Users size={14} color="var(--accent-primary)" />
                            <span>View Roster</span>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            onClick={() => handleDeleteTest(t.id)}
                            className="dropdown-item"
                            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', color: 'var(--status-critical)' }}
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  )}
                </div>
              </div>

              {/* Description */}
              {t.description && (
                <p className="t-body" style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                  {t.description}
                </p>
              )}

              {/* Action Rows: Open Google Form & Submit Status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
                {t.formUrl ? (
                  <a
                    href={t.formUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      background: 'var(--accent-primary)',
                      color: '#0F0F11',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: '13px',
                      boxShadow: '0 2px 8px rgba(129, 140, 248, 0.25)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>Open Google Form</span>
                    <ExternalLink size={14} />
                  </a>
                ) : isCRorTeacher ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLinkTest(t);
                      setLinkInput('');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '9px 14px',
                      background: 'rgba(129, 140, 248, 0.12)',
                      border: '1px dashed rgba(129, 140, 248, 0.4)',
                      color: 'var(--accent-primary)',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Link2 size={15} />
                    <span>+ Add Google Form / Test Link</span>
                  </button>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-muted)',
                      fontSize: '12.5px',
                      fontStyle: 'italic',
                    }}
                  >
                    Test link will be added by CR soon
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleSubmit(t)}
                    disabled={toggleSubmissionMutation.isPending}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '9px 12px',
                      background: t.isSubmitted ? 'rgba(52, 201, 123, 0.12)' : 'var(--bg-elevated)',
                      border: t.isSubmitted ? '1px solid rgba(52, 201, 123, 0.3)' : '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      color: t.isSubmitted ? 'var(--status-safe)' : 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {t.isSubmitted ? (
                      <>
                        <CheckCircle2 size={15} color="var(--status-safe)" />
                        <span>Submitted</span>
                        {t.marksObtained !== null && (
                          <span className="t-mono-sm" style={{ opacity: 0.9 }}>
                            ({t.marksObtained}/{t.maxMarks} marks)
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <Circle size={15} />
                        <span>Mark as Submitted</span>
                      </>
                    )}
                  </button>

                  {/* Optional Score Recorder */}
                  {t.isSubmitted && (
                    <button
                      type="button"
                      onClick={() => {
                        setScoringTestId(isScoring ? null : t.id);
                        setMarksInput(t.marksObtained !== null && t.marksObtained !== undefined ? String(t.marksObtained) : '');
                      }}
                      style={{
                        padding: '9px 12px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.marksObtained !== null ? 'Edit Score' : '+ Add Score'}
                    </button>
                  )}

                  {isCRorTeacher && (
                    <button
                      type="button"
                      onClick={() => setRosterTest(t)}
                      style={{
                        padding: '9px 12px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--accent-primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Users size={14} />
                      <span>Roster</span>
                    </button>
                  )}
                </div>

                {/* Score Input Drawer */}
                {isScoring && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    marginTop: 2,
                  }}>
                    <span className="t-mono-sm" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      Marks Obtained (out of {t.maxMarks}):
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={t.maxMarks}
                      step="0.5"
                      placeholder={`e.g. 9`}
                      value={marksInput}
                      onChange={e => setMarksInput(e.target.value)}
                      style={{
                        width: 70,
                        padding: '4px 8px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 6,
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveMarks(t)}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--accent-primary)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })
      )}

      {/* CR Roster Modal */}
      <UnitTestRosterModal
        open={!!rosterTest}
        onClose={() => setRosterTest(null)}
        unitTest={rosterTest}
      />

      {/* Edit / Add Google Form Link Sheet */}
      <BottomSheet
        open={!!editingLinkTest}
        onClose={() => setEditingLinkTest(null)}
        title={editingLinkTest?.formUrl ? 'Edit Test Link' : 'Add Test Link'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Google Form or Online Test URL
            </label>
            <div style={{ position: 'relative' }}>
              <input
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 34px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                placeholder="https://forms.google.com/..."
                value={linkInput}
                onChange={e => setLinkInput(e.target.value)}
                autoFocus
              />
              <Link2
                size={15}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '6px 0 0' }}>
              Students in your section will be able to open this link to submit their test responses.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setEditingLinkTest(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={handleSaveLink}
              disabled={updateUnitTestMutation.isPending}
            >
              {updateUnitTestMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
              <span>Save Link</span>
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
