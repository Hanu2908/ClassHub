import { useEffect, useRef, useCallback, memo } from 'react';

interface PDFTextLayerProps {
  pdf: any;
  pageNumber: number;
  renderPageScale: number;
  rotation: number;
  searchQuery: string;
  isRendered: boolean;
  isInCacheBuffer: boolean;
}

export const textLayerStyles = `
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
      regex.lastIndex = 0;
      const parent = node.parentNode as HTMLElement;
      if (
        parent &&
        !parent.classList.contains('highlight') &&
        parent.tagName !== 'SCRIPT' &&
        parent.tagName !== 'STYLE'
      ) {
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

export const PDFTextLayer = memo(function PDFTextLayer({
  pdf,
  pageNumber,
  renderPageScale,
  rotation,
  searchQuery,
  isRendered,
  isInCacheBuffer,
}: PDFTextLayerProps) {
  const textLayerRef = useRef<HTMLDivElement>(null);

  const drawTextLayer = useCallback(async () => {
    if (!pdf || !textLayerRef.current || !isRendered || !isInCacheBuffer) return;
    try {
      textLayerRef.current.innerHTML = '';
      const page = await pdf.getPage(pageNumber);
      if (!isInCacheBuffer) return;
      const textContent = await page.getTextContent();
      if (!isInCacheBuffer) return;

      const safeRenderPageScale =
        isNaN(renderPageScale) || renderPageScale <= 0 ? 1.0 : renderPageScale;
      const cssViewport = page.getViewport({
        scale: safeRenderPageScale,
        rotation: rotation,
      });

      await window.pdfjsLib.renderTextLayer({
        textContent: textContent,
        textContentSource: textContent,
        container: textLayerRef.current,
        viewport: cssViewport,
        textDivs: [],
      }).promise;

      if (!isInCacheBuffer) return;

      if (searchQuery) {
        applyHighlighting(textLayerRef.current, searchQuery);
      }
    } catch (err) {
      console.error(`[PDFViewer] Text layer redraw error on page ${pageNumber}:`, err);
    }
  }, [pdf, pageNumber, renderPageScale, searchQuery, rotation, isRendered, isInCacheBuffer]);

  useEffect(() => {
    if (isRendered && isInCacheBuffer) {
      drawTextLayer();
    }
  }, [isRendered, isInCacheBuffer, searchQuery, rotation, drawTextLayer]);

  if (!isInCacheBuffer || !isRendered) return null;

  return (
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
        ['--scale-factor' as any]: renderPageScale,
      }}
    />
  );
});
