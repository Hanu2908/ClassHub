import { useEffect, useRef, useCallback, memo } from 'react';
import type { PDFDisplayMode } from '../types';

interface PDFPageCanvasProps {
  pdf: any;
  pageNumber: number;
  layoutWidth: number;
  renderPageScale: number;
  rotation: number;
  displayMode: PDFDisplayMode;
  isInCacheBuffer: boolean;
  isFastScrolling: boolean;
  onRenderSuccess: () => void;
  onRenderError: () => void;
}

export const PDFPageCanvas = memo(function PDFPageCanvas({
  pdf,
  pageNumber,
  layoutWidth,
  renderPageScale,
  rotation,
  displayMode,
  isInCacheBuffer,
  isFastScrolling,
  onRenderSuccess,
  onRenderError,
}: PDFPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const drawingRef = useRef(false);

  const drawPage = useCallback(async () => {
    if (!isInCacheBuffer || isFastScrolling || !pdf || !canvasRef.current || drawingRef.current)
      return;

    try {
      drawingRef.current = true;
      const page = await pdf.getPage(pageNumber);
      if (!isInCacheBuffer) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Cancel any active draw jobs on this canvas first
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      // High-DPI scaling: support crisp text on Retina/OLED screens (up to 3.0 DPR)
      const dpr = Math.min(3.0, window.devicePixelRatio || 1);
      const safeRenderPageScale =
        isNaN(renderPageScale) || renderPageScale <= 0 ? 1.0 : renderPageScale;
      const viewport = page.getViewport({
        scale: safeRenderPageScale * dpr,
        rotation: rotation,
      });

      // Ceiling at 4096px physical width to prevent blur during pinch-to-zoom
      const MAX_PHYSICAL_CANVAS_WIDTH = 4096;
      let finalViewport = viewport;

      if (viewport.width > MAX_PHYSICAL_CANVAS_WIDTH) {
        const maxScale = MAX_PHYSICAL_CANVAS_WIDTH / (layoutWidth || 595);
        finalViewport = page.getViewport({ scale: maxScale, rotation: rotation });
      }

      // Resize canvas element to match physical viewport dimensions exactly
      canvas.width = Math.floor(finalViewport.width);
      canvas.height = Math.floor(finalViewport.height);
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return;

      // Fill with solid white backdrop to enable optimal subpixel font rasterization
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      const renderContext = {
        canvasContext: context,
        viewport: finalViewport,
        intent: 'display',
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;

      if (!isInCacheBuffer || !canvasRef.current) return;

      onRenderSuccess();
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error(`[PDFViewer] Page ${pageNumber} render error:`, err);
        onRenderError();
      }
    } finally {
      drawingRef.current = false;
    }
  }, [
    pdf,
    pageNumber,
    layoutWidth,
    renderPageScale,
    rotation,
    isInCacheBuffer,
    isFastScrolling,
    onRenderSuccess,
    onRenderError,
  ]);

  useEffect(() => {
    if (isInCacheBuffer && !isFastScrolling) {
      drawPage();
    } else if (!isInCacheBuffer) {
      // Memory cleanup: reclaim GPU texture memory
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
    }
  }, [isInCacheBuffer, isFastScrolling, rotation, drawPage]);

  if (!isInCacheBuffer) return null;

  const canvasFilter =
    displayMode === 'dark'
      ? 'invert(0.9) hue-rotate(180deg)'
      : displayMode === 'sepia'
        ? 'sepia(0.6) contrast(0.95)'
        : 'none';

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        filter: canvasFilter,
        transition: 'filter var(--transition-fast)',
        width: '100%',
        height: '100%',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }}
    />
  );
});
