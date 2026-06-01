import { useState } from 'react';
import { Share2, X } from 'lucide-react';

const DISMISS_KEY = 'classhub-direct-share-tip-dismissed';

export default function DirectShareTip() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isAndroid = /android/i.test(window.navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    return isAndroid && isStandalone && localStorage.getItem(DISMISS_KEY) !== 'true';
  });

  if (!visible) return null;

  return (
    <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderColor: 'rgba(96,165,250,0.24)', background: 'rgba(96,165,250,0.07)' }}>
      <Share2 size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
      <p className="t-body" style={{ color: 'var(--text-secondary)', flex: 1 }}>
        From WhatsApp, tap Share -&gt; ClassHub to turn a faculty file into an announcement or assignment.
      </p>
      <button
        aria-label="Dismiss direct share tip"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, 'true');
          setVisible(false);
        }}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 2 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
