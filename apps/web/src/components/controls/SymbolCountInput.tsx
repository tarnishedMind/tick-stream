import { useState, type FormEvent } from 'react'
import { formatInteger } from '../../format'

type Props = { value: number; max: number; onApply(value: number): void }

/** Number input that applies on Enter or blur, clamped to 1..max. Remount it to reset the draft. */
export function SymbolCountInput({ value, max, onApply }: Props) {
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
      <span className="hint">max {formatInteger(max)}</span>
    </form>
  )
}
