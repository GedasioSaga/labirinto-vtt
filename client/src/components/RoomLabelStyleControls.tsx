import { useId } from 'react'
import {
  ROOM_LABEL_DEFAULT_COLOR,
  ROOM_LABEL_SCALE_MAX,
  ROOM_LABEL_SCALE_MIN,
  type RoomLabelStyle,
  type RoomLabelStylePatch,
} from '../lib/roomLabelStyle'
import { Toggle } from './Toggle'
import { CampoDeCorComPipeta } from './CampoDeCorComPipeta'

/** Passo do slider de tamanho, em pontos percentuais. */
const SCALE_STEP_PERCENT = 5

const ORIENTATIONS: readonly { vertical: boolean; label: string }[] = [
  { vertical: false, label: 'Horizontal' },
  { vertical: true, label: 'Vertical' },
]

export interface RoomLabelStyleControlsProps {
  style: RoomLabelStyle
  onChange: (patch: RoomLabelStylePatch) => void
}

/**
 * ESTILO DO TÍTULO — logo abaixo do Nome da Sala: fundo (a plaquinha clara),
 * tamanho da fonte, cor do texto e orientação. Cada controle manda só o eixo
 * que mexeu; o padrão de cada um é o visual de sempre.
 */
export function RoomLabelStyleControls({ style, onChange }: RoomLabelStyleControlsProps) {
  const baseId = useId()
  const sizeId = `${baseId}-tamanho`
  const colorId = `${baseId}-cor`
  const percent = Math.round(style.scale * 100)
  const isDefaultColor = style.color === ROOM_LABEL_DEFAULT_COLOR

  return (
    <div className="lb-room-title" role="group" aria-label="Título no mapa">
      <Toggle label="Fundo do título" checked={style.plate} onChange={(plate) => onChange({ plate })} />

      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor={sizeId}>
            Tamanho do título
          </label>
          <span className="lb-num">{percent}%</span>
        </div>
        <input
          id={sizeId}
          className="lb-range"
          type="range"
          min={Math.round(ROOM_LABEL_SCALE_MIN * 100)}
          max={Math.round(ROOM_LABEL_SCALE_MAX * 100)}
          step={SCALE_STEP_PERCENT}
          value={percent}
          onChange={(event) => onChange({ scale: Number(event.target.value) / 100 })}
        />
      </div>

      <div className="lb-section__row">
        <label className="lb-label" htmlFor={colorId}>
          Cor do título
        </label>
        <div className="lb-room-title__color">
          {!isDefaultColor && (
            <button type="button" className="lb-btn lb-btn--ghost" onClick={() => onChange({ color: ROOM_LABEL_DEFAULT_COLOR })}>
              Padrão
            </button>
          )}
          <CampoDeCorComPipeta
            id={colorId}
            value={style.color}
            rotuloDaPipeta="Pegar do mapa a cor do título"
            onChange={(cor) => onChange({ color: cor })}
          />
        </div>
      </div>

      <div className="lb-seg" role="radiogroup" aria-label="Orientação do título">
        {ORIENTATIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={style.vertical === option.vertical}
            className="lb-seg__option"
            onClick={() => onChange({ vertical: option.vertical })}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
