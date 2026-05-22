import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ZoomIn, ZoomOut, Download, Share2, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { showToast } from '../../components/Toast';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfjsLib?: any;
  }
}

export default function PDFViewerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const url = searchParams.get('url') || '';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const range = searchParams.get('range') || '';
  const title = searchParams.get('title') || 'PDF Viewer';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState<number>(initialPage);
  const [numPages, setNumPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2); // Render scaling multiplier
  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);

  // Load PDF.js dynamically from CDN
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

  // Fetch the PDF document when script is loaded and url is provided
  useEffect(() => {
    if (!scriptLoaded || !url) return;

    let active = true;

    const loadPDF = async () => {
      // Set states inside the async function to avoid synchronous cascading renders
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
        
        // Ensure starting page is bound correctly
        const start = Math.max(1, Math.min(initialPage, pdfDoc.numPages));
        setPageNum(start);
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

    loadPDF();

    return () => {
      active = false;
    };
  }, [scriptLoaded, url, initialPage]);

  // Page Render Functionality
  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current || rendering) return;

    try {
      setRendering(true);
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      // Cancel any active render tasks
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      // Calculate viewport at high density for maximum text crispness
      const dpr = window.devicePixelRatio || 1;
      const baseViewport = page.getViewport({ scale: 1.0 });
      
      // Calculate responsive width scaling
      const containerWidth = Math.min(window.innerWidth - 32, 800);
      const responsiveScale = (containerWidth / baseViewport.width) * scale;
      
      const viewport = page.getViewport({ scale: responsiveScale * dpr });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Set CSS dimensions for dynamic responsive fitting
      canvas.style.width = `${containerWidth * scale}px`;
      canvas.style.maxWidth = 'none';
      canvas.style.height = 'auto';

      context.scale(1, 1);

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err) {
      const error = err as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (error?.name !== 'RenderingCancelledException') {
        console.error('[PDFViewer] Render error:', err);
      }
    } finally {
      setRendering(false);
    }
  }, [pdf, pageNum, scale, rendering]);

  // Trigger page render when page, PDF, or scale changes
  useEffect(() => {
    let active = true;

    const triggerRender = async () => {
      // Defer render trigger using microtask to avoid synchronous setState inside effect
      await Promise.resolve();
      if (active) {
        renderPage();
      }
    };

    triggerRender();

    return () => {
      active = false;
    };
  }, [renderPage]);

  // Navigation handlers
  const handlePrevPage = () => {
    if (pageNum > 1) {
      setPageNum(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (pdf && pageNum < pdf.numPages) {
      setPageNum(prev => prev + 1);
    }
  };

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
      showToast('Download started', 'success');
    } catch {
      showToast('Failed to download PDF', 'error');
    }
  };

  const handleShare = async () => {
    if (!url) return;
    const shareData = {
      title: title,
      text: `ClassHub PDF: ${title} (Page ${pageNum})`,
      url: url
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        showToast('Temporary view link copied to clipboard!', 'success');
      }
    } catch (err) {
      const error = err as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (error?.name !== 'AbortError') {
        console.error('[PDFViewer] Share error:', err);
        showToast('Could not share link', 'error');
      }
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-body)',
      boxSizing: 'border-box'
    }}>
      {/* Sticky Header */}
      <header style={{
        position: 'sticky',
        top: 0,
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
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
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

      {/* Main Content Render Panel */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflow: 'auto',
        position: 'relative'
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Loader2 className="spin" size={32} color="var(--accent-primary)" />
            <p className="t-mono-sm" style={{ color: 'var(--text-secondary)', margin: 0 }}>Initializing canvas stream...</p>
          </div>
        ) : loadError ? (
          <div style={{
            maxWidth: '340px',
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
          <div style={{
            position: 'relative',
            display: 'block',
            margin: 'auto',
            transition: 'transform var(--transition-slow)'
          }}>
            <canvas 
              ref={canvasRef}
              style={{
                background: '#ffffff',
                boxShadow: 'var(--shadow-elevated)',
                borderRadius: '8px',
                transition: 'all 0.15s ease',
                display: 'block',
                margin: 'auto'
              }}
            />
          </div>
        )}
      </main>

      {/* Sticky Bottom Actions Bar */}
      {!loading && !loadError && (
        <footer style={{
          position: 'sticky',
          bottom: 0,
          background: 'rgba(13, 15, 20, 0.95)',
          backdropFilter: 'var(--glass-blur)',
          borderTop: '1px solid var(--border-default)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 40
        }}>
          {/* Zoom Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
              minWidth: '38px',
              textAlign: 'center'
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

          {/* Page Counter UI */}
          <div className="t-mono-sm" style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            fontWeight: 500
          }}>
            Page <span style={{ color: 'var(--accent-primary)' }}>{pageNum}</span> of {numPages}
          </div>

          {/* Page Navigators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrevPage}
              disabled={pageNum <= 1}
              style={{
                background: 'none',
                border: '1px solid var(--border-default)',
                color: pageNum <= 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                cursor: pageNum <= 1 ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={e => {
                if (pageNum > 1) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'var(--border-active)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.color = pageNum <= 1 ? 'var(--text-muted)' : 'var(--text-secondary)';
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleNextPage}
              disabled={pageNum >= numPages}
              style={{
                background: 'none',
                border: '1px solid var(--border-default)',
                color: pageNum >= numPages ? 'var(--text-muted)' : 'var(--text-secondary)',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                cursor: pageNum >= numPages ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={e => {
                if (pageNum < numPages) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'var(--border-active)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.color = pageNum >= numPages ? 'var(--text-muted)' : 'var(--text-secondary)';
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
