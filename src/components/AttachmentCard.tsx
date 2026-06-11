import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, FileImage, FileCode, File, Loader2, ImageOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AnimatePresence } from 'motion/react';
import type { Attachment } from '../store/appStore';
import { isPreviewableImage } from '../lib/utils/attachments';
import { getThumbPath, decodeAtReducedResolution } from '../lib/utils/imageResize';

// ── Module-level cache ─────────────────────────────────────────────────────────
// Deduplicates signed URL requests across AttachmentCard instances.

interface CachedUrls {
  thumbUrl: string;    // Thumbnail URL (or original URL if no thumbnail exists)
  fullUrl: string;     // Original full-resolution URL
  hasThumb: boolean;   // True when a real thumbnail was found
  expiresAt: number;
}
const signedUrlCache = new Map<string, CachedUrls>();

interface AttachmentCardProps {
  attachment: Attachment;
  pageNumber?: string;
}

// Lazy load the ImageZoomModal component
const ImageZoomModal = React.lazy(() => import('./ImageZoomModal'));

export const AttachmentCard = React.memo(function AttachmentCard({ attachment, pageNumber }: AttachmentCardProps) {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [previewState, setPreviewState] = useState<{
    thumbUrl: string | null;
    fullUrl: string | null;
    hasThumb: boolean;
    error: boolean;
    loading: boolean;
  }>({
    thumbUrl: null,
    fullUrl: null,
    hasThumb: false,
    error: false,
    loading: false
  });
  const [showZoomModal, setShowZoomModal] = useState(false);
  
  // GPU animation tracking state
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Option D: downscaled object URL for legacy images (no thumbnail)
  const downscaledUrlRef = useRef<string | null>(null);
  const [cardDisplayUrl, setCardDisplayUrl] = useState<string | null>(null);

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

  // 2. Two-tier signed URL fetcher: thumbnail first, fallback to original
  useEffect(() => {
    if (!isImage || !isVisible) return;

    let cancelled = false;

    // Check module cache first
    const cached = signedUrlCache.get(attachment.storagePath);
    if (cached && cached.expiresAt > Date.now()) {
      setPreviewState({
        thumbUrl: cached.thumbUrl,
        fullUrl: cached.fullUrl,
        hasThumb: cached.hasThumb,
        error: false,
        loading: false,
      });
      setCardDisplayUrl(cached.thumbUrl);
      return;
    }

    setPreviewState(prev => ({ ...prev, loading: true }));

    const fetchUrls = async () => {
      const expiresAt = Date.now() + 3500 * 1000; // Slightly before 3600s token expiry

      // Step 1: Try to get thumbnail signed URL
      const thumbPath = getThumbPath(attachment.storagePath);
      const { data: thumbData, error: thumbError } = await supabase.storage
        .from('attachments')
        .createSignedUrl(thumbPath, 3600);

      if (cancelled) return;

      // Step 2: Get the original URL (always needed for modal / fallback)
      const { data: fullData, error: fullError } = await supabase.storage
        .from('attachments')
        .createSignedUrl(attachment.storagePath, 3600);

      if (cancelled) return;

      if (fullError || !fullData?.signedUrl) {
        // Can't even get the original — error state
        setPreviewState({ thumbUrl: null, fullUrl: null, hasThumb: false, error: true, loading: false });
        return;
      }

      const fullUrl = fullData.signedUrl;
      const hasThumb = !thumbError && !!thumbData?.signedUrl;
      const thumbUrl = hasThumb ? thumbData!.signedUrl : fullUrl;

      // Cache result
      signedUrlCache.set(attachment.storagePath, { thumbUrl, fullUrl, hasThumb, expiresAt });

      setPreviewState({ thumbUrl, fullUrl, hasThumb, error: false, loading: false });
      setCardDisplayUrl(thumbUrl);
    };

    fetchUrls().catch(() => {
      if (!cancelled) {
        setPreviewState({ thumbUrl: null, fullUrl: null, hasThumb: false, error: true, loading: false });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [attachment.storagePath, isImage, isVisible]);

  // 3. Option D: decode-time downscale for legacy images (no thumbnail found)
  useEffect(() => {
    if (!isImageLoaded || previewState.hasThumb || !previewState.fullUrl) return;
    // Only apply when card is showing the full-res original (no thumb available)
    if (previewState.thumbUrl !== previewState.fullUrl) return;

    let cancelled = false;

    decodeAtReducedResolution(previewState.fullUrl).then((downscaledUrl) => {
      if (cancelled) return;
      // Only swap if we got a different (downscaled) URL
      if (downscaledUrl !== previewState.fullUrl) {
        downscaledUrlRef.current = downscaledUrl;
        setCardDisplayUrl(downscaledUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isImageLoaded, previewState.hasThumb, previewState.fullUrl, previewState.thumbUrl]);

  // Cleanup downscaled object URL on unmount
  useEffect(() => {
    return () => {
      if (downscaledUrlRef.current) {
        URL.revokeObjectURL(downscaledUrlRef.current);
      }
    };
  }, []);

  const handleCardClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isImage && previewState.thumbUrl) {
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
  }, [isImage, previewState.thumbUrl, downloading, attachment, pageNumber, navigate]);

  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (downloading) return;
    setDownloading(true);

    try {
      const { data, error } = await supabase.storage.from('attachments').createSignedUrl(attachment.storagePath, 60, {
        download: attachment.filename
      });
      if (error) throw error;
      if (data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = attachment.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('[AttachmentCard] Failed to download file:', err);
      alert('Failed to download file.');
    } finally {
      setDownloading(false);
    }
  }, [downloading, attachment]);

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

  // Determine standard preview styling based on image loading
  const getImagePreviewStyle = (): React.CSSProperties => {
    return {
      width: '100%',
      height: '100%',
      maxHeight: '380px',
      objectFit: 'contain',
      display: 'block'
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
          transition: 'background-color var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast)',
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
              maxHeight: '380px',
              minHeight: isImageLoaded ? '120px' : '200px',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: 'rgba(10, 12, 20, 0.55)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            {/* Absolute-positioned loader centered inside the container */}
            {(previewState.loading || (cardDisplayUrl && !isImageLoaded && !previewState.error)) && (
              <div style={{ 
                position: 'absolute',
                inset: 0,
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: 8, 
                color: 'var(--text-secondary)',
                background: 'rgba(10, 12, 20, 0.55)',
                zIndex: 1
              }}>
                <Loader2 className="animate-spin" size={20} />
                <span className="t-mono-sm">Loading preview…</span>
              </div>
            )}

            {cardDisplayUrl && !previewState.error ? (
              <img 
                src={cardDisplayUrl} 
                alt={attachment.filename} 
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                onLoad={() => setIsImageLoaded(true)}
                onError={() => setPreviewState(prev => ({ ...prev, error: true }))}
                style={{
                  ...getImagePreviewStyle(),
                  opacity: isImageLoaded ? 1 : 0,
                  transition: 'opacity 0.22s ease-in-out'
                }}
              />
            ) : (
              !previewState.loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                  <ImageOff size={22} />
                  <span className="t-mono-sm">Preview unavailable</span>
                </div>
              )
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
              onClick={handleDownload}
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
                transition: 'background-color var(--transition-fast), color var(--transition-fast)',
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

      <AnimatePresence>
        {showZoomModal && previewState.thumbUrl && (
          <React.Suspense fallback={
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }}>
              <Loader2 className="animate-spin" color="#fff" size={32} />
            </div>
          }>
            <ImageZoomModal
              thumbUrl={previewState.thumbUrl}
              fullUrl={previewState.fullUrl || previewState.thumbUrl}
              onClose={() => setShowZoomModal(false)}
            />
          </React.Suspense>
        )}
      </AnimatePresence>
    </>
  );
});
