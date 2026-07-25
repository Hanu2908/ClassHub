import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, ImageOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getThumbPath } from '../lib/utils/imageResize';
import { signedUrlCache } from '../lib/utils/attachments';
import type { Attachment } from '../store/appStore';

interface ImageCarouselProps {
  images: Attachment[];
  onImageClick: (index: number) => void;
}

export const ImageCarousel = React.memo(function ImageCarousel({ images, onImageClick }: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [qualityMode, setQualityMode] = useState<'SD' | 'HD'>('SD');

  // States to keep track of loaded URLs and loading/error status per image
  const [urls, setUrls] = useState<Record<string, { thumbUrl: string; fullUrl: string }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Touch swipe refs
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Detect if the device supports hover (to always show arrows on touch devices)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: none)');
    setIsMobile(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Fetch signed URLs for all images
  useEffect(() => {
    let cancelled = false;

    const fetchImageUrls = async () => {
      const pendingUrls: Record<string, { thumbUrl: string; fullUrl: string }> = {};
      const newLoading: Record<string, boolean> = {};
      const newErrors: Record<string, boolean> = {};

      // Initialize loading state for uncached images
      images.forEach((img) => {
        const cached = signedUrlCache.get(img.storagePath);
        if (cached && cached.expiresAt > Date.now()) {
          pendingUrls[img.storagePath] = { thumbUrl: cached.thumbUrl, fullUrl: cached.fullUrl };
        } else {
          newLoading[img.storagePath] = true;
        }
      });

      if (Object.keys(newLoading).length > 0) {
        setLoading((prev) => ({ ...prev, ...newLoading }));
      }
      if (Object.keys(pendingUrls).length > 0) {
        setUrls((prev) => ({ ...prev, ...pendingUrls }));
      }

      // Fetch signed URLs in parallel for those not cached
      await Promise.all(
        images.map(async (img) => {
          const path = img.storagePath;
          if (pendingUrls[path]) return; // Already cached

          try {
            const thumbPath = getThumbPath(path);
            
            // Step 1: Try to create signed URL for thumbnail (may not exist)
            let thumbUrl: string | null = null;
            try {
              const { data: thumbData, error: thumbError } = await supabase.storage
                .from('attachments')
                .createSignedUrl(thumbPath, 3600);
              if (!thumbError && thumbData?.signedUrl) {
                thumbUrl = thumbData.signedUrl;
              }
            } catch {
              // Thumbnail doesn't exist — this is expected, fall through
            }

            if (cancelled) return;

            // Step 2: Create signed URL for full image
            const { data: fullData, error: fullError } = await supabase.storage
              .from('attachments')
              .createSignedUrl(path, 3600);

            if (cancelled) return;

            if (fullError || !fullData?.signedUrl) {
              newErrors[path] = true;
              return;
            }

            const fullUrl = fullData.signedUrl;
            const hasThumb = !!thumbUrl;
            const resolvedThumbUrl = hasThumb ? thumbUrl! : fullUrl;

            // Save to Cache
            signedUrlCache.set(path, {
              thumbUrl: resolvedThumbUrl,
              fullUrl,
              hasThumb,
              expiresAt: Date.now() + 3500 * 1000,
            });

            pendingUrls[path] = { thumbUrl: resolvedThumbUrl, fullUrl };
          } catch {
            newErrors[path] = true;
          } finally {
            newLoading[path] = false;
          }
        })
      );

      if (cancelled) return;

      setUrls((prev) => ({ ...prev, ...pendingUrls }));
      setLoading((prev) => {
        const next = { ...prev };
        images.forEach((img) => {
          next[img.storagePath] = false;
        });
        return next;
      });
      setErrors((prev) => ({ ...prev, ...newErrors }));
    };

    fetchImageUrls();

    return () => {
      cancelled = true;
    };
  }, [images]);

  const handlePrev = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleNext = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  // Touch Swipe Handlers (calls e.stopPropagation() to prevent bubbling up to active card drag listeners)
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (touchStartX.current === null || touchEndX.current === null) return;
    
    const diff = touchStartX.current - touchEndX.current;
    const swipeThreshold = 50;

    if (diff > swipeThreshold) {
      // Swipe Left -> Next Image
      setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    } else if (diff < -swipeThreshold) {
      // Swipe Right -> Prev Image
      setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const showControls = images.length > 1 && (hovered || isMobile);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: '100%',
        maxHeight: '400px',
        minHeight: '200px',
        aspectRatio: '4 / 5',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'rgba(10, 12, 20, 0.55)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {/* Horizontal Slider Track */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: `translateX(-${activeIndex * 100}%)`,
        }}
      >
        {images.map((img, idx) => {
          const path = img.storagePath;
          const displayUrl = qualityMode === 'HD' 
            ? (urls[path]?.fullUrl || urls[path]?.thumbUrl) 
            : (urls[path]?.thumbUrl || urls[path]?.fullUrl);
          const isImgLoading = loading[path];
          const isError = errors[path];

          return (
            <div
              key={img.id}
              onClick={() => !isImgLoading && !isError && onImageClick(idx)}
              style={{
                flex: '0 0 100%',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: isImgLoading || isError ? 'default' : 'pointer',
                position: 'relative',
              }}
            >
              {isImgLoading && (
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
                }}>
                  <Loader2 className="animate-spin" size={20} />
                  <span className="t-mono-sm">Loading preview…</span>
                </div>
              )}

              {isError && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--text-secondary)',
                }}>
                  <ImageOff size={22} />
                  <span className="t-mono-sm">Preview unavailable</span>
                </div>
              )}

              {!isImgLoading && !isError && displayUrl && (
                <img
                  src={displayUrl}
                  alt={img.filename}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    pointerEvents: 'none', // Prevents browser drag overlays
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Minimal SD / HD Quality Toggle Badge */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setQualityMode((prev) => (prev === 'SD' ? 'HD' : 'SD'));
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

      {/* Edge Chevron Navigation controls */}
      {images.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            aria-label="Previous slide"
            style={{
              position: 'absolute',
              left: '8px',
              zIndex: 10,
              background: 'rgba(15, 18, 28, 0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer',
              opacity: showControls ? 1 : 0,
              pointerEvents: showControls ? 'auto' : 'none',
              transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), background-color var(--transition-fast)',
              outline: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(15, 18, 28, 0.85)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(15, 18, 28, 0.65)'; }}
          >
            <ChevronLeft size={16} />
          </button>

          <button
            onClick={handleNext}
            aria-label="Next slide"
            style={{
              position: 'absolute',
              right: '8px',
              zIndex: 10,
              background: 'rgba(15, 18, 28, 0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer',
              opacity: showControls ? 1 : 0,
              pointerEvents: showControls ? 'auto' : 'none',
              transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), background-color var(--transition-fast)',
              outline: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(15, 18, 28, 0.85)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(15, 18, 28, 0.65)'; }}
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}

      {/* Slide Indicators (Dots) */}
      {images.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          pointerEvents: 'none',
        }}>
          {images.map((_, idx) => (
            <span
              key={idx}
              style={{
                width: idx === activeIndex ? '14px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: idx === activeIndex ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.35)',
                boxShadow: idx === activeIndex ? '0 0 6px var(--accent-primary-glow)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
