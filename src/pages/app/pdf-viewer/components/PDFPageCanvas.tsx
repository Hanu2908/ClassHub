import { useEffect, useRef, useCallback, memo } from 'react';
import type { PDFDisplayMode } from '../types';

interface PDFPageCanvasProps {
  pdf: any;
  pageNumber: number;
  layoutWidth: number;
  displayWidth: number;
  displayHeight: number;
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
  displayWidth,
  displayHeight,
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

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      // High-DPI scaling: capture true device pixel ratio (capped at 3.0)
      const dpr = Math.min(3.0, window.devicePixelRatio || 1);

      // Compute exact integer backing store dimensions
      const pixelWidth = Math.round(displayWidth * dpr);
      const pixelHeight = Math.round(displayHeight * dpr);

      // 4096px physical texture ceiling
      const MAX_PHYSICAL_CANVAS_WIDTH = 4096;
      let finalPixelWidth = pixelWidth;
      let finalPixelHeight = pixelHeight;

      if (pixelWidth > MAX_PHYSICAL_CANVAS_WIDTH) {
        const ratio = MAX_PHYSICAL_CANVAS_WIDTH / pixelWidth;
        finalPixelWidth = MAX_PHYSICAL_CANVAS_WIDTH;
        finalPixelHeight = Math.round(pixelHeight * ratio);
      }

      canvas.width = finalPixelWidth;
      canvas.height = finalPixelHeight;

      // Lock CSS presentation dimensions to exact pixels (not 100%) to prevent subpixel blurring
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      const exactScale = layoutWidth > 0 ? finalPixelWidth / layoutWidth : dpr;
      const viewport = page.getViewport({
        scale: exactScale,
        rotation: rotation,
      });

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return;

      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, finalPixelWidth, finalPixelHeight);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
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
    displayWidth,
    displayHeight,
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
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }}
    />
  );
});
