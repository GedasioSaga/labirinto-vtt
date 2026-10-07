import type { RegionSplit, RegionSplitDirection } from '../types/map'
import { SPLIT_AT_DEFAULT, SPLIT_AT_MAX, SPLIT_AT_MIN } from '../lib/regionSplit'
import { CampoDeCorComPipeta } from './CampoDeCorComPipeta'
import { Toggle } from './Toggle'

const DIRECTIONS: Array<{ value: RegionSplitDirection; label: string }> = [
  { value: 'vertical', label: 'Em pé' },
  { value: 'horizontal', label: 'Deitada' },
  { value: 'diagonal', label: 'Diagonal' },
]

/** Segunda cor quando o mestre liga: o latão do app, que contrasta com o fundo padrão. */
const SEGUNDA_COR_PADRAO = '#e0a44a'

export interface RegionSplitControlsProps {
  /** A divisão da sala selecionada; `undefined` = uma cor só. */
  split: RegionSplit | undefined
  onChange: (split: RegionSplit | null) => void
}

/**
 * "Duas cores" no painel da Sala (pedido de 07/10/2026): uma reta divide a
 * sala e o lado de lá pega a segunda cor. Direção em pé, deitada ou diagonal;
 * o controle "Onde corta" anda a reta de um lado ao outro.
 */
export function RegionSplitControls({ split, onChange }: RegionSplitControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Duas cores</h2>
      <Toggle
        label="Pintar parte da sala de outra cor"
        checked={split !== undefined}
        onChange={(on) => onChange(on ? { color: SEGUNDA_COR_PADRAO, direction: 'vertical', at: SPLIT_AT_DEFAULT } : null)}
      />
      {split && (
        <>
          <div className="lb-section__row">
            <label className="lb-label" htmlFor="lb-region-split-color">
              Segunda cor
            </label>
            <CampoDeCorComPipeta
              id="lb-region-split-color"
              value={split.color}
              rotuloDaPipeta="Pegar do mapa a segunda cor"
              onChange={(color) => onChange({ ...split, color })}
            />
          </div>
          <div className="lb-field">
            <span className="lb-label">Divisão</span>
            <div className="lb-seg" role="radiogroup" aria-label="Direção da divisão">
              {DIRECTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={split.direction === value}
                  className="lb-seg__option"
                  onClick={() => onChange({ ...split, direction: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="lb-field">
            <div className="lb-section__row">
              <label className="lb-label" htmlFor="lb-region-split-at">
                Onde corta
              </label>
              <span className="lb-num">{Math.round(split.at * 100)}%</span>
            </div>
            <input
              id="lb-region-split-at"
              className="lb-range"
              type="range"
              min={SPLIT_AT_MIN * 100}
              max={SPLIT_AT_MAX * 100}
              step={1}
              value={Math.round(split.at * 100)}
              onChange={(event) => onChange({ ...split, at: Number(event.target.value) / 100 })}
            />
          </div>
        </>
      )}
    </section>
  )
}
