import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface ImageZoomModalProps {
  images: Array<{ thumbUrl: string; fullUrl: string }>;
  initialIndex: number;
  onClose: () => void;
}

export default function ImageZoomModal({ images, initialIndex, onClose }: ImageZoomModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentImage = images[currentIndex] || { thumbUrl: '', fullUrl: '' };

  // Refs for tracking transform state without causing React re-renders
  const scaleRef = useRef(1);
  const posRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const rAFRef = useRef<number | null>(null);

  // Sync state just for rendering controls (e.g. enabling/disabling zoom buttons)
  const [currentScale, setCurrentScale] = useState(1);

  // Progressive loading: start with thumb, swap to full when ready
  const [displayUrl, setDisplayUrl] = useState(currentImage.thumbUrl);
  const [isFullLoaded, setIsFullLoaded] = useState(currentImage.thumbUrl === currentImage.fullUrl);

  // Swipe gesture refs
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // When active slide changes, reset zoom state and start preloading the HD image
  useEffect(() => {
    // Reset transforms
    scaleRef.current = 1;
    setCurrentScale(1);
    posRef.current = { x: 0, y: 0 };
    if (imgRef.current) {
      imgRef.current.style.transition = 'none';
      imgRef.current.style.transform = 'translate3d(0, 0, 0) scale(1)';
      // Trigger reflow to apply 'none' transition immediately
      void imgRef.current.offsetHeight;
      imgRef.current.style.transition = 'transform 0.16s cubic-bezier(0.25, 1, 0.5, 1)';
    }

    const activeImage = images[currentIndex];
    if (!activeImage) return;

    if (activeImage.thumbUrl === activeImage.fullUrl) {
      setDisplayUrl(activeImage.fullUrl);
      setIsFullLoaded(true);
      return;
    }

    setDisplayUrl(activeImage.thumbUrl);
    setIsFullLoaded(false);

    const img = new Image();
    img.onload = () => {
      // Only swap if this request is still relevant for the active index
      if (images[currentIndex] === activeImage) {
        setDisplayUrl(activeImage.fullUrl);
        setIsFullLoaded(true);
      }
    };
    img.src = activeImage.fullUrl;

    return () => {
      img.onload = null;
    };
  }, [currentIndex, images]);

  // Lock scrolling on document.body
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    // Focus close button on mount for keyboard a11y
    if (closeBtnRef.current) {
      closeBtnRef.current.focus();
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Set up Keyboard handlers (Left/Right arrows for sliding)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && scaleRef.current === 1 && images.length > 1) {
        setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight' && scaleRef.current === 1 && images.length > 1) {
        setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Tab' && containerRef.current) {
        // Simple focus trap: lock focus within modal interactive elements
        const focusableElements = containerRef.current.querySelectorAll(
          'button, [tabIndex="0"]'
        );
        const first = focusableElements[0] as HTMLElement;
        const last = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, images.length]);

  // Direct DOM mutation for transform inside requestAnimationFrame to prevent re-renders
  const scheduleUpdate = () => {
    if (rAFRef.current) return;
    rAFRef.current = requestAnimationFrame(() => {
      rAFRef.current = null;
      if (imgRef.current) {
        imgRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0) scale(${scaleRef.current})`;
        imgRef.current.style.cursor = scaleRef.current > 1 
          ? (isDraggingRef.current ? 'grabbing' : 'grab') 
          : 'zoom-in';
      }
    });
  };

  // Wheel zooming (attached directly on element with passive: false)
  useEffect(() => {
    const imgEl = imgRef.current;
    if (!imgEl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.01;
      const prevScale = scaleRef.current;
      const nextScale = Math.min(Math.max(1, prevScale + delta), 5);
      
      scaleRef.current = nextScale;
      setCurrentScale(nextScale);
      
      // If reset to 1, clear position
      if (nextScale === 1) {
        posRef.current = { x: 0, y: 0 };
      }
      
      scheduleUpdate();
    };

    imgEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      imgEl.removeEventListener('wheel', handleWheel);
      if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (scaleRef.current <= 1) return;
    e.preventDefault();
    isDraggingRef.current = true;
    startPosRef.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y
    };
    if (imgRef.current) {
      imgRef.current.style.transition = 'none';
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    scheduleUpdate();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    posRef.current = {
      x: e.clientX - startPosRef.current.x,
      y: e.clientY - startPosRef.current.y
    };
    scheduleUpdate();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (imgRef.current) {
      imgRef.current.style.transition = 'transform 0.16s cubic-bezier(0.25, 1, 0.5, 1)';
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
    scheduleUpdate();
  };

  // Touch Swipe Handlers for changing images when scale is 1
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scaleRef.current > 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (scaleRef.current > 1) return;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (scaleRef.current > 1) return;
    if (touchStartX.current === null || touchEndX.current === null) return;

    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (diff > threshold && images.length > 1) {
      // Swipe Left -> Next Image
      setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    } else if (diff < -threshold && images.length > 1) {
      // Swipe Right -> Prev Image
      setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Button actions
  const zoomIn = () => {
    const nextScale = Math.min(5, scaleRef.current + 0.5);
    scaleRef.current = nextScale;
    setCurrentScale(nextScale);
    scheduleUpdate();
  };

  const zoomOut = () => {
    const nextScale = Math.max(1, scaleRef.current - 0.5);
    scaleRef.current = nextScale;
    setCurrentScale(nextScale);
    if (nextScale === 1) {
      posRef.current = { x: 0, y: 0 };
    }
    scheduleUpdate();
  };

  const reset = () => {
    scaleRef.current = 1;
    setCurrentScale(1);
    posRef.current = { x: 0, y: 0 };
    scheduleUpdate();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <motion.div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="zoom-modal-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none'
      }}
      onClick={handleOverlayClick}
    >
      <h2 id="zoom-modal-title" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
        Full Screen Image Zoom
      </h2>

      {/* Top Close Control */}
      <button
        ref={closeBtnRef}
        onClick={onClose}
        aria-label="Close image preview"
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 10,
          background: 'rgba(255,255,255,0.12)',
          border: 'none',
          borderRadius: '50%',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          cursor: 'pointer',
          transition: 'background var(--transition-fast)'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
      >
        <X size={22} />
      </button>

      {/* Left Navigation Chevron (Visible only when scale === 1) */}
      {images.length > 1 && currentScale === 1 && (
        <button
          onClick={() => setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
          aria-label="Previous image"
          style={{
            position: 'absolute',
            left: 20,
            zIndex: 10,
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: 'none',
            borderRadius: '50%',
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            transition: 'background var(--transition-fast)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {/* Centered Image */}
      <motion.img
        ref={imgRef}
        src={displayUrl}
        alt="Expanded view with zoom support"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        draggable={false}
        onClick={() => {
          if (scaleRef.current === 1) {
            scaleRef.current = 2;
            setCurrentScale(2);
            scheduleUpdate();
          } else {
            reset();
          }
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: currentScale, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        style={{
          maxWidth: '100vw',
          maxHeight: '100vh',
          objectFit: 'contain',
          // eslint-disable-next-line react-hooks/refs
          transform: `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0) scale(${scaleRef.current})`,
          transition: 'transform 0.16s cubic-bezier(0.25, 1, 0.5, 1)',
          cursor: currentScale > 1 ? 'grab' : 'zoom-in',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          willChange: 'transform'
        }}
      />

      {/* Right Navigation Chevron (Visible only when scale === 1) */}
      {images.length > 1 && currentScale === 1 && (
        <button
          onClick={() => setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
          aria-label="Next image"
          style={{
            position: 'absolute',
            right: 20,
            zIndex: 10,
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: 'none',
            borderRadius: '50%',
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            transition: 'background var(--transition-fast)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* Slide Indicators (Dots) */}
      {images.length > 1 && currentScale === 1 && (
        <div style={{
          position: 'absolute',
          bottom: 90,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          zIndex: 10,
          pointerEvents: 'none'
        }}>
          {images.map((_, idx) => (
            <span
              key={idx}
              style={{
                width: idx === currentIndex ? 14 : 6,
                height: 6,
                borderRadius: 3,
                background: idx === currentIndex ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.35)',
                boxShadow: idx === currentIndex ? '0 0 6px var(--accent-primary-glow)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          ))}
        </div>
      )}

      {/* Zoom Control Panel */}
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'rgba(15, 18, 28, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '8px 20px',
          borderRadius: 24,
          zIndex: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          opacity: currentScale === 1 ? 1 : 0,
          pointerEvents: currentScale === 1 ? 'auto' : 'none',
          transition: 'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <button
          onClick={zoomOut}
          disabled={currentScale <= 1}
          aria-label="Zoom out"
          style={{
            background: 'none',
            border: 'none',
            color: currentScale <= 1 ? 'var(--text-muted)' : '#fff',
            cursor: currentScale <= 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
            transition: 'color var(--transition-fast)'
          }}
        >
          <ZoomOut size={18} />
        </button>

        <button
          onClick={reset}
          aria-label="Reset zoom level"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            padding: '4px 12px',
            borderRadius: 12,
            transition: 'all var(--transition-fast)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
        >
          {currentScale.toFixed(1)}x
        </button>

        <button
          onClick={zoomIn}
          disabled={currentScale >= 5}
          aria-label="Zoom in"
          style={{
            background: 'none',
            border: 'none',
            color: currentScale >= 5 ? 'var(--text-muted)' : '#fff',
            cursor: currentScale >= 5 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
            transition: 'color var(--transition-fast)'
          }}
        >
          <ZoomIn size={18} />
        </button>

        {/* HD loading indicator */}
        {!isFullLoaded && currentImage.thumbUrl !== currentImage.fullUrl && (
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            HD…
          </span>
        )}
      </div>
    </motion.div>,
    document.body
  );
}
