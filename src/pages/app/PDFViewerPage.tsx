import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ZoomIn, ZoomOut, Download, Share2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

interface PageLayout {
  pageNumber: number;
  width: number;
  height: number;
  offsetTop: number;
}

interface PDFPageContainerProps {
  pageLayout: PageLayout;
  pdf: any;
  scale: number;
  isLowEnd: boolean;
  isFastScrolling: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isInRange: boolean;
}

// Dedicated virtualized wrapper for high-performance canvas page rendering
function PDFPageContainer({
  pageLayout,
  pdf,
  scale,
  isLowEnd,
  isFastScrolling,
  scrollContainerRef,
  isInRange
}: PDFPageContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [renderError, setRenderError] = useState(false);

  // Calculate dynamic dimensions at current scale
  const containerWidth = Math.min(window.innerWidth - 32, 800) * scale;
  const pageScale = containerWidth / pageLayout.width;
  const height = pageLayout.height * pageScale;
  const width = containerWidth;

  // Mount/Unmount observer with adaptive thresholds
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(entry.isIntersecting);
      },
      {
        root: scrollContainerRef.current,
        // Low-end devices get tighter buffers to conserve memory immediately
        rootMargin: isLowEnd ? '10% 0px' : '100% 0px',
        threshold: 0
      }
    );

    observer.observe(el);
    return () => {
      observer.unobserve(el);
      observer.disconnect();
    };
  }, [isLowEnd, scrollContainerRef]);

  // Handle active drawing loop
  const renderTaskRef = useRef<any>(null);
  const drawingRef = useRef(false);

  const drawPage = useCallback(async () => {
    if (!isVisible || isFastScrolling || !pdf || !canvasRef.current || drawingRef.current) return;

    try {
      drawingRef.current = true;
      const page = await pdf.getPage(pageLayout.pageNumber);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      // Cancel any active draw jobs on this canvas first
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      // Cap DPI scaling at 2.0 to protect GPU texture buffer
      const dpr = Math.min(2.0, window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: pageScale * dpr });

      // Enforce physical width ceiling to prevent mobile Safari out-of-memory crash
      const MAX_PHYSICAL_CANVAS_WIDTH = 2048;
      let finalViewport = viewport;

      if (viewport.width > MAX_PHYSICAL_CANVAS_WIDTH) {
        const maxScale = MAX_PHYSICAL_CANVAS_WIDTH / (pageLayout.width * pageScale);
        finalViewport = page.getViewport({ scale: maxScale });
      }

      // Double-buffered canvas drawing to eliminate rendering flicker
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = finalViewport.width;
      tempCanvas.height = finalViewport.height;
      const tempContext = tempCanvas.getContext('2d');

      if (!tempContext) return;

      const renderContext = {
        canvasContext: tempContext,
        viewport: finalViewport
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;

      // Synchronously write back to DOM canvas in single paint step
      canvas.width = finalViewport.width;
      canvas.height = finalViewport.height;
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      context.drawImage(tempCanvas, 0, 0);
      setIsRendered(true);
      setRenderError(false);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error(`[PDFViewer] Page ${pageLayout.pageNumber} render error:`, err);
        setRenderError(true);
      }
    } finally {
      drawingRef.current = false;
    }
  }, [pdf, isVisible, isFastScrolling, pageScale, pageLayout]);

  useEffect(() => {
    if (isVisible && !isFastScrolling) {
      drawPage();
    } else if (!isVisible) {
      // Free memory immediately once page leaves active observer threshold
      setIsRendered(false);
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
    }
  }, [isVisible, isFastScrolling, drawPage]);

  return (
    <div
      ref={containerRef}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        margin: '0 auto 16px auto',
        position: 'relative',
        background: 'var(--bg-elevated)',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-elevated)',
        border: isInRange ? '2px solid var(--status-warning)' : '1px solid var(--border-default)',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        transition: 'border var(--transition-fast)'
      }}
    >
      {/* Range highlights */}
      {isInRange && (
        <span style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 10,
          background: 'var(--status-warning)',
          color: '#000',
          fontSize: '9px',
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          padding: '2px 6px',
          borderRadius: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          textTransform: 'uppercase',
          pointerEvents: 'none'
        }}>
          Assigned
        </span>
      )}

      {isVisible && !renderError ? (
        <canvas ref={canvasRef} style={{ display: isRendered ? 'block' : 'none' }} />
      ) : null}

      {/* Loading Skeleton */}
      {!isRendered && !renderError && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-muted)'
        }}>
          <Loader2 className="spin" size={24} />
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>Page {pageLayout.pageNumber}</span>
        </div>
      )}

      {/* Error state */}
      {renderError && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--status-critical)',
          padding: '16px',
          textAlign: 'center'
        }}>
          <AlertCircle size={24} />
          <span style={{ fontSize: '12px', fontWeight: 500 }}>Failed to draw page</span>
        </div>
      )}
    </div>
  );
}

