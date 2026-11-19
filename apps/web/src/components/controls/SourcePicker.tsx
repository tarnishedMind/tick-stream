import type { SourceId, SourceInfo } from '../../app/sources'
import type { ConnectionStatus } from '../../data'

type Props = {
  sources: readonly SourceInfo[]
  value: SourceId
  onChange(source: SourceId): void
  status: ConnectionStatus
}

/** Radio buttons for the data source, with the feed's connection status next to them. */
export function SourcePicker({ sources, value, onChange, status }: Props) {
  return (
    <fieldset className="control source">
      <legend>Source</legend>
      {sources.map((s) => (
        <label key={s.id}>
          <input type="radio" name="source" checked={value === s.id} onChange={() => onChange(s.id)} />
          {s.label}
        </label>
      ))}
      <span className={`status status-${status}`}>{status}</span>
    </fieldset>
  )
}
