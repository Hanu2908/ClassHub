import { useEffect, useState } from 'react';
import { Megaphone, ClipboardList, Trash2, FileText, Send, HelpCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useSubjects } from '../hooks/useSubjects';
import { listPendingShares, deleteShare, type ShareInboxEntry } from '../lib/shareInbox';
import { parseSharedText } from '../lib/utils/smartTextParser';
import { toast } from 'sonner';

export function ShareIntakeBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAppStore(s => s.role);
  const { data: subjects = [] } = useSubjects();
  
  const [pendingShares, setPendingShares] = useState<ShareInboxEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchShares = async () => {
    try {
      const shares = await listPendingShares();
      setPendingShares(shares);
      if (currentIndex >= shares.length) {
        setCurrentIndex(Math.max(0, shares.length - 1));
      }
    } catch (e) {
      console.error('[ShareIntakeBanner] Failed to list pending shares:', e);
    }
  };

  useEffect(() => {
    fetchShares();
    const interval = setInterval(fetchShares, 3000); // Check every 3s
    return () => clearInterval(interval);
  }, []);

  // Listen to URL search param ?share_id=
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shareId = params.get('share_id');
    if (shareId && pendingShares.length > 0) {
      const idx = pendingShares.findIndex(s => s.id === shareId);
      if (idx !== -1) setCurrentIndex(idx);
    }
  }, [location.search, pendingShares]);

  if (pendingShares.length === 0) return null;

  const currentShare = pendingShares[currentIndex] || pendingShares[0];
  if (!currentShare) return null;

  const parsed = parseSharedText(currentShare.caption, subjects);
  const firstFile = currentShare.files[0];
  const fileCount = currentShare.files.length;

  const handleDiscard = async () => {
    try {
      await deleteShare(currentShare.id);
      toast.info('Shared item discarded');
      await fetchShares();
    } catch {
      toast.error('Failed to discard share');
    }
  };

  const handleOpenAnnouncement = () => {
    navigate('/app/announcements', {
      state: { openCreate: true, shareInboxId: currentShare.id }
    });
  };

  const handleOpenAssignment = () => {
    navigate('/app/assignments', {
      state: { openCreate: true, shareInboxId: currentShare.id }
    });
  };

  const handleStudentQueue = async () => {
    toast.success('Draft submitted to CR review queue ✓', {
      description: 'Your CR will review and publish this to the section feed.'
    });
    await deleteShare(currentShare.id);
    await fetchShares();
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))',
        left: 16,
        right: 16,
        maxWidth: 480,
        margin: '0 auto',
        zIndex: 1000,
        background: 'rgba(18, 21, 34, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        borderRadius: 'var(--radius-lg, 16px)',
        padding: '14px 16px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 0 15px rgba(99, 102, 241, 0.15)',
        animation: 'fadeSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            📥 SHARED TO CLASSHUB
          </span>
          {pendingShares.length > 1 && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)', padding: '1px 6px', borderRadius: 10 }}>
              {currentIndex + 1} of {pendingShares.length}
            </span>
          )}
        </div>
        <button
          onClick={handleDiscard}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--status-critical)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            opacity: 0.8,
            outline: 'none',
          }}
          title="Discard shared item"
          aria-label="Discard shared item"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Item Summary Content */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {firstFile ? (
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={18} color="var(--accent-primary)" />
          </div>
        ) : null}

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {parsed.title || firstFile?.name || 'Shared Content'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {firstFile ? `${firstFile.name} ${fileCount > 1 ? `(+${fileCount - 1} more)` : ''}` : parsed.body}
          </p>
        </div>

        {parsed.matchedSubjectName && (
          <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(52, 201, 123, 0.15)', color: 'var(--status-safe)', border: '1px solid rgba(52, 201, 123, 0.3)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
            {parsed.matchedSubjectName} ✨
          </span>
        )}
      </div>

      {/* Action Buttons */}
      {role === 'cr' || role === 'teacher' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 2 }}>
          <button
            onClick={handleOpenAnnouncement}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--accent-primary)',
              border: 'none',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              outline: 'none',
            }}
          >
            <Megaphone size={14} /> Announcement
          </button>
          <button
            onClick={handleOpenAssignment}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              outline: 'none',
            }}
          >
            <ClipboardList size={14} /> Assignment
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 2 }}>
          <button
            onClick={handleStudentQueue}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--accent-primary)',
              border: 'none',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              outline: 'none',
            }}
          >
            <Send size={14} /> Submit to CR
          </button>
          <button
            onClick={handleOpenAnnouncement}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              outline: 'none',
            }}
          >
            <HelpCircle size={14} /> Ask Q&A
          </button>
        </div>
      )}
    </div>
  );
}
