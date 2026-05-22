import { useState, useEffect, useRef } from 'react';

interface BottomSheetProps {
  open?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
}

export function BottomSheet({ open = true, onClose, title, children }: BottomSheetProps) {
  const startY = useRef(0);
  const lastYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  
  const [dragging, setDragging] = useState(false);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    let frame = 0;
    if (open) {
      frame = requestAnimationFrame(() => setOffsetY(0));
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag with left mouse button click or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    setDragging(true);
    startY.current = e.clientY;
    lastYRef.current = e.clientY;
    lastTimeRef.current = Date.now();
    velocityRef.current = 0;
    
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    
    const currentY = e.clientY;
    const currentTime = Date.now();
    const timeDelta = currentTime - lastTimeRef.current;
    
    // Calculate swipe velocity in px/ms
    if (timeDelta > 0) {
      velocityRef.current = (currentY - lastYRef.current) / timeDelta;
    }
    
    lastYRef.current = currentY;
    lastTimeRef.current = currentTime;
    
    const delta = currentY - startY.current;
    
    // Premium elastic rubber-band stretch when dragging up
    let targetOffsetY = delta;
    if (targetOffsetY < 0) {
      targetOffsetY = targetOffsetY * 0.15;
    }
    
    setOffsetY(targetOffsetY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    // Dismiss if dragged down > 100px OR flicked down with velocity > 0.4px/ms and minimum displacement
   // Let the panel slide out with a faster, dedicated linear-glide exit transition
  if (panelRef.current) {
    panelRef.current.style.transition = 'transform 0.24s cubic-bezier(0.25, 1, 0.5, 1)';
  }
  setOffsetY(window.innerHeight); 
  
  setTimeout(() => {
    onClose();
  }, 240); // Wait for the full 240ms exit slide-down to finish completely
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    setOffsetY(0);
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        className="sheet-panel"
        style={{
          transform: `translateX(-50%) translateY(${offsetY}px)`,
// NEW SMOOTH TWEAK:
transition: dragging ? 'none' : 'transform 0.32s cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      >
        {/* Enforce Option A: Drag zone restricted only to the handle and header area */}
        <div
          className="sheet-drag-zone"
          style={{
            cursor: dragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <div className="sheet-handle" />
          {title && (
            <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--border-default)' }}>
              {typeof title === 'string' ? (
                <p style={{ font: '600 17px var(--font-display)', color: 'var(--text-primary)' }}>{title}</p>
              ) : (
                title
              )}
            </div>
          )}
        </div>
        
        {/* Content area: safe from drag triggers, supporting standard scrolling */}
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </>
  );
}
