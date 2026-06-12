# Spec: Filled-Background Voting Representation for Polls

Design and specification for updating the ClassHub poll option rendering from a vertical text-and-bar stack to a premium, animated filled-background progress representation.

## Goal
Make the voting results inside both normal and Mass Bunk polls feel more premium and modern by replacing the small, separate horizontal progress bar with an animated filled-background overlay directly inside the option button, matching the design of modern polling widgets.

## UX & Visual Details

### 1. Pre-Voting State (Unchanged)
Before a user votes, the options render normally to avoid bias:
*   Show standard selection icons (e.g., circular radio button or square checkbox).
*   Standard hover states and borders.
*   Background remains `--bg-elevated` without any progress fill.

### 2. Voted/Results State (Updated)
Once results are revealed (after user votes or when the poll is closed):
*   **Hide selection icons**: Hide the left radio/checkbox icons.
*   **Trailing checkmark**: Add a trailing ` ✓` to the chosen option(s).
*   **Background Fill**: Render a progress overlay div spanning from the left of the button to the option's vote percentage (`pct%`).
*   **Animation**: Animate the background fill's width when results are first revealed or updated (`transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1)`).
*   **Contrast**: Keep the option text and percentages sitting on a text content layer with `z-index: 1`, ensuring readability is maintained regardless of the progress color.

## Visual Tokens & Theme Compatibility

### 1. Normal Polls
*   **Selected Option (User's choice)**:
    *   Background Fill: `var(--accent-primary-glow)` (`rgba(96, 165, 250, 0.15)`)
    *   Border: `1.5px solid var(--accent-primary)`
    *   Text color: `var(--text-accent)` (blue) + trailing checkmark ` ✓`
*   **Unselected Option**:
    *   Background Fill: `rgba(255, 255, 255, 0.04)` (neutral overlay)
    *   Border: `1.5px solid var(--border-default)`
    *   Text color: `var(--text-secondary)` (muted grey)

### 2. Mass Bunk Polls (Status-based indicators)
*   **"Ditch & Chill" Option (Bunk Option)**:
    *   **If Bunk is Active (ditchPct >= 60%)**:
        *   Background Fill: `rgba(248, 113, 113, 0.15)` (translucent critical red)
        *   Border: `1.5px solid var(--status-critical)` if selected, else `rgba(248, 113, 113, 0.3)`
        *   Text color: `var(--status-critical)` (bright red)
    *   **If Bunk is Pending (ditchPct < 60%)**:
        *   Background Fill: `rgba(251, 191, 36, 0.12)` (translucent warning yellow)
        *   Border: `1.5px solid var(--status-warning)` if selected, else `rgba(251, 191, 36, 0.25)`
        *   Text color: `var(--status-warning)` (amber)
*   **"Front Bench Energy" Option (Study Option)**:
    *   Uses standard blue/neutral theme styling to contrast against the bunk status option.

## Implementation Details

### DOM Restructuring
We restructure the inside of the `<button className="vote-option">` to support the overlay:
```tsx
<button className={`vote-option relative overflow-hidden w-full ${isSelected ? 'selected' : ''} ${showResults ? 'voted' : ''}`}>
  {/* Layer 0: Progress Fill Overlay */}
  {showResults && (
    <div 
      className="vote-option-fill absolute left-0 top-0 bottom-0 z-0"
      style={{
        width: `${pct}%`,
        background: fillBackground,
        transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    />
  )}

  {/* Layer 1: Content Overlay */}
  <div className="flex items-center justify-between w-full relative z-1 pointer-events-none">
    <div className="flex items-center gap-2">
      {!showResults && <Icon size={15} className="text-secondary shrink-0" />}
      <span className="t-body" style={{ color: textSecondaryColor }}>
        {opt.text}
        {showResults && isSelected && ' ✓'}
      </span>
    </div>
    {showResults && (
      <div className="flex items-center gap-2 font-mono">
        <span style={{ color: percentColor }}>{pct}%</span>
        <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>({opt.votes})</span>
      </div>
    )}
  </div>
</button>
```

### CSS Refinements (`src/index.css`)
```css
.vote-option {
  position: relative;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-elevated);
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}

.vote-option.selected {
  border-color: var(--accent-primary);
}

.vote-option.voted {
  background: rgba(28, 34, 54, 0.45);
}

.vote-option-fill {
  pointer-events: none;
  border-radius: inherit;
}
```

## Optimistic Sync & Flicker Prevention

### 1. Delay Optimistic Cleanup
In `src/hooks/usePolls.ts`, we update `useVotePoll()` so that the `onSuccess` callback returns the `invalidateQueries` promise. This forces React Query to await the refetch from the network before settling the mutation and executing `onSettled` (which clears the Zustand optimistic state):

```typescript
    onSuccess: () => {
      return qc.invalidateQueries({ queryKey: ['polls'] });
    },
    onSettled: (_data, _error, input) => {
      if (input?.pollId) {
        // Cooldown delay to prevent race conditions with Realtime WebSocket sync invalidations
        setTimeout(() => {
          clearOptimisticVote(input.pollId);
        }, 800);
      }
    },
```

### 2. Disabling Buttons During Active Sync
To prevent double clicks or race conditions during the 200–500ms sync window, we disable the option buttons:
```tsx
const isPending = voteMutation.isPending && voteMutation.variables?.pollId === poll.id;

// In button props:
disabled={isClosed || isPending}
```

## Verification & Testing
1.  **Rendering Test**: Verify option buttons before and after voting. Before voting, checkboxes/radio buttons render on the left; after voting, they disappear, and the background is filled to match `pct%`.
2.  **Animation Test**: Verify that the background fill slides smoothly from left-to-right on vote submission.
3.  **Flicker & Sync Test**: Click an option to vote. Verify that the bar fills instantly, stays filled without disappearing/resetting, and the buttons are temporarily disabled until the network sync completes.
4.  **Mass Bunk Test**: Create a Mass Bunk template poll. Verify that the "Ditch & Chill" option turns orange/red and glows correctly when the bunk status threshold is met, using the new full-background fill style.
5.  **Contrast & Accessibility**: Check that text remains highly readable over all filled background variants.
