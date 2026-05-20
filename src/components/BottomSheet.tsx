import { useState, useEffect, useRef } from 'react';

interface BottomSheetProps {
  open?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
}

export function BottomSheet({ open = true, onClose, title, children }: BottomSheetProps) {
  const startY = useRef(0);
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

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setOffsetY(delta);
  };
  const handleTouchEnd = () => {
    setDragging(false);
    if (offsetY > 80) { setOffsetY(0); onClose(); }
    else setOffsetY(0);
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        className="sheet-panel"
        style={{ transform: `translateX(-50%) translateY(${offsetY}px)`, transition: dragging ? 'none' : undefined }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </>
  );
}
