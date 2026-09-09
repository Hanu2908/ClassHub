import React, { useState, useEffect } from 'react';
import { Clock, Image } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import type { Announcement } from '../../../store/appStore';
import { isPreviewableImage, signedUrlCache } from '../../../lib/utils/attachments';



export function TimelineSection({ title, count }: { title: string; count: number }) {
  return (
    <div style={{
      position: 'sticky',
      top: '150px',
      zIndex: 10,
      background: 'rgba(13, 15, 20, 0.95)',
      backdropFilter: 'blur(12px)',
      padding: '10px 16px',
      margin: '0 -16px 8px -16px',
      borderBottom: '1px solid var(--border-default)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <span className="t-label" style={{ 
        color: 'var(--text-primary)', 
        fontWeight: 600, 
        letterSpacing: '0.05em',
        fontSize: '12px',
        textTransform: 'uppercase'
      }}>
        {title}
      </span>
      <span className="t-mono-sm" style={{
        background: 'var(--bg-elevated)',
        color: 'var(--text-muted)',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '12px',
        fontWeight: 500,
      }}>
        {count} {count === 1 ? 'announcement' : 'announcements'}
      </span>
    </div>
  );
}

export function CountdownTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTime = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        onExpire();
        return;
      }
      const h = Math.floor(diff / (3600 * 1000));
      const m = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
      const s = Math.floor((diff % (60 * 1000)) / 1000);

      if (h > 0) {
        setTimeLeft(`${h}h ${m}m ${s}s left`);
      } else if (m > 0) {
        setTimeLeft(`${m}m ${s}s left`);
      } else {
        setTimeLeft(`${s}s left`);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 8px',
      borderRadius: 'var(--radius-pill)',
      background: 'rgba(239, 68, 68, 0.15)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      color: '#ef4444',
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: '12px',
      fontWeight: 600,
    }}>
      <Clock size={11} className="animate-pulse" style={{ animation: 'pulse 1.5s infinite' }} />
      <span>{timeLeft}</span>
    </div>
  );
}

export function AnnouncementsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '18px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={90} height={16} borderRadius="var(--radius-pill)" />
            <Skeleton width={60} height={12} />
          </div>
          <Skeleton width="75%" height={18} style={{ margin: '4px 0 6px' }} />
          <Skeleton width="95%" height={13} style={{ marginBottom: 4 }} />
          <Skeleton width="80%" height={13} />
        </div>
      ))}
    </div>
  );
}

export interface ShareOptionsContentProps {
  ann: Announcement;
  onShareNotice: () => void;
  onSharePhotos: () => void;
  isSharingPhotos: boolean;
  selectedPhotos: string[];
  setSelectedPhotos: React.Dispatch<React.SetStateAction<string[]>>;
}

export function ShareOptionsContent({
  ann,
  onShareNotice,
  onSharePhotos,
  isSharingPhotos,
  selectedPhotos,
  setSelectedPhotos,
}: ShareOptionsContentProps) {
  const shareImages = ann.attachments?.filter(att => isPreviewableImage(att.fileType, att.filename)) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <button 
        onClick={onShareNotice}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s',
          color: '#fff',
          outline: 'none'
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
      >
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-primary)',
          flexShrink: 0
        }}>
          <Image size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ font: '600 14px var(--font-display)', margin: '0 0 2px', color: 'var(--text-primary)' }}>Share Notice Card</p>
          <p style={{ font: '400 11px var(--font-body)', color: 'var(--text-secondary)', margin: 0 }}>Generates a premium image combining notice text and images.</p>
        </div>
      </button>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        borderTop: '1px solid var(--border-default)',
        paddingTop: '20px',
        textAlign: 'left'
      }}>
        <p style={{ font: '600 14px var(--font-display)', margin: 0, color: 'var(--text-primary)' }}>Share Photos Directly</p>
        <p style={{ font: '400 11px var(--font-body)', color: 'var(--text-secondary)', margin: '0 0 8px' }}>Select which attachment photos to share directly to WhatsApp.</p>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          marginBottom: '8px'
        }}>
          {shareImages.map(img => {
            const isSelected = selectedPhotos.includes(img.id);
            const cached = signedUrlCache.get(img.storagePath);
            const url = cached?.thumbUrl || cached?.fullUrl || '';
            
            return (
              <div 
                key={img.id}
                onClick={() => {
                  setSelectedPhotos(prev => 
                    prev.includes(img.id) 
                      ? prev.filter(id => id !== img.id) 
                      : [...prev, img.id]
                  );
                }}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  background: 'rgba(255,255,255,0.03)',
                  boxSizing: 'border-box'
                }}
              >
                {url ? (
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222' }}>
                    <Image size={16} color="var(--text-muted)" />
                  </div>
                )}
                
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  border: '1.5px solid #fff',
                  background: isSelected ? 'var(--accent-primary)' : 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {isSelected && '✓'}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onSharePhotos}
          disabled={isSharingPhotos || selectedPhotos.length === 0}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            background: selectedPhotos.length === 0 ? 'var(--bg-elevated)' : 'var(--accent-primary)',
            border: 'none',
            color: selectedPhotos.length === 0 ? 'var(--text-muted)' : '#fff',
            cursor: selectedPhotos.length === 0 ? 'default' : 'pointer',
            fontWeight: 600,
            fontSize: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: selectedPhotos.length === 0 ? 'none' : '0 4px 14px rgba(74, 158, 255, 0.3)',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          {isSharingPhotos ? 'Preparing Photos...' : `Share Selected Photos (${selectedPhotos.length})`}
        </button>
      </div>
    </div>
  );
}
