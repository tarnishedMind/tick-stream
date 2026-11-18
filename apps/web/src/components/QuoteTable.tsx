import { useMemo, useRef } from 'react'
import { flexRender, useTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { QuoteRow } from './QuoteRow'
import { quoteColumns, quoteTableFeatures, type QuoteRowData } from './quoteColumns'

/** Must match `.quotes tbody tr` height in styles.css: rows are fixed-height, nothing is measured. */
export const ROW_HEIGHT = 28
const OVERSCAN = 8

/**
 * Virtualized quotes table. Only rows in (and just around) the viewport are
 * mounted, and each mounted row subscribes to its own symbol.
 */
export function QuoteTable({ symbols }: { symbols: readonly string[] }) {
  const data = useMemo<QuoteRowData[]>(() => symbols.map((symbol) => ({ symbol })), [symbols])
  const table = useTable({
    features: quoteTableFeatures,
    columns: quoteColumns,
    data,
    getRowId: (row) => row.symbol,
  })
  const rows = table.getRowModel().rows

  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => rows[index]?.id ?? index,
    overscan: OVERSCAN,
  })
  const items = virtualizer.getVirtualItems()
  const padTop = items[0]?.start ?? 0
  const padBottom = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0)

  return (
    <div ref={scrollRef} className="quotes-scroll">
      <table className="quotes">
        <colgroup>
          {table.getAllLeafColumns().map((column) => (
            <col key={column.id} style={{ width: column.getSize() }} />
          ))}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} className={header.column.id === 'symbol' ? undefined : 'num'}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {padTop > 0 && (
            <tr aria-hidden className="spacer">
              <td colSpan={quoteColumns.length} style={{ height: padTop }} />
            </tr>
          )}
          {items.map((item) => {
            const row = rows[item.index]
            return row ? <QuoteRow key={row.id} row={row} /> : null
          })}
          {padBottom > 0 && (
            <tr aria-hidden className="spacer">
              <td colSpan={quoteColumns.length} style={{ height: padBottom }} />
            </tr>
          )}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty">No symbols yet.</p>}
    </div>
  )
}
