/**
 * Safe wrapper around the Web Vibrations API for ClassHub.
 * Safely degrades on unsupported platforms (like iOS Safari or desktop).
 */
export const haptics = {
  /**
   * Premium 10ms micro-pulse for positive ticks and selections.
   */
  lightClick: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch (err) {
        // Fallback for security restrictions in sandboxed iframes
        console.debug('[Haptics] lightClick failed:', err);
      }
    }
  },

  /**
   * Slightly heavier 20ms pulse for cancellations, removals, and active sheet actions.
   */
  heavyClick: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(20);
      } catch (err) {
        console.debug('[Haptics] heavyClick failed:', err);
      }
    }
  },

  /**
   * Rich double-pulse [8ms, 50ms, 8ms] for major workflow milestones (like submissions and imports).
   */
  doublePulse: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([8, 50, 8]);
      } catch (err) {
        console.debug('[Haptics] doublePulse failed:', err);
      }
    }
  }
};
