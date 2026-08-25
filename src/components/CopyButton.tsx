import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../lib/utils/clipboard';
import { toast } from 'sonner';

interface CopyButtonProps {
  text: string;
  label?: string;
  size?: number;
  successMessage?: string;
  showText?: boolean;
}

export function CopyButton({ text, label = 'Copy', size = 11, successMessage = 'Copied!', showText = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={label}
      title={label}
      style={{
        background: 'none',
        border: 'none',
        padding: '2px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: copied ? 'var(--status-safe)' : 'var(--text-muted)',
        borderRadius: '4px',
        transition: 'color 0.2s ease',
        gap: '4px',
      }}
      onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = 'var(--text-primary)'; }}
      onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = 'var(--text-muted)'; }}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
      {showText && <span style={{ fontSize: '12px' }}>{copied ? 'Copied!' : 'Copy'}</span>}
    </button>
  );
}
