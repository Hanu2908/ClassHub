import { useRef, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';

interface BottomSheetProps {
  open?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
}

export function BottomSheet({ open = true, onClose, title, children }: BottomSheetProps) {
  const openTimeRef = useRef<number>(0);
  const dragControls = useDragControls();

  // Synchronize document scroll locking
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      openTimeRef.current = Date.now();
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

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
          className="sheet-panel"
          initial={{ y: '100%', x: '-50%' }}
          animate={{ y: 0, x: '-50%' }}
          exit={{ y: '100%', x: '-50%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 240 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0.05, bottom: 0.8 }}
          dragSnapToOrigin
          onDragEnd={(_e, info) => {
            if (info.offset.y > 100 || (info.velocity.y > 300 && info.offset.y > 20)) {
              onClose();
            }
          }}
          style={{
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
            onPointerDown={(e) => dragControls.start(e)}
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
