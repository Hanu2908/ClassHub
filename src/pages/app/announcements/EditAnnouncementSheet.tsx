import { useState, useEffect } from 'react';
import { BottomSheet } from '../../../components/BottomSheet';
import { useUpdateAnnouncement } from '../../../hooks/useAnnouncements';
import type { Announcement } from '../../../store/appStore';
import { toast } from 'sonner';

export function EditAnnouncementSheet({ open, announcement, onClose }: { open: boolean; announcement: Announcement | null; onClose: () => void }) {
  const updateAnn = useUpdateAnnouncement();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'general' | 'critical'>('general');
  const [targetBatch, setTargetBatch] = useState<'all' | '1' | '2'>('all');
  const [deadline, setDeadline] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const formatIsoForInput = (isoStr?: string | null) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title || '');
      setBody(announcement.body || '');
      setPriority(announcement.priority === 'critical' ? 'critical' : 'general');
      setTargetBatch((announcement.targetBatch as any) || 'all');
      setDeadline(formatIsoForInput(announcement.deadline));
      setExpiresAt(formatIsoForInput(announcement.expiresAt));
    }
  }, [announcement]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcement || !title.trim()) return;
    try {
      await updateAnn.mutateAsync({
        id: announcement.id,
        title: title.trim(),
        message: body.trim(),
        priority,
        targetBatch: targetBatch === 'all' ? null : targetBatch,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      toast.success('Announcement updated successfully! ✓');
      onClose();
    } catch {
      toast.error('Failed to update announcement');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    outline: 'none', fontSize: 13,
  };
  const labelStyle: React.CSSProperties = {
    color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600,
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Edit Announcement">
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 20px' }}>
        <div>
          <label style={labelStyle}>Title *</label>
          <input
            style={inputStyle}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Announcement title"
            required
          />
        </div>

        <div>
          <label style={labelStyle}>Body / Content</label>
          <textarea
            style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Announcement details & instructions..."
          />
        </div>

        {/* Priority & Target Group */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Priority</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setPriority('general')}
                style={{
                  flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                  border: priority === 'general' ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                  background: priority === 'general' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-elevated)',
                  color: priority === 'general' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', outline: 'none',
                }}
              >
                General
              </button>
              <button
                type="button"
                onClick={() => setPriority('critical')}
                style={{
                  flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                  border: priority === 'critical' ? '1px solid #ef4444' : '1px solid var(--border-default)',
                  background: priority === 'critical' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-elevated)',
                  color: priority === 'critical' ? '#ef4444' : 'var(--text-secondary)',
                  cursor: 'pointer', outline: 'none',
                }}
              >
                Critical 🚨
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Target Group</label>
            <select
              style={inputStyle}
              value={targetBatch}
              onChange={e => setTargetBatch(e.target.value as any)}
            >
              <option value="all">Full Section (All)</option>
              <option value="1">Group G1</option>
              <option value="2">Group G2</option>
            </select>
          </div>
        </div>

        {/* Deadline & Expiration */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Deadline Date-Time</label>
            <input
              type="datetime-local"
              style={inputStyle}
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Expiration Date-Time</label>
            <input
              type="datetime-local"
              style={inputStyle}
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={updateAnn.isPending}
          className="t-button"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px', background: updateAnn.isPending ? 'var(--bg-elevated)' : 'var(--accent-primary)',
            border: 'none', borderRadius: 'var(--radius-md)', cursor: updateAnn.isPending ? 'not-allowed' : 'pointer',
            color: updateAnn.isPending ? 'var(--text-muted)' : '#fff',
            transition: 'all 0.2s', marginTop: 8, fontWeight: 600,
          }}
        >
          {updateAnn.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </BottomSheet>
  );
}
