import { useEffect, useState, useCallback } from 'react';
import { Megaphone, ClipboardList, Trash2, FileText, Send, HelpCircle, ChevronLeft, ChevronRight, Sparkles, Clock, AlertTriangle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useSubjects } from '../hooks/useSubjects';
import { listPendingShares, deleteShare, type ShareInboxEntry } from '../lib/shareInbox';
import { parseSharedText } from '../lib/utils/smartTextParser';
import { toast } from 'sonner';
import { haptics } from '../lib/haptics';

export function ShareIntakeBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAppStore(s => s.role);
  const { data: subjects = [] } = useSubjects();
  
  const [pendingShares, setPendingShares] = useState<ShareInboxEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchShares = useCallback(async () => {
    try {
      const shares = await listPendingShares();
      setPendingShares(shares);
      if (currentIndex >= shares.length) {
        setCurrentIndex(Math.max(0, shares.length - 1));
      }
    } catch (e) {
      console.error('[ShareIntakeBanner] Failed to list pending shares:', e);
    }
  }, [currentIndex]);

  useEffect(() => {
    fetchShares();
    const interval = setInterval(fetchShares, 3000);
    return () => clearInterval(interval);
  }, [fetchShares]);

  // Listen to URL search param ?share_id=
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shareId = params.get('share_id');
    if (shareId && pendingShares.length > 0) {
      const idx = pendingShares.findIndex(s => s.id === shareId);
      if (idx !== -1) setCurrentIndex(idx);
    }
  }, [location.search, pendingShares]);

  if (
    pendingShares.length === 0 ||
    location.pathname.includes('/share-intake') ||
    Boolean(location.state?.openCreate) ||
    Boolean(location.state?.shareInboxId)
  ) {
    return null;
  }

  const currentShare = pendingShares[currentIndex] || pendingShares[0];
  if (!currentShare) return null;

  const parsed = parseSharedText(currentShare.caption, subjects);
  const firstFile = currentShare.files[0];
  const fileCount = currentShare.files.length;

  const handleDiscard = async () => {
    haptics.lightClick();
    try {
      await deleteShare(currentShare.id);
      toast.info('Shared item discarded');
      await fetchShares();
    } catch {
      toast.error('Failed to discard share');
    }
  };

  const handleOpenAnnouncement = () => {
    haptics.lightClick();
    navigate('/app/announcements', {
      state: { openCreate: true, shareInboxId: currentShare.id }
    });
  };

  const handleOpenAssignment = () => {
    haptics.lightClick();
    navigate('/app/assignments', {
      state: { openCreate: true, shareInboxId: currentShare.id }
    });
  };

  const handleStudentQueue = async () => {
    haptics.heavyClick();
    toast.success('Draft submitted to CR review queue ✓', {
      description: 'Your CR will review and publish this to the section feed.'
    });
    await deleteShare(currentShare.id);
    await fetchShares();
  };

  const handleNext = () => {
    if (currentIndex < pendingShares.length - 1) {
      haptics.lightClick();
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      haptics.lightClick();
      setCurrentIndex(prev => prev - 1);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        left: 16,
        right: 16,
        maxWidth: 480,
        margin: '0 auto',
        zIndex: 1000,
        background: 'rgba(18, 21, 34, 0.94)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        borderRadius: 'var(--radius-lg, 16px)',
        padding: '12px 14px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45), 0 0 20px rgba(99, 102, 241, 0.2)',
        animation: 'fadeSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 12,
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: 'var(--accent-primary, #6366f1)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em'
          }}>
            <Sparkles size={12} /> SHARED INTAKE
          </div>
          {pendingShares.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  cursor: currentIndex === 0 ? 'default' : 'pointer', opacity: currentIndex === 0 ? 0.3 : 0.9,
                  padding: 2, display: 'flex', alignItems: 'center', outline: 'none',
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', padding: '0 2px' }}>
                {currentIndex + 1}/{pendingShares.length}
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex === pendingShares.length - 1}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  cursor: currentIndex === pendingShares.length - 1 ? 'default' : 'pointer', opacity: currentIndex === pendingShares.length - 1 ? 0.3 : 0.9,
                  padding: 2, display: 'flex', alignItems: 'center', outline: 'none',
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleDiscard}
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 6,
            color: 'var(--status-critical, #ef4444)',
            cursor: 'pointer',
            padding: '3px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 600,
            outline: 'none',
          }}
          title="Discard shared item"
          aria-label="Discard shared item"
        >
          <Trash2 size={13} />
          <span>Discard</span>
        </button>
      </div>

      {/* Item Details Content */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          {firstFile ? <FileText size={18} color="var(--accent-primary, #6366f1)" /> : <Megaphone size={18} color="var(--accent-primary, #6366f1)" />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {parsed.title || firstFile?.name || 'Shared Content'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {firstFile ? `${firstFile.name} ${fileCount > 1 ? `(+${fileCount - 1} files)` : ''}` : parsed.body}
          </p>
        </div>
      </div>

      {/* Smart Auto-Detection Badges Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {parsed.matchedSubjectName && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: 'rgba(52, 201, 123, 0.15)',
            color: 'var(--status-safe, #10b981)',
            border: '1px solid rgba(52, 201, 123, 0.3)',
            padding: '2px 6px', borderRadius: 5,
            display: 'flex', alignItems: 'center', gap: 3
          }}>
            {parsed.matchedSubjectName} ✨
          </span>
        )}

        {parsed.dueDate && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            background: 'rgba(56, 189, 248, 0.12)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            padding: '2px 6px', borderRadius: 5,
            display: 'flex', alignItems: 'center', gap: 3
          }}>
            <Clock size={10} /> Due: {new Date(parsed.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
          </span>
        )}

        {parsed.priority === 'critical' && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '2px 6px', borderRadius: 5,
            display: 'flex', alignItems: 'center', gap: 3
          }}>
            <AlertTriangle size={10} /> Urgent
          </span>
        )}
      </div>

      {/* Action Buttons */}
      {role === 'cr' || role === 'teacher' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 2 }}>
          <button
            onClick={handleOpenAnnouncement}
            style={{
              padding: '9px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--accent-primary, #6366f1)',
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
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
            }}
          >
            <Megaphone size={14} /> Announcement
          </button>
          <button
            onClick={handleOpenAssignment}
            style={{
              padding: '9px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-default, rgba(255, 255, 255, 0.12))',
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
              padding: '9px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--accent-primary, #6366f1)',
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
              padding: '9px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-default, rgba(255, 255, 255, 0.12))',
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
