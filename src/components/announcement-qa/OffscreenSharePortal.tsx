import React from 'react';
import { timeAgo } from '../Shared';
import { type Announcement } from '../../store/appStore';

interface OffscreenSharePortalProps {
  announcement: Announcement | null;
  domRef: React.RefObject<HTMLDivElement | null>;
}

function getPortalCategory(title: string, priority: 'critical' | 'general') {
  const t = (title || '').toLowerCase();
  
  if (priority === 'critical' || t.includes('urgent') || t.includes('attention') || t.includes('alert') || t.includes('important')) {
    return { name: 'Immediate Alert', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.5)' };
  }
  if (t.includes('exam') || t.includes('test') || t.includes('quiz') || t.includes('midterm') || t.includes('practical') || t.includes('mst') || t.includes('assessment') || t.includes('viva')) {
    return { name: 'Academic Exam', color: '#a78bfa', borderColor: 'rgba(167, 139, 250, 0.5)' };
  }
  if (t.includes('schedule') || t.includes('class') || t.includes('timing') || t.includes('timetable') || t.includes('slot') || t.includes('rescheduled') || t.includes('postponed')) {
    return { name: 'Schedule Change', color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.5)' };
  }
  return { name: 'General Announcement', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.5)' };
}

export function OffscreenSharePortal({ announcement, domRef }: OffscreenSharePortalProps) {
  if (!announcement) return null;

  const category = getPortalCategory(announcement.title, announcement.priority);

  return (
    <div
      ref={domRef}
      style={{
        position: 'absolute',
        top: '-9999px',
        left: '-9999px',
        width: '600px',
        padding: '28px',
        background: 'var(--bg-elevated, #151622)',
        border: `2px solid ${category.borderColor}`,
        borderRadius: 'var(--radius-lg, 16px)',
        color: 'var(--text-primary, #ffffff)',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. BRAND HEADER WATERMARK */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.08))', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/favicon.ico" alt="ClassHub" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, fontSize: '17px', letterSpacing: '0.05em', color: 'var(--text-primary, #fff)' }}>ClassHub</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span style={{ fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: category.color }}>
            {category.name}
          </span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>
            BETA SECTION P-2 | SKIT
          </span>
        </div>
      </div>

      {/* 2. TITLE & TIMESTAMP */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0', lineHeight: 1.3, color: 'var(--text-primary, #fff)' }}>
          {announcement.title}
        </h1>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          {timeAgo(announcement.postedAt)}
        </span>
      </div>

      {/* 3. FULL DESCRIPTION */}
      <p style={{ fontSize: '14.5px', lineHeight: 1.625, color: 'var(--text-primary, #fff)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {announcement.body}
      </p>

      {/* 4. ATTACHMENTS (If present) */}
      {announcement.attachments && announcement.attachments.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-default, rgba(255,255,255,0.08))', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, rgba(255,255,255,0.6))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📎 Attachments ({announcement.attachments.length})
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {announcement.attachments.map(att => (
              <div 
                key={att.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid var(--border-default, rgba(255,255,255,0.08))', 
                  borderRadius: 'var(--radius-sm, 6px)', 
                  padding: '8px 12px', 
                  fontSize: '12px',
                  color: 'var(--text-primary, #fff)'
                }}
              >
                <span style={{ fontWeight: 500 }}>{att.filename}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
