import { useState, useCallback, memo } from 'react';
import { Loader2, AlertCircle, RotateCw } from 'lucide-react';
import type { PDFPageContainerProps } from '../types';
import { PDFPageCanvas } from './PDFPageCanvas';
import { PDFTextLayer } from './PDFTextLayer';

export const PDFPageContainer = memo(function PDFPageContainer({
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
  rotation,
}: PDFPageContainerProps) {
  const [isRendered, setIsRendered] = useState(false);
  const [renderError, setRenderError] = useState(false);

  // Swap width and height if rotated by 90 or 270 degrees
  const isRotated90 = rotation === 90 || rotation === 270;
  const layoutWidth = (isRotated90 ? pageLayout.height : pageLayout.width) || 595;
  const layoutHeight = (isRotated90 ? pageLayout.width : pageLayout.height) || 842;

  // Real-time visual scale
  const safeScale = isNaN(scale) || scale <= 0 ? 1.0 : scale;
  const currentContainerWidth = containerWidth * safeScale;
  const pageScale = layoutWidth > 0 ? currentContainerWidth / layoutWidth : 1.0;
  const height = Math.round(layoutHeight * pageScale);
  const width = Math.round(currentContainerWidth);

  // Debounced render dimensions
  const safeRenderScale = isNaN(renderScale) || renderScale <= 0 ? 1.0 : renderScale;
  const renderContainerWidth = containerWidth * safeRenderScale;
  const renderPageScale = layoutWidth > 0 ? renderContainerWidth / layoutWidth : 1.0;
  const renderDisplayHeight = Math.round(layoutHeight * renderPageScale);
  const renderDisplayWidth = Math.round(renderContainerWidth);

  const handleRenderSuccess = useCallback(() => {
    setIsRendered(true);
    setRenderError(false);
  }, []);

  const handleRenderError = useCallback(() => {
    setRenderError(true);
  }, []);

  const handleRetry = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setRenderError(false);
    setIsRendered(false);
  }, []);

  return (
    <div
      className="pdf-container"
      data-page-number={pageLayout.pageNumber}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        margin: '0 auto 16px auto',
        position: 'relative',
        background: 'var(--bg-elevated)',
        borderRadius: '8px',
        boxShadow: isInRange
          ? '0 0 0 2px var(--status-warning), var(--shadow-elevated)'
          : '0 0 0 1px var(--border-default), var(--shadow-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        transition: 'box-shadow var(--transition-fast)',
      }}
    >
      {/* Assigned range indicator */}
      {isInRange && (
        <span
          style={{
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
            pointerEvents: 'none',
          }}
        >
          Assigned
        </span>
      )}

      {/* Canvas Layer */}
      <PDFPageCanvas
        pdf={pdf}
        pageNumber={pageLayout.pageNumber}
        layoutWidth={layoutWidth}
        displayWidth={renderDisplayWidth}
        displayHeight={renderDisplayHeight}
        rotation={rotation}
        displayMode={displayMode}
        isInCacheBuffer={isInCacheBuffer}
        isFastScrolling={isFastScrolling}
        onRenderSuccess={handleRenderSuccess}
        onRenderError={handleRenderError}
      />

      {/* Text Layer */}
      <PDFTextLayer
        pdf={pdf}
        pageNumber={pageLayout.pageNumber}
        layoutWidth={layoutWidth}
        displayWidth={width}
        rotation={rotation}
        searchQuery={searchQuery}
        isRendered={isRendered}
        isInCacheBuffer={isInCacheBuffer}
      />

      {/* Loading Skeleton */}
      {isInCacheBuffer && !isRendered && !renderError && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-muted)',
          }}
        >
          <Loader2 className="animate-spin" size={24} />
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            Page {pageLayout.pageNumber}
          </span>
        </div>
      )}

      {/* Error state */}
      {renderError && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--status-critical)',
            padding: '16px',
            textAlign: 'center',
            zIndex: 30,
          }}
        >
          <AlertCircle size={24} />
          <span style={{ fontSize: '12px', fontWeight: 500 }}>Failed to draw page</span>
          <button
            onClick={handleRetry}
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
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(248, 113, 113, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(248, 113, 113, 0.15)';
            }}
          >
            <RotateCw size={12} />
            Retry
          </button>
        </div>
      )}
    </div>
  );
});
