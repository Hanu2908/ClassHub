import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { PDFPagePillProps } from '../types';

export const PDFPagePill: React.FC<PDFPagePillProps> = ({
  activePageNum,
  numPages,
  pageInputValue,
  onPageInputChange,
  onPageInputKeyDown,
  onPageInputBlur,
  onPrevPage,
  onNextPage,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15, 18, 28, 0.95)',
        border: '1px solid var(--border-default)',
        backdropFilter: 'var(--glass-blur)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        padding: '6px 12px',
        borderRadius: '9999px',
        zIndex: 99,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <button
        onClick={onPrevPage}
        disabled={activePageNum === 1}
        style={{
          background: 'none',
          border: 'none',
          color: activePageNum === 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
          cursor: activePageNum === 1 ? 'not-allowed' : 'pointer',
          padding: '6px',
          display: 'flex',
          borderRadius: '50%',
          transition: 'background var(--transition-fast)',
        }}
        title="Previous Page"
        onMouseEnter={(e) => {
          if (activePageNum > 1) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none';
        }}
      >
        <ChevronUp size={20} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="text"
          value={pageInputValue}
          onChange={onPageInputChange}
          onKeyDown={onPageInputKeyDown}
          onBlur={onPageInputBlur}
          style={{
            width: '40px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-default)',
            borderRadius: '4px',
            textAlign: 'center',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            padding: '2px 0',
            fontWeight: 'bold',
            outline: 'none',
          }}
        />
        <span
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          / {numPages}
        </span>
      </div>

      <button
        onClick={onNextPage}
        disabled={activePageNum === numPages}
        style={{
          background: 'none',
          border: 'none',
          color: activePageNum === numPages ? 'var(--text-muted)' : 'var(--text-secondary)',
          cursor: activePageNum === numPages ? 'not-allowed' : 'pointer',
          padding: '6px',
          display: 'flex',
          borderRadius: '50%',
          transition: 'background var(--transition-fast)',
        }}
        title="Next Page"
        onMouseEnter={(e) => {
          if (activePageNum < numPages)
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none';
        }}
      >
        <ChevronDown size={20} />
      </button>
    </div>
  );
};
