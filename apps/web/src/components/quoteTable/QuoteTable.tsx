import { flexRender, useTable } from '@tanstack/react-table'
import { useMemo, useRef, type CSSProperties } from 'react'
import { quoteColumns, quoteTableFeatures, type QuoteRowData } from './columns'
import { QuoteRow } from './QuoteRow'
import { SpacerRow } from './SpacerRow'
import { useVirtualRows } from './useVirtualRows'

/** Row height in px. Passed to CSS as `--row-height`; rows are fixed-height, nothing is measured. */
export const ROW_HEIGHT = 28
const OVERSCAN = 8

const scrollStyle = { '--row-height': `${ROW_HEIGHT}px` } as CSSProperties

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
  const { items, padTop, padBottom } = useVirtualRows(rows, scrollRef, ROW_HEIGHT, OVERSCAN)

  return (
    <div ref={scrollRef} className="quotes-scroll" style={scrollStyle}>
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
                <th key={header.id} className={header.column.columnDef.meta?.align === 'right' ? 'num' : undefined}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          <SpacerRow height={padTop} colSpan={quoteColumns.length} />
          {items.map((item) => {
            const row = rows[item.index]
            return row ? <QuoteRow key={row.id} row={row} /> : null
          })}
          <SpacerRow height={padBottom} colSpan={quoteColumns.length} />
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty">No symbols yet.</p>}
    </div>
  )
}
