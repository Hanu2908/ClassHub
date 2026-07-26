import React, { useState, useEffect } from 'react';
import Skeleton from 'react-loading-skeleton';
import { HighlightText } from './HighlightText';
import { haptics } from '../lib/haptics';

// Regex to match YouTube URLs
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;

// Regex to match Document & Drive URLs
const DOC_URL_REGEX = /(https?:\/\/(?:drive\.google\.com\/\S+|docs\.google\.com\/\S+|forms\.gle\/\S+|nptel\.ac\.in\/\S+|swayam\.gov\.in\/\S+|[^\s]+\.(?:pdf|docx?|xlsx?|pptx?|zip|csv)))(?=\s|$)/gi;

interface YouTubePlayerProps {
  videoId: string;
}

export function YouTubePlayer({ videoId }: YouTubePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchTitle = async () => {
      try {
        const response = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (active && data.title) {
          setTitle(data.title);
        }
      } catch {
        if (active) {
          setTitle("Watch YouTube Video Inline");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchTitle();
    return () => {
      active = false;
    };
  }, [videoId]);

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const fallbackThumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  if (isPlaying) {
    return (
      <div 
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: 'var(--radius-lg, 12px)',
          overflow: 'hidden',
          border: '1px solid var(--border-default)',
          background: '#000',
          marginTop: 10,
        }}
      >
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          title={title || "YouTube video player"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsPlaying(true)}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        borderRadius: 'var(--radius-lg, 12px)',
        overflow: 'hidden',
        border: '1px solid var(--border-default)',
        cursor: 'pointer',
        marginTop: 10,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s',
      }}
      className="youtube-preview-card"
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.012)';
        e.currentTarget.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.35)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <img
        src={thumbnailUrl}
        onError={(e) => {
          e.currentTarget.src = fallbackThumbnailUrl;
        }}
        alt={title || "YouTube Video Thumbnail"}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(10, 12, 20, 0.9) 0%, rgba(10, 12, 20, 0.3) 50%, rgba(10, 12, 20, 0.1) 100%)',
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2,
          width: 56,
          height: 40,
          background: '#ef4444',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)',
          transition: 'all 0.2s ease',
        }}
      >
        <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
          <path d="M17 10L1 19V1L17 10Z" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div
        style={{
          zIndex: 2,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          textAlign: 'left',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width="80%" height={16} borderRadius={4} />
            <Skeleton width="40%" height={12} borderRadius={4} />
          </div>
        ) : (
          <>
            <h4
              style={{
                margin: 0,
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                fontWeight: 600,
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {title}
            </h4>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              YouTube Video • Watch Inline
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   Smart Document & Drive Attachment Card (Solid Surface Design)
   ========================================================================== */
interface SmartDocumentCardProps {
  url: string;
}

export function SmartDocumentCard({ url }: SmartDocumentCardProps) {
  const getDocTypeInfo = (targetUrl: string) => {
    const lower = targetUrl.toLowerCase();
    if (lower.includes('forms.gle') || lower.includes('docs.google.com/forms')) {
      return { label: 'Google Form', type: 'form', color: '#8B5CF6' };
    }
    if (lower.includes('nptel.ac.in') || lower.includes('swayam.gov.in')) {
      return { label: 'NPTEL / SWAYAM Course', type: 'nptel', color: '#F97316' };
    }
    if (lower.includes('github.com')) {
      return { label: 'GitHub Repository', type: 'github', color: '#94A3B8' };
    }
    if (lower.includes('figma.com')) {
      return { label: 'Figma Design', type: 'figma', color: '#F24E1E' };
    }
    if (lower.includes('canva.com')) {
      return { label: 'Canva Presentation', type: 'canva', color: '#00C4CC' };
    }
    if (lower.includes('notion.so') || lower.includes('notion.site')) {
      return { label: 'Notion Page', type: 'notion', color: '#CBD5E1' };
    }
    if (lower.includes('zoom.us') || lower.includes('zoom.com') || lower.includes('teams.microsoft.com') || lower.includes('meet.google.com')) {
      return { label: 'Live Class Meeting Link', type: 'meeting', color: '#38BDF8' };
    }
    if (lower.includes('skit.ac.in') || lower.includes('rtu.ac.in')) {
      return { label: 'College Portal', type: 'portal', color: '#60A5FA' };
    }
    if (lower.includes('drive.google.com')) {
      return { label: 'Google Drive File', type: 'drive', color: '#4285F4' };
    }
    if (lower.includes('docs.google.com/document')) {
      return { label: 'Google Doc', type: 'doc', color: '#4285F4' };
    }
    if (lower.includes('docs.google.com/spreadsheets')) {
      return { label: 'Google Sheet', type: 'sheet', color: '#0F9D58' };
    }
    if (lower.includes('docs.google.com/presentation')) {
      return { label: 'Google Slides', type: 'slides', color: '#F4B400' };
    }
    if (lower.endsWith('.pdf') || lower.includes('.pdf?')) {
      return { label: 'PDF Document', type: 'pdf', color: '#EF4444' };
    }
    if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
      return { label: 'Word Document', type: 'doc', color: '#2563EB' };
    }
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
      return { label: 'Spreadsheet', type: 'sheet', color: '#10B981' };
    }
    if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) {
      return { label: 'Presentation', type: 'slides', color: '#F59E0B' };
    }
    if (lower.endsWith('.zip') || lower.endsWith('.rar')) {
      return { label: 'Archive File', type: 'zip', color: '#8B5CF6' };
    }
    return { label: 'Document Attachment', type: 'file', color: '#6366F1' };
  };

  const getFileName = (targetUrl: string, fallbackLabel: string) => {
    try {
      const parsed = new URL(targetUrl);
      const pathname = parsed.pathname;
      const parts = pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last.includes('.') && last.length < 50) {
        return decodeURIComponent(last);
      }
    } catch {
      // fallback
    }
    return fallbackLabel;
  };

  const info = getDocTypeInfo(url);
  const fileName = getFileName(url, info.label);

  const renderIcon = () => {
    switch (info.type) {
      case 'form':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M9 13l2 2 4-4" />
          </svg>
        );
      case 'nptel':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        );
      case 'meeting':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        );
      case 'portal':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        );
      case 'github':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
        );
      case 'figma':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
            <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
            <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" />
            <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z" />
            <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" />
          </svg>
        );
      case 'pdf':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
      case 'sheet':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="16" y2="17" />
            <line x1="12" y1="9" x2="12" y2="21" />
          </svg>
        );
      case 'slides':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        );
      case 'zip':
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2v20M14 2v20M4 14h16M4 18h16" />
            <rect x="4" y="2" width="16" height="20" rx="2" />
          </svg>
        );
      default:
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        );
    }
  };

  const getHostDomain = (targetUrl: string) => {
    try {
      const parsed = new URL(targetUrl);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return 'external-link';
    }
  };

  const getGoogleDriveFileId = (targetUrl: string): string | null => {
    try {
      const match = targetUrl.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=)|docs\.google\.com\/(?:file\/d\/|document\/d\/|spreadsheets\/d\/|presentation\/d\/))([a-zA-Z0-9_-]{25,})/i);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  const domain = getHostDomain(url);
  const fileId = getGoogleDriveFileId(url);
  const [showEmbed, setShowEmbed] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: 6 }}>
      <div
        onClick={(e) => {
          e.stopPropagation();
          window.open(url, '_blank', 'noopener,noreferrer');
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderRadius: 'var(--radius-lg, 12px)',
          background: 'var(--bg-elevated, rgba(19, 21, 32, 0.85))',
          border: '1px solid var(--border-default, rgba(255, 255, 255, 0.08))',
          cursor: 'pointer',
          gap: 12,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: `${info.color}15`,
              border: `1px solid ${info.color}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {renderIcon()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', textAlign: 'left', minWidth: 0 }}>
            <span
              style={{
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'var(--text-primary, #f8fafc)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {fileName}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 500, fontFamily: 'var(--font-mono, monospace)' }}>
              {domain}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {fileId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEmbed(!showEmbed);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                background: showEmbed ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                color: showEmbed ? 'var(--accent-primary, #818cf8)' : 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
              title={showEmbed ? "Close live preview" : "Toggle live preview"}
            >
              {showEmbed ? 'Hide Preview' : '👁️ Preview'}
            </button>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              background: `${info.color}18`,
              color: info.color,
              border: `1px solid ${info.color}35`,
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            <span>{info.label.split(' ')[0]}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </div>
        </div>
      </div>

      {showEmbed && fileId && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            width: '100%',
            height: 380,
            borderRadius: 'var(--radius-lg, 12px)',
            overflow: 'hidden',
            border: '1px solid var(--border-default)',
            background: '#0a0c14',
            marginTop: 8,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <iframe
            src={`https://drive.google.com/file/d/${fileId}/preview`}
            title="Google Drive Document Live Preview"
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="autoplay"
          />
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Multi-line Code Block Component with Language Badge & Copy Button
   ========================================================================== */
interface CodeBlockProps {
  code: string;
  language?: string;
  search?: string;
}

export function CodeBlock({ code, language = 'code', search }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    haptics.lightClick();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        margin: '8px 0',
        borderRadius: 'var(--radius-lg, 10px)',
        overflow: 'hidden',
        border: '1px solid var(--border-default, rgba(255, 255, 255, 0.12))',
        background: '#0f172a',
        textAlign: 'left',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          background: 'rgba(30, 41, 59, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {language}
        </span>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: 4,
            padding: '3px 8px',
            color: copied ? '#34d399' : '#cbd5e1',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code body */}
      <pre
        style={{
          margin: 0,
          padding: '12px 16px',
          overflowX: 'auto',
          fontSize: '13px',
          lineHeight: 1.5,
          fontFamily: 'Consolas, Monaco, "Fira Code", monospace',
          color: '#f1f5f9',
          whiteSpace: 'pre',
        }}
      >
        <code>{search ? <HighlightText text={code} search={search} /> : code}</code>
      </pre>
    </div>
  );
}

