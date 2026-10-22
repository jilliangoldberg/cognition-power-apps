import type { MouseEvent } from 'react';

export function openFromRow(open: () => void) {
  return (event: MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as Element).closest('a, button, input, select, textarea, label')) return;
    if (window.getSelection()?.toString()) return;
    open();
  };
}
