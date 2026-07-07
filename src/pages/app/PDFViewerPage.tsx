import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, ZoomIn, ZoomOut, Download, Share2, Loader2, AlertCircle,
  ChevronUp, ChevronDown, Check, RotateCw, Sun, Moon, Eye, MoreVertical, Search, X
} from 'lucide-react';
import { toast } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

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
  renderScale: number;
  containerWidth: number;
  isFastScrolling: boolean;
  isInRange: boolean;
  isInCacheBuffer: boolean;
  searchQuery: string;
  displayMode: 'original' | 'dark' | 'sepia';
  rotation: number;
}

const textLayerStyles = `
  .pdf-container {
    position: relative;
    user-select: text;
    -webkit-user-select: text;
  }

  .textLayer {
    position: absolute;
    text-align: initial;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    opacity: 1;
    line-height: 1;
    text-size-adjust: none;
    forced-color-adjust: none;
    transform-origin: 0 0;
    z-index: 10;
    pointer-events: auto;
    user-select: text;
    -webkit-user-select: text;
  }

  .textLayer span,
  .textLayer br {
    color: transparent;
    position: absolute;
    white-space: pre;
    cursor: text;
    transform-origin: 0% 0%;
    user-select: text;
    -webkit-user-select: text;
  }

  .textLayer ::selection {
    background: rgba(59, 130, 246, 0.4) !important;
  }

  /* search match highlights */
  .textLayer .highlight {
    background-color: rgba(254, 240, 138, 0.6) !important;
    border-radius: 2px;
    box-shadow: 0 0 2px rgba(254, 240, 138, 0.8);
    display: inline-block;
  }
`;

const applyHighlighting = (container: HTMLDivElement, query: string) => {
  if (!query || !query.trim()) return;
  const cleanQuery = query.trim();
  const escapedQuery = cleanQuery.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodesToReplace: { node: Text; parent: HTMLElement; parts: Node[] }[] = [];
  
  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue;
    if (text && regex.test(text)) {
      regex.lastIndex = 0; // Reset
      const parent = node.parentNode as HTMLElement;
      if (parent && !parent.classList.contains('highlight') && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
        const parts: Node[] = [];
        const rawParts = text.split(regex);
        rawParts.forEach((part) => {
          if (part.toLowerCase() === cleanQuery.toLowerCase()) {
            const span = document.createElement('span');
            span.className = 'highlight';
            span.textContent = part;
            parts.push(span);
          } else {
            parts.push(document.createTextNode(part));
          }
        });
        nodesToReplace.push({ node: node as Text, parent, parts });
      }
    }
  }
  
  nodesToReplace.forEach(({ node, parent, parts }) => {
    parts.forEach((part) => {
      parent.insertBefore(part, node);
    });
    parent.removeChild(node);
  });
};

