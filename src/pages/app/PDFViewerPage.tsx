import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { downloadAttachmentFile } from '../../lib/utils/attachments';
import type { PDFDisplayMode } from './pdf-viewer/types';
import { usePdfEngine } from './pdf-viewer/hooks/usePdfEngine';
import { usePdfDocument } from './pdf-viewer/hooks/usePdfDocument';
import { usePdfGestures } from './pdf-viewer/hooks/usePdfGestures';
import { usePdfSearch } from './pdf-viewer/hooks/usePdfSearch';
import { textLayerStyles } from './pdf-viewer/components/PDFTextLayer';
import { PDFHeaderBar } from './pdf-viewer/components/PDFHeaderBar';
import { PDFSearchBar } from './pdf-viewer/components/PDFSearchBar';
import { PDFPageContainer } from './pdf-viewer/components/PDFPageContainer';
import { PDFPagePill } from './pdf-viewer/components/PDFPagePill';
import { PDFZoomFooter } from './pdf-viewer/components/PDFZoomFooter';

export default function PDFViewerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const rawUrl = searchParams.get('url') || '';
  const storagePath = searchParams.get('path') || '';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const range = searchParams.get('range') || '';
  const title = searchParams.get('title') || 'PDF Viewer';

  // Advanced features states
  const [displayMode, setDisplayMode] = useState<PDFDisplayMode>('original');
  const [rotation, setRotation] = useState<number>(0);

  // Performance configurations
  const [isLowEnd] = useState<boolean>(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const ram = (navigator as any).deviceMemory || 4;
    return cores <= 4 || ram < 4;
  });

  // PDF.js dynamic engine loader
  const { scriptLoaded, engineError } = usePdfEngine();

  // Document loading, parallel layout metadata & self-healing signed URL
  const {
    pdf,
    numPages,
    pageLayouts,
    loading,
    loadError: docError,
    activeUrl,
  } = usePdfDocument({
    rawUrl,
    storagePath,
    scriptLoaded,
  });

  const loadError = engineError || docError;

  // Gestures, viewport virtualizer & zoom state
  const {
    scale,
    renderScale,
    activePageNum,
    pageInputValue,
    setPageInputValue,
    containerWidth,
    isFastScrolling,
    scrollContainerRef,
    handleScroll,
    jumpToPage,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
  } = usePdfGestures({
    pageLayouts,
    initialPage,
    rotation,
    loading,
  });

  const handleJumpToPage = useCallback(
    (pageNum: number) => {
      jumpToPage(pageNum, numPages);
    },
    [jumpToPage, numPages]
  );

  // In-document text search
  const {
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchResults,
    currentMatchIndex,
    handleSearchNext,
    handleSearchPrev,
    handleCloseSearch,
  } = usePdfSearch({
    pdf,
    numPages,
    onJumpToPage: handleJumpToPage,
  });

  // Paging controls
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d+$/.test(val)) {
      setPageInputValue(val);
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      jumpToPage(parseInt(pageInputValue, 10), numPages);
      e.currentTarget.blur();
    }
  };

  const handlePageInputBlur = () => {
    jumpToPage(parseInt(pageInputValue, 10), numPages);
  };

  const goToPrevPage = useCallback(() => {
    if (activePageNum > 1) {
      jumpToPage(activePageNum - 1, numPages);
    }
  }, [activePageNum, numPages, jumpToPage]);

  const goToNextPage = useCallback(() => {
    if (activePageNum < numPages) {
      jumpToPage(activePageNum + 1, numPages);
    }
  }, [activePageNum, numPages, jumpToPage]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toUpperCase();
      if (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        navigate(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToNextPage, goToPrevPage, navigate]);

  // Actions
  const handleDownload = useCallback(async () => {
    const downloadFilename = title.endsWith('.pdf') ? title : `${title}.pdf`;
    if (storagePath) {
      try {
        await downloadAttachmentFile(storagePath, downloadFilename, 3600);
        toast.success('Download started');
        return;
      } catch {
        toast.error('Failed to download PDF');
        return;
      }
    }
    const currentUrl = activeUrl || rawUrl;
    if (!currentUrl) return;
    try {
      const a = document.createElement('a');
      a.href = currentUrl;
      a.download = downloadFilename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Download started');
    } catch {
      toast.error('Failed to download PDF');
    }
  }, [title, storagePath, activeUrl, rawUrl]);

  const handleShare = useCallback(async () => {
    const currentUrl = activeUrl || rawUrl;
    if (!currentUrl) return;
    const shareData = {
      title: title,
      text: `ClassHub PDF: ${title} (Page ${activePageNum})`,
      url: currentUrl,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(currentUrl);
        toast.success('Temporary view link copied to clipboard!');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('[PDFViewer] Share error:', err);
        toast.error('Could not share link');
      }
    }
  }, [title, activePageNum, activeUrl, rawUrl]);

  // Helper range checker
  const isPageInRange = useCallback(
    (pageNum: number) => {
      if (!range) return false;
      try {
        if (range.includes('-')) {
          const [start, end] = range.split('-').map((x) => parseInt(x.trim(), 10));
          return pageNum >= start && pageNum <= end;
        } else {
          return pageNum === parseInt(range.trim(), 10);
        }
      } catch {
        return false;
      }
    },
    [range]
  );

  // Virtualizer slide buffer
  const isPageInCacheBuffer = useCallback(
    (pageNum: number) => {
      const rangeLimit = isLowEnd ? 1 : 2;
      return Math.abs(pageNum - activePageNum) <= rangeLimit;
    },
    [isLowEnd, activePageNum]
  );

  return (
    <div
      style={{
        minHeight: '100dvh',
        height: '100dvh',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-body)',
        boxSizing: 'border-box',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: textLayerStyles }} />

      {/* Header Bar */}
      <PDFHeaderBar
        title={title}
        range={range}
        displayMode={displayMode}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((prev) => !prev)}
        onShare={handleShare}
        onDownload={handleDownload}
        onSelectDisplayMode={setDisplayMode}
        onRotateClockwise={() => setRotation((prev) => (prev + 90) % 360)}
        onResetZoom={handleResetZoom}
        onBack={() => navigate(-1)}
      />

      {/* Search Bar */}
      {searchOpen && (
        <PDFSearchBar
          searchQuery={searchQuery}
          searchResults={searchResults}
          currentMatchIndex={currentMatchIndex}
          onSearchChange={setSearchQuery}
          onSearchNext={handleSearchNext}
          onSearchPrev={handleSearchPrev}
          onClose={handleCloseSearch}
        />
      )}

      {/* Main Document Viewport */}
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
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {loading ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
            <p className="t-mono-sm" style={{ color: 'var(--text-secondary)', margin: 0 }}>
              {scriptLoaded ? 'Analyzing document layouts...' : 'Initializing canvas engine...'}
            </p>
          </div>
        ) : loadError ? (
          <div
            style={{
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
              gap: '12px',
            }}
          >
            <AlertCircle size={32} color="var(--status-critical)" />
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>Error loading document</h3>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '13px',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {loadError}
            </p>
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

      {/* Floating Active-Page Pill Navigation */}
      {!loading && !loadError && (
        <PDFPagePill
          activePageNum={activePageNum}
          numPages={numPages}
          pageInputValue={pageInputValue}
          onPageInputChange={handlePageInputChange}
          onPageInputKeyDown={handlePageInputKeyDown}
          onPageInputBlur={handlePageInputBlur}
          onPrevPage={goToPrevPage}
          onNextPage={goToNextPage}
        />
      )}

      {/* Bottom Zoom Control Footer */}
      {!loading && !loadError && (
        <PDFZoomFooter scale={scale} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />
      )}
    </div>
  );
}
