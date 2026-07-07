import { useState, useEffect } from 'react';
import Skeleton from 'react-loading-skeleton';

// Regular Expression to match standard and short YouTube URLs
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;

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
          borderRadius: 'var(--radius-lg)',
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
        borderRadius: 'var(--radius-lg)',
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
      {/* Background Thumbnail with fallback */}
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
      
      {/* Dark Scrim */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(10, 12, 20, 0.9) 0%, rgba(10, 12, 20, 0.3) 50%, rgba(10, 12, 20, 0.1) 100%)',
          zIndex: 1,
        }}
      />

      {/* Red Play Button Centered */}
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
        <svg
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M17 10L1 19V1L17 10Z"
            fill="white"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Title & Metadata bottom overlay */}
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

import { HighlightText } from './HighlightText';

interface RichTextBodyProps {
  text: string;
  search?: string;
}

export default function RichTextBody({ text, search }: RichTextBodyProps) {
  if (!text) return null;

  // Extract all unique YouTube Video IDs
  const matches = [...text.matchAll(YOUTUBE_REGEX)];
  const youtubeVideoIds = matches
    .map((match) => match[1])
    .filter((id, index, self) => id && self.indexOf(id) === index);

  // Regex to split text by URLs so we can render them as links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', textAlign: 'left' }}>
      {/* 1. Body Text with Clickable Links */}
      <span style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {parts.map((part, index) => {
          if (urlRegex.test(part) || part.startsWith('http://') || part.startsWith('https://')) {
            return (
              <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  color: 'var(--accent-primary)', 
                  textDecoration: 'underline', 
                  wordBreak: 'break-all',
                  fontWeight: 500
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {search ? <HighlightText text={part} search={search} /> : part}
              </a>
            );
          }
          return search ? <HighlightText key={index} text={part} search={search} /> : part;
        })}
      </span>

      {/* 2. On-demand YouTube embed cards */}
      {youtubeVideoIds.length > 0 && (
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 12, 
            width: '100%',
            marginTop: 4 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {youtubeVideoIds.map((id) => (
            <YouTubePlayer key={id} videoId={id} />
          ))}
        </div>
      )}
    </div>
  );
}