const PDFPageContainer = memo(function PDFPageContainer({
  pageLayout,
  pdf,
  scale,
  renderScale,
  containerWidth,
  isFastScrolling,
  isInRange,
  isInCacheBuffer,
  searchQuery,
  displayMode,
  rotation
}: PDFPageContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [renderError, setRenderError] = useState(false);

  const isFastScrollingRef = useRef(isFastScrolling);
  const isInCacheBufferRef = useRef(isInCacheBuffer);

  useEffect(() => {
    isFastScrollingRef.current = isFastScrolling;
  }, [isFastScrolling]);

  useEffect(() => {
    isInCacheBufferRef.current = isInCacheBuffer;
  }, [isInCacheBuffer]);

  // Swap width and height if rotated by 90 or 270 degrees
  const isRotated90 = rotation === 90 || rotation === 270;
  const layoutWidth = (isRotated90 ? pageLayout.height : pageLayout.width) || 595;
  const layoutHeight = (isRotated90 ? pageLayout.width : pageLayout.height) || 842;

  // Real-time and debounced scales with safety fallbacks
  const safeScale = isNaN(scale) || scale <= 0 ? 1.0 : scale;
  const safeRenderScale = isNaN(renderScale) || renderScale <= 0 ? 1.0 : renderScale;

  // Calculate dynamic dimensions at current visual scale (responsive & updates in real-time)
  const currentContainerWidth = containerWidth * safeScale;
  const pageScale = layoutWidth > 0 ? currentContainerWidth / layoutWidth : 1.0;
  const height = layoutHeight * pageScale;
  const width = currentContainerWidth;

  // Calculate render dimensions based on debounced renderScale
  const renderContainerWidth = containerWidth * safeRenderScale;
  const renderPageScale = layoutWidth > 0 ? renderContainerWidth / layoutWidth : 1.0;



  // Handle active drawing loop
  const renderTaskRef = useRef<any>(null);
  const drawingRef = useRef(false);

  const drawPage = useCallback(async () => {
    if (!isInCacheBufferRef.current || isFastScrollingRef.current || !pdf || !canvasRef.current || drawingRef.current) return;

    try {
      drawingRef.current = true;
      const page = await pdf.getPage(pageLayout.pageNumber);
      if (!isInCacheBufferRef.current) return;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      // Cancel any active draw jobs on this canvas first
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      // Cap DPI scaling at 2.0 to protect GPU texture buffer
      const dpr = Math.min(2.0, window.devicePixelRatio || 1);
      const safeRenderPageScale = isNaN(renderPageScale) || renderPageScale <= 0 ? 1.0 : renderPageScale;
      const viewport = page.getViewport({ scale: safeRenderPageScale * dpr, rotation: rotation });

      // Enforce physical width ceiling to prevent mobile Safari out-of-memory crash
      const MAX_PHYSICAL_CANVAS_WIDTH = 2048;
      let finalViewport = viewport;

      if (viewport.width > MAX_PHYSICAL_CANVAS_WIDTH) {
        const maxScale = MAX_PHYSICAL_CANVAS_WIDTH / (layoutWidth || 595);
        finalViewport = page.getViewport({ scale: maxScale, rotation: rotation });
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

      if (!isInCacheBufferRef.current) return;

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
  }, [pdf, renderPageScale, pageLayout, rotation, layoutWidth]);

  const drawTextLayer = useCallback(async () => {
    if (!pdf || !textLayerRef.current || !isRendered || !isInCacheBufferRef.current) return;
    try {
      textLayerRef.current.innerHTML = '';
      const page = await pdf.getPage(pageLayout.pageNumber);
      if (!isInCacheBufferRef.current) return;
      const textContent = await page.getTextContent();
      if (!isInCacheBufferRef.current) return;
      const safeRenderPageScale = isNaN(renderPageScale) || renderPageScale <= 0 ? 1.0 : renderPageScale;
      const cssViewport = page.getViewport({ scale: safeRenderPageScale, rotation: rotation });
      
      await window.pdfjsLib.renderTextLayer({
        textContent: textContent,
        textContentSource: textContent,
        container: textLayerRef.current,
        viewport: cssViewport,
        textDivs: []
      }).promise;

      if (!isInCacheBufferRef.current) return;

      if (searchQuery) {
        applyHighlighting(textLayerRef.current, searchQuery);
      }
    } catch (err) {
      console.error(`[PDFViewer] Text layer redraw error on page ${pageLayout.pageNumber}:`, err);
    }
  }, [pdf, pageLayout.pageNumber, renderPageScale, searchQuery, rotation, isRendered]);

  useEffect(() => {
    if (isInCacheBuffer) {
      if (!isRendered && !isFastScrolling) {
        drawPage();
      }
    } else {
      // Free memory immediately once page leaves cache buffer threshold
      setIsRendered(false);
      setRenderError(false); // Reset error status so it retries automatically when scrolling back
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = '';
      }
    }
  }, [isInCacheBuffer, isFastScrolling, isRendered, drawPage]);

  // Redraw text layer on search query changes or when rotation updates
  useEffect(() => {
    if (isRendered) {
      drawTextLayer();
    }
  }, [searchQuery, isRendered, rotation, drawTextLayer]);

  // Redraw canvas/text-layer on rotation or scale changes
  const isRenderedRef = useRef(isRendered);
  useEffect(() => {
    isRenderedRef.current = isRendered;
  }, [isRendered]);

  useEffect(() => {
    if (isRenderedRef.current) {
      drawPage();
    }
  }, [rotation, drawPage]);

  const canvasFilter = displayMode === 'dark' 
    ? 'invert(0.9) hue-rotate(180deg)' 
    : displayMode === 'sepia' 
      ? 'sepia(0.6) contrast(0.95)' 
      : 'none';

  return (
    <div
      ref={containerRef}
      className="pdf-container"
      data-page-number={pageLayout.pageNumber}
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
          zIndex: 20,
          background: 'var(--status-warning)',
          color: '#000',
          fontSize: '12px',
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

      {isInCacheBuffer ? (
        <canvas 
          ref={canvasRef} 
          style={{ 
            display: isRendered && !renderError ? 'block' : 'none',
            filter: canvasFilter,
            transition: 'filter var(--transition-fast)',
            width: '100%',
            height: '100%'
          }} 
        />
      ) : null}

      {isInCacheBuffer && isRendered && !renderError && (
        <div 
          ref={textLayerRef} 
          className="textLayer" 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            pointerEvents: 'auto',
            zIndex: 10,
            ['--scale-factor' as any]: renderPageScale // Pass scale factor to CSS custom variable for PDF.js textLayer alignment
          }}
        />
      )}

      {/* Loading Skeleton */}
      {isInCacheBuffer && !isRendered && !renderError && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-muted)'
        }}>
          <Loader2 className="animate-spin" size={24} />
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>Page {pageLayout.pageNumber}</span>
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
          textAlign: 'center',
          zIndex: 30
        }}>
          <AlertCircle size={24} />
          <span style={{ fontSize: '12px', fontWeight: 500 }}>Failed to draw page</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRenderError(false);
              drawPage();
            }}
            style={{
              marginTop: '4px',
              padding: '6px 12px',
              background: 'rgba(248, 113, 113, 0.15)',
              border: '1px solid var(--status-critical)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248, 113, 113, 0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248, 113, 113, 0.15)'; }}
          >
            <RotateCw size={12} />
            Retry
          </button>
        </div>
      )}
    </div>
  );
});

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
  
  // Real-time scale for layout container widths
  const [scale, setScale] = useState<number>(1.0);
  // Debounced scale for high-res rendering
  const [renderScale, setRenderScale] = useState<number>(1.0);

  const [loading, setLoading] = useState<boolean>(true);
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Advanced features states
  const [displayMode, setDisplayMode] = useState<'original' | 'dark' | 'sepia'>('original');
  const [rotation, setRotation] = useState<number>(0);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<{ pageNumber: number; index: number }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(-1);
  const [pageInputValue, setPageInputValue] = useState<string>(initialPage.toString());

  // Performance configurations
  const [isLowEnd] = useState<boolean>(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const ram = (navigator as any).deviceMemory || 4;
    return cores <= 4 || ram < 4;
  });
  const [isFastScrolling, setIsFastScrolling] = useState<boolean>(false);
  const [initialScrollDone, setInitialScrollDone] = useState<boolean>(false);
  const [containerWidth, setContainerWidth] = useState<number>(375); // Safe initial width

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  const velocityTimerRef = useRef<number | null>(null);

  // Load PDF.js CDN Scripts dynamically
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

  // Debounce scale updates for high-res redraws to keep gestures at 60 FPS
  useEffect(() => {
    const timer = setTimeout(() => {
      setRenderScale(scale);
    }, 250);
    return () => clearTimeout(timer);
  }, [scale]);

  // Dynamically observe the clientWidth of the scroll container to guarantee "fit to width" layout with no overflows
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateWidth = () => {
      // clientWidth includes width + padding. We subtract 16px (8px horizontal padding on each side) to get available width.
      const availableWidth = container.clientWidth - 16;
      setContainerWidth(Math.max(200, Math.min(availableWidth, 800)));
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [loading]);

  // Helper: Get offset y value for a given page index at the current scale factor, adjusted for rotation
  const getPageOffsetTop = useCallback((pageIndex: number) => {
    if (pageLayouts.length === 0) return 0;
    const spacing = 16;
    let offset = 16; // Start at 16 to account for main padding-top: 16px
    const safeScale = isNaN(scale) || scale <= 0 ? 1.0 : scale;
    const currentContainerWidth = containerWidth * safeScale;
    const isRotated90 = rotation === 90 || rotation === 270;
    for (let i = 0; i < pageIndex; i++) {
      const layout = pageLayouts[i];
      const layoutWidth = (isRotated90 ? layout.height : layout.width) || 595;
      const layoutHeight = (isRotated90 ? layout.width : layout.height) || 842;
      const pageScale = layoutWidth > 0 ? currentContainerWidth / layoutWidth : 1.0;
      offset += (layoutHeight * pageScale) + spacing;
    }
    return offset;
  }, [pageLayouts, scale, rotation, containerWidth]);

  // Load PDF and do pre-layout sizing pre-calculation
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

        // Run metadata heights collection
        const layouts: PageLayout[] = [];
        let accumulatedOffset = 0;
        const spacing = 16;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const baseViewport = page.getViewport({ scale: 1.0 });
          const pageWidth = baseViewport?.width || 595;
          const pageHeight = baseViewport?.height || 842;

          layouts.push({
            pageNumber: i,
            width: pageWidth,
            height: pageHeight,
            offsetTop: accumulatedOffset
          });

          accumulatedOffset += pageHeight + spacing;
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

  // Proportional scroll adjustments during scale zooming
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
  // Instantly jump to initial target page offset without scroll jumps
  useEffect(() => {
    if (loading || pageLayouts.length === 0 || initialScrollDone) return;

    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (container) {
        // Temporarily disable smooth scroll behavior for the initial jump
        const originalScrollBehavior = container.style.scrollBehavior;
        container.style.scrollBehavior = 'auto';

        const offset = getPageOffsetTop(initialPage - 1);
        container.scrollTop = offset;

        // Initialize scroll tracker values to prevent false velocity spikes
        lastScrollTopRef.current = offset;
        lastScrollTimeRef.current = performance.now();

        setActivePageNum(initialPage);
        setInitialScrollDone(true);

        // Restore smooth scrolling behavior after the layout has settled
        setTimeout(() => {
          if (container) {
            container.style.scrollBehavior = originalScrollBehavior || 'smooth';
          }
        }, 50);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [loading, pageLayouts, initialPage, getPageOffsetTop, initialScrollDone]);
  // Scroll Listener: Active-page tracker and velocity rendering limiter
  const handleScroll = useCallback(() => {
    if (!initialScrollDone) return;
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

    let currentActive = activePageNum;
    const isRotated90 = rotation === 90 || rotation === 270;
    const safeScale = isNaN(scale) || scale <= 0 ? 1.0 : scale;
    const currentContainerWidth = containerWidth * safeScale;
    for (let i = 0; i < pageLayouts.length; i++) {
      const layout = pageLayouts[i];
      const pageTop = getPageOffsetTop(i);
      const layoutWidth = (isRotated90 ? layout.height : layout.width) || 595;
      const layoutHeight = (isRotated90 ? layout.width : layout.height) || 842;
      const pageScale = layoutWidth > 0 ? currentContainerWidth / layoutWidth : 1.0;
      const pageBottom = pageTop + (layoutHeight * pageScale) + 16;

      if (viewportMiddle >= pageTop && viewportMiddle <= pageBottom) {
        currentActive = layout.pageNumber;
        break;
      }
    }

    if (currentActive !== activePageNum) {
      setActivePageNum(currentActive);
    }
  }, [pageLayouts, activePageNum, getPageOffsetTop, isFastScrolling, scale, rotation, initialScrollDone, containerWidth]);

  useEffect(() => {
    return () => {
      if (velocityTimerRef.current) {
        window.clearTimeout(velocityTimerRef.current);
      }
    };
  }, []);

  // Pinch-to-zoom gesture listener
  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let startDist = 0;
    let startScale = 1.0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
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
        const newScale = Math.min(Math.max(startScale * factor, 0.3), 3.0);
        setScale(Math.round(newScale * 10) / 10);
      }
    };

    const onTouchEnd = () => {
      startDist = 0;
    };

    const onGesture = (e: Event) => {
      e.preventDefault();
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);
    container.addEventListener('gesturestart', onGesture, { passive: false });
    container.addEventListener('gesturechange', onGesture, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
      container.removeEventListener('gesturestart', onGesture);
      container.removeEventListener('gesturechange', onGesture);
    };
  }, [pageLayouts]);

  // Sync floating page input number with actual active page
  useEffect(() => {
    setPageInputValue(activePageNum.toString());
  }, [activePageNum]);

  // Paging controls logic
  const jumpToPage = useCallback((pageNum: number) => {
    let target = pageNum;
    if (isNaN(target) || target < 1) target = 1;
    if (target > numPages) target = numPages;

    const offset = getPageOffsetTop(target - 1);
    scrollContainerRef.current?.scrollTo({
      top: offset,
      behavior: 'smooth'
    });
    setActivePageNum(target);
    setPageInputValue(target.toString());
  }, [numPages, getPageOffsetTop]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d+$/.test(val)) {
      setPageInputValue(val);
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      jumpToPage(parseInt(pageInputValue, 10));
      e.currentTarget.blur();
    }
  };

  const handlePageInputBlur = () => {
    jumpToPage(parseInt(pageInputValue, 10));
  };

  const goToPrevPage = () => {
    if (activePageNum > 1) {
      jumpToPage(activePageNum - 1);
    }
  };

  const goToNextPage = () => {
    if (activePageNum < numPages) {
      jumpToPage(activePageNum + 1);
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.3));
  };

  const handleResetZoom = () => {
    setScale(1.0);
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

  // Text search algorithms
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || !pdf) {
      setSearchResults([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const matches: { pageNumber: number; index: number }[] = [];
    const cleanQuery = query.toLowerCase().trim();

    try {
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ').toLowerCase();

        if (pageText.includes(cleanQuery)) {
          let count = 0;
          let pos = pageText.indexOf(cleanQuery);
          while (pos !== -1) {
            count++;
            pos = pageText.indexOf(cleanQuery, pos + cleanQuery.length);
          }
          
          for (let c = 0; c < count; c++) {
            matches.push({ pageNumber: i, index: matches.length });
          }
        }
      }
      setSearchResults(matches);
      if (matches.length > 0) {
        setCurrentMatchIndex(0);
        jumpToPage(matches[0].pageNumber);
      } else {
        setCurrentMatchIndex(-1);
        toast.error('No matches found');
      }
    } catch (err) {
      console.error('[PDFViewer] Search error:', err);
    }
  }, [pdf, numPages, jumpToPage]);

  // Debounced search trigger
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      setCurrentMatchIndex(-1);
      return;
    }
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleSearchNext = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchResults.length;
    setCurrentMatchIndex(nextIdx);
    jumpToPage(searchResults[nextIdx].pageNumber);
  };

  const handleSearchPrev = () => {
    if (searchResults.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentMatchIndex(prevIdx);
    jumpToPage(searchResults[prevIdx].pageNumber);
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

  // Slide buffer coordinates calculations
  const isPageInCacheBuffer = (pageNum: number) => {
    const rangeLimit = isLowEnd ? 1 : 2;
    return Math.abs(pageNum - activePageNum) <= rangeLimit;
  };

  // Safe Inline CSS Theme Layout rules
  const headerStyle: React.CSSProperties = {
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
  };

  const headerLeftStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
    flex: 1
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'all var(--transition-fast)'
  };

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
      overflow: 'hidden',
      userSelect: 'none'
    }}>
      <style dangerouslySetInnerHTML={{ __html: textLayerStyles }} />

      {/* Sticky Top Header */}
      <header style={headerStyle}>
        <div style={headerLeftStyle}>
          <button
            onClick={() => navigate(-1)}
            style={btnStyle}
            aria-label="Go Back"
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={titleStyle}>{title}</h1>
            {range && (
              <span className="t-mono-sm" style={{
                color: 'var(--status-warning)',
                fontSize: '12px',
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
            onClick={() => setSearchOpen(prev => !prev)}
            style={{
              ...btnStyle,
              background: searchOpen ? 'var(--accent-primary-glow)' : 'none',
              color: searchOpen ? 'var(--accent-primary)' : 'var(--text-secondary)'
            }}
            title="Search PDF"
            onMouseEnter={e => { if (!searchOpen) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
            onMouseLeave={e => { if (!searchOpen) e.currentTarget.style.background = 'none'; }}
          >
            <Search size={18} />
          </button>
          
          <button
            onClick={handleShare}
            style={btnStyle}
            title="Share PDF link"
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <Share2 size={18} />
          </button>

          <button
            onClick={handleDownload}
            style={btnStyle}
            title="Download PDF"
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <Download size={18} />
          </button>

          {/* More options dropdown trigger */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                style={btnStyle}
                title="Options"
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <MoreVertical size={18} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                alignOffset={12}
                sideOffset={8}
                className="dropdown-content animate-slide-up"
                style={{ zIndex: 10000, minWidth: '180px' }}
              >
                <DropdownMenu.Item
                  onClick={() => setDisplayMode('original')}
                  className="dropdown-item"
                  style={{
                    color: displayMode === 'original' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    background: displayMode === 'original' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                    borderLeft: displayMode === 'original' ? '3px solid var(--accent-primary)' : '3px solid transparent',
                    fontWeight: displayMode === 'original' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    paddingLeft: '9px'
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Sun size={14} />
                    Original (Light)
                  </span>
                  {displayMode === 'original' && <Check size={14} />}
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onClick={() => setDisplayMode('dark')}
                  className="dropdown-item"
                  style={{
                    color: displayMode === 'dark' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    background: displayMode === 'dark' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                    borderLeft: displayMode === 'dark' ? '3px solid var(--accent-primary)' : '3px solid transparent',
                    fontWeight: displayMode === 'dark' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    paddingLeft: '9px'
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Moon size={14} />
                    Dark Mode
                  </span>
                  {displayMode === 'dark' && <Check size={14} />}
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onClick={() => setDisplayMode('sepia')}
                  className="dropdown-item"
                  style={{
                    color: displayMode === 'sepia' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    background: displayMode === 'sepia' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                    borderLeft: displayMode === 'sepia' ? '3px solid var(--accent-primary)' : '3px solid transparent',
                    fontWeight: displayMode === 'sepia' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    paddingLeft: '9px'
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Eye size={14} />
                    Sepia
                  </span>
                  {displayMode === 'sepia' && <Check size={14} />}
                </DropdownMenu.Item>

                <div style={{ height: '1px', backgroundColor: 'var(--border-default)', margin: '6px 0' }} />

                <DropdownMenu.Item
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  className="dropdown-item"
                  style={{
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderLeft: '3px solid transparent',
                    paddingLeft: '9px'
                  }}
                >
                  <RotateCw size={14} />
                  <span>Rotate Clockwise</span>
                </DropdownMenu.Item>

                <div style={{ height: '1px', backgroundColor: 'var(--border-default)', margin: '6px 0' }} />

                <DropdownMenu.Item
                  onClick={handleResetZoom}
                  className="dropdown-item"
                  style={{
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderLeft: '3px solid transparent',
                    paddingLeft: '9px'
                  }}
                >
                  <ZoomOut size={14} />
                  <span>Reset Zoom</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* Animated Search Bar Toolbar */}
      {searchOpen && (
        <div style={{
          background: 'rgba(18, 22, 36, 0.95)',
          borderBottom: '1px solid var(--border-default)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          zIndex: 40,
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1,
            maxWidth: '380px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            padding: '6px 12px'
          }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search in PDF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '15px',
                flex: 1
              }}
              autoFocus
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          {searchResults.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {currentMatchIndex + 1} of {searchResults.length}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={handleSearchPrev}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                  title="Previous Match"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={handleSearchNext}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                  title="Next Match"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
          )}
          
          <button
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              padding: '6px',
              borderRadius: '4px'
            }}
            title="Close Search"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Main Viewport: Native vertical and horizontal scrollbars on zoom */}
      <main
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          padding: '16px 8px',
          position: 'relative',
          display: 'block',
          scrollBehavior: 'smooth',
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
            <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
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
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>Error loading document</h3>
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
                renderScale={renderScale}
                containerWidth={containerWidth}
                isFastScrolling={isFastScrolling}
                isInRange={isPageInRange(layout.pageNumber)}
                isInCacheBuffer={isPageInCacheBuffer(layout.pageNumber)}
                searchQuery={searchQuery}
                displayMode={displayMode}
                rotation={rotation}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Active-Page overlay controls (Adobe interactive style) */}
      {!loading && !loadError && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 18, 28, 0.95)',
          border: '1px solid var(--border-default)',
          backdropFilter: 'var(--glass-blur)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          padding: '6px 12px',
          borderRadius: '9999px',
          zIndex: 99,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button
            onClick={goToPrevPage}
            disabled={activePageNum === 1}
            style={{
              background: 'none',
              border: 'none',
              color: activePageNum === 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
              cursor: activePageNum === 1 ? 'not-allowed' : 'pointer',
              padding: '6px',
              display: 'flex',
              borderRadius: '50%',
              transition: 'background var(--transition-fast)'
            }}
            title="Previous Page"
            onMouseEnter={e => { if (activePageNum > 1) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <ChevronUp size={20} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              onBlur={handlePageInputBlur}
              style={{
                width: '40px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-default)',
                borderRadius: '4px',
                textAlign: 'center',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                padding: '2px 0',
                fontWeight: 'bold',
                outline: 'none'
              }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>/ {numPages}</span>
          </div>

          <button
            onClick={goToNextPage}
            disabled={activePageNum === numPages}
            style={{
              background: 'none',
              border: 'none',
              color: activePageNum === numPages ? 'var(--text-muted)' : 'var(--text-secondary)',
              cursor: activePageNum === numPages ? 'not-allowed' : 'pointer',
              padding: '6px',
              display: 'flex',
              borderRadius: '50%',
              transition: 'background var(--transition-fast)'
            }}
            title="Next Page"
            onMouseEnter={e => { if (activePageNum < numPages) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <ChevronDown size={20} />
          </button>
        </div>
      )}

      {/* Static Footer (Zoom Percent indicator) */}
      {!loading && !loadError && (
        <footer style={{
          background: 'rgba(13, 15, 20, 0.95)',
          backdropFilter: 'var(--glass-blur)',
          borderTop: '1px solid var(--border-default)',
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleZoomOut}
              style={btnStyle}
              title="Zoom Out"
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <ZoomOut size={16} />
            </button>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              minWidth: '42px',
              textAlign: 'center',
              fontWeight: 600
            }}>
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              style={btnStyle}
              title="Zoom In"
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
