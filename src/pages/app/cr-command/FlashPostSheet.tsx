import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { BottomSheet } from '../../../components/BottomSheet';
import { useCreateAnnouncement } from '../../../hooks/useAnnouncements';
import { toast } from 'sonner';

export function FlashPostSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [timer, setTimer] = useState<string>('30m'); // 30m, 1h, 3h, 6h
  const [customHours, setCustomHours] = useState('');
  
  const createAnnouncement = useCreateAnnouncement();

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    outline: 'none',
  };

  const handleSend = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!body.trim())  { toast.error('Message body is required'); return; }
    
    let hoursToAdd = 0.5;
    if (timer === '30m') hoursToAdd = 0.5;
    else if (timer === '1h') hoursToAdd = 1;
    else if (timer === '3h') hoursToAdd = 3;
    else if (timer === '6h') hoursToAdd = 6;
    else if (timer === 'custom') {
      const parsed = parseFloat(customHours);
      if (isNaN(parsed) || parsed <= 0) { toast.error('Invalid custom hours'); return; }
      hoursToAdd = parsed;
    }

    const expiresAt = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000).toISOString();

    try {
      await createAnnouncement.mutateAsync({
        title: title.trim(),
        message: body.trim(),
        priority: 'critical', // We'll map 'critical' with 'expires_at' as Flash Post
        expiresAt: expiresAt,
      });
      toast.success('Flash Post published!');
      onClose();
    } catch (err) {
      console.error('[FlashPost] Send failed:', err);
      toast.error('Failed to publish Flash Post');
    }
  };

  const sending = createAnnouncement.isPending;

  return (
    <BottomSheet open={open} onClose={onClose} title="Send Flash Post">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
        <div>
          <label className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Title *</label>
          <input id="notif-title" style={inputStyle} placeholder="e.g. Class Cancelled" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Message *</label>
          <textarea id="notif-body" style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Write your message…" value={body} onChange={e => setBody(e.target.value)} />
        </div>
        <div>
          <label className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Expiry Timer</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['30m', '1h', '3h', '6h', 'custom'].map(t => (
              <button
                key={t}
                onClick={() => setTimer(t)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: timer === t ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                  background: timer === t ? 'var(--accent-primary-glow)' : 'var(--bg-elevated)',
                  color: timer === t ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                {t === 'custom' ? 'Custom' : t}
              </button>
            ))}
          </div>
          {timer === 'custom' && (
            <div style={{ marginTop: 8 }}>
              <input type="number" step="0.5" min="0.5" placeholder="Hours (e.g. 1.5)" style={inputStyle} value={customHours} onChange={e => setCustomHours(e.target.value)} />
            </div>
          )}
        </div>
        <button
          id="send-notif-btn"
          onClick={handleSend}
          disabled={sending} className="t-button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px', background: sending ? 'var(--bg-elevated)' : 'var(--accent-primary)',
            border: 'none', borderRadius: 'var(--radius-md)', cursor: sending ? 'not-allowed' : 'pointer',
            color: sending ? 'var(--text-muted)' : '#fff',
            transition: 'all 0.2s', marginTop: 10 }}
        >
          {sending ? (
            <Loader2 className="animate-spin" size={15} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Send size={15} />
          )}
          {sending ? 'Sending…' : 'Publish Flash Post'}
        </button>
      </div>
    </BottomSheet>
  );
}
