import { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { BottomSheet } from '../../../components/BottomSheet';
import { useSection } from '../../../hooks/useSectionMembers';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase';

export function SendNotificationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const { data: section } = useSection();

  const draftLoadedRef = useRef(false);

  // Load draft from localStorage on mount (when sheet opens)
  useEffect(() => {
    if (open) {
      if (draftLoadedRef.current) return;
      draftLoadedRef.current = true;
      const saved = localStorage.getItem('classhub-draft-announcement');
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          const hasDraftContent = !!(draft.title?.trim() || draft.body?.trim());
          const isStateEmpty = !title && !body;

          if (draft.title) setTitle(draft.title);
          if (draft.body) setBody(draft.body);

          if (hasDraftContent && isStateEmpty) {
            toast.success('Draft recovered! ✓');
          }
        } catch (e) {
          console.error('Failed to parse draft', e);
        }
      }
    } else {
      draftLoadedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Save draft to localStorage on fields change
  useEffect(() => {
    if (open) {
      const draft = { title, body };
      if (title.trim() || body.trim()) {
        localStorage.setItem('classhub-draft-announcement', JSON.stringify(draft));
      } else {
        localStorage.removeItem('classhub-draft-announcement');
      }
    }
  }, [title, body, open]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    outline: 'none',
  };

  const handleSend = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!body.trim())  { toast.error('Message body is required'); return; }
    if (!section?.id) return;
    setSending(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Not authenticated');

      const { data: pushData, error: pushErr } = await supabase.functions.invoke('send-custom-notification', {
        body: { title: title.trim(), body: body.trim(), sectionId: section.id },
      });

      if (pushErr) {
        console.error('[Notify] Push failed:', pushErr);
        toast.warning('Notification sent to bell icon! Push delivery failed.');
      } else if (pushData && !pushData.error) {
        const { sent, failed } = pushData;
        if (sent === 0 && failed > 0) {
          toast.warning('Notification sent to bell icon! Push delivery failed for all.');
        } else if (sent > 0 && failed > 0) {
          toast.success(`Notification sent! Push delivered to ${sent} (${failed} failed).`);
        } else if (sent > 0) {
          toast.success(`Notification sent! Push delivered to ${sent} students.`);
        } else {
          toast.success('Notification sent! (No active subscriptions found)');
        }
      } else if (pushData?.error) {
        console.error('[Notify] Edge function error:', pushData.error);
        toast.error(`Failed: ${pushData.error}`);
      } else {
        toast.success('Notification sent!');
      }
      localStorage.removeItem('classhub-draft-announcement');
      setTitle('');
      setBody('');
      onClose();
    } catch (err) {
      console.error('[Notify] Send failed:', err);
      toast.error('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Send Notification">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
        <div>
          <label className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Title *</label>
          <input id="notif-title" style={inputStyle} placeholder="e.g. Important update" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Message *</label>
          <textarea id="notif-body" style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Write your message to the class…" value={body} onChange={e => setBody(e.target.value)} />
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
          {sending ? 'Sending…' : 'Send Notification'}
        </button>
      </div>
    </BottomSheet>
  );
}
