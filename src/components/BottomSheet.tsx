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
  
  const [shouldRender, setShouldRender] = useState(open);
  const [isActive, setIsActive] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [offsetY, setOffsetY] = useState(0);

  // Synchronize internal rendering state with parent's open prop
  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setOffsetY(0); // Reset drag offset on open so it doesn't render off-screen if previously swiped
      // Defer transition active state to let the DOM mount and paint in its initial state
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 30);
      return () => clearTimeout(timer);
    } else {
      setIsActive(false);
      // Wait for exit animations to complete before unmounting (matches CSS transition)
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 280);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Synchronize document scroll locking
  useEffect(() => {
    if (shouldRender && open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [shouldRender, open]);

  // Dismiss on Escape key press (keyboard accessibility)
  useEffect(() => {
    if (!shouldRender || !open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shouldRender, open, onClose]);

  if (!shouldRender) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
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
    
    const delta = e.clientY - startY.current;
    
    // Dismiss if dragged down > 100px OR flicked down with velocity > 0.4px/ms and minimum displacement
    const shouldDismiss = delta > 100 || (velocityRef.current > 0.4 && delta > 30);
    
    if (shouldDismiss) {
      setIsActive(false);
      setOffsetY(window.innerHeight);
      
      setTimeout(() => {
        onClose();
      }, 240);
    } else {
      setOffsetY(0);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    setOffsetY(0);
  };

  return (
    <>
      <div 
        className={`sheet-backdrop ${isActive ? 'active' : ''}`} 
        onClick={onClose} 
      />
      <div
        ref={panelRef}
        className={`sheet-panel ${isActive ? 'active' : ''}`}
        style={{
          transform: isActive 
            ? `translate3d(-50%, ${offsetY}px, 0)` 
            : `translate3d(-50%, 100%, 0)`,
          transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      >
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
        
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </>
  );
}
