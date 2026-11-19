/** Empty row that stands in for the rows the virtualizer does not mount. Renders nothing at height 0. */
export function SpacerRow({ height, colSpan }: { height: number; colSpan: number }) {
  if (height <= 0) return null
  return (
    <tr aria-hidden className="spacer">
      <td colSpan={colSpan} style={{ height }} />
    </tr>
  )
}
