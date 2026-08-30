import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, X, Users, Mail, Search, Pencil, UserX, AlertTriangle, Loader2, SlidersHorizontal, ChevronDown, Check } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import Skeleton from 'react-loading-skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { NavBar } from '../../components/NavBar';
import { useSectionMembers, useSection, useSectionAttendance, type SectionMember } from '../../hooks/useSectionMembers';
import { useRemoveSectionMember, useUpdateSectionMember } from '../../hooks/useSectionAdmin';
import { useUserTagsBatch, useDeleteTag } from '../../hooks/useUserTags';
import { useAppStore } from '../../store/appStore';
import { TagPill, TagOverflow } from '../../components/TagPill';
import { BottomSheet } from '../../components/BottomSheet';
import { CopyButton } from '../../components/CopyButton';
import { toast } from 'sonner';

const MAX_VISIBLE_TAGS = 3;

function DirectorySkeleton() {
  return (
    <div className="card" style={{ padding: 0 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderBottom: i < 5 ? '1px solid var(--border-default)' : 'none',
          }}
        >
          <Skeleton circle width={36} height={36} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Skeleton width={120} height={16} />
              <Skeleton width={40} height={14} />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Skeleton width={60} height={20} borderRadius="var(--radius-pill)" />
              <Skeleton width={50} height={20} borderRadius="var(--radius-pill)" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EditMemberModal({
  member,
  open,
  onClose,
}: {
  member: SectionMember | null;
  open: boolean;
  onClose: () => void;
}) {
  const updateMember = useUpdateSectionMember();
  const [roll, setRoll] = useState('');
  const [batch, setBatch] = useState<'1' | '2'>('1');

  useEffect(() => {
    if (member) {
      setRoll(member.classRoll ?? '');
      setBatch((member.subBatch as '1' | '2') || '1');
    }
  }, [member]);

  if (!member) return null;

  const handleSave = async () => {
    if (!roll.trim()) {
      toast.error('Class Roll Number is required');
      return;
    }
    await updateMember.mutateAsync({
      targetUserId: member.id,
      sectionRoll: roll.trim(),
      subBatch: batch,
    });
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Edit Student Details">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 20 }}>
        <div>
          <p className="t-body-medium" style={{ color: 'var(--text-primary)', margin: 0 }}>{member.name}</p>
          <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 2 }}>{member.email}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="t-label" style={{ color: 'var(--text-secondary)' }}>Section Roll Number</label>
          <input
            type="text"
            value={roll}
            onChange={e => setRoll(e.target.value)}
            placeholder="e.g. P-17"
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="t-label" style={{ color: 'var(--text-secondary)' }}>Assigned Sub-Batch</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              onClick={() => setBatch('1')}
              style={{
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                background: batch === '1' ? 'rgba(96, 165, 250, 0.15)' : 'var(--bg-elevated)',
                border: batch === '1' ? '1.5px solid #60A5FA' : '1px solid var(--border-default)',
                color: batch === '1' ? '#60A5FA' : 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Batch 1 (G1)
            </button>
            <button
              type="button"
              onClick={() => setBatch('2')}
              style={{
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                background: batch === '2' ? 'rgba(167, 139, 250, 0.15)' : 'var(--bg-elevated)',
                border: batch === '2' ? '1.5px solid #A78BFA' : '1px solid var(--border-default)',
                color: batch === '2' ? '#A78BFA' : 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Batch 2 (G2)
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn-secondary" onClick={onClose} style={{ flex: 1, minHeight: 44 }}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={updateMember.isPending}
            style={{ flex: 1, minHeight: 44 }}
          >
            {updateMember.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function RemoveMemberModal({
  member,
  open,
  onClose,
}: {
  member: SectionMember | null;
  open: boolean;
  onClose: () => void;
}) {
  const removeMember = useRemoveSectionMember();

  if (!member) return null;

  const handleConfirm = async () => {
    await removeMember.mutateAsync(member.id);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Remove Member from Section?">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 20 }}>
        <div style={{
          background: 'rgba(255, 68, 68, 0.05)',
          border: '1.5px solid rgba(255, 68, 68, 0.2)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}>
          <AlertTriangle size={20} color="var(--status-critical)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="t-subtitle" style={{ color: 'var(--status-critical)', marginBottom: 4 }}>
              Detach {member.name}
            </p>
            <p className="t-caption" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              This will immediately detach <strong>{member.name}</strong> ({member.classRoll ?? member.email}) from this section hub. Their section roll, sub-batch assignment, and section tags will be reset.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn-secondary" onClick={onClose} style={{ flex: 1, minHeight: 48 }}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={removeMember.isPending}
            style={{
              flex: 1,
              background: 'linear-gradient(180deg, #FF6B6B 0%, #E83E3C 100%)',
              boxShadow: '0 4px 16px rgba(255,68,68,0.25)',
              minHeight: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {removeMember.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserX size={16} />}
            {removeMember.isPending ? 'Removing…' : 'Remove Student'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

export default function SectionDirectoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tagFilter = searchParams.get('tag');
  const role = useAppStore(s => s.authUser?.role ?? 'student');
  const isCR = role === 'cr';
  const [activeTab, setActiveTab] = useState<'students' | 'teachers'>('students');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState<'all' | '1' | '2'>('all');
  const [commuteFilter, setCommuteFilter] = useState<'all' | 'ds' | 'hostel'>('all');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'below_75' | 'above_75'>('all');
  const [sortBy, setSortBy] = useState<'roll' | 'name' | 'attendance_asc' | 'attendance_desc'>('roll');

  // Modals for CR
  const [editingMember, setEditingMember] = useState<SectionMember | null>(null);
  const [removingMember, setRemovingMember] = useState<SectionMember | null>(null);

  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;

  const { data: section } = useSection();
  const sectionName = section?.name || '';

  const { data: teachers = [], isLoading: isTeachersLoading } = useQuery({
    queryKey: ['section-teachers', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('section_teachers')
        .select(`
          id,
          is_counsellor_for_batch,
          teacher:teacher_id (id, name, email, avatar_url, phone),
          subjects:subject_id (name, code)
        `)
        .eq('section_id', sectionId || '');
      if (error) throw error;
      return data || [];
    },
    enabled: !!sectionId,
  });

  const groupedTeachers = useMemo(() => {
    const map: Record<string, {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      isCounsellorForBatch: '1' | '2' | null;
      phone: string | null;
      subjects: { name: string; code: string }[];
    }> = {};

    teachers.forEach((row: any) => {
      if (!row.teacher) return;
      const tId = row.teacher.id;
      if (!map[tId]) {
        map[tId] = {
          id: tId,
          name: row.teacher.name,
          email: row.teacher.email,
          phone: row.teacher.phone,
          avatarUrl: row.teacher.avatar_url,
          isCounsellorForBatch: row.is_counsellor_for_batch,
          subjects: [],
        };
      }
      if (row.subjects) {
        const code = row.subjects.code;
        if (!map[tId].subjects.some(s => s.code === code)) {
          map[tId].subjects.push({
            name: row.subjects.name,
            code,
          });
        }
      }
      if (row.is_counsellor_for_batch) {
        map[tId].isCounsellorForBatch = row.is_counsellor_for_batch;
      }
    });

    return Object.values(map);
  }, [teachers]);

  const { data: members = [], isLoading } = useSectionMembers();
  const { data: attendanceMap = {} } = useSectionAttendance();
  const memberIds = useMemo(() => members.map(m => m.id), [members]);
  const { data: tagsByUser = {} } = useUserTagsBatch(memberIds);
  const deleteTag = useDeleteTag();

  // Combine members with attendance
  const studentMembers = useMemo(() => {
    const nonTeachers = members.filter(m => m.role !== 'teacher');
    return nonTeachers.map(m => {
      const att = attendanceMap[m.id];
      return {
        ...m,
        overallPercentage: att?.overallPercentage ?? null,
        totalHeld: att?.totalHeld ?? 0,
      };
    });
  }, [members, attendanceMap]);

  // Filter students based on search, tags, batches, commute, and attendance
  const filteredStudents = useMemo(() => {
    return studentMembers.filter(member => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = member.name.toLowerCase().includes(q);
        const matchesRoll = member.classRoll?.toLowerCase().includes(q) ?? false;
        const matchesUniv = member.universityRoll?.toLowerCase().includes(q) ?? false;
        const matchesPhone = member.phone?.includes(q) ?? false;
        if (!matchesName && !matchesRoll && !matchesUniv && !matchesPhone) return false;
      }

      // Tag filter
      if (tagFilter) {
        const lower = tagFilter.toLowerCase();
        const tags = tagsByUser[member.id] ?? [];
        if (!tags.some(t => t.tagText.toLowerCase() === lower)) return false;
      }

      // Batch filter
      if (batchFilter === '1' && member.subBatch !== '1') return false;
      if (batchFilter === '2' && member.subBatch !== '2') return false;

      // Commute filter
      if (commuteFilter === 'ds' && member.dayScholar !== true) return false;
      if (commuteFilter === 'hostel' && member.dayScholar !== false) return false;

      // Attendance filter (CR only)
      if (isCR && attendanceFilter === 'below_75') {
        if (member.overallPercentage === null || member.overallPercentage >= 75) return false;
      }
      if (isCR && attendanceFilter === 'above_75') {
        if (member.overallPercentage === null || member.overallPercentage < 75) return false;
      }

      return true;
    });
  }, [studentMembers, searchQuery, tagFilter, tagsByUser, batchFilter, commuteFilter, attendanceFilter, isCR]);

  // Sort students
  const sortedStudents = useMemo(() => {
    const getRollNumber = (roll: string | null | undefined) => {
      if (!roll) return 999;
      const cleaned = roll.replace(/[^0-9]/g, '');
      const num = parseInt(cleaned, 10);
      return isNaN(num) ? 999 : num;
    };

    return [...filteredStudents].sort((a, b) => {
      if (sortBy === 'attendance_asc') {
        if (a.overallPercentage === null) return 1;
        if (b.overallPercentage === null) return -1;
        return a.overallPercentage - b.overallPercentage;
      }
      if (sortBy === 'attendance_desc') {
        if (a.overallPercentage === null) return 1;
        if (b.overallPercentage === null) return -1;
        return b.overallPercentage - a.overallPercentage;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // Default: Roll sort
      const rollA = getRollNumber(a.classRoll);
      const rollB = getRollNumber(b.classRoll);
      return rollA - rollB;
    });
  }, [filteredStudents, sortBy]);

  const clearFilter = () => {
    setSearchParams({});
  };

  const handleTagTap = (tagText: string) => {
    setSearchParams({ tag: tagText });
  };

  const containerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useWindowVirtualizer({
    count: sortedStudents.length,
    estimateSize: () => 74,
    overscan: 10,
    scrollMargin: 0,
  });

  const handleTagRemove = (tagId: string) => {
    if (window.confirm('Remove this tag from this student?')) {
      deleteTag.mutate(tagId, {
        onSuccess: () => toast.info('Tag removed'),
        onError: (err) => toast.error(`Failed: ${err.message}`),
      });
    }
  };

  // Counts for filters
  const b1Count = studentMembers.filter(m => m.subBatch === '1').length;
  const b2Count = studentMembers.filter(m => m.subBatch === '2').length;
  const dsCount = studentMembers.filter(m => m.dayScholar === true).length;
  const hostelCount = studentMembers.filter(m => m.dayScholar === false).length;
  const criticalCount = studentMembers.filter(m => m.overallPercentage !== null && m.overallPercentage < 75).length;
  const safeCount = studentMembers.filter(m => m.overallPercentage !== null && m.overallPercentage >= 75).length;

  return (
    <div className="page-shell">
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
            padding: 0,
          }}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <Users size={18} color="var(--accent-primary)" />
        <h1 className="t-page-title" style={{ color: 'var(--text-primary)', flex: 1 }}>
          Section Directory
        </h1>
        <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
          {activeTab === 'students' ? `${sortedStudents.length} of ${studentMembers.length}` : `${groupedTeachers.length} teachers`}
        </span>
      </header>

      {/* Directory Tabs */}
      <div style={{
        display: 'flex',
        padding: '0 16px',
        borderBottom: '1px solid var(--border-default)',
        background: 'var(--bg-base)',
        gap: 12
      }}>
        <button
          onClick={() => setActiveTab('students')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '12px 16px 10px',
            borderBottom: activeTab === 'students' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'students' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'students' ? 700 : 500, fontSize: 13,
          }}
        >
          Students ({studentMembers.length})
        </button>
        <button
          onClick={() => setActiveTab('teachers')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '12px 16px 10px',
            borderBottom: activeTab === 'teachers' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'teachers' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'teachers' ? 700 : 500, fontSize: 13,
          }}
        >
          Teachers ({groupedTeachers.length})
        </button>
      </div>

      <main className="page-content" style={{ gap: 12 }}>
        {activeTab === 'teachers' ? (
          isTeachersLoading ? (
            <DirectorySkeleton />
          ) : groupedTeachers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
              <p className="t-body-medium">No teachers linked to this section yet.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              {groupedTeachers.map((teacher, index) => (
                <div
                  key={teacher.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '16px',
                    borderBottom: index < groupedTeachers.length - 1 ? '1px solid var(--border-default)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Avatar */}
                    {teacher.avatarUrl ? (
                      <img
                        src={teacher.avatarUrl}
                        alt={teacher.name}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        flexShrink: 0,
                      }}>
                        {teacher.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="t-body-medium" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                          {teacher.name}
                        </span>
                        {teacher.isCounsellorForBatch && (
                          <span className="t-mono-sm" style={{
                            background: 'rgba(99, 102, 241, 0.1)',
                            color: 'rgb(99, 102, 241)',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontSize: '12px',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                          }}>
                            Counsellor {sectionName || 'B'}{teacher.isCounsellorForBatch === '1' ? '1' : '2'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Mail size={12} color="var(--text-muted)" />
                        <span className="t-caption" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {teacher.email}
                        </span>
                      </div>
                      {teacher.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            +91 {teacher.phone}
                          </span>
                          <CopyButton
                            text={teacher.phone}
                            ariaLabel="Copy teacher phone number"
                            successMessage="Phone number copied!"
                            iconSize={11}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subjects taught by this teacher */}
                  {teacher.subjects.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 48 }}>
                      {teacher.subjects.map((sub, sIdx) => (
                        <span
                          key={sIdx}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-default)',
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 600 }}>{sub.code}</span>
                          <span>{sub.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            {/* Search and Filters Strip */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Search Bar + Radix Sort Dropdown Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <Search size={16} color="var(--text-muted)" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search students by name, roll, or phone..."
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Radix Sort Dropdown Menu */}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      id="section-sort-trigger-btn"
                      type="button"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all var(--transition-fast)',
                        height: 38,
                        boxSizing: 'border-box',
                      }}
                    >
                      <SlidersHorizontal size={13} color="var(--text-muted)" />
                      <span style={{ fontSize: 12.5 }}>
                        Sort: <strong style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                          {sortBy === 'name' ? 'Name' : sortBy === 'attendance_asc' ? 'Low %' : sortBy === 'attendance_desc' ? 'High %' : 'Roll'}
                        </strong>
                      </span>
                      <ChevronDown size={13} color="var(--text-muted)" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={6}
                      className="dropdown-content animate-slide-up"
                      style={{ minWidth: 190, zIndex: 9999 }}
                    >
                      <DropdownMenu.Item
                        className="dropdown-item"
                        onClick={() => setSortBy('roll')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <span>Sort by Roll No</span>
                        {sortBy === 'roll' && <Check size={14} color="var(--accent-primary)" />}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="dropdown-item"
                        onClick={() => setSortBy('name')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <span>Sort by Name</span>
                        {sortBy === 'name' && <Check size={14} color="var(--accent-primary)" />}
                      </DropdownMenu.Item>
                      {isCR && (
                        <>
                          <div style={{ height: 1, background: 'var(--border-default)', margin: '4px 0' }} />
                          <DropdownMenu.Item
                            className="dropdown-item"
                            onClick={() => setSortBy('attendance_asc')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                          >
                            <span>Low Attendance First</span>
                            {sortBy === 'attendance_asc' && <Check size={14} color="var(--accent-primary)" />}
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="dropdown-item"
                            onClick={() => setSortBy('attendance_desc')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                          >
                            <span>High Attendance First</span>
                            {sortBy === 'attendance_desc' && <Check size={14} color="var(--accent-primary)" />}
                          </DropdownMenu.Item>
                        </>
                      )}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>

              {/* Filters Carousel */}
              <div className="carousel" style={{ display: 'flex', gap: 6, paddingBottom: 2, alignItems: 'center' }}>
                {/* Batch Filter */}
                <button
                  type="button"
                  onClick={() => setBatchFilter('all')}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                    border: batchFilter === 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                    background: batchFilter === 'all' ? 'var(--accent-primary-glow)' : 'transparent',
                    color: batchFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0
                  }}
                >
                  All Batches
                </button>
                <button
                  type="button"
                  onClick={() => setBatchFilter(b => b === '1' ? 'all' : '1')}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                    border: batchFilter === '1' ? '1px solid #60A5FA' : '1px solid var(--border-default)',
                    background: batchFilter === '1' ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
                    color: batchFilter === '1' ? '#60A5FA' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0
                  }}
                >
                  Batch 1 ({b1Count})
                </button>
                <button
                  type="button"
                  onClick={() => setBatchFilter(b => b === '2' ? 'all' : '2')}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                    border: batchFilter === '2' ? '1px solid #A78BFA' : '1px solid var(--border-default)',
                    background: batchFilter === '2' ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
                    color: batchFilter === '2' ? '#A78BFA' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0
                  }}
                >
                  Batch 2 ({b2Count})
                </button>

                <div style={{ width: 1, height: 16, background: 'var(--border-default)', margin: '0 2px', flexShrink: 0 }} />

                {/* Commute Filter */}
                <button
                  type="button"
                  onClick={() => setCommuteFilter(c => c === 'ds' ? 'all' : 'ds')}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                    border: commuteFilter === 'ds' ? '1px solid #60A5FA' : '1px solid var(--border-default)',
                    background: commuteFilter === 'ds' ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
                    color: commuteFilter === 'ds' ? '#60A5FA' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0
                  }}
                >
                  🚌 DS ({dsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCommuteFilter(c => c === 'hostel' ? 'all' : 'hostel')}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                    border: commuteFilter === 'hostel' ? '1px solid #A78BFA' : '1px solid var(--border-default)',
                    background: commuteFilter === 'hostel' ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
                    color: commuteFilter === 'hostel' ? '#A78BFA' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0
                  }}
                >
                  🏠 Hostel ({hostelCount})
                </button>

                {/* CR Attendance Filters */}
                {isCR && (
                  <>
                    <div style={{ width: 1, height: 16, background: 'var(--border-default)', margin: '0 2px', flexShrink: 0 }} />
                    <button
                      type="button"
                      onClick={() => setAttendanceFilter(a => a === 'below_75' ? 'all' : 'below_75')}
                      style={{
                        padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                        border: attendanceFilter === 'below_75' ? '1px solid var(--status-critical)' : '1px solid var(--border-default)',
                        background: attendanceFilter === 'below_75' ? 'rgba(248, 113, 113, 0.15)' : 'transparent',
                        color: attendanceFilter === 'below_75' ? 'var(--status-critical)' : 'var(--text-secondary)',
                        fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0
                      }}
                    >
                      &lt;75% Risk ({criticalCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceFilter(a => a === 'above_75' ? 'all' : 'above_75')}
                      style={{
                        padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                        border: attendanceFilter === 'above_75' ? '1px solid var(--status-safe)' : '1px solid var(--border-default)',
                        background: attendanceFilter === 'above_75' ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
                        color: attendanceFilter === 'above_75' ? 'var(--status-safe)' : 'var(--text-secondary)',
                        fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0
                      }}
                    >
                      75%+ Safe ({safeCount})
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Active Tag Filter Indicator */}
            {tagFilter && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                background: 'rgba(74, 158, 255, 0.08)',
                border: '1px solid rgba(74, 158, 255, 0.2)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}>
                <span>Filtered by tag:</span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  background: 'rgba(74, 158, 255, 0.15)',
                  borderRadius: 'var(--radius-pill)',
                }}>
                  {tagFilter}
                  <button
                    onClick={clearFilter}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 14,
                      height: 14,
                      padding: 0,
                      border: 'none',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-secondary)',
                      borderRadius: '50%',
                      cursor: 'pointer',
                    }}
                    aria-label="Clear tag filter"
                  >
                    <X size={9} />
                  </button>
                </span>
              </div>
            )}

            {/* Students List */}
            {isLoading ? (
              <DirectorySkeleton />
            ) : sortedStudents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                <p className="t-body-medium">No students found matching your criteria.</p>
                {(searchQuery || tagFilter || batchFilter !== 'all' || commuteFilter !== 'all' || attendanceFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setBatchFilter('all');
                      setCommuteFilter('all');
                      setAttendanceFilter('all');
                      clearFilter();
                    }}
                    className="t-button"
                    style={{
                      marginTop: 12,
                      padding: '8px 16px',
                      fontSize: '12px',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                    }}
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            ) : (
              <div
                ref={containerRef}
                className="card"
                style={{
                  padding: 0,
                  height: `${virtualizer.getTotalSize()}px`,
                  position: 'relative',
                  overflow: 'visible',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const member = sortedStudents[virtualItem.index];
                  if (!member) return null;

                  const tags = tagsByUser[member.id] ?? [];
                  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
                  const overflowCount = tags.length - MAX_VISIBLE_TAGS;
                  const pct = member.overallPercentage;
                  const isMemberCR = member.role === 'cr';

                  return (
                    <div
                      key={member.id}
                      ref={virtualizer.measureElement}
                      data-index={virtualItem.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        borderBottom: virtualItem.index < sortedStudents.length - 1 ? '1px solid var(--border-default)' : 'none',
                      }}
                    >
                      {/* Avatar or Roll Circle */}
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-default)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        flexShrink: 0,
                      }}>
                        {member.classRoll ?? member.name.slice(0, 2).toUpperCase()}
                      </div>

                      {/* Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                          <span className="t-body-medium" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                            {member.name}
                          </span>
                          {member.subBatch && (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: member.subBatch === '1' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(167, 139, 250, 0.15)',
                              color: member.subBatch === '1' ? '#60A5FA' : '#A78BFA',
                              border: member.subBatch === '1' ? '1px solid rgba(96, 165, 250, 0.3)' : '1px solid rgba(167, 139, 250, 0.3)',
                            }}>
                              G{member.subBatch}
                            </span>
                          )}
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: 4,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            background: member.dayScholar ? 'rgba(96, 165, 250, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                            color: member.dayScholar ? '#60A5FA' : '#a78bfa',
                            border: member.dayScholar ? '1px solid rgba(96, 165, 250, 0.2)' : '1px solid rgba(139, 92, 246, 0.2)',
                            userSelect: 'none',
                          }}>
                            {member.dayScholar ? 'DS 🚌' : 'Hostel 🏠'}
                          </span>
                          {isMemberCR && (
                            <span className="t-mono-sm" style={{
                              background: 'rgba(167, 139, 250, 0.15)',
                              color: 'var(--status-announcement)',
                              padding: '1px 5px',
                              borderRadius: 4,
                              fontSize: '11px',
                              fontWeight: 700,
                            }}>
                              CR
                            </span>
                          )}
                        </div>

                        {/* Phone & Roll */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: tags.length > 0 ? 4 : 0 }}>
                          {member.universityRoll && (
                            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <span>{member.universityRoll}</span>
                              <CopyButton
                                text={member.universityRoll}
                                ariaLabel={`Copy university roll for ${member.name}`}
                                successMessage="Roll number copied!"
                                iconSize={10}
                              />
                            </span>
                          )}
                          {member.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                +91 {member.phone}
                              </span>
                              <CopyButton
                                text={member.phone}
                                ariaLabel={`Copy phone number for ${member.name}`}
                                successMessage="Phone number copied!"
                                iconSize={11}
                              />
                            </div>
                          )}
                        </div>

                        {/* Tags */}
                        {tags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {visibleTags.map(tag => (
                              <TagPill
                                key={tag.id}
                                tagText={tag.tagText}
                                expiresAt={tag.expiresAt}
                                size="sm"
                                showExpiry
                                onTap={() => handleTagTap(tag.tagText)}
                                onRemove={isCR ? () => handleTagRemove(tag.id) : undefined}
                              />
                            ))}
                            {overflowCount > 0 && <TagOverflow count={overflowCount} size="sm" />}
                          </div>
                        )}
                      </div>

                      {/* CR Superpowers: Attendance Chip + Action Buttons */}
                      {isCR && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {pct === null ? (
                            <span style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '3px 7px',
                              borderRadius: 'var(--radius-pill)',
                              color: 'var(--text-secondary)',
                              background: 'var(--border-default)',
                            }}>
                              N/A
                            </span>
                          ) : pct < 75 ? (
                            <span style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '3px 7px',
                              borderRadius: 'var(--radius-pill)',
                              color: 'var(--status-critical)',
                              background: 'var(--status-critical-bg)',
                              border: '1px solid rgba(248, 113, 113, 0.2)',
                            }}>
                              {pct.toFixed(1)}%
                            </span>
                          ) : (
                            <span style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '3px 7px',
                              borderRadius: 'var(--radius-pill)',
                              color: 'var(--status-safe)',
                              background: 'var(--status-safe-bg)',
                              border: '1px solid rgba(52, 211, 153, 0.2)',
                            }}>
                              {pct.toFixed(1)}%
                            </span>
                          )}

                          {!isMemberCR && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => setEditingMember(member)}
                                style={{
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  border: '1px solid var(--border-default)',
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: 'pointer',
                                  color: 'var(--text-secondary)',
                                  padding: '5px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Edit Roll & Batch"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setRemovingMember(member)}
                                style={{
                                  background: 'rgba(255, 68, 68, 0.06)',
                                  border: '1px solid rgba(255, 68, 68, 0.2)',
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: 'pointer',
                                  color: 'var(--status-critical)',
                                  padding: '5px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Remove Student from Hub"
                              >
                                <UserX size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <EditMemberModal
        member={editingMember}
        open={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
      />
      <RemoveMemberModal
        member={removingMember}
        open={Boolean(removingMember)}
        onClose={() => setRemovingMember(null)}
      />

      <NavBar />
    </div>
  );
}
