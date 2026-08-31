import { useState, useEffect, useRef, useCallback } from 'react';
import type { PageLayout } from '../types';

interface UsePdfGesturesOptions {
  pageLayouts: PageLayout[];
  initialPage: number;
  rotation: number;
  loading: boolean;
}

export function usePdfGestures({
  pageLayouts,
  initialPage,
  rotation,
  loading,
}: UsePdfGesturesOptions) {
  const [scale, setScale] = useState<number>(1.0);
  const [renderScale, setRenderScale] = useState<number>(1.0);
  const [activePageNum, setActivePageNum] = useState<number>(initialPage);
  const [pageInputValue, setPageInputValue] = useState<string>(initialPage.toString());
  const [isFastScrolling, setIsFastScrolling] = useState<boolean>(false);
  const [initialScrollDone, setInitialScrollDone] = useState<boolean>(false);
  const [containerWidth, setContainerWidth] = useState<number>(375);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  const velocityTimerRef = useRef<number | null>(null);

  // Debounce scale updates for high-res redraws to keep gestures at 60 FPS
  useEffect(() => {
    const timer = setTimeout(() => {
      setRenderScale(scale);
    }, 250);
    return () => clearTimeout(timer);
  }, [scale]);

  // Dynamically observe container width for fit-to-width layout
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateWidth = () => {
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

  // Helper: Get offset y value for a given page index
  const getPageOffsetTop = useCallback(
    (pageIndex: number) => {
      if (pageLayouts.length === 0) return 0;
      const spacing = 16;
      let offset = 16;
      const safeScale = isNaN(scale) || scale <= 0 ? 1.0 : scale;
      const currentContainerWidth = containerWidth * safeScale;
      const isRotated90 = rotation === 90 || rotation === 270;

      for (let i = 0; i < pageIndex; i++) {
        const layout = pageLayouts[i];
        const layoutWidth = (isRotated90 ? layout.height : layout.width) || 595;
        const layoutHeight = (isRotated90 ? layout.width : layout.height) || 842;
        const pageScale = layoutWidth > 0 ? currentContainerWidth / layoutWidth : 1.0;
        offset += layoutHeight * pageScale + spacing;
      }
      return offset;
    },
    [pageLayouts, scale, rotation, containerWidth]
  );

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

  // Jump to initial target page offset
  useEffect(() => {
    if (loading || pageLayouts.length === 0 || initialScrollDone) return;

    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (container) {
        const originalScrollBehavior = container.style.scrollBehavior;
        container.style.scrollBehavior = 'auto';

        const offset = getPageOffsetTop(initialPage - 1);
        container.scrollTop = offset;

        lastScrollTopRef.current = offset;
        lastScrollTimeRef.current = performance.now();

        setActivePageNum(initialPage);
        setInitialScrollDone(true);

        setTimeout(() => {
          if (container) {
            container.style.scrollBehavior = originalScrollBehavior || 'smooth';
          }
        }, 50);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [loading, pageLayouts, initialPage, getPageOffsetTop, initialScrollDone]);

  // Scroll listener: active-page tracking and velocity limiter
  const handleScroll = useCallback(() => {
    if (!initialScrollDone) return;
    const container = scrollContainerRef.current;
    if (!container || pageLayouts.length === 0) return;

    const scrollTop = container.scrollTop;
    const scrollTime = performance.now();

    const dist = Math.abs(scrollTop - lastScrollTopRef.current);
    const time = scrollTime - lastScrollTimeRef.current;
    const velocity = time > 0 ? dist / time : 0;

    lastScrollTopRef.current = scrollTop;
    lastScrollTimeRef.current = scrollTime;

    // Fling speed check (> 2.5px/ms)
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

    // Active page intersection
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
      const pageBottom = pageTop + layoutHeight * pageScale + 16;

      if (viewportMiddle >= pageTop && viewportMiddle <= pageBottom) {
        currentActive = layout.pageNumber;
        break;
      }
    }

    if (currentActive !== activePageNum) {
      setActivePageNum(currentActive);
    }
  }, [
    pageLayouts,
    activePageNum,
    getPageOffsetTop,
    isFastScrolling,
    scale,
    rotation,
    initialScrollDone,
    containerWidth,
  ]);

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
    let lastTapTime = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        startDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        startScale = scaleRef.current;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime < 300) {
          e.preventDefault();
          setScale((current) => (current < 1.4 ? 2.0 : 1.0));
          lastTapTime = 0;
          return;
        }
        lastTapTime = now;
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

  // Sync floating page input value
  useEffect(() => {
    setPageInputValue(activePageNum.toString());
  }, [activePageNum]);

  const jumpToPage = useCallback(
    (pageNum: number, numPages: number) => {
      let target = pageNum;
      if (isNaN(target) || target < 1) target = 1;
      if (target > numPages) target = numPages;

      const offset = getPageOffsetTop(target - 1);
      scrollContainerRef.current?.scrollTo({
        top: offset,
        behavior: 'smooth',
      });
      setActivePageNum(target);
      setPageInputValue(target.toString());
    },
    [getPageOffsetTop]
  );

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.2, 0.3));
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1.0);
  }, []);

  return {
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
  };
}
