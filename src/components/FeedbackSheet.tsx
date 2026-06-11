import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { supabase } from '../lib/supabase';
import { BottomSheet } from './BottomSheet';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';

interface FeedbackSheetProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackSheet({ open, onClose }: FeedbackSheetProps) {
  const authUser = useAppStore(s => s.authUser);
  const [type, setType] = useState<'bug' | 'feature_request' | 'feedback'>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    setSubmitting(true);
    try {
      // Harvest detailed environment diagnostics silently
      const device_info = {
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        connection: (navigator as any).connection?.effectiveType || 'unknown',
        pwaInstalled: window.matchMedia('(display-mode: standalone)').matches,
        currentPath: window.location.pathname,
        timestamp: new Date().toISOString(),
        devicePixelRatio: window.devicePixelRatio,
        language: navigator.language
      };

      const { error } = await (supabase as any).from('feedback_reports').insert({
        user_id: authUser?.id || undefined,
        type,
        title: title.trim(),
        description: description.trim(),
        device_info,
        status: 'pending'
      });

      if (error) throw error;

      setSuccess(true);
      toast.success('Transmission received! Thank you 🎉');
      
      setTimeout(() => {
        setSuccess(false);
        setTitle('');
        setDescription('');
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Submission failure:', err);
      toast.error(err.message || 'Transmission failed. Please check network.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="💬 Feedback & Bug Report">
      {success ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 10px', textAlign: 'center' }}>
          <CheckCircle2 size={48} color="#10B981" style={{ marginBottom: 16 }} />
          <h3 style={{ font: '600 18px var(--font-display)', color: 'var(--text-primary)', marginBottom: 8 }}>✓ Successfully Sent!</h3>
          <p style={{ font: '14px var(--font-mono)', color: 'var(--text-secondary)' }}>The developers have received your transmission.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Segmented monospaced tab buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ font: '600 11px var(--font-mono)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Select Category
            </label>
            <div style={{ display: 'flex', gap: 8, background: '#13131C', padding: 4, borderRadius: 8, border: '1px solid var(--border-default)' }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 4px',
                  borderRadius: 6,
                  font: '600 11px var(--font-mono)',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: type === 'bug' ? 'rgba(244, 63, 94, 0.1)' : 'transparent',
                  color: type === 'bug' ? '#FB7185' : 'var(--text-secondary)',
                  borderColor: type === 'bug' ? 'rgba(244, 63, 94, 0.3)' : 'transparent'
                }}
                onClick={() => setType('bug')}
              >
                🐛 BUG
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 4px',
                  borderRadius: 6,
                  font: '600 11px var(--font-mono)',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: type === 'feature_request' ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                  color: type === 'feature_request' ? '#C084FC' : 'var(--text-secondary)',
                  borderColor: type === 'feature_request' ? 'rgba(168, 85, 247, 0.3)' : 'transparent'
                }}
                onClick={() => setType('feature_request')}
              >
                💡 SUGGESTION
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 4px',
                  borderRadius: 6,
                  font: '600 11px var(--font-mono)',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: type === 'feedback' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  color: type === 'feedback' ? '#34D399' : 'var(--text-secondary)',
                  borderColor: type === 'feedback' ? 'rgba(16, 185, 129, 0.3)' : 'transparent'
                }}
                onClick={() => setType('feedback')}
              >
                💬 FEEDBACK
              </button>
            </div>
          </div>

          {/* Form fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="feedback-title" style={{ font: '600 11px var(--font-mono)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Subject Title
            </label>
            <input
              id="feedback-title"
              type="text"
              placeholder="e.g. Schedule is not showing the updated timetable room"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{
                background: '#13131C',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                padding: '12px 14px',
                font: '14px var(--font-mono)',
                color: 'var(--text-primary)',
                outline: 'none',
                width: '100%',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#8B5CF6'}
              onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="feedback-desc" style={{ font: '600 11px var(--font-mono)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Description & Reproduction
            </label>
            <textarea
              id="feedback-desc"
              rows={4}
              placeholder="Describe the issue or suggestion. For bugs, include steps to reproduce so we can isolate and patch it."
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{
                background: '#13131C',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                padding: '12px 14px',
                font: '14px var(--font-mono)',
                color: 'var(--text-primary)',
                outline: 'none',
                width: '100%',
                resize: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#8B5CF6'}
              onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
            />
          </div>

          {/* Premium monospaced submit action */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: '#8B5CF6',
              border: 'none',
              borderRadius: 8,
              padding: '14px 20px',
              font: '600 13px var(--font-mono)',
              color: '#FFFFFF',
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'opacity 0.2s, transform 0.1s',
              opacity: submitting ? 0.8 : 1,
            }}
            onMouseOver={e => !submitting && (e.currentTarget.style.opacity = '0.9')}
            onMouseOut={e => !submitting && (e.currentTarget.style.opacity = '1')}
          >
            {submitting ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                HARVESTING DIAGNOSTICS...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                SUBMIT TRANSMISSION
              </>
            )}
          </button>
        </form>
      )}
    </BottomSheet>
  );
}
