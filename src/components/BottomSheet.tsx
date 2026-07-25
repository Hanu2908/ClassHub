import { useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';

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
  
  const offsetY = useMotionValue(0);

  const openTimeRef = useRef<number>(0);

  // Synchronize document scroll locking and animate entry
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      offsetY.set(0);
      openTimeRef.current = Date.now();
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, offsetY]);

  const handleBackdropClick = () => {
    // Prevent trailing synthesized tap click from instantly closing sheet
    if (Date.now() - openTimeRef.current < 300) {
      return;
    }
    onClose();
  };

  // Dismiss on Escape key press (keyboard accessibility)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    startY.current = e.clientY;
    lastYRef.current = e.clientY;
    lastTimeRef.current = Date.now();
    velocityRef.current = 0;
    
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    
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
    
    offsetY.set(targetOffsetY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    const delta = e.clientY - startY.current;
    
    // Dismiss if dragged down > 100px OR flicked down with velocity > 0.4px/ms and minimum displacement
    const shouldDismiss = delta > 100 || (velocityRef.current > 0.4 && delta > 30);
    
    if (shouldDismiss) {
      animate(offsetY, window.innerHeight, { duration: 0.2 }).then(() => {
        onClose();
      });
    } else {
      animate(offsetY, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    animate(offsetY, 0, { type: 'spring', stiffness: 300, damping: 30 });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div 
          key="sheet-backdrop"
          className="sheet-backdrop" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick} 
        />
      )}
      {open && (
        <motion.div
          key="sheet-panel"
          ref={panelRef}
          className="sheet-panel"
          initial={{ y: '100%', x: '-50%' }}
          animate={{ y: 0, x: '-50%' }}
          exit={{ y: '100%', x: '-50%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          style={{
            y: offsetY,
            x: '-50%'
          }}
        >
          <div
            className="sheet-drag-zone"
            style={{
              cursor: 'grab',
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
