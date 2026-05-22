import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, CheckCircle2, AlertTriangle, Inbox, Trash2, Loader, Search, X, ArrowUpDown, Bell, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NavBar } from '../../components/NavBar';
import { BottomSheet } from '../../components/BottomSheet';
import { CROnly, EmptyState, timeAgo, deadlineBadgeClass, deadlineLabel } from '../../components/Shared';
import { useAppStore, isExpired, type Announcement, type Attachment } from '../../store/appStore';
import { showToast } from '../../components/Toast';
import { useAnnouncements, useSectionMembers, type SectionMember } from '../../hooks/useSupabaseQuery';
import { useCreateAnnouncement, useDeleteAnnouncement, useAcknowledge } from '../../hooks/useSupabaseMutations';
import { FileUploader } from '../../components/FileUploader';
import { AttachmentCard } from '../../components/AttachmentCard';
import { supabase } from '../../lib/supabase';

type Filter = 'all' | 'critical' | 'general';

function CreateAnnouncementSheet({ onClose }: { onClose: () => void }) {
  const createAnn = useCreateAnnouncement();
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;
  const userId = authUser?.id;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'general' | 'critical'>('general');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    outline: 'none',
  };

  const handlePost = async () => {
    if (!title.trim() || !body.trim()) { showToast('Title and body required', 'error'); return; }
    
    setIsPosting(true);
    try {
      const parentId = await createAnn.mutateAsync({
        title: title.trim(),
        message: body.trim(),
        priority,
        deadline: hasDeadline && deadlineDate ? new Date(deadlineDate).toISOString() : null,
      });

      if (parentId && files.length > 0) {
        if (!sectionId || !userId) throw new Error('Missing section context or user context');
        for (const file of files) {
          const path = `${sectionId}/announcements/${parentId}/${file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from('attachments')
            .upload(path, file, { cacheControl: '3600', upsert: true });
          if (uploadErr) throw uploadErr;

          const { error: dbErr } = await supabase
            .from('attachments')
            .insert({
              section_id: sectionId,
              announcement_id: parentId,
              storage_path: path,
              filename: file.name,
              file_size: file.size,
              file_type: file.type,
              uploaded_by: userId,
            });
          if (dbErr) throw dbErr;
        }
      }

      showToast('Announcement posted', 'success');
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to post', 'error');
    } finally {
      setIsPosting(false);
    }
  };

  const pending = createAnn.isPending || isPosting;

  return (
    <BottomSheet onClose={onClose} title="Post Announcement">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 20 }}>
        <div>
          <label className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Title *</label>
          <input 
            style={inputStyle} 
            className={`input-adaptive ${priority === 'critical' ? 'focus-critical' : 'focus-violet'}`}
            placeholder="e.g. End Semester Exam Schedule" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
          />
        </div>
        <div>
          <label className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Message *</label>
          <textarea 
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} 
            className={`input-adaptive ${priority === 'critical' ? 'focus-critical' : 'focus-violet'}`}
            placeholder="Details of the announcement…" 
            value={body} 
            onChange={e => setBody(e.target.value)} 
          />
        </div>
        
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Priority</label>
            <select 
              style={inputStyle} 
              className={`input-adaptive ${priority === 'critical' ? 'focus-critical' : 'focus-violet'}`}
              value={priority} 
              onChange={e => setPriority(e.target.value as 'general' | 'critical')}
            >
              <option value="general">General</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: hasDeadline ? 8 : 0 }}>
            <input type="checkbox" checked={hasDeadline} onChange={e => setHasDeadline(e.target.checked)} />
            <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>Set a deadline</span>
          </label>
          {hasDeadline && (
            <input 
              type="datetime-local" 
              style={inputStyle} 
              className={`input-adaptive ${priority === 'critical' ? 'focus-critical' : 'focus-violet'}`}
              value={deadlineDate} 
              onChange={e => setDeadlineDate(e.target.value)} 
            />
          )}
        </div>

        <div>
          <FileUploader files={files} onChange={setFiles} />
        </div>

        <button
          onClick={handlePost}
          disabled={pending} className="t-button" style={{ width: '100%', padding: '12px', 
            background: pending ? 'var(--bg-elevated)' : (priority === 'critical' ? 'var(--status-critical)' : 'var(--status-announcement)'),
            border: 'none', borderRadius: 'var(--radius-md)', cursor: pending ? 'not-allowed' : 'pointer',
            color: pending ? 'var(--text-muted)' : '#fff', marginTop: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all var(--transition-fast)' }}
        >
          {pending && <Loader size={14} className="spin" />}
          {pending ? 'Posting…' : 'Post Announcement'}
        </button>
      </div>
    </BottomSheet>
  );
}

interface SectionAck {
  announcement_id: string;
  user_id: string;
  acknowledged_at: string;
}

interface AcksTrackingSheetProps {
  announcement: Announcement;
  onClose: () => void;
  sectionAcks: SectionAck[];
  members: SectionMember[];
}

function AcksTrackingSheet({ announcement, onClose, sectionAcks, members }: AcksTrackingSheetProps) {
  const [activeTab, setActiveTab] = useState<'acknowledged' | 'pending'>('acknowledged');
  const [studentSearch, setStudentSearch] = useState('');
  const [nudgingIds, setNudgingIds] = useState<Set<string>>(new Set());
  const [isNudgingAll, setIsNudgingAll] = useState(false);

  // Filter out CR accounts to get students list
  const totalStudents = members.filter(m => m.role === 'student');
  
  // Find which students acknowledged this announcement
  const announcementAcks = sectionAcks.filter(a => a.announcement_id === announcement.id);
  const ackedUserIds = new Set(announcementAcks.map(a => a.user_id));

  const ackedStudents = totalStudents.filter(m => ackedUserIds.has(m.id));
  const pendingStudents = totalStudents.filter(m => !ackedUserIds.has(m.id));

  // Fuzzy filter by name or class roll
  const filterList = (list: SectionMember[]) => {
    return list.filter(m => 
      m.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
      (m.classRoll && m.classRoll.toLowerCase().includes(studentSearch.toLowerCase()))
    );
  };

  const filteredAcked = filterList(ackedStudents);
  const filteredPending = filterList(pendingStudents);

  const handleNudgeSingle = async (studentId: string, studentName: string) => {
    setNudgingIds(prev => {
      const next = new Set(prev);
      next.add(studentId);
      return next;
    });
    try {
      const { error } = await supabase.functions.invoke('nudge-unacknowledged', {
        body: { announcementId: announcement.id, studentId }
      });
      if (error) throw error;
      showToast(`Nudge sent to ${studentName}`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to send nudge', 'error');
    } finally {
      setNudgingIds(prev => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  };

  const handleNudgeAll = async () => {
    if (pendingStudents.length === 0) {
      showToast('All students have already acknowledged', 'info');
      return;
    }
    setIsNudgingAll(true);
    try {
      const { error } = await supabase.functions.invoke('nudge-unacknowledged', {
        body: { announcementId: announcement.id }
      });
      if (error) throw error;
      showToast(`Nudge sent to all unacknowledged students (${pendingStudents.length})`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to send bulk nudge', 'error');
    } finally {
      setIsNudgingAll(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="Acknowledgment Status">
      <div style={{ paddingBottom: 24 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
            {announcement.title}
          </h3>
          <p className="t-caption" style={{ color: 'var(--text-secondary)' }}>
            Acknowledgment tracking: <strong style={{ color: 'var(--status-announcement)' }}>{ackedStudents.length} / {totalStudents.length} acknowledged</strong>
          </p>
        </div>

        {/* Dynamic Search Bar */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input className="t-body" 
            type="text" 
            placeholder="Search students..." 
            value={studentSearch} 
            onChange={e => setStudentSearch(e.target.value)} 
            style={{
              width: '100%', padding: '10px 12px 10px 36px', boxSizing: 'border-box',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>

        {/* Slide tabs */}
        <div className="sheet-tabs-container">
          <button 
            className={`sheet-tab-button${activeTab === 'acknowledged' ? ' active' : ''}`}
            onClick={() => setActiveTab('acknowledged')}
          >
            Acknowledged ({ackedStudents.length})
          </button>
          <button 
            className={`sheet-tab-button${activeTab === 'pending' ? ' active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending ({pendingStudents.length})
          </button>
        </div>

        {/* Nudge All Button for critical announcements */}
        {activeTab === 'pending' && announcement.priority === 'critical' && pendingStudents.length > 0 && (
          <button
            onClick={handleNudgeAll}
            disabled={isNudgingAll} className="t-subtitle" style={{ width: '100%', padding: '10px 14px', marginBottom: 16,
              background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              color: 'var(--status-announcement)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all var(--transition-fast)' }}
          >
            {isNudgingAll ? <Loader size={14} className="spin" /> : <Bell size={14} />}
            Nudge All Unacknowledged ({pendingStudents.length})
          </button>
        )}

        {/* Students List */}
        <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: 4 }} className="custom-scrollbar">
          {(activeTab === 'acknowledged' ? filteredAcked : filteredPending).length === 0 ? (
            <div className="t-body" style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
              No students found.
            </div>
          ) : (
            (activeTab === 'acknowledged' ? filteredAcked : filteredPending).map(student => (
              <div key={student.id} className="student-ack-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                    overflow: 'hidden', flexShrink: 0
                  }}>
                    {student.avatarUrl ? (
                      <img src={student.avatarUrl} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      student.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="t-body-medium" style={{ color: 'var(--text-primary)' }}>{student.name}</div>
                    <div className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
                      {student.classRoll || 'No Roll'} • {student.email}
                    </div>
                  </div>
                </div>
                {activeTab === 'pending' && announcement.priority === 'critical' && (
                  <button 
                    onClick={() => handleNudgeSingle(student.id, student.name)}
                    className="btn-nudge-single"
                    disabled={nudgingIds.has(student.id)}
                    title={`Nudge ${student.name}`}
                  >
                    {nudgingIds.has(student.id) ? (
                      <Loader size={14} className="spin" />
                    ) : (
                      <Bell size={14} />
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [filter, setFilter] = useState<Filter>('all');
  const [showCreate, setShowCreate] = useState(location.state?.openCreate || false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'priority' | 'deadline'>('newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [trackingAnnouncement, setTrackingAnnouncement] = useState<Announcement | null>(null);

  const role = useAppStore(s => s.role);
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;

  const { data: announcements = [], isLoading } = useAnnouncements();
  const deleteAnn = useDeleteAnnouncement();
  const ackMutation = useAcknowledge();

  // Fetch section members to compute stats & nudge lists
  const { data: members = [] } = useSectionMembers();

  // Fetch section-wide acknowledgments for counts and tracking list
  const { data: sectionAcks = [] } = useQuery({
    queryKey: ['section_acknowledgments', sectionId],
    enabled: !!sectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acknowledgments')
        .select('announcement_id, user_id, acknowledged_at');
      if (error) throw error;
      return data ?? [];
    }
  });

  // Filter out CRs to count students
  const totalStudents = members.filter(m => m.role === 'student');
  const totalStudentsCount = totalStudents.length;

  // Acknowledgment counts map
  const ackCountsMap = sectionAcks.reduce((acc, curr) => {
    acc[curr.announcement_id] = (acc[curr.announcement_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Auto-expiry: hide items past deadline + 2 days
  const visible = announcements.filter(a => !isExpired(a.deadline));

  const filtered = visible.filter(a => {
    const matchesFilter = filter === 'all' ? true : a.priority === filter;
    const matchesSearch = searchQuery.trim() === '' || 
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.body.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'priority') {
      if (a.priority === 'critical' && b.priority !== 'critical') return -1;
      if (b.priority === 'critical' && a.priority !== 'critical') return 1;
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    } else if (sortBy === 'deadline') {
      // eslint-disable-next-line react-hooks/purity
      const now = Date.now();
      const getDeadlineScore = (deadline: string | null) => {
        if (!deadline) return Infinity;
        const time = new Date(deadline).getTime();
        if (time < now) return Infinity - 1; // Expired close to last
        return time; // Future closest deadline first
      };
      const scoreA = getDeadlineScore(a.deadline);
      const scoreB = getDeadlineScore(b.deadline);
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    } else {
      // Default: 'newest'
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    }
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteAnn.mutateAsync(id);
      showToast('Announcement deleted', 'info');
    } catch { showToast('Failed to delete', 'error'); }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await ackMutation.mutateAsync(id);
      showToast('Acknowledged ✓', 'success');
    } catch { showToast('Failed to acknowledge', 'error'); }
  };

  return (
    <div className="page-shell">
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button id="ann-back-btn" onClick={() => navigate('/app/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', marginLeft: -4 }}
            aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1 className="t-page-title" style={{ color: 'var(--text-primary)', flex: 1 }}>Announcements</h1>
          
          {/* Sorting Dropdown Trigger */}
          <div className="sort-dropdown-container">
            <button
              onClick={() => {
                setShowSortDropdown(!showSortDropdown);
                setShowSearch(false);
              }}
              className={`header-action-btn${(showSortDropdown || sortBy !== 'newest') ? ' active' : ''}`}
              style={{ marginRight: 4 }}
              aria-label="Sort Options"
            >
              <ArrowUpDown size={18} />
            </button>
            {showSortDropdown && (
              <div className="sort-dropdown-menu">
                <button
                  className={`sort-dropdown-item${sortBy === 'newest' ? ' active' : ''}`}
                  onClick={() => { setSortBy('newest'); setShowSortDropdown(false); }}
                >
                  <span>Newest First</span>
                </button>
                <button
                  className={`sort-dropdown-item${sortBy === 'priority' ? ' active' : ''}`}
                  onClick={() => { setSortBy('priority'); setShowSortDropdown(false); }}
                >
                  <span>Priority First</span>
                </button>
                <button
                  className={`sort-dropdown-item${sortBy === 'deadline' ? ' active' : ''}`}
                  onClick={() => { setSortBy('deadline'); setShowSortDropdown(false); }}
                >
                  <span>Closest Deadline</span>
                </button>
              </div>
            )}
          </div>

          {/* Search Toggle Button */}
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              setShowSortDropdown(false);
              if (showSearch) setSearchQuery(''); // Clear search on collapse
            }}
            className={`header-action-btn${(showSearch || searchQuery) ? ' active' : ''}`}
            aria-label="Toggle Search"
          >
            <Search size={18} />
          </button>
        </div>

        {/* Collapsible Search Bar Container */}
        <div className={`search-bar-container${showSearch || searchQuery ? ' open' : ''}`}>
          <div className="search-input-wrapper">
            <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              className="search-input-field"
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search field"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', display: 'flex', padding: 4,
                  alignItems: 'center', justifyContent: 'center'
                }}
                aria-label="Clear Search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="filter-tabs">
          {(['all', 'critical', 'general'] as Filter[]).map(f => (
            <button key={f} id={`ann-filter-${f}`} className={`filter-tab${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>
              {f}
            </button>
          ))}
        </div>
      </header>

      <main className="page-content">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Loader size={24} color="var(--accent-primary)" className="spin" />
          </div>
        ) : filtered.length === 0
          ? <EmptyState icon={<Inbox size={36} color="var(--text-muted)" />} title="Nothing here" subtitle="No announcements found" />
          : filtered.map(ann => {
            const isCritical = ann.priority === 'critical';
            const isAcked = ann.isAcknowledged;
            const bdg = deadlineBadgeClass(ann.deadline);
            const lbl = deadlineLabel(ann.deadline);

            return (
              <article key={ann.id} className="card" style={{
                borderLeft: isCritical ? '4px solid var(--status-critical)' : undefined,
                background: isCritical ? 'var(--status-critical-bg)' : undefined,
                animation: 'fadeSlideUp 0.35s ease both',
                padding: '16px',
              }}>
                <div className="announcement-card-content">
                  {/* Left balanced column (75%) */}
                  <div className="announcement-card-left">
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      {isCritical && (
                        <span className="badge badge-critical" style={{ background: 'rgba(248, 113, 113, 0.15)', color: 'var(--status-critical)' }}>
                          <AlertTriangle size={10} /> CRITICAL
                        </span>
                      )}
                      {ann.deadline && <span className={`badge ${bdg}`}>{lbl}</span>}
                    </div>
                    
                    <h2 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.3 }}>
                      {ann.title}
                    </h2>

                    <p className="t-body" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                      {ann.body}
                    </p>

                    {ann.attachments && ann.attachments.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                        {ann.attachments.map((att: Attachment) => (
                          <AttachmentCard key={att.id} attachment={att} />
                        ))}
                      </div>
                    )}

                    <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 'auto', paddingTop: 8 }}>
                      Posted {timeAgo(ann.postedAt)}
                    </p>
                  </div>

                  {/* Right balanced column (25%) */}
                  <div className="announcement-card-right">
                    {role === 'cr' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          id={`del-ann-${ann.id}`}
                          onClick={() => handleDelete(ann.id)}
                          className="btn-del-ann"
                          style={{
                            background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)',
                            borderRadius: 8, padding: '6px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}
                          title="Delete announcement"
                        >
                          <Trash2 size={14} color="var(--status-critical)" />
                        </button>
                      </div>
                    )}

                    {role === 'cr' && (
                      <div 
                        className="tracker-pill"
                        onClick={() => setTrackingAnnouncement(ann)}
                        title="View read receipts"
                      >
                        <Users size={12} />
                        <span>{ackCountsMap[ann.id] || 0}/{totalStudentsCount} ✓</span>
                      </div>
                    )}

                    <div className="t-label" style={{ width: '100%', marginTop: 'auto' }}>
                      {!isAcked ? (
                        <button
                          id={`ack-btn-${ann.id}`}
                          onClick={() => handleAcknowledge(ann.id)}
                          className="btn-ack-btn"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-md)', cursor: 'pointer',
                            color: 'var(--text-primary)',
                            width: '100%', justifyContent: 'center',
                          }}
                        >
                          <CheckCircle2 size={13} /> Acknowledge
                        </button>
                      ) : (
                        <div style={{ 
                          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', 
                          background: 'var(--status-safe-bg)', border: '1px solid rgba(52,201,123,0.25)', 
                          borderRadius: 'var(--radius-md)', width: '100%', justifyContent: 'center',
                          boxSizing: 'border-box'
                        }}>
                          <CheckCircle2 size={13} color="var(--status-safe)" />
                          <span className="t-label" style={{ color: 'var(--status-safe)' }}>Acked</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        }
      </main>

      <CROnly>
        <button id="post-ann-fab" onClick={() => setShowCreate(true)} className="fab" aria-label="Post announcement">
          <Plus size={22} />
        </button>
      </CROnly>

      {showCreate && <CreateAnnouncementSheet onClose={() => setShowCreate(false)} />}
      
      {trackingAnnouncement && (
        <AcksTrackingSheet 
          announcement={trackingAnnouncement} 
          onClose={() => setTrackingAnnouncement(null)}
          sectionAcks={sectionAcks}
          members={members}
        />
      )}

      <NavBar />
    </div>
  );
}
