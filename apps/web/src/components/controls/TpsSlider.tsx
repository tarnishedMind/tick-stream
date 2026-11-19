import { LIMITS } from '@tick-stream/protocol'
import { useState } from 'react'
import { formatInteger, PLACEHOLDER } from '../../format'

/** Slider range. The server accepts up to LIMITS.tps.max; the UI stops lower to keep steps usable. */
export const TPS_RANGE = { min: LIMITS.tps.min, max: 100_000, step: 500 } as const

type Props = {
  value: number | null
  disabled: boolean
  /** Show the "mock only" hint (the active source has no rate setting). */
  mockOnly: boolean
  onChange(value: number): void
}

/** The slider shows the dragged value immediately and sends every change; the server echoes the applied one. */
export function TpsSlider({ value, disabled, mockOnly, onChange }: Props) {
  const [draft, setDraft] = useState<number | null>(null)
  const shown = disabled ? null : (draft ?? value)
  const settle = () => setDraft(null)

  return (
    <label className="control tps">
      <span className="control-label">
        Ticks/sec <strong>{shown === null ? PLACEHOLDER : formatInteger(shown)}</strong>
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
