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
      const context = canvas?.getContext('2d');
      if (!context || !canvas) return;

      // Cancel any active draw jobs on this canvas first
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      // Cap DPI scaling at 2.0 to protect GPU texture buffer
      const dpr = Math.min(2.0, window.devicePixelRatio || 1);
      const safeRenderPageScale =
        isNaN(renderPageScale) || renderPageScale <= 0 ? 1.0 : renderPageScale;
      const viewport = page.getViewport({
        scale: safeRenderPageScale * dpr,
        rotation: rotation,
      });

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
        viewport: finalViewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;

      if (!isInCacheBuffer || !canvasRef.current) return;

      // Synchronously write back to DOM canvas in single paint step
      canvas.width = finalViewport.width;
      canvas.height = finalViewport.height;
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      context.drawImage(tempCanvas, 0, 0);
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
      }}
    />
  );
});
