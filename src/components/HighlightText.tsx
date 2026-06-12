import React from 'react';

interface HighlightTextProps {
  text: string;
  search: string;
}

/**
 * Renders text with the search query highlighted.
 */
export const HighlightText: React.FC<HighlightTextProps> = React.memo(({ text, search }) => {
  if (!text) return null;
  if (!search || !search.trim()) return <>{text}</>;

  const trimmedSearch = search.trim();
  const escapedSearch = trimmedSearch.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedSearch})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.25)',
              color: 'var(--accent-primary)',
              borderRadius: '2px',
              padding: '0 2px',
              fontWeight: 'inherit',
            }}
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
});

HighlightText.displayName = 'HighlightText';
