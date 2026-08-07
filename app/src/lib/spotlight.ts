import type { MouseEvent } from 'react';

// Cursor-tracked radial-gradient glow for panel-style cards — mirrors
// Pushdle's own spotlightMove/.spotlight pattern exactly. Pair with the
// .spotlight CSS class: this just feeds it --mx/--my.
export function spotlightMove(e: MouseEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
}
