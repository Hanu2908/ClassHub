import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../lib/utils/clipboard';

export interface CopyButtonProps {
  text: string;
  label?: string;
  ariaLabel?: string;
  successMessage?: string;
  iconSize?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function CopyButton({
  text,
  label,
  ariaLabel = 'Copy to clipboard',
  successMessage = 'Copied to clipboard!',
  iconSize = 13,
  className,
  style,
  children,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const success = await copyToClipboard(text, {
      successMessage,
      errorMessage: 'Clipboard permission denied',
    });

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={className}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '3px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        color: copied ? 'var(--status-safe)' : 'var(--text-muted)',
        borderRadius: 'var(--radius-sm)',
        transition: 'color var(--transition-fast), background var(--transition-fast)',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!copied) e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        if (!copied) e.currentTarget.style.color = 'var(--text-muted)';
      }}
    >
      {copied ? <Check size={iconSize} color="var(--status-safe)" /> : <Copy size={iconSize} />}
      {label && <span>{copied ? 'Copied' : label}</span>}
      {children}
    </button>
  );
}
