import React, { useState, useRef } from 'react';
import { Upload, X, Paperclip } from 'lucide-react';

interface FileUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export function FileUploader({ 
  files, 
  onChange, 
  maxFiles = 5, 
  maxSizeMB = 10 
}: FileUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
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

      if (acceptedFiles.length >= maxFiles) {
        alert(`Maximum of ${maxFiles} attachments allowed.`);
        break;
      }

      const exists = acceptedFiles.some(
        f => f.name === file.name && f.size === file.size
      );
      
      if (!exists) {
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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
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
        Attachments (Max {maxFiles} files, {maxSizeMB}MB each)
      </label>
      
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
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
                <Paperclip size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
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
    </div>
  );
}
