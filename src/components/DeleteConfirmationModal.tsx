import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

interface DeleteConfirmationProps {
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmationModal({ onClose, onConfirm }: DeleteConfirmationProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Autofocus Cancel first
  useEffect(() => {
    cancelBtnRef.current?.focus();
  }, [isMobile]);

  // Escape key down listener for desktop modal
  useEffect(() => {
    if (isMobile) return;
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Tab' && containerRef.current) {
        const focusable = containerRef.current.querySelectorAll('button');
        const first = focusable[0] as HTMLElement;
        const last = focusable[focusable.length - 1] as HTMLElement;
        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [isMobile, onClose]);

  const messageText = (
    <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
      Are you sure you want to delete this announcement? This will permanently remove the announcement and all associated read receipts and acknowledgment tracking data. This action <strong style={{ color: 'var(--status-critical)' }}>cannot be undone</strong>.
    </p>
  );

  if (isMobile) {
    return (
      <BottomSheet onClose={onClose} title="Confirm Deletion">
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

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.85)',
        padding: 20
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        style={{
          background: '#161824', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, width: '100%', maxWidth: 440, overflow: 'hidden',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
          <span id="confirm-delete-title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Confirm Deletion</span>
          <button onClick={onClose} aria-label="Close dialog" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
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
        </div>
      </div>
    </div>,
    document.body
  );
}
