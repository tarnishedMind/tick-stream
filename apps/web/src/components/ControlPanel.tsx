import { useState, type FormEvent } from 'react'
import type { ConnectionStatus } from '../data'
import { LiveStats } from './LiveStats'

export type Source = 'mock' | 'binance'

export const TPS_RANGE = { min: 0, max: 100_000, step: 500 } as const

type Props = {
  source: Source
  onSourceChange(source: Source): void
  status: ConnectionStatus
  /** Ticks/sec reported by the mock server; null for Binance or before the first config. */
  tps: number | null
  onTpsChange(tps: number): void
  symbolCount: number
  maxSymbols: number
  onSymbolCountChange(count: number): void
}

export function ControlPanel(props: Props) {
  const { source, onSourceChange, status, tps, onTpsChange, symbolCount, maxSymbols, onSymbolCountChange } = props
  const isMock = source === 'mock'

  return (
    <section className="panel">
      <fieldset className="control source">
        <legend>Source</legend>
        {(['mock', 'binance'] as const).map((s) => (
          <label key={s}>
            <input type="radio" name="source" checked={source === s} onChange={() => onSourceChange(s)} />
            {s === 'mock' ? 'Mock' : 'Binance'}
          </label>
        ))}
        <span className={`status status-${status}`}>{status}</span>
      </fieldset>

      <TpsSlider value={tps} disabled={!isMock || tps === null} mockOnly={!isMock} onChange={onTpsChange} />

      <SymbolCountInput
        // Remount when the source or the applied value changes, so the draft resets.
        key={`${source}:${symbolCount}`}
        value={symbolCount}
        max={maxSymbols}
        onApply={onSymbolCountChange}
      />

      <LiveStats />
    </section>
  )
}

/** The slider shows the dragged value immediately and sends every change; the server echoes the applied one. */
function TpsSlider(props: { value: number | null; disabled: boolean; mockOnly: boolean; onChange(v: number): void }) {
  const { value, disabled, mockOnly, onChange } = props
  const [draft, setDraft] = useState<number | null>(null)
  const shown = disabled ? null : (draft ?? value)
  const settle = () => setDraft(null)

  return (
    <label className="control tps">
      <span className="control-label">
        Ticks/sec <strong>{shown === null ? '—' : shown.toLocaleString('en-US')}</strong>
      </span>
      <input
        type="range"
        min={TPS_RANGE.min}
        max={TPS_RANGE.max}
        step={TPS_RANGE.step}
        disabled={disabled}
        value={shown ?? TPS_RANGE.min}
        onChange={(e) => {
          const v = Number(e.currentTarget.value)
          setDraft(v)
          onChange(v)
        }}
        onPointerUp={settle}
        onKeyUp={settle}
        onBlur={settle}
      />
      {mockOnly && <span className="hint">mock only</span>}
    </label>
  )
}

function SymbolCountInput({ value, max, onApply }: { value: number; max: number; onApply(v: number): void }) {
  const [draft, setDraft] = useState(String(value))

  const apply = () => {
    const n = Math.round(Number(draft))
    if (!Number.isFinite(n)) return setDraft(String(value))
    const clamped = Math.min(max, Math.max(1, n))
    setDraft(String(clamped))
    if (clamped !== value) onApply(clamped)
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    apply()
  }

  return (
    <form className="control symbols" onSubmit={onSubmit} noValidate>
      <label>
        <span className="control-label">Symbols</span>
        <input
          type="number"
          min={1}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={apply}
        />
      </label>
      <span className="hint">max {max.toLocaleString('en-US')}</span>
    </form>
  )
}
