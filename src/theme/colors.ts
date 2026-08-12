/**
 * colors.ts
 *
 * Single responsibility: the one source of truth for color values used
 * across screens. Add new colors here instead of hard-coding hex values
 * inside a screen's StyleSheet.
 */
export const colors = {
  background: '#000000',
  text: '#ffffff',
  /** Bounding box / status color while tracking but not yet centred. */
  tracking: '#ffcc00',
  /** Bounding box / status color once the athlete is within the centre buffer. */
  locked: '#34c759',
  /** Semi-transparent panel background for on-screen readouts, over live camera feed. */
  overlayPanel: 'rgba(0,0,0,0.72)',
} as const;
