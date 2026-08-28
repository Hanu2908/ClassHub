import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, FileImage, FileCode, File, Loader2, ImageOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AnimatePresence } from 'motion/react';
import type { Attachment } from '../store/appStore';
import { isPreviewableImage, signedUrlCache } from '../lib/utils/attachments';
import { getThumbPath, decodeAtReducedResolution } from '../lib/utils/imageResize';

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
  const [qualityMode, setQualityMode] = useState<'SD' | 'HD'>('SD');
  const [showZoomModal, setShowZoomModal] = useState(false);
  
  // GPU animation tracking state
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Reset loaded state when qualityMode changes to trigger fresh image load
  useEffect(() => {
    setIsImageLoaded(false);
  }, [qualityMode]);

  // Option D: downscaled object URL for legacy images (no thumbnail)
  const downscaledUrlRef = useRef<string | null>(null);
  const [cardDisplayUrl, setCardDisplayUrl] = useState<string | null>(null);

  // Intersection Observer elements
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  const isImage = isPreviewableImage(attachment.fileType, attachment.filename);
  const isPdf = attachment.fileType.toLowerCase().includes('pdf') || attachment.filename.toLowerCase().endsWith('.pdf');
  const isPreviewable = isImage || isPdf;

  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const [hasPdfThumb, setHasPdfThumb] = useState(false);
  const [cachedThumbDataUrl, setCachedThumbDataUrl] = useState<string | null>(null);

  // Check 0ms IndexedDB & Memory thumbnail cache on mount
  useEffect(() => {
    if (!isPdf) return;
    let cancelled = false;
    import('../lib/utils/thumbnailCache').then(({ getCachedThumbnail }) => {
      getCachedThumbnail(attachment.storagePath).then((cached) => {
        if (!cancelled && cached) {
          setCachedThumbDataUrl(cached);
          setHasPdfThumb(true);
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [attachment.storagePath, isPdf]);

  // 1. Intersection Observer hook to observe when card enters viewport
  useEffect(() => {
    if (!isPreviewable) return;

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
  }, [isPreviewable]);

  // 2. Signed URL fetcher & PDF 1st page thumbnail renderer
  useEffect(() => {
    if (!isPreviewable || !isVisible) return;

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

      const { data: fullData, error: fullError } = await supabase.storage
        .from('attachments')
        .createSignedUrl(attachment.storagePath, 3600);

      if (cancelled) return;

      if (fullError || !fullData?.signedUrl) {
        setPreviewState({ thumbUrl: null, fullUrl: null, hasThumb: false, error: true, loading: false });
        return;
      }

      const fullUrl = fullData.signedUrl;

      if (isImage) {
        const thumbPath = getThumbPath(attachment.storagePath);
        const { data: thumbData, error: thumbError } = await supabase.storage
          .from('attachments')
          .createSignedUrl(thumbPath, 3600);

        if (cancelled) return;

        const hasThumb = !thumbError && !!thumbData?.signedUrl;
        const thumbUrl = hasThumb ? thumbData!.signedUrl : fullUrl;

        signedUrlCache.set(attachment.storagePath, { thumbUrl, fullUrl, hasThumb, expiresAt });
        setPreviewState({ thumbUrl, fullUrl, hasThumb, error: false, loading: false });
        setCardDisplayUrl(thumbUrl);
      } else {
        signedUrlCache.set(attachment.storagePath, { thumbUrl: fullUrl, fullUrl, hasThumb: false, expiresAt });
        setPreviewState({ thumbUrl: fullUrl, fullUrl, hasThumb: false, error: false, loading: false });
      }
    };

    fetchUrls().catch(() => {
      if (!cancelled) {
        setPreviewState({ thumbUrl: null, fullUrl: null, hasThumb: false, error: true, loading: false });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [attachment.storagePath, isImage, isPdf, isPreviewable, isVisible]);

  // 3. Render PDF 1st-page thumbnail onto canvas (50ms execution delay to preserve 60fps scroll)
  useEffect(() => {
    if (!isPdf || cachedThumbDataUrl || !previewState.fullUrl || !pdfCanvasRef.current) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      import('../lib/utils/pdfThumbnail').then(({ renderPDFThumbnail }) => {
        if (cancelled || !pdfCanvasRef.current || !previewState.fullUrl) return;
        renderPDFThumbnail(previewState.fullUrl, pdfCanvasRef.current, 180).then((success) => {
          if (!cancelled && success) {
            setHasPdfThumb(true);
            try {
              const dataUrl = pdfCanvasRef.current?.toDataURL('image/webp', 0.85);
              if (dataUrl) {
                import('../lib/utils/thumbnailCache').then(({ setCachedThumbnail }) => {
                  setCachedThumbnail(attachment.storagePath, dataUrl);
                });
              }
            } catch {
              // ignore cross-origin canvas security errors
            }
          }
        });
      });
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attachment.storagePath, cachedThumbDataUrl, isPdf, previewState.fullUrl]);

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

            {/* Minimal SD / HD Quality Toggle Badge */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setQualityMode(prev => prev === 'SD' ? 'HD' : 'SD');
              }}
              title="Toggle SD vs HD quality"
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 50,
                padding: '3px 8px',
                borderRadius: '10px',
                background: qualityMode === 'HD' 
                  ? 'rgba(56, 189, 248, 0.25)' 
                  : 'rgba(15, 23, 42, 0.8)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: qualityMode === 'HD' 
                  ? '1px solid rgba(56, 189, 248, 0.5)' 
                  : '1px solid rgba(255, 255, 255, 0.2)',
                color: qualityMode === 'HD' ? '#38bdf8' : 'rgba(255, 255, 255, 0.85)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            >
              {qualityMode}
            </button>

            {(() => {
              const activeImageUrl = qualityMode === 'HD'
                ? (previewState.fullUrl || previewState.thumbUrl || cardDisplayUrl)
                : (previewState.thumbUrl || cardDisplayUrl || previewState.fullUrl);

              if (activeImageUrl && !previewState.error) {
                return (
                  <img 
                    src={activeImageUrl} 
                    alt={attachment.filename} 
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    onLoad={() => setIsImageLoaded(true)}
                    onError={() => setPreviewState(prev => ({ ...prev, error: true }))}
                    style={{
                      ...getImagePreviewStyle(),
                      opacity: isImageLoaded ? 1 : 0,
                      transition: 'opacity 0.22s ease-in-out',
                      filter: qualityMode === 'SD' && previewState.thumbUrl === previewState.fullUrl ? 'blur(0.5px)' : 'none',
                    }}
                  />
                );
              }

              return (
                !previewState.loading && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                    <ImageOff size={22} />
                    <span className="t-mono-sm">Preview unavailable</span>
                  </div>
                )
              );
            })()}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', minWidth: 0, padding: '2px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
              {isPdf ? (
                <div style={{ position: 'relative', width: 68, height: 90, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#0f131d', border: '1px solid rgba(255, 255, 255, 0.12)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {cachedThumbDataUrl ? (
                    <img
                      src={cachedThumbDataUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <canvas
                      ref={pdfCanvasRef}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: hasPdfThumb ? 'block' : 'none',
                      }}
                    />
                  )}
                  {!hasPdfThumb && !cachedThumbDataUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#ef4444' }}>
                      <FileText size={24} />
                      <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em' }}>PDF</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {getFileIcon(attachment.fileType)}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, textAlign: 'left' }}>
                <span className="t-body-medium" style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '13px' }}>
                  {attachment.filename}
                </span>
                <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 500 }}>
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
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                padding: '8px 12px',
                color: 'var(--accent-primary, #818cf8)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all var(--transition-fast)',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'; }}
            >
              {downloading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
              <span>{isPdf ? 'Open' : 'Save'}</span>
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
              images={[{
                thumbUrl: previewState.thumbUrl,
                fullUrl: previewState.fullUrl || previewState.thumbUrl
              }]}
              initialIndex={0}
              onClose={() => setShowZoomModal(false)}
            />
          </React.Suspense>
        )}
      </AnimatePresence>
    </>
  );
});
