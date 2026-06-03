import { useState, useRef, useMemo } from 'react';
import { BottomSheet } from './BottomSheet';
import { showToast } from './Toast';
import {
  useSectionTagPool,
  useAddTag,
  computeExpiresAt,
  TAG_DURATION_OPTIONS,
  MAX_TAG_LENGTH,
} from '../hooks/useUserTags';

interface AddTagSheetProps {
  open: boolean;
  onClose: () => void;
}

export function AddTagSheet({ open, onClose }: AddTagSheetProps) {
  const [inputVal, setInputVal] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null); // null = permanent
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: tagPool = [] } = useSectionTagPool();
  const addTag = useAddTag();

  // Filter autocomplete suggestions
  const suggestions = useMemo(() => {
    if (!inputVal.trim()) return [];
    const query = inputVal.toLowerCase();
    return tagPool
      .filter(t => t.toLowerCase().includes(query))
      .slice(0, 6);
  }, [inputVal, tagPool]);

  const handleSubmit = async () => {
    const trimmed = inputVal.trim();
    if (!trimmed || addTag.isPending) return;

    try {
      await addTag.mutateAsync({
        tagText: trimmed,
        expiresAt: computeExpiresAt(selectedDuration),
      });
      showToast('Tag added ✓', 'success');
      setInputVal('');
      setSelectedDuration(null);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Maximum 5')) {
        showToast('You already have 5 active tags. Remove one first.', 'error');
      } else if (msg.includes('idx_user_tags_no_duplicates') || msg.includes('duplicate')) {
        showToast('You already have this tag!', 'error');
      } else {
        showToast(`Failed to add tag: ${msg}`, 'error');
      }
    }
  };

  const handleSelectSuggestion = (tag: string) => {
    setInputVal(tag);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_TAG_LENGTH) {
      setInputVal(val);
      setShowSuggestions(val.trim().length > 0);
    }
  };

  const canSubmit = inputVal.trim().length > 0 && !addTag.isPending;

  if (!open) return null;

  return (
    <BottomSheet onClose={onClose} title="Add a Tag">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Tag input with autocomplete */}
        <div style={{ position: 'relative' }}>
          <label
            className="t-label"
            style={{ color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}
          >
            TAG NAME
          </label>
          <input
            ref={inputRef}
            type="text"
            className="input"
            placeholder="e.g. 🤖 Robotics, Dance Crew..."
            value={inputVal}
            onChange={handleInputChange}
            onFocus={() => { if (inputVal.trim()) setShowSuggestions(true); }}
            onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }}
            autoComplete="off"
            style={{ width: '100%' }}
          />
          <span
            className="t-mono-sm"
            style={{
              position: 'absolute',
              right: 12,
              bottom: 10,
              fontSize: '9px',
              color: inputVal.length >= MAX_TAG_LENGTH ? 'var(--status-warning)' : 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            {inputVal.length}/{MAX_TAG_LENGTH}
          </span>

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: 'rgba(10, 11, 18, 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-elevated)',
              zIndex: 50,
              maxHeight: 180,
              overflowY: 'auto',
              scrollbarWidth: 'thin',
            }}>
              {suggestions.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleSelectSuggestion(tag)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 14px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    transition: 'background var(--transition-fast)',
                    outline: 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Duration picker */}
        <div>
          <label
            className="t-label"
            style={{ color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}
          >
            EXPIRES
          </label>
          <div style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}>
            {TAG_DURATION_OPTIONS.map(opt => {
              const isSelected = selectedDuration === opt.days;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setSelectedDuration(opt.days)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isSelected ? '#000' : 'var(--text-secondary)',
                    background: isSelected ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-pill)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    outline: 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'var(--text-muted)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'var(--border-default)';
                    }
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: 600,
            color: canSubmit ? '#000' : 'var(--text-muted)',
            background: canSubmit ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'all var(--transition-fast)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {addTag.isPending && (
            <span className="spin" style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
            }} />
          )}
          <span>{addTag.isPending ? 'Adding...' : 'Add Tag'}</span>
        </button>
      </div>
    </BottomSheet>
  );
}
