import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, ZoomIn, ZoomOut, Download, Share2, Loader2, AlertCircle,
  ChevronUp, ChevronDown, Check, RotateCw, Sun, Moon, Eye, MoreVertical, Search, X
} from 'lucide-react';
import { toast } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

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
  isLowEnd: boolean;
  isFastScrolling: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
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

// Dedicated virtualized wrapper for high-performance canvas page rendering
function PDFPageContainer({
  pageLayout,
  pdf,
  isLowEnd,
  isFastScrolling,
  scrollContainerRef,
  isInRange,
  isInCacheBuffer,
  searchQuery,
  displayMode,
  rotation
}: PDFPageContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [renderError, setRenderError] = useState(false);

  // Swap width and height if rotated by 90 or 270 degrees
  const isRotated90 = rotation === 90 || rotation === 270;
  const layoutWidth = isRotated90 ? pageLayout.height : pageLayout.width;
  const layoutHeight = isRotated90 ? pageLayout.width : pageLayout.height;

  // Calculate dynamic dimensions at base layout scale (zooming is done via CSS transform wrapper)
  const baseLayoutScale = 1.2;
  const containerWidth = Math.min(window.innerWidth - 32, 800) * baseLayoutScale;
  const pageScale = containerWidth / layoutWidth;
  const height = layoutHeight * pageScale;
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
    if ((!isVisible && !isInCacheBuffer) || isFastScrolling || !pdf || !canvasRef.current || drawingRef.current) return;

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
      const viewport = page.getViewport({ scale: pageScale * dpr, rotation: rotation });

      // Enforce physical width ceiling to prevent mobile Safari out-of-memory crash
      const MAX_PHYSICAL_CANVAS_WIDTH = 2048;
      let finalViewport = viewport;

      if (viewport.width > MAX_PHYSICAL_CANVAS_WIDTH) {
        const maxScale = MAX_PHYSICAL_CANVAS_WIDTH / (layoutWidth * pageScale);
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
  }, [pdf, isVisible, isInCacheBuffer, isFastScrolling, pageScale, pageLayout, rotation, layoutWidth]);

  const drawTextLayer = useCallback(async () => {
    if (!pdf || !textLayerRef.current || !isRendered) return;
    try {
      textLayerRef.current.innerHTML = '';
      const page = await pdf.getPage(pageLayout.pageNumber);
      const textContent = await page.getTextContent();
      const cssViewport = page.getViewport({ scale: pageScale, rotation: rotation });
      
      await window.pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: textLayerRef.current,
        viewport: cssViewport,
        textDivs: []
      }).promise;

      if (searchQuery) {
        applyHighlighting(textLayerRef.current, searchQuery);
      }
    } catch (err) {
      console.error(`[PDFViewer] Text layer redraw error on page ${pageLayout.pageNumber}:`, err);
    }
  }, [pdf, pageLayout.pageNumber, pageScale, searchQuery, rotation, isRendered]);

  useEffect(() => {
    if (isVisible || isInCacheBuffer) {
      if (!isRendered && !isFastScrolling) {
        drawPage();
      }
    } else {
      // Free memory immediately once page leaves active observer and buffer threshold
      setIsRendered(false);
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = '';
      }
    }
  }, [isVisible, isInCacheBuffer, isFastScrolling, isRendered, drawPage]);

  // Redraw text layer on search query changes or when rotation updates
  useEffect(() => {
    if (isRendered) {
      drawTextLayer();
    }
  }, [searchQuery, isRendered, rotation, drawTextLayer]);

  // Redraw canvas/text-layer on rotation change
  useEffect(() => {
    if (isRendered) {
      drawPage();
    }
  }, [rotation, isRendered, drawPage]);

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

      {(isVisible || isInCacheBuffer) && !renderError ? (
        <canvas 
          ref={canvasRef} 
          style={{ 
            display: isRendered ? 'block' : 'none',
            filter: canvasFilter,
            transition: 'filter var(--transition-fast)',
            width: '100%',
            height: '100%'
          }} 
        />
      ) : null}

      {(isVisible || isInCacheBuffer) && isRendered && !renderError && (
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
            zIndex: 10
          }}
        />
      )}

      {/* Loading Skeleton */}
      {!isRendered && !renderError && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-muted)'
        }}>
          <Loader2 className="animate-spin" size={24} />
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
  const [scale, setScale] = useState<number>(1.0);
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  const velocityTimerRef = useRef<number | null>(null);
  const transformRef = useRef<any>(null);

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

  // Helper: Get offset y value for a given page index at the base scale factor, adjusted for rotation
  const getPageOffsetTop = useCallback((pageIndex: number) => {
    if (pageLayouts.length === 0) return 0;
    const spacing = 16;
    let offset = 0;
    const baseLayoutScale = 1.2;
    const containerWidth = Math.min(window.innerWidth - 32, 800) * baseLayoutScale;
    const isRotated90 = rotation === 90 || rotation === 270;
    for (let i = 0; i < pageIndex; i++) {
      const layout = pageLayouts[i];
      const layoutWidth = isRotated90 ? layout.height : layout.width;
      const layoutHeight = isRotated90 ? layout.width : layout.height;
      const pageScale = containerWidth / layoutWidth;
      offset += (layoutHeight * pageScale) + spacing;
    }
    return offset;
  }, [pageLayouts, rotation]);

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

  // 6. IntersectionObserver to track Active Page dynamically (supports scroll & pan scale translations)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || pageLayouts.length === 0 || loading) return;

    const activeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page-number') || '1', 10);
            setActivePageNum(pageNum);
          }
        });
      },
      {
        root: container,
        rootMargin: '-40% 0px -40% 0px', // detects page in the center 20% band of viewport
        threshold: 0
      }
    );

    const wrappers = container.querySelectorAll('[data-page-number]');
    wrappers.forEach((el) => activeObserver.observe(el));

    return () => {
      activeObserver.disconnect();
    };
  }, [pageLayouts, loading]);

  // 7. Scroll Listener: Velocity rendering limiter
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || pageLayouts.length === 0) return;

    const scrollTop = container.scrollTop;
    const scrollTime = performance.now();

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
  }, [pageLayouts, isFastScrolling]);

  useEffect(() => {
    return () => {
      if (velocityTimerRef.current) {
        window.clearTimeout(velocityTimerRef.current);
      }
    };
  }, []);

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

  // Zoom wrapper scaling adjustments
  const handleTransform = (ref: any) => {
    setScale(ref.state.scale);
  };

  const handleZoomIn = () => {
    if (transformRef.current) {
      transformRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (transformRef.current) {
      transformRef.current.zoomOut();
    }
  };

  const handleResetZoom = () => {
    if (transformRef.current) {
      transformRef.current.resetTransform();
      setScale(1.0);
    }
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
          // Count total matches on page
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

  return (
    <div className="min-h-screen h-screen bg-[var(--bg-base)] flex flex-col text-[var(--text-primary)] font-[var(--font-body)] box-border overflow-hidden select-none">
      <style dangerouslySetInnerHTML={{ __html: textLayerStyles }} />

      {/* Sticky Top Header */}
      <header className="relative z-50 bg-[#0d0f14]/95 backdrop-blur-md border-b border-[var(--border-default)] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-full text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-colors"
            aria-label="Go Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-semibold text-[var(--text-primary)] m-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {title}
            </h1>
            {range && (
              <span className="text-[var(--status-warning)] text-[11px] font-medium font-mono mt-0.5 block">
                Your Set: Pages {range}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSearchOpen(prev => !prev)}
            className={`p-2 rounded-full transition-all ${searchOpen ? 'bg-[var(--accent-primary-glow)] text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'}`}
            title="Search PDF"
          >
            <Search size={18} />
          </button>
          
          <button
            onClick={handleShare}
            className="p-2 rounded-full text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-all"
            title="Share PDF link"
          >
            <Share2 size={18} />
          </button>

          <button
            onClick={handleDownload}
            className="p-2 rounded-full text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-all"
            title="Download PDF"
          >
            <Download size={18} />
          </button>

          {/* More options dropdown trigger */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="p-2 rounded-full text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-all"
                title="Options"
              >
                <MoreVertical size={18} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="dropdown-content animate-slide-up bg-[#0f121c]/95 border border-[var(--border-default)] backdrop-blur-md rounded-xl p-1 z-[10000] min-w-[180px] shadow-2xl"
              >
                <div className="px-2.5 py-1.5 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Display Mode</div>
                
                <DropdownMenu.Item
                  onClick={() => setDisplayMode('original')}
                  className="dropdown-item"
                  style={{
                    color: displayMode === 'original' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    background: displayMode === 'original' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                    fontWeight: displayMode === 'original' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
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
                    fontWeight: displayMode === 'dark' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
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
                    fontWeight: displayMode === 'sepia' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Eye size={14} />
                    Sepia
                  </span>
                  {displayMode === 'sepia' && <Check size={14} />}
                </DropdownMenu.Item>

                <div className="h-px bg-[var(--border-default)] my-1" />

                <DropdownMenu.Item
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  className="dropdown-item"
                  style={{
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <RotateCw size={14} />
                  <span>Rotate Clockwise</span>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onClick={handleResetZoom}
                  className="dropdown-item"
                  style={{
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
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
        <div className="bg-[#121624]/90 border-b border-[var(--border-default)] px-4 py-2 flex items-center justify-between gap-4 animate-slide-down z-40 relative">
          <div className="flex items-center gap-2 flex-1 max-w-md bg-white/5 border border-[var(--border-default)] rounded-lg px-3 py-1">
            <Search size={16} className="text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search in PDF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-[var(--text-primary)] text-sm flex-1"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={14} />
              </button>
            )}
          </div>
          
          {searchResults.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-secondary)] font-mono">
                {currentMatchIndex + 1} of {searchResults.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSearchPrev}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                  title="Previous Match"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={handleSearchNext}
                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
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
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded hover:bg-white/5 transition-all"
            title="Close Search"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Main Virtualized Continuous Scroll Viewport wrapped in Transform scale layers */}
      <main
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 relative block scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-[var(--accent-primary)]" size={32} />
            <p className="font-mono text-xs text-[var(--text-secondary)] m-0">
              {scriptLoaded ? 'Analyzing document layouts...' : 'Initializing canvas engine...'}
            </p>
          </div>
        ) : loadError ? (
          <div className="max-w-[340px] mx-auto my-20 p-6 bg-[var(--status-critical-bg)] border border-red-500/20 rounded-[var(--radius-md)] text-center flex flex-col items-center gap-3">
            <AlertCircle size={32} className="text-[var(--status-critical)]" />
            <h3 className="m-0 text-base font-semibold">Error loading document</h3>
            <p className="text-[var(--text-secondary)] text-xs m-0 leading-relaxed">{loadError}</p>
            <button
              className="btn-secondary mt-2 px-4 py-2"
              onClick={() => navigate(-1)}
            >
              Go Back
            </button>
          </div>
        ) : (
          <TransformWrapper
            ref={transformRef}
            initialScale={1.0}
            minScale={0.6}
            maxScale={3.0}
            centerOnInit={false}
            onTransform={handleTransform}
            panning={{
              disabled: scale === 1.0,
              velocityDisabled: true
            }}
            doubleClick={{
              disabled: false,
              step: 0.5
            }}
          >
            <TransformComponent
              wrapperStyle={{
                width: '100%',
                overflow: 'visible'
              }}
              contentStyle={{
                width: '100%',
                display: 'block'
              }}
            >
              <div className="block mx-auto max-w-full">
                {pageLayouts.map((layout) => (
                  <PDFPageContainer
                    key={layout.pageNumber}
                    pageLayout={layout}
                    pdf={pdf}
                    isLowEnd={isLowEnd}
                    isFastScrolling={isFastScrolling}
                    scrollContainerRef={scrollContainerRef}
                    isInRange={isPageInRange(layout.pageNumber)}
                    isInCacheBuffer={isPageInCacheBuffer(layout.pageNumber)}
                    searchQuery={searchQuery}
                    displayMode={displayMode}
                    rotation={rotation}
                  />
                ))}
              </div>
            </TransformComponent>
          </TransformWrapper>
        )}
      </main>

      {/* Floating Active-Page overlay controls (Adobe interactive style) */}
      {!loading && !loadError && (
        <div className="fixed bottom-[80px] left-1/2 -translate-x-1/2 bg-[#0f121c]/95 border border-[var(--border-default)] backdrop-blur-md shadow-2xl px-3 py-1.5 rounded-full z-[99] flex items-center gap-3 animate-fade-in">
          <button
            onClick={goToPrevPage}
            disabled={activePageNum === 1}
            className="p-1 rounded-full text-[var(--text-secondary)] hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="Previous Page"
          >
            <ChevronUp size={20} />
          </button>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              onBlur={handlePageInputBlur}
              className="w-10 bg-white/5 border border-[var(--border-default)] rounded text-center text-[var(--text-primary)] font-mono text-xs py-0.5 font-bold outline-none focus:border-[var(--accent-primary)] focus:bg-white/10 transition-all"
            />
            <span className="text-xs text-[var(--text-secondary)] font-mono">/ {numPages}</span>
          </div>

          <button
            onClick={goToNextPage}
            disabled={activePageNum === numPages}
            className="p-1 rounded-full text-[var(--text-secondary)] hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="Next Page"
          >
            <ChevronDown size={20} />
          </button>
        </div>
      )}

      {/* Static Footer (Zoom Percent indicator) */}
      {!loading && !loadError && (
        <footer className="bg-[#0d0f14]/95 backdrop-blur-md border-t border-[var(--border-default)] py-2 flex items-center justify-center z-40">
          <div className="flex items-center gap-3">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-all"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="font-mono text-xs text-[var(--text-secondary)] min-w-[42px] text-center font-semibold">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-all"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
