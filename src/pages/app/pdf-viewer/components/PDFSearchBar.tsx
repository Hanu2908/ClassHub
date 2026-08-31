import React from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import type { PDFSearchBarProps } from '../types';

export const PDFSearchBar: React.FC<PDFSearchBarProps> = ({
  searchQuery,
  searchResults,
  currentMatchIndex,
  onSearchChange,
  onSearchNext,
  onSearchPrev,
  onClose,
}) => {
  return (
    <div
      style={{
        background: 'rgba(18, 22, 36, 0.95)',
        borderBottom: '1px solid var(--border-default)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        zIndex: 40,
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: 1,
          maxWidth: '380px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          padding: '6px 12px',
        }}
      >
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search in PDF..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '15px',
            flex: 1,
          }}
          autoFocus
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {searchResults.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {currentMatchIndex + 1} of {searchResults.length}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={onSearchPrev}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
              }}
              title="Previous Match"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={onSearchNext}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
              }}
              title="Next Match"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          padding: '6px',
          borderRadius: '4px',
        }}
        title="Close Search"
      >
        <X size={18} />
      </button>
    </div>
  );
};
