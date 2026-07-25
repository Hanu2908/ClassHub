import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, X, Camera, Image, FileText } from 'lucide-react';
import { isPreviewableImage } from '../lib/utils/attachments';
import { BottomSheet } from './BottomSheet';

interface FileUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxDocs?: number;
  maxImages?: number;
  maxSizeMB?: number;
}

export function FileUploader({ 
  files, 
  onChange, 
  maxFiles = 20, 
  maxDocs = 5,
  maxImages = 20,
  maxSizeMB = 10 
}: FileUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSourceSheetOpen, setIsSourceSheetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const acceptedFiles: File[] = [...files];
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];

      if (file.size > maxSizeBytes) {
        alert(`File "${file.name}" exceeds the ${maxSizeMB}MB limit.`);
        continue;
      }

      const isImg = isPreviewableImage(file.type, file.name);

      const exists = acceptedFiles.some(
        f => f.name === file.name && f.size === file.size
      );
      
      if (!exists) {
        // Calculate current tallies in state
        const currentImagesCount = acceptedFiles.filter(f => isPreviewableImage(f.type, f.name)).length;
        const currentDocsCount = acceptedFiles.length - currentImagesCount;

        if (isImg) {
          if (currentImagesCount >= maxImages) {
            alert(`Maximum of ${maxImages} images allowed.`);
            continue;
          }
        } else {
          if (currentDocsCount >= maxDocs) {
            alert(`Maximum of ${maxDocs} documents allowed.`);
            continue;
          }
        }

        if (acceptedFiles.length >= maxFiles) {
          alert(`Maximum of ${maxFiles} total attachments allowed.`);
          break;
        }

        acceptedFiles.push(file);
      }
    }

    onChange(acceptedFiles);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onChange(updated);
  };

  const triggerFileInput = (type: 'camera' | 'gallery' | 'document' | 'all') => {
    const input = fileInputRef.current;
    if (!input) return;
    if (type === 'camera') {
      input.setAttribute('accept', 'image/*');
      input.setAttribute('capture', 'environment');
    } else if (type === 'gallery') {
      input.setAttribute('accept', 'image/*');
      input.removeAttribute('capture');
    } else if (type === 'document') {
      input.setAttribute('accept', 'application/pdf,text/*,.csv,application/vnd.openxmlformats-officedocument.*,application/vnd.ms-excel,application/msword,application/vnd.ms-powerpoint');
      input.removeAttribute('capture');
    } else {
      input.setAttribute('accept', 'image/*,application/pdf,text/*,.csv,application/vnd.openxmlformats-officedocument.*,application/vnd.ms-excel,application/msword,application/vnd.ms-powerpoint');
      input.removeAttribute('capture');
    }
    input.click();
  };

  const handleUploadZoneClick = () => {
    if (window.innerWidth < 768) {
      setIsSourceSheetOpen(true);
    } else {
      triggerFileInput('all');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      <label className="t-subtitle" style={{ color: 'var(--text-secondary)' }}>
        Attachments (Max {maxImages} images, {maxDocs} documents, {maxSizeMB}MB each)
      </label>
      
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={handleUploadZoneClick}
        style={{
          border: isDragActive 
            ? '1.5px dashed var(--accent-primary)' 
            : '1.5px dashed rgba(255, 255, 255, 0.12)',
          background: isDragActive 
            ? 'rgba(96, 165, 250, 0.05)' 
            : 'rgba(255, 255, 255, 0.02)',
          borderRadius: 'var(--radius-md)',
          padding: '24px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: isDragActive ? 'var(--shadow-glow-blue)' : 'none'
        }}
        onMouseEnter={(e) => {
          if (!isDragActive) {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.24)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragActive) {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/*,.csv,application/vnd.openxmlformats-officedocument.*,application/vnd.ms-excel,application/msword,application/vnd.ms-powerpoint"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        
        <div 
          style={{ 
            background: isDragActive ? 'rgba(96, 165, 250, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            padding: '10px',
            borderRadius: '50%',
            color: isDragActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Upload size={22} className={isDragActive ? 'animate-bounce' : ''} />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>
            {isDragActive ? 'Drop files here' : 'Click to upload or drag & drop'}
          </span>
          <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
            PDF, PNG, JPG, JPEG, CSV, sheets, texts
          </span>
        </div>
      </div>

      {files.length > 0 && (
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            marginTop: '4px',
            maxHeight: '180px',
            overflowY: 'auto',
            paddingRight: '2px'
          }}
        >
          {files.map((file, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 'var(--radius-sm)',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <SelectedFilePreview key={`${file.name}-${file.size}-${file.lastModified}`} file={file} />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <span 
                    className="t-caption"
                    style={{ 
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {file.name}
                  </span>
                  <span className="t-mono-sm" style={{ color: 'var(--text-secondary)' }}>
                    {formatSize(file.size)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(idx);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--status-critical)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(248, 113, 113, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Source Selection Bottom Sheet */}
      <BottomSheet 
        open={isSourceSheetOpen} 
        onClose={() => setIsSourceSheetOpen(false)} 
        title="Select Attachment Source"
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          padding: '12px 0 24px',
          textAlign: 'center'
        }}>
          {/* Camera */}
          <div 
            onClick={() => {
              setIsSourceSheetOpen(false);
              triggerFileInput('camera');
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
              color: '#ffffff'
            }}>
              <Camera size={24} />
            </div>
            <span className="t-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Camera
            </span>
          </div>

          {/* Gallery */}
          <div 
            onClick={() => {
              setIsSourceSheetOpen(false);
              triggerFileInput('gallery');
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              color: '#ffffff'
            }}>
              <Image size={24} />
            </div>
            <span className="t-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Gallery
            </span>
          </div>

          {/* Document */}
          <div 
            onClick={() => {
              setIsSourceSheetOpen(false);
              triggerFileInput('document');
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              color: '#ffffff'
            }}>
              <FileText size={24} />
            </div>
            <span className="t-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Document
            </span>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function SelectedFilePreview({ file }: { file: File }) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const isImage = isPreviewableImage(file.type, file.name);
  const isPdf = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
  const previewUrl = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [file, isImage]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasPdfThumb, setHasPdfThumb] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!isPdf || !canvasRef.current) return;
    let cancelled = false;

    file.arrayBuffer().then(async (buffer) => {
      if (cancelled || !canvasRef.current || !window.pdfjsLib) return;
      try {
        const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (!cancelled) setHasPdfThumb(true);
        }
      } catch {
        // Fallback badge
      }
    });

    return () => {
      cancelled = true;
    };
  }, [file, isPdf]);

  if (isImage && previewUrl && !previewFailed) {
    return (
      <img
        src={previewUrl}
        alt=""
        onError={() => setPreviewFailed(true)}
        style={{
          width: 34,
          height: 34,
          borderRadius: 'var(--radius-sm, 6px)',
          objectFit: 'cover',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.04)',
          flexShrink: 0,
        }}
      />
    );
  }

  if (isPdf) {
    return (
      <div style={{ position: 'relative', width: 34, height: 34, flexShrink: 0 }}>
        <canvas
          ref={canvasRef}
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-sm, 6px)',
            objectFit: 'cover',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            background: '#1e1b2e',
            display: hasPdfThumb ? 'block' : 'none',
          }}
        />
        {!hasPdfThumb && (
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-sm, 6px)',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              fontWeight: 800,
            }}
          >
            PDF
          </div>
        )}
      </div>
    );
  }

  const ext = file.name.split('.').pop()?.toUpperCase() || 'DOC';
  const getBadgeColor = () => {
    if (['DOC', 'DOCX'].includes(ext)) return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
    if (['XLS', 'XLSX', 'CSV'].includes(ext)) return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
    if (['PPT', 'PPTX'].includes(ext)) return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
    return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' };
  };

  const badgeStyle = getBadgeColor();

  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 'var(--radius-sm, 6px)',
        background: badgeStyle.bg,
        border: `1px solid ${badgeStyle.border}`,
        color: badgeStyle.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      {ext.slice(0, 4)}
    </div>
  );
}
