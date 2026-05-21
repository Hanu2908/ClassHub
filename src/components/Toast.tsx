/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

interface ToastItem { id: string; type: 'success'|'error'|'info'|'warning'; message: string; }

let listeners: ((t: ToastItem) => void)[] = [];

export function showToast(message: string, type: ToastItem['type'] = 'info') {
  const id = Math.random().toString(36).slice(2);
  listeners.forEach(fn => fn({ id, type, message }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (t: ToastItem) => {
      setToasts(prev => [...prev.slice(-2), t]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3000);
    };
    listeners.push(handler);
    return () => { listeners = listeners.filter(l => l !== handler); };
  }, []);

  const icons = {
    success: <CheckCircle2 size={16} />,
    error: <AlertCircle size={16} />,
    info: <Info size={16} />,
    warning: <AlertTriangle size={16} />,
  };

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {icons[t.type]}
          <span className="t-body-medium" style={{ flex: 1, color: 'var(--text-primary)' }}>{t.message}</span>
          <button
            onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}
            style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'2px',display:'flex' }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
