import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  Share2,
  Download,
  MoreVertical,
  Sun,
  Moon,
  Eye,
  RotateCw,
  ZoomOut,
  Check,
} from 'lucide-react';
import type { PDFHeaderBarProps } from '../types';

export const PDFHeaderBar: React.FC<PDFHeaderBarProps> = ({
  title,
  range,
  displayMode,
  searchOpen,
  onToggleSearch,
  onShare,
  onDownload,
  onSelectDisplayMode,
  onRotateClockwise,
  onResetZoom,
  onBack,
}) => {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!optionsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setOptionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [optionsOpen]);

  const headerStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 50,
    background: 'rgba(13, 15, 20, 0.95)',
    backdropFilter: 'var(--glass-blur)',
    borderBottom: '1px solid var(--border-default)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  };

  const headerLeftStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
    flex: 1,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

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

  const menuItemStyle = (isActive: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    background: isActive ? 'rgba(74, 158, 255, 0.08)' : 'transparent',
    border: 'none',
    borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
    borderRadius: 'var(--radius-sm)',
    color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
    fontWeight: isActive ? 600 : 400,
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background var(--transition-fast)',
  });

  return (
    <header style={headerStyle}>
      <div style={headerLeftStyle}>
        <button
          onClick={onBack}
          style={btnStyle}
          aria-label="Go Back"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={titleStyle}>{title}</h1>
          {range && (
            <span
              className="t-mono-sm"
              style={{
                color: 'var(--status-warning)',
                fontSize: '12px',
                fontWeight: 500,
                marginTop: '2px',
                display: 'block',
              }}
            >
              Your Set: Pages {range}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={onToggleSearch}
          style={{
            ...btnStyle,
            background: searchOpen ? 'var(--accent-primary-glow)' : 'none',
            color: searchOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
          }}
          title="Search PDF"
          onMouseEnter={(e) => {
            if (!searchOpen) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          }}
          onMouseLeave={(e) => {
            if (!searchOpen) e.currentTarget.style.background = 'none';
          }}
        >
          <Search size={18} />
        </button>

        <button
          onClick={onShare}
          style={btnStyle}
          title="Share PDF link"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <Share2 size={18} />
        </button>

        <button
          onClick={onDownload}
          style={btnStyle}
          title="Download PDF"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <Download size={18} />
        </button>

        {/* Options dropdown menu */}
        <div ref={optionsRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setOptionsOpen((prev) => !prev)}
            style={{
              ...btnStyle,
              background: optionsOpen ? 'rgba(255, 255, 255, 0.08)' : 'none',
              color: optionsOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            title="Options"
            aria-expanded={optionsOpen}
            aria-haspopup="true"
          >
            <MoreVertical size={18} />
          </button>

          {optionsOpen && (
            <div
              className="dropdown-content animate-slide-up"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 10000,
                minWidth: '190px',
                background: 'rgba(18, 20, 29, 0.98)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-elevated)',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  onSelectDisplayMode('original');
                  setOptionsOpen(false);
                }}
                style={menuItemStyle(displayMode === 'original')}
                onMouseEnter={(e) => {
                  if (displayMode !== 'original') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  if (displayMode !== 'original') e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sun size={14} />
                  Original (Light)
                </span>
                {displayMode === 'original' && <Check size={14} />}
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectDisplayMode('dark');
                  setOptionsOpen(false);
                }}
                style={menuItemStyle(displayMode === 'dark')}
                onMouseEnter={(e) => {
                  if (displayMode !== 'dark') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  if (displayMode !== 'dark') e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Moon size={14} />
                  Dark Mode
                </span>
                {displayMode === 'dark' && <Check size={14} />}
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectDisplayMode('sepia');
                  setOptionsOpen(false);
                }}
                style={menuItemStyle(displayMode === 'sepia')}
                onMouseEnter={(e) => {
                  if (displayMode !== 'sepia') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  if (displayMode !== 'sepia') e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Eye size={14} />
                  Sepia
                </span>
                {displayMode === 'sepia' && <Check size={14} />}
              </button>

              <div
                style={{
                  height: '1px',
                  backgroundColor: 'var(--border-default)',
                  margin: '4px 0',
                }}
              />

              <button
                type="button"
                onClick={() => {
                  onRotateClockwise();
                  setOptionsOpen(false);
                }}
                style={menuItemStyle(false)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RotateCw size={14} />
                  Rotate Clockwise
                </span>
              </button>

              <div
                style={{
                  height: '1px',
                  backgroundColor: 'var(--border-default)',
                  margin: '4px 0',
                }}
              />

              <button
                type="button"
                onClick={() => {
                  onResetZoom();
                  setOptionsOpen(false);
                }}
                style={menuItemStyle(false)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ZoomOut size={14} />
                  Reset Zoom
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
