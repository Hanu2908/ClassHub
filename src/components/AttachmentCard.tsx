import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, FileImage, FileCode, File, Loader2, ImageOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Attachment } from '../store/appStore';
import { isPreviewableImage } from '../lib/utils/attachments';

// Module-level cache to deduplicate signed URLs across AttachmentCards
interface CachedUrl {
  url: string;
  expiresAt: number;
}
const signedUrlCache = new Map<string, CachedUrl>();

interface AttachmentCardProps {
  attachment: Attachment;
  pageNumber?: string;
}

// Lazy load the ImageZoomModal component
const ImageZoomModal = React.lazy(() => import('./ImageZoomModal'));

export const AttachmentCard = React.memo(function AttachmentCard({ attachment, pageNumber }: AttachmentCardProps) {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [previewState, setPreviewState] = useState<{ url: string | null; error: boolean; loading: boolean }>({
    url: null,
    error: false,
    loading: false
  });
  const [showZoomModal, setShowZoomModal] = useState(false);
  
  // Dynamic image layout properties
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | null>(null);

  // Intersection Observer elements
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const isImage = isPreviewableImage(attachment.fileType, attachment.filename);

  // 1. Intersection Observer hook to observe when card enters viewport
  useEffect(() => {
    if (!isImage) return;

    const currentEl = cardRef.current;
    if (!currentEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target); // Unobserve after first intersection
          }
        });
      },
      { rootMargin: '200px', threshold: 0 }
    );

    observer.observe(currentEl);
    return () => {
      if (currentEl) {
        observer.unobserve(currentEl);
      }
    };
  }, [isImage]);

  // 2. signedUrl Cache and fetcher gated by visibility
  useEffect(() => {
    if (!isImage || !isVisible) return;

    let cancelled = false;

    // Check module cache first
    const cached = signedUrlCache.get(attachment.storagePath);
    if (cached && cached.expiresAt > Date.now()) {
      setPreviewState({ url: cached.url, error: false, loading: false });
      return;
    }

    setPreviewState(prev => ({ ...prev, loading: true }));

    supabase.storage.from('attachments').createSignedUrl(attachment.storagePath, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          setPreviewState({ url: null, error: true, loading: false });
        } else {
          // Set to module cache (3500 seconds TTL slightly before 3600 seconds token expiry)
          signedUrlCache.set(attachment.storagePath, {
            url: data.signedUrl,
            expiresAt: Date.now() + 3500 * 1000
          });
          setPreviewState({ url: data.signedUrl, error: false, loading: false });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPreviewState({ url: null, error: true, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [attachment.storagePath, isImage, isVisible]);

  const handleCardClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isImage && previewState.url) {
      setShowZoomModal(true);
      return;
    }

    if (downloading) return;
    setDownloading(true);

    try {
      const { data, error } = await supabase.storage.from('attachments').createSignedUrl(attachment.storagePath, 60);
      if (error) throw error;
      if (data?.signedUrl) {
        const isPDF = attachment.fileType.toLowerCase().includes('pdf') || attachment.filename.toLowerCase().endsWith('.pdf');
        if (isPDF) {
          const firstPage = pageNumber ? (pageNumber.match(/\d+/)?.[0] || '1') : '1';
          navigate(`/app/pdf-viewer?url=${encodeURIComponent(data.signedUrl)}&page=${firstPage}&range=${encodeURIComponent(pageNumber || '')}&title=${encodeURIComponent(attachment.filename)}`);
        } else {
          window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (err) {
      console.error('[AttachmentCard] Failed to download:', err);
      alert('Failed to retrieve file.');
    } finally {
      setDownloading(false);
    }
  };

  const getFileIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('pdf')) return <FileText size={20} style={{ color: '#F87171' }} />;
    if (t.includes('image')) return <FileImage size={20} style={{ color: '#34D399' }} />;
    if (t.includes('csv') || t.includes('sheet') || t.includes('excel')) return <FileCode size={20} style={{ color: '#FBBF24' }} />;
    if (t.includes('json') || t.includes('javascript') || t.includes('typescript') || t.includes('css')) return <FileCode size={20} style={{ color: '#60A5FA' }} />;
    return <File size={20} style={{ color: '#22D3EE' }} />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setOrientation(naturalHeight >= naturalWidth ? 'portrait' : 'landscape');
  };

  // Determine standard preview styling based on image loading & orientation states
  const getImagePreviewStyle = (): React.CSSProperties => {
    const common: React.CSSProperties = {
      width: '100%',
      display: 'block'
    };

    if (orientation === 'portrait') {
      return {
        ...common,
        maxHeight: '400px',
        height: 'auto',
        objectFit: 'contain'
      };
    } else if (orientation === 'landscape') {
      return {
        ...common,
        maxHeight: '280px',
        height: 'auto',
        objectFit: 'contain'
      };
    }
    
    return {
      ...common,
      height: '100%',
      objectFit: 'cover'
    };
  };

  return (
    <>
      <div 
        ref={cardRef}
        onClick={handleCardClick}
        className="attachment-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          padding: isImage ? '0' : '10px 14px',
          background: isImage ? 'transparent' : 'rgba(255, 255, 255, 0.03)',
          border: isImage ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
          userSelect: 'none',
          gap: isImage ? '0' : '12px'
        }}
        onMouseEnter={(e) => {
          if (!isImage) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.3)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isImage) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.transform = 'none';
          }
        }}
      >
        {isImage ? (
          <div 
            style={{
              width: '100%',
              minHeight: orientation ? 'auto' : '120px',
              maxHeight: orientation === 'portrait' ? 400 : 280,
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: 'rgba(10, 12, 20, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all var(--transition-base)',
            }}
          >
            {previewState.url && !previewState.error ? (
              <img 
                src={previewState.url} 
                alt={attachment.filename} 
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                onLoad={handleImageLoad}
                onError={() => setPreviewState({ url: null, error: true, loading: false })}
                style={getImagePreviewStyle()}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', padding: '24px 0' }}>
                {previewState.loading ? <Loader2 className="animate-spin" size={20} /> : <ImageOff size={22} />}
                <span className="t-mono-sm">{previewState.loading ? 'Loading preview' : 'Preview unavailable'}</span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
              {getFileIcon(attachment.fileType)}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span className="t-body-medium" style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {attachment.filename}
                </span>
                <span className="t-mono-sm" style={{ color: 'var(--text-secondary)' }}>
                  {formatSize(attachment.fileSize)}
                </span>
              </div>
            </div>
            <button
              type="button" 
              disabled={downloading} 
              aria-label={`Download ${attachment.filename}`}
              style={{
                background: 'none',
                border: 'none',
                padding: '6px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRadius: '50%',
                transition: 'all var(--transition-fast)',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            </button>
          </div>
        )}
      </div>

      {showZoomModal && previewState.url && (
        <React.Suspense fallback={
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }}>
            <Loader2 className="animate-spin" color="#fff" size={32} />
          </div>
        }>
          <ImageZoomModal url={previewState.url} onClose={() => setShowZoomModal(false)} />
        </React.Suspense>
      )}
    </>
  );
});
