import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import type { RefObject } from 'react'

export type VirtualRows = {
  items: VirtualItem[]
  /** Height of the unmounted rows above and below the mounted ones (px). */
  padTop: number
  padBottom: number
}

/**
 * Fixed-height row virtualization for a table inside `scrollRef`. Rows are
 * never measured, so `rowHeight` must match the CSS row height.
 */
export function useVirtualRows(
  rows: readonly { id: string }[],
  scrollRef: RefObject<HTMLElement | null>,
  rowHeight: number,
  overscan: number,
): VirtualRows {
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    getItemKey: (index) => rows[index]?.id ?? index,
    overscan,
  })
  const items = virtualizer.getVirtualItems()
  const padTop = items[0]?.start ?? 0
  const padBottom = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0)
  return { items, padTop, padBottom }
}
