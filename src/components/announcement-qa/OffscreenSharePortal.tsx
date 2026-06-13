import React from 'react';
import { type Announcement } from '../../store/appStore';
import { isPreviewableImage } from '../../lib/utils/attachments';
import { useSection } from '../../hooks/useSectionMembers';

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

function getAbsoluteTimestamp(dateStr: string) {
  try {
    const date = new Date(dateStr);
    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    
    return `${day} ${month} · ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  } catch {
    return '';
  }
}

function BentoGridCollage({ images }: { images: any[] }) {
  if (images.length === 0) return null;
  
  if (images.length === 1) {
    return (
      <div style={{
        width: '100%',
        height: '320px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
        background: 'rgba(10, 12, 20, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <img
          src={images[0].signedUrl}
          alt={images[0].filename}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block'
          }}
        />
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        width: '100%',
        height: '240px'
      }}>
        {images.map((img, idx) => (
          <div key={img.id || idx} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-default, rgba(255,255,255,0.08))', background: 'rgba(10, 12, 20, 0.4)' }}>
            <img src={img.signedUrl} alt={img.filename} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ))}
      </div>
    );
  }

  if (images.length === 3) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: '8px',
        width: '100%',
        height: '280px'
      }}>
        {/* Left large featured image */}
        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-default, rgba(255,255,255,0.08))', background: 'rgba(10, 12, 20, 0.4)' }}>
          <img src={images[0].signedUrl} alt={images[0].filename} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        {/* Right stacked column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
          {images.slice(1, 3).map((img, idx) => (
            <div key={img.id || idx} style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-default, rgba(255,255,255,0.08))', background: 'rgba(10, 12, 20, 0.4)', height: '136px' }}>
              <img src={img.signedUrl} alt={img.filename} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4 or more images
  const displayImages = images.slice(0, 4);
  const extraCount = images.length - 4;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: '8px',
      width: '100%',
      height: '280px'
    }}>
      {displayImages.map((img, idx) => {
        const isFourth = idx === 3;
        return (
          <div 
            key={img.id || idx} 
            style={{ 
              position: 'relative',
              borderRadius: '12px', 
              overflow: 'hidden', 
              border: '1px solid var(--border-default, rgba(255,255,255,0.08))', 
              background: 'rgba(10, 12, 20, 0.4)' 
            }}
          >
            <img src={img.signedUrl} alt={img.filename} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            
            {isFourth && extraCount > 0 && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(10, 12, 20, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(3px)',
              }}>
                <span style={{
                  color: '#ffffff',
                  fontSize: '22px',
                  fontWeight: 700,
                  letterSpacing: '0.05em'
                }}>
                  +{extraCount} more
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OffscreenSharePortal({ announcement, domRef }: OffscreenSharePortalProps) {
  const { data: section } = useSection();

  if (!announcement) return null;

  const category = getPortalCategory(announcement.title, announcement.priority);

  const sectionText = section?.name 
    ? `SECTION ${section.name.toUpperCase()}` 
    : '';
  const institutionText = section?.college 
    ? section.college.toUpperCase() 
    : '';
  const watermarkText = [sectionText, institutionText].filter(Boolean).join(' | ');

  const imageAttachments = (announcement.attachments || []).filter(att => 
    isPreviewableImage(att.fileType, att.filename) && att.signedUrl
  );
  
  const nonImageAttachments = (announcement.attachments || []).filter(att => 
    !isPreviewableImage(att.fileType, att.filename)
  );

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
          {/* Circular Brand Icon */}
          <img 
            src="/app_icon.svg" 
            alt="ClassHub" 
            style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              objectFit: 'contain',
              display: 'block' 
            }} 
          />
          {/* Subtle brand name */}
          <span style={{ fontWeight: 600, fontSize: '13px', letterSpacing: '0.05em', color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>ClassHub</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span style={{ fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: category.color }}>
            {category.name}
          </span>
          {watermarkText && (
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>
              {watermarkText}
            </span>
          )}
        </div>
      </div>

      {/* 2. TITLE (Distinguished from brand header) */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0', lineHeight: 1.35, color: '#ffffff', letterSpacing: '-0.02em' }}>
          {announcement.title}
        </h1>
      </div>

      {/* 3. FULL DESCRIPTION */}
      <p style={{ fontSize: '14.5px', lineHeight: 1.625, color: 'var(--text-primary, #fff)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {announcement.body}
      </p>

      {/* 4. ATTACHMENTS (If present) */}
      {(imageAttachments.length > 0 || nonImageAttachments.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {imageAttachments.length > 0 && (
            <BentoGridCollage images={imageAttachments} />
          )}
          {nonImageAttachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {nonImageAttachments.map(att => (
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
          )}
        </div>
      )}

      {/* 5. TIMESTAMP AT THE BOTTOM */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', borderTop: '1px solid var(--border-default, rgba(255,255,255,0.04))', paddingTop: '12px', marginTop: '4px' }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
          {getAbsoluteTimestamp(announcement.postedAt)}
        </span>
      </div>
    </div>
  );
}

