import React from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { PDFZoomFooterProps } from '../types';

export const PDFZoomFooter: React.FC<PDFZoomFooterProps> = ({
  scale,
  onZoomIn,
  onZoomOut,
}) => {
  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'all var(--transition-fast)',
  };

  return (
    <footer
      style={{
        background: 'rgba(13, 15, 20, 0.95)',
        backdropFilter: 'var(--glass-blur)',
        borderTop: '1px solid var(--border-default)',
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onZoomOut}
          style={btnStyle}
          title="Zoom Out"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <ZoomOut size={16} />
        </button>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            minWidth: '42px',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          style={btnStyle}
          title="Zoom In"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <ZoomIn size={16} />
        </button>
      </div>
    </footer>
  );
};
