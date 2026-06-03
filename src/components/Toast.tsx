/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

let listeners: ((t: ToastItem) => void)[] = [];

export function showToast(
  message: string,
  type: ToastItem['type'] = 'info',
  options?: {
    duration?: number;
    action?: {
      label: string;
      onClick: () => void;
    };
  }
) {
  const id = Math.random().toString(36).slice(2);
  listeners.forEach(fn =>
    fn({
      id,
      type,
      message,
      duration: options?.duration,
      action: options?.action,
    })
  );
}

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const [isExiting, setIsExiting] = useState(false);
  const duration = toast.duration ?? 3000;

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200); // Wait for CSS exit animation to complete
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const dismissTimer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearTimeout(dismissTimer);
    };
  }, [duration, handleClose]);

  const handleActionClick = () => {
    if (toast.action?.onClick) {
      toast.action.onClick();
    }
    handleClose();
  };

  const icons = {
    success: <CheckCircle2 size={16} />,
    error: <AlertCircle size={16} />,
    info: <Info size={16} />,
    warning: <AlertTriangle size={16} />,
  };

  const progressColors = {
    success: 'var(--status-safe)',
    error: 'var(--status-critical)',
    warning: 'var(--status-warning)',
    info: 'var(--status-info)',
  };

  return (
    <div
      className={`toast toast-${toast.type}${isExiting ? ' exiting' : ''}`}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {icons[toast.type]}
      <span className="t-body-medium" style={{ flex: 1, color: 'var(--text-primary)' }}>
        {toast.message}
      </span>
      {toast.action && (
        <button
          onClick={handleActionClick}
          style={{
            background: 'rgba(74, 158, 255, 0.1)',
            border: '1px solid rgba(74, 158, 255, 0.3)',
            color: 'var(--accent-primary)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            font: 'inherit',
            fontSize: 12,
            fontWeight: 600,
            transition: 'all 0.2s',
            marginRight: '6px',
            minHeight: 'fit-content',
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={handleClose}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: '2px',
          display: 'flex',
        }}
        aria-label="Close"
      >
        <X size={14} />
      </button>

      {/* Progress countdown bar */}
      <div
        className="toast-progress-bar"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '3px',
          width: '100%',
          transformOrigin: 'left',
          backgroundColor: progressColors[toast.type],
          animation: `toastShrink ${duration}ms linear forwards`,
        }}
      />
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (t: ToastItem) => {
      setToasts(prev => [...prev.slice(-2), t]);
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter(l => l !== handler);
    };
  }, []);

  const handleDismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <ToastCard key={t.id} toast={t} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}