/* ==========================================================================
   Interactive Task List Component
   ========================================================================== */
interface TaskItem {
  text: string;
  initialChecked: boolean;
}

interface InteractiveTaskListProps {
  items: TaskItem[];
  search?: string;
  renderInline: (text: string, search?: string) => React.ReactNode;
}

function getTaskStorageKey(taskText: string): string {
  let hash = 0;
  for (let i = 0; i < taskText.length; i++) {
    hash = (hash << 5) - hash + taskText.charCodeAt(i);
    hash |= 0;
  }
  return `classhub_task_${Math.abs(hash)}`;
}

export function InteractiveTaskList({ items, search, renderInline }: InteractiveTaskListProps) {
  const [checkedState, setCheckedState] = useState<boolean[]>(() => {
    return items.map((item) => {
      try {
        const key = getTaskStorageKey(item.text);
        const saved = localStorage.getItem(key);
        if (saved !== null) {
          return saved === 'true';
        }
      } catch {
        // Fallback
      }
      return item.initialChecked;
    });
  });

  const toggleTask = (index: number) => {
    haptics.lightClick();
    setCheckedState((prev) => {
      const next = [...prev];
      const newChecked = !next[index];
      next[index] = newChecked;

      try {
        const item = items[index];
        if (item) {
          const key = getTaskStorageKey(item.text);
          localStorage.setItem(key, String(newChecked));
        }
      } catch {
        // Fallback
      }

      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '6px 0', width: '100%' }}>
      {items.map((item, idx) => {
        const isChecked = checkedState[idx];
        return (
          <div
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              toggleTask(idx);
            }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '4px 6px',
              borderRadius: 6,
              transition: 'background-color 0.15s ease',
            }}
            className="task-list-item"
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                border: isChecked ? 'none' : '1.5px solid var(--text-muted, #64748b)',
                background: isChecked ? 'var(--accent-primary, #6366f1)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 2,
                flexShrink: 0,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {isChecked && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span
              style={{
                fontSize: '14px',
                lineHeight: 1.5,
                color: isChecked ? 'var(--text-muted, #94a3b8)' : 'var(--text-primary, #f8fafc)',
                textDecoration: isChecked ? 'line-through' : 'none',
                opacity: isChecked ? 0.75 : 1,
                transition: 'all 0.2s ease',
                wordBreak: 'break-word',
              }}
            >
              {renderInline(item.text, search)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Inline Markdown Parser & Linkifier
   ========================================================================== */
function renderInlineMarkdown(text: string, search?: string): React.ReactNode {
  if (!text) return null;

  // Regex to split by Markdown links [label](url), inline code `code`, bold **text** or *text*, italic _text_, strikethrough ~~text~~, or raw URLs
  const inlineRegex = /(\[(?:[^\]]+)\]\((?:https?:\/\/[^\s)]+)\)|`[^`]+`|\*\*(?:[^*]+)\*\*|\*(?:[^*]+)\*|_(?:[^_]+)_|~~(?:[^~]+)~~|~(?:[^~]+)~|https?:\/\/[^\s]+)/g;

  const parts = text.split(inlineRegex);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        // 1. Markdown Links: [label](url)
        const mdLinkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
        if (mdLinkMatch) {
          const label = mdLinkMatch[1];
          const url = mdLinkMatch[2];
          return (
            <a
              key={index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent-primary, #6366f1)',
                textDecoration: 'underline',
                fontWeight: 500,
                wordBreak: 'break-word',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {search ? <HighlightText text={label} search={search} /> : label}
            </a>
          );
        }

        // 2. Inline Code: `code`
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          const content = part.slice(1, -1);
          return (
            <code
              key={index}
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                padding: '1.5px 5px',
                fontSize: '0.88em',
                fontFamily: 'Consolas, Monaco, "Fira Code", monospace',
              }}
            >
              {search ? <HighlightText text={content} search={search} /> : content}
            </code>
          );
        }

        // 3. Bold: **text** or *text*
        if ((part.startsWith('**') && part.endsWith('**') && part.length > 4) || (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**'))) {
          const content = part.startsWith('**') ? part.slice(2, -2) : part.slice(1, -1);
          return (
            <strong key={index} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {search ? <HighlightText text={content} search={search} /> : content}
            </strong>
          );
        }

        // 4. Italic: _text_
        if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
          const content = part.slice(1, -1);
          return (
            <em key={index} style={{ fontStyle: 'italic' }}>
              {search ? <HighlightText text={content} search={search} /> : content}
            </em>
          );
        }

        // 5. Strikethrough: ~~text~~ or ~text~
        if ((part.startsWith('~~') && part.endsWith('~~') && part.length > 4) || (part.startsWith('~') && part.endsWith('~') && part.length > 2 && !part.startsWith('~~'))) {
          const content = part.startsWith('~~') ? part.slice(2, -2) : part.slice(1, -1);
          return (
            <del key={index} style={{ textDecoration: 'line-through', opacity: 0.8 }}>
              {search ? <HighlightText text={content} search={search} /> : content}
            </del>
          );
        }

        // 6. Raw URLs: https://...
        if (part.startsWith('http://') || part.startsWith('https://')) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent-primary, #6366f1)',
                textDecoration: 'underline',
                wordBreak: 'break-all',
                fontWeight: 500,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {search ? <HighlightText text={part} search={search} /> : part}
            </a>
          );
        }

        // 7. Regular leaf text
        return search ? <HighlightText key={index} text={part} search={search} /> : part;
      })}
    </>
  );
}

/* ==========================================================================
   Main RichTextBody Component
   ========================================================================== */
interface RichTextBodyProps {
  text: string;
  search?: string;
  collapsed?: boolean;
}

export default function RichTextBody({ text, search, collapsed }: RichTextBodyProps) {
  if (!text) return null;

  // Extract all YouTube Video IDs
  const youtubeMatches = [...text.matchAll(YOUTUBE_REGEX)];
  const youtubeVideoIds = youtubeMatches
    .map((match) => match[1])
    .filter((id, index, self) => id && self.indexOf(id) === index);

  // Extract all Document/Drive URLs
  const docMatches = [...text.matchAll(DOC_URL_REGEX)];
  const documentUrls = docMatches
    .map((match) => match[1])
    .filter((url, index, self) => url && self.indexOf(url) === index);

  // --------------------------------------------------------------------------
  // Block Parsing Logic & Smart Task Detection
  // --------------------------------------------------------------------------
  const TASK_ACTION_VERBS = [
    'submit', 'fill', 'complete', 'pay', 'bring', 'sign', 'upload', 'read',
    'register', 'download', 'attend', 'finish', 'solve', 'prepare', 'verify',
    'check', 'do', 'send', 'collect', 'write', 'get', 'create', 'deposit',
    'inform', 'join', 'print', 'attach', 'review', 'report', 'file', 'take',
    'clear', 'update', 'remember'
  ];
  const TASK_HEADER_REGEX = /(?:tasks?|to-?dos?|action items?|instructions?|checklists?|steps?|things to do|deadlines?|requirements?):?/i;

  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = '';

  let currentTaskList: TaskItem[] = [];
  let currentBlockquote: string[] = [];
  let currentBulletList: string[] = [];
  let currentNumList: string[] = [];
  let lastNonEmptyLine = '';

  const flushTaskList = () => {
    if (currentTaskList.length > 0) {
      const items = [...currentTaskList];
      blocks.push(
        <InteractiveTaskList
          key={`task-${blocks.length}`}
          items={items}
          search={search}
          renderInline={renderInlineMarkdown}
        />
      );
      currentTaskList = [];
    }
  };

  const flushBlockquote = () => {
    if (currentBlockquote.length > 0) {
      const content = currentBlockquote.join('\n');
      blocks.push(
        <blockquote
          key={`quote-${blocks.length}`}
          style={{
            margin: '6px 0',
            padding: '8px 12px',
            borderLeft: '3.5px solid var(--accent-primary, #6366f1)',
            background: 'var(--bg-surface-elevated, rgba(30, 41, 59, 0.4))',
            borderRadius: '0 8px 8px 0',
            color: 'var(--text-secondary, #cbd5e1)',
            fontStyle: 'italic',
            textAlign: 'left',
          }}
        >
          {renderInlineMarkdown(content, search)}
        </blockquote>
      );
      currentBlockquote = [];
    }
  };

  const flushBulletList = () => {
    if (currentBulletList.length > 0) {
      const items = [...currentBulletList];
      blocks.push(
        <ul key={`ul-${blocks.length}`} style={{ margin: '4px 0 8px 20px', padding: 0, textAlign: 'left' }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ marginBottom: 3 }}>
              {renderInlineMarkdown(item, search)}
            </li>
          ))}
        </ul>
      );
      currentBulletList = [];
    }
  };

  const flushNumList = () => {
    if (currentNumList.length > 0) {
      const items = [...currentNumList];
      blocks.push(
        <ol key={`ol-${blocks.length}`} style={{ margin: '4px 0 8px 20px', padding: 0, textAlign: 'left' }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ marginBottom: 3 }}>
              {renderInlineMarkdown(item, search)}
            </li>
          ))}
        </ol>
      );
      currentNumList = [];
    }
  };

  const flushAll = () => {
    flushTaskList();
    flushBlockquote();
    flushBulletList();
    flushNumList();
  };

  const isTaskListItem = (itemContent: string) => {
    const trimmedItem = itemContent.trim().toLowerCase();
    if (lastNonEmptyLine && TASK_HEADER_REGEX.test(lastNonEmptyLine)) {
      return true;
    }
    const firstWord = trimmedItem.split(/\s+/)[0];
    if (TASK_ACTION_VERBS.includes(firstWord)) {
      return true;
    }
    if (/\b(?:due by|submit before|deadline|by \d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i.test(trimmedItem)) {
      return true;
    }
    return false;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // 1. Code Block parsing ```lang
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        blocks.push(
          <CodeBlock
            key={`code-${blocks.length}`}
            code={codeBuffer.join('\n')}
            language={codeLang || 'code'}
            search={search}
          />
        );
        codeBuffer = [];
        codeLang = '';
        inCodeBlock = false;
      } else {
        // Start of code block
        flushAll();
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // 2. Explicit Interactive Task Item: - [ ] or - [x] or * [ ] or * [x]
    const explicitTaskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (explicitTaskMatch) {
      flushBlockquote();
      flushBulletList();
      flushNumList();
      const isChecked = explicitTaskMatch[1].toLowerCase() === 'x';
      const taskText = explicitTaskMatch[2];
      currentTaskList.push({ text: taskText, initialChecked: isChecked });
      return;
    }

    // 3. Blockquote: > text
    if (trimmed.startsWith('>')) {
      flushTaskList();
      flushBulletList();
      flushNumList();
      const quoteText = line.replace(/^\s*>\s?/, '');
      currentBlockquote.push(quoteText);
      return;
    } else {
      flushBlockquote();
    }

    // 4. Bulleted List Item: - item or * item
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      const itemText = bulletMatch[1];
      if (isTaskListItem(itemText)) {
        flushBulletList();
        flushNumList();
        currentTaskList.push({ text: itemText, initialChecked: false });
        return;
      } else if (currentTaskList.length > 0) {
        // If we are currently collecting a task list, continue adding plain bullet items to it
        currentTaskList.push({ text: itemText, initialChecked: false });
        return;
      } else {
        flushTaskList();
        flushNumList();
        currentBulletList.push(itemText);
        return;
      }
    }

    // 5. Numbered List Item: 1. item
    const numMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numMatch) {
      const itemText = numMatch[1];
      if (isTaskListItem(itemText)) {
        flushNumList();
        flushBulletList();
        currentTaskList.push({ text: itemText, initialChecked: false });
        return;
      } else if (currentTaskList.length > 0) {
        currentTaskList.push({ text: itemText, initialChecked: false });
        return;
      } else {
        flushTaskList();
        flushBulletList();
        currentNumList.push(itemText);
        return;
      }
    }

    // Flush active lists if regular line reached
    flushTaskList();
    flushBulletList();
    flushNumList();

    // 6. Regular text line / paragraph
    if (trimmed === '') {
      blocks.push(<div key={`blank-${index}`} style={{ height: 6 }} />);
    } else {
      lastNonEmptyLine = trimmed;
      blocks.push(
        <div key={`p-${index}`} style={{ wordBreak: 'break-word', lineHeight: 1.55 }}>
          {renderInlineMarkdown(line, search)}
        </div>
      );
    }
  });

  // Flush remaining buffers after looping lines
  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push(
      <CodeBlock
        key={`code-${blocks.length}`}
        code={codeBuffer.join('\n')}
        language={codeLang || 'code'}
        search={search}
      />
    );
  }
  flushAll();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', textAlign: 'left' }}>
      {/* 1. Formatted Markdown Body */}
      <div
        style={{
          display: collapsed ? '-webkit-box' : 'block',
          WebkitLineClamp: collapsed ? 3 : undefined,
          WebkitBoxOrient: collapsed ? 'vertical' : undefined,
          overflow: collapsed ? 'hidden' : 'visible',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {blocks}
      </div>

      {/* 2. On-demand YouTube embed cards */}
      {!collapsed && youtubeVideoIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            width: '100%',
            marginTop: 4,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {youtubeVideoIds.map((id) => (
            <YouTubePlayer key={id} videoId={id} />
          ))}
        </div>
      )}

      {/* 3. Smart Document & Drive Attachment Cards (Solid Surface Design) */}
      {!collapsed && documentUrls.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            width: '100%',
            marginTop: 6,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {documentUrls.map((url) => (
            <SmartDocumentCard key={url} url={url} />
          ))}
        </div>
      )}
    </div>
  );
}