export default function PDFViewerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const url = searchParams.get('url') || '';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const range = searchParams.get('range') || '';
  const title = searchParams.get('title') || 'PDF Viewer';

  const [pdf, setPdf] = useState<any>(null);
  const [pageLayouts, setPageLayouts] = useState<PageLayout[]>([]);
  const [activePageNum, setActivePageNum] = useState<number>(initialPage);
  const [numPages, setNumPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Performance configurations (lazy initial state to detect low-end devices synchronously)
  const [isLowEnd] = useState<boolean>(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const ram = (navigator as any).deviceMemory || 4;
    return cores <= 4 || ram < 4;
  });
  const [isFastScrolling, setIsFastScrolling] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  const velocityTimerRef = useRef<number | null>(null);

  // 2. Load PDF.js CDN Scripts dynamically
  useEffect(() => {
    if (window.pdfjsLib) {
      Promise.resolve().then(() => setScriptLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;

    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      setScriptLoaded(true);
    };

    script.onerror = () => {
      setLoadError('Failed to load PDF engine. Please check your internet connection.');
      setLoading(false);
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Helper: Get offset y value for a given page index at the current scale factor
  const getPageOffsetTop = useCallback((pageIndex: number) => {
    if (pageLayouts.length === 0) return 0;
    const spacing = 16;
    let offset = 0;
    const containerWidth = Math.min(window.innerWidth - 32, 800) * scale;
    for (let i = 0; i < pageIndex; i++) {
      const layout = pageLayouts[i];
      const pageScale = containerWidth / layout.width;
      offset += (layout.height * pageScale) + spacing;
    }
    return offset;
  }, [pageLayouts, scale]);

  // 3. Load PDF and do pre-layout sizing pre-calculation
  useEffect(() => {
    if (!scriptLoaded || !url) return;

    let active = true;

    const loadPDFAndPreCalculateLayout = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const loadingTask = window.pdfjsLib.getDocument({
          url,
          withCredentials: false
        });

        const pdfDoc = await loadingTask.promise;
        if (!active) return;

        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);

        // Run ultra-fast metadata heights collection
        const layouts: PageLayout[] = [];
        let accumulatedOffset = 0;
        const spacing = 16;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const baseViewport = page.getViewport({ scale: 1.0 });

          layouts.push({
            pageNumber: i,
            width: baseViewport.width,
            height: baseViewport.height,
            offsetTop: accumulatedOffset
          });

          accumulatedOffset += baseViewport.height + spacing;
        }

        setPageLayouts(layouts);
        setLoading(false);
      } catch (err) {
        console.error('[PDFViewer] Error loading document:', err);
        if (active) {
          const errMsg = err instanceof Error ? err.message : 'Error loading PDF document. The link may have expired.';
          setLoadError(errMsg);
          setLoading(false);
        }
      }
    };

    loadPDFAndPreCalculateLayout();

    return () => {
      active = false;
    };
  }, [scriptLoaded, url]);

  // 4. Proportional scroll adjustments during scale zooming
  const lastScaleRef = useRef(scale);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || pageLayouts.length === 0) return;

    const prevScale = lastScaleRef.current;
    if (prevScale === scale) return;

    const ratio = scale / prevScale;
    container.scrollTop = container.scrollTop * ratio;

    lastScaleRef.current = scale;
  }, [scale, pageLayouts]);

  // 5. Instantly jump to initial target page offset without scroll jumps
  useEffect(() => {
    if (loading || pageLayouts.length === 0) return;

    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (container) {
        const offset = getPageOffsetTop(initialPage - 1);
        container.scrollTop = offset;
        setActivePageNum(initialPage);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [loading, pageLayouts, initialPage, getPageOffsetTop]);

  // Track scale in a ref to keep event listeners stable
  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // 6. Pinch-to-zoom on scrollContainer
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let startDist = 0;
    let startScale = 1.2;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        startScale = scaleRef.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / startDist;
        const newScale = Math.min(Math.max(startScale * factor, 0.6), 3.0);
        setScale(Math.round(newScale * 10) / 10);
      }
    };

    const onTouchEnd = () => {
      startDist = 0;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [pageLayouts]);

  // 7. Scroll Listener: Velocity rendering limiter and active-page tracker
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || pageLayouts.length === 0) return;

    const scrollTop = container.scrollTop;
    const scrollTime = performance.now();

    // Calculate Scroll Velocity
    const dist = Math.abs(scrollTop - lastScrollTopRef.current);
    const time = scrollTime - lastScrollTimeRef.current;
    const velocity = time > 0 ? dist / time : 0;

    lastScrollTopRef.current = scrollTop;
    lastScrollTimeRef.current = scrollTime;

    // Fling Speed check: > 2.5px/ms
    if (velocity > 2.5) {
      if (!isFastScrolling) {
        setIsFastScrolling(true);
      }

      if (velocityTimerRef.current) {
        window.clearTimeout(velocityTimerRef.current);
      }
      velocityTimerRef.current = window.setTimeout(() => {
        setIsFastScrolling(false);
      }, 100);
    }

    // Active Page Intersector calculations
    const containerHeight = container.clientHeight;
    const viewportMiddle = scrollTop + containerHeight / 2;

    let currentActive = 1;
    for (let i = 0; i < pageLayouts.length; i++) {
      const layout = pageLayouts[i];
      const pageTop = getPageOffsetTop(i);
      const containerWidth = Math.min(window.innerWidth - 32, 800) * scale;
      const pageScale = containerWidth / layout.width;
      const pageBottom = pageTop + (layout.height * pageScale);

      if (viewportMiddle >= pageTop && viewportMiddle <= pageBottom) {
        currentActive = layout.pageNumber;
        break;
      }
    }

    if (currentActive !== activePageNum) {
      setActivePageNum(currentActive);
    }
  }, [pageLayouts, activePageNum, getPageOffsetTop, isFastScrolling, scale]);

  useEffect(() => {
    return () => {
      if (velocityTimerRef.current) {
        window.clearTimeout(velocityTimerRef.current);
      }
    };
  }, []);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.6));
  };

  const handleDownload = () => {
    if (!url) return;
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = title.endsWith('.pdf') ? title : `${title}.pdf`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Download started');
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  const handleShare = async () => {
    if (!url) return;
    const shareData = {
      title: title,
      text: `ClassHub PDF: ${title} (Page ${activePageNum})`,
      url: url
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Temporary view link copied to clipboard!');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('[PDFViewer] Share error:', err);
        toast.error('Could not share link');
      }
    }
  };

  // Helper Range parser
  const isPageInRange = useCallback((pageNum: number) => {
    if (!range) return false;
    try {
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(x => parseInt(x.trim(), 10));
        return pageNum >= start && pageNum <= end;
      } else {
        return pageNum === parseInt(range.trim(), 10);
      }
    } catch {
      return false;
    }
  }, [range]);

  return (
    <div style={{
      minHeight: '100dvh',
      height: '100dvh',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-body)',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      {/* Sticky Top Header */}
      <header style={{
        position: 'relative',
        zIndex: 50,
        background: 'rgba(13, 15, 20, 0.95)',
        backdropFilter: 'var(--glass-blur)',
        borderBottom: '1px solid var(--border-default)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '6px',
              display: 'flex',
              borderRadius: '50%',
              transition: 'background var(--transition-fast)'
            }}
            aria-label="Go Back"
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>{title}</h1>
            {range && (
              <span className="t-mono-sm" style={{
                color: 'var(--status-warning)',
                fontSize: '11px',
                fontWeight: 500,
                marginTop: '2px',
                display: 'block'
              }}>
                Your Set: Pages {range}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handleShare}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              borderRadius: '50%',
              transition: 'all var(--transition-fast)'
            }}
            title="Share PDF link"
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <Share2 size={18} />
          </button>
          <button
            onClick={handleDownload}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              borderRadius: '50%',
              transition: 'all var(--transition-fast)'
            }}
            title="Download PDF"
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <Download size={18} />
          </button>
        </div>
      </header>

      {/* Main Virtualized Continuous Scroll Viewport */}
      <main
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px 8px',
          position: 'relative',
          display: 'block',
          scrollBehavior: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {loading ? (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <Loader2 className="spin" size={32} color="var(--accent-primary)" />
            <p className="t-mono-sm" style={{ color: 'var(--text-secondary)', margin: 0 }}>
              {scriptLoaded ? 'Analyzing document layouts...' : 'Initializing canvas engine...'}
            </p>
          </div>
        ) : loadError ? (
          <div style={{
            maxWidth: '340px',
            margin: '80px auto',
            padding: '24px',
            background: 'var(--status-critical-bg)',
            border: '1px solid rgba(248, 113, 113, 0.2)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertCircle size={32} color="var(--status-critical)" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Error loading document</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>{loadError}</p>
            <button
              className="btn-secondary"
              onClick={() => navigate(-1)}
              style={{ marginTop: '8px', padding: '8px 16px' }}
            >
              Go Back
            </button>
          </div>
        ) : (
          <div style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}>
            {pageLayouts.map((layout) => (
              <PDFPageContainer
                key={layout.pageNumber}
                pageLayout={layout}
                pdf={pdf}
                scale={scale}
                isLowEnd={isLowEnd}
                isFastScrolling={isFastScrolling}
                scrollContainerRef={scrollContainerRef}
                isInRange={isPageInRange(layout.pageNumber)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Active-Page overlay pill (Adobe style) */}
      {!loading && !loadError && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 18, 28, 0.9)',
          border: '1px solid var(--border-default)',
          backdropFilter: 'var(--glass-blur)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          padding: '6px 16px',
          borderRadius: '20px',
          zIndex: 99,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span className="t-mono-sm" style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontWeight: 600
          }}>
            Page <span style={{ color: 'var(--accent-primary)' }}>{activePageNum}</span> of {numPages}
          </span>
        </div>
      )}

      {/* Static Footer (Zoom controls only, no next/prev buttons needed!) */}
      {!loading && !loadError && (
        <footer style={{
          background: 'rgba(13, 15, 20, 0.95)',
          backdropFilter: 'var(--glass-blur)',
          borderTop: '1px solid var(--border-default)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleZoomOut}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                padding: '10px',
                cursor: 'pointer',
                display: 'flex',
                borderRadius: 'var(--radius-sm)',
                transition: 'all var(--transition-fast)'
              }}
              title="Zoom Out"
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <ZoomOut size={18} />
            </button>
            <span className="t-mono-sm" style={{
              color: 'var(--text-secondary)',
              fontSize: '12px',
              minWidth: '42px',
              textAlign: 'center',
              fontWeight: 600
            }}>
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                padding: '10px',
                cursor: 'pointer',
                display: 'flex',
                borderRadius: 'var(--radius-sm)',
                transition: 'all var(--transition-fast)'
              }}
              title="Zoom In"
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <ZoomIn size={18} />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
