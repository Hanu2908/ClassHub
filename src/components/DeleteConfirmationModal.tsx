import { useState, useEffect, useRef } from 'react';
import { BottomSheet } from './BottomSheet';
import { Dialog } from './ui/Dialog';

interface DeleteConfirmationProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmationModal({ open, onClose, onConfirm }: DeleteConfirmationProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Autofocus Cancel first on mount/render
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, isMobile]);

  const messageText = (
    <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
      Are you sure you want to delete this announcement? This will permanently remove the announcement and all associated read receipts and acknowledgment tracking data. This action <strong style={{ color: 'var(--status-critical)' }}>cannot be undone</strong>.
    </p>
  );

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={onClose} title="Confirm Deletion">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 24 }}>
          {messageText}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              ref={cancelBtnRef}
              onClick={onClose}
              style={{
                width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer',
                transition: 'background var(--transition-fast)'
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              style={{
                width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                background: 'var(--status-critical)', border: 'none',
                color: '#fff', fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(248, 113, 113, 0.2)',
                transition: 'background var(--transition-fast)'
              }}
            >
              Delete Announcement
            </button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }} title="Confirm Deletion">
      <div style={{ marginBottom: 20 }}>
        {messageText}
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button
          ref={cancelBtnRef}
          onClick={onClose}
          style={{
            padding: '8px 16px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: '8px 16px', borderRadius: 8,
            background: 'var(--status-critical)', border: 'none',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(248, 113, 113, 0.2)'
          }}
        >
          Delete
        </button>
      </div>
    </Dialog>
  );
}
