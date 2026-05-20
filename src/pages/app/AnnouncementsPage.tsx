import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, CheckCircle2, AlertTriangle, Inbox, Trash2, Loader } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { BottomSheet } from '../../components/BottomSheet';
import { CROnly, EmptyState, timeAgo, deadlineBadgeClass, deadlineLabel } from '../../components/Shared';
import { useAppStore, isExpired } from '../../store/appStore';
import { showToast } from '../../components/Toast';
import { useAnnouncements } from '../../hooks/useSupabaseQuery';
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
    font: '400 14px var(--font-body)', outline: 'none',
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
          <label style={{ font: '500 12px var(--font-body)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Title *</label>
          <input style={inputStyle} placeholder="e.g. End Semester Exam Schedule" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label style={{ font: '500 12px var(--font-body)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Message *</label>
          <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Details of the announcement…" value={body} onChange={e => setBody(e.target.value)} />
        </div>
        
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ font: '500 12px var(--font-body)', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Priority</label>
            <select style={inputStyle} value={priority} onChange={e => setPriority(e.target.value as 'general' | 'critical')}>
              <option value="general">General</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: hasDeadline ? 8 : 0 }}>
            <input type="checkbox" checked={hasDeadline} onChange={e => setHasDeadline(e.target.checked)} />
            <span style={{ font: '500 13px var(--font-body)', color: 'var(--text-primary)' }}>Set a deadline</span>
          </label>
          {hasDeadline && (
            <input type="datetime-local" style={inputStyle} value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} />
          )}
        </div>

        <div>
          <FileUploader files={files} onChange={setFiles} />
        </div>

        <button
          onClick={handlePost}
          disabled={pending}
          style={{
            width: '100%', padding: '12px', background: pending ? 'var(--bg-elevated)' : 'var(--accent-primary)',
            border: 'none', borderRadius: 'var(--radius-md)', cursor: pending ? 'not-allowed' : 'pointer',
            font: '600 14px var(--font-body)', color: pending ? 'var(--text-muted)' : '#fff', marginTop: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {pending && <Loader size={14} className="spin" />}
          {pending ? 'Posting…' : 'Post Announcement'}
        </button>
      </div>
    </BottomSheet>
  );
}

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [filter, setFilter] = useState<Filter>('all');
  const [showCreate, setShowCreate] = useState(location.state?.openCreate || false);
  const role = useAppStore(s => s.role);
  const { data: announcements = [], isLoading } = useAnnouncements();
  const deleteAnn = useDeleteAnnouncement();
  const ackMutation = useAcknowledge();

  // Auto-expiry: hide items past deadline + 2 days
  const visible = announcements.filter(a => !isExpired(a.deadline));

  const filtered = visible.filter(a =>
    filter === 'all' ? true : a.priority === filter
  ).sort((a, b) => {
    if (a.priority === 'critical' && b.priority !== 'critical') return -1;
    if (b.priority === 'critical' && a.priority !== 'critical') return 1;
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
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
          <h1 style={{ font: '600 18px var(--font-display)', color: 'var(--text-primary)', flex: 1 }}>Announcements</h1>
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
          ? <EmptyState icon={<Inbox size={36} color="var(--text-muted)" />} title="Nothing here" subtitle="No announcements in this category" />
          : filtered.map(ann => {
            const isCritical = ann.priority === 'critical';
            const isAcked = ann.isAcknowledged;
            const bdg = deadlineBadgeClass(ann.deadline);
            const lbl = deadlineLabel(ann.deadline);

            return (
              <article key={ann.id} className="card" style={{
                borderLeft: isCritical ? '3px solid var(--status-critical)' : undefined,
                background: isCritical ? 'rgba(255,68,68,0.05)' : undefined,
                animation: 'fadeSlideUp 0.35s ease both',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      {isCritical && (
                        <span className="badge badge-critical">
                          <AlertTriangle size={10} /> CRITICAL
                        </span>
                      )}
                      {ann.deadline && <span className={`badge ${bdg}`}>{lbl}</span>}
                    </div>
                    <h2 style={{ font: '600 15px var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
                      {ann.title}
                    </h2>
                    <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', marginBottom: 10 }}>
                      Posted {timeAgo(ann.postedAt)}
                    </p>
                  </div>
                  {role === 'cr' && (
                    <button
                      id={`del-ann-${ann.id}`}
                      onClick={() => handleDelete(ann.id)}
                      style={{
                        background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)',
                        borderRadius: 8, padding: '6px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s', flexShrink: 0,
                      }}
                      title="Delete announcement"
                    >
                      <Trash2 size={14} color="var(--status-critical)" />
                    </button>
                  )}
                </div>

                <p style={{ font: '400 14px var(--font-body)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                  {ann.body}
                </p>

                {ann.attachments && ann.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {ann.attachments.map(att => (
                      <AttachmentCard key={att.id} attachment={att} />
                    ))}
                  </div>
                )}

                {!isAcked ? (
                  <button
                    id={`ack-btn-${ann.id}`}
                    onClick={() => handleAcknowledge(ann.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      font: '500 13px var(--font-body)', color: 'var(--text-primary)',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <CheckCircle2 size={15} /> Acknowledge
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--status-safe-bg)', border: '1px solid rgba(52,201,123,0.25)', borderRadius: 'var(--radius-md)' }}>
                    <CheckCircle2 size={15} color="var(--status-safe)" />
                    <span style={{ font: '500 13px var(--font-body)', color: 'var(--status-safe)' }}>Acknowledged</span>
                  </div>
                )}
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

      <NavBar />
    </div>
  );
}
