import React from 'react';
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
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
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

        {/* More options dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              style={btnStyle}
              title="Options"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <MoreVertical size={18} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              alignOffset={12}
              sideOffset={8}
              className="dropdown-content animate-slide-up"
              style={{ zIndex: 10000, minWidth: '180px' }}
            >
              <DropdownMenu.Item
                onClick={() => onSelectDisplayMode('original')}
                className="dropdown-item"
                style={{
                  color:
                    displayMode === 'original' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  background:
                    displayMode === 'original' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                  borderLeft:
                    displayMode === 'original'
                      ? '3px solid var(--accent-primary)'
                      : '3px solid transparent',
                  fontWeight: displayMode === 'original' ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingLeft: '9px',
                }}
              >
                <span className="flex items-center gap-2">
                  <Sun size={14} />
                  Original (Light)
                </span>
                {displayMode === 'original' && <Check size={14} />}
              </DropdownMenu.Item>

              <DropdownMenu.Item
                onClick={() => onSelectDisplayMode('dark')}
                className="dropdown-item"
                style={{
                  color:
                    displayMode === 'dark' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  background:
                    displayMode === 'dark' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                  borderLeft:
                    displayMode === 'dark'
                      ? '3px solid var(--accent-primary)'
                      : '3px solid transparent',
                  fontWeight: displayMode === 'dark' ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingLeft: '9px',
                }}
              >
                <span className="flex items-center gap-2">
                  <Moon size={14} />
                  Dark Mode
                </span>
                {displayMode === 'dark' && <Check size={14} />}
              </DropdownMenu.Item>

              <DropdownMenu.Item
                onClick={() => onSelectDisplayMode('sepia')}
                className="dropdown-item"
                style={{
                  color:
                    displayMode === 'sepia' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  background:
                    displayMode === 'sepia' ? 'rgba(74, 158, 255, 0.08)' : undefined,
                  borderLeft:
                    displayMode === 'sepia'
                      ? '3px solid var(--accent-primary)'
                      : '3px solid transparent',
                  fontWeight: displayMode === 'sepia' ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingLeft: '9px',
                }}
              >
                <span className="flex items-center gap-2">
                  <Eye size={14} />
                  Sepia
                </span>
                {displayMode === 'sepia' && <Check size={14} />}
              </DropdownMenu.Item>

              <div
                style={{
                  height: '1px',
                  backgroundColor: 'var(--border-default)',
                  margin: '6px 0',
                }}
              />

              <DropdownMenu.Item
                onClick={onRotateClockwise}
                className="dropdown-item"
                style={{
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderLeft: '3px solid transparent',
                  paddingLeft: '9px',
                }}
              >
                <RotateCw size={14} />
                <span>Rotate Clockwise</span>
              </DropdownMenu.Item>

              <div
                style={{
                  height: '1px',
                  backgroundColor: 'var(--border-default)',
                  margin: '6px 0',
                }}
              />

              <DropdownMenu.Item
                onClick={onResetZoom}
                className="dropdown-item"
                style={{
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderLeft: '3px solid transparent',
                  paddingLeft: '9px',
                }}
              >
                <ZoomOut size={14} />
                <span>Reset Zoom</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
};
