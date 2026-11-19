import type { SourceControls, SourceId, SourceInfo } from '../../app/sources'
import type { ConnectionStatus } from '../../data'
import { LiveStats } from '../stats/LiveStats'
import { SourcePicker } from './SourcePicker'
import { SymbolCountInput } from './SymbolCountInput'
import { TpsSlider } from './TpsSlider'

type Props = {
  sources: readonly SourceInfo[]
  source: SourceId
  onSourceChange(source: SourceId): void
  status: ConnectionStatus
  controls: SourceControls
}

export function ControlPanel({ sources, source, onSourceChange, status, controls }: Props) {
  const { tps, setTps, symbols, maxSymbols, setSymbolCount } = controls

  return (
    <section className="panel">
      <SourcePicker sources={sources} value={source} onChange={onSourceChange} status={status} />

      <TpsSlider
        value={tps}
        disabled={setTps === null || tps === null}
        mockOnly={setTps === null}
        onChange={(v) => setTps?.(v)}
      />

      <SymbolCountInput
        // Remount when the source or the applied value changes, so the draft resets.
        key={`${source}:${symbols.length}`}
        value={symbols.length}
        max={maxSymbols}
        onApply={setSymbolCount}
      />

      <LiveStats />
    </section>
  )
}
