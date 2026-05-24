import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, FileImage, FileCode, File, Loader2, ImageOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Attachment } from '../store/appStore';
import { isPreviewableImage } from '../lib/utils/attachments';

interface AttachmentCardProps {
  attachment: Attachment;
  pageNumber?: string;
}

export function AttachmentCard({ attachment, pageNumber }: AttachmentCardProps) {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [previewState, setPreviewState] = useState<{
    storagePath: string;
    url: string | null;
    error: boolean;
  }>({ storagePath: '', url: null, error: false });

  const isImage = isPreviewableImage(attachment.fileType, attachment.filename);
  const hasCurrentPreviewState = previewState.storagePath === attachment.storagePath;
  const previewUrl = isImage && hasCurrentPreviewState ? previewState.url : null;
  const previewError = isImage && hasCurrentPreviewState ? previewState.error : false;
  const previewLoading = isImage && !hasCurrentPreviewState;

  useEffect(() => {
    let cancelled = false;

    if (!isImage) {
      return;
    }

    supabase.storage
      .from('attachments')
      .createSignedUrl(attachment.storagePath, 300)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          setPreviewState({ storagePath: attachment.storagePath, url: null, error: true });
          return;
        }
        setPreviewState({ storagePath: attachment.storagePath, url: data.signedUrl, error: false });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[AttachmentCard] Failed to load image preview:', err);
        setPreviewState({ storagePath: attachment.storagePath, url: null, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [attachment.storagePath, isImage]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);

    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .createSignedUrl(attachment.storagePath, 60);

      if (error) {
        throw error;
      }

      if (data?.signedUrl) {
        const isPDF = attachment.fileType.toLowerCase().includes('pdf') || attachment.filename.toLowerCase().endsWith('.pdf');
        if (isPDF) {
          const firstPage = pageNumber ? (pageNumber.match(/\d+/)?.[0] || '1') : '1';
          navigate(`/app/pdf-viewer?url=${encodeURIComponent(data.signedUrl)}&page=${firstPage}&range=${encodeURIComponent(pageNumber || '')}&title=${encodeURIComponent(attachment.filename)}`);
        } else {
          window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (err) {
      console.error('[AttachmentCard] Failed to download:', err);
      alert('Failed to retrieve file. You may not have access to this section\'s attachments.');
    } finally {
      setDownloading(false);
    }
  };

  const getFileIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('pdf')) return <FileText size={20} style={{ color: '#F87171' }} />;
    if (t.includes('image')) return <FileImage size={20} style={{ color: '#34D399' }} />;
    if (t.includes('csv') || t.includes('sheet') || t.includes('excel')) return <FileCode size={20} style={{ color: '#FBBF24' }} />;
    if (t.includes('json') || t.includes('javascript') || t.includes('typescript') || t.includes('css')) return <FileCode size={20} style={{ color: '#60A5FA' }} />;
    return <File size={20} style={{ color: '#22D3EE' }} />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div 
      onClick={handleDownload}
      className="attachment-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: '10px 14px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        userSelect: 'none',
        gap: '12px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
        e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.3)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {isImage && (
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            minHeight: 150,
            maxHeight: 260,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: 'rgba(10, 12, 20, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {previewUrl && !previewError ? (
            <img
              src={previewUrl}
              alt={attachment.filename}
              loading="lazy"
              onError={() => setPreviewState({ storagePath: attachment.storagePath, url: null, error: true })}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
              {previewLoading ? <Loader2 className="animate-spin" size={20} /> : <ImageOff size={22} />}
              <span className="t-mono-sm">
                {previewLoading ? 'Loading preview' : 'Preview unavailable'}
              </span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          {getFileIcon(attachment.fileType)}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <span 
              className="t-body-medium"
              style={{ 
                color: 'var(--text-primary)', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}
            >
              {attachment.filename}
            </span>
            <span className="t-mono-sm" style={{ color: 'var(--text-secondary)' }}>
              {formatSize(attachment.fileSize)}
              {isImage ? ' - Tap to open full image' : ''}
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled={downloading}
          aria-label={`Open ${attachment.filename}`}
          style={{
            background: 'none',
            border: 'none',
            padding: '6px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderRadius: '50%',
            transition: 'all var(--transition-fast)',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'var(--accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          {downloading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Download size={16} />
          )}
      </button>
      </div>
    </div>
  );
}
