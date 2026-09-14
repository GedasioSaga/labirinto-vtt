import type { FloorStyle, MapFrame } from '../types/map'
import { Toggle } from './Toggle'

export interface FloorStyleControlsProps {
  style: FloorStyle
  onStyleChange: (patch: Partial<FloorStyle>) => void
  /** `false` sem imagem de fundo — o botão fica desabilitado, com o motivo escrito. */
  canTraceFromBackground: boolean
  onTraceFromBackground: () => void
  onTraceDetailsFromBackground: () => void
  /** Pipeline completo (chão + linhas + portas + calibração) com render fiel ligado. */
  onRecreateMinimapFromBackground: () => void
  frame: MapFrame | null
  onFrameChange: (frame: MapFrame | null) => void
  /** Retângulo usado ao ligar a moldura pela primeira vez. */
  defaultFrameRect: Pick<MapFrame, 'x' | 'y' | 'w' | 'h'>
}

const DEFAULT_FRAME_TITLE = 'Mapa'

/** `FloorStyle.sampleStep` ausente === 2 (types/map.ts). */
const DEFAULT_SAMPLE_STEP = 2
/** Cor do contorno ao ligá-lo pela primeira vez — escuro lê como borda sobre qualquer preenchimento. */
const DEFAULT_STROKE_COLOR = '#000000'

const SAMPLE_STEP_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0.5, label: 'Alta' },
  { value: 1, label: 'Média' },
  { value: 2, label: 'Rápida' },
]

/**
 * Estilo do chão do MAPA inteiro (não de uma peça) e a criação de peças a
 * partir da imagem de fundo. Mesma seção do painel para os dois porque os
 * dois são "o chão deste mapa", independentes de seleção.
 */
export function FloorStyleControls({
  style,
  onStyleChange,
  canTraceFromBackground,
  onTraceFromBackground,
  onTraceDetailsFromBackground,
  onRecreateMinimapFromBackground,
  frame,
  onFrameChange,
  defaultFrameRect,
}: FloorStyleControlsProps) {
  const sampleStep = style.sampleStep ?? DEFAULT_SAMPLE_STEP

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Chão</h2>

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-floor-fill-color">
          Cor do chão
        </label>
        <input
          id="lb-floor-fill-color"
          className="lb-swatch"
          type="color"
          value={style.fillColor}
          onChange={(event) => onStyleChange({ fillColor: event.target.value })}
        />
      </div>

      <Toggle
        label="Contorno"
        checked={style.strokeColor !== null}
        onChange={(checked) => onStyleChange({ strokeColor: checked ? DEFAULT_STROKE_COLOR : null })}
      />
      {style.strokeColor !== null && (
        <div className="lb-field">
          <label className="lb-label" htmlFor="lb-floor-stroke-color">
            Cor do contorno
          </label>
          <input
            id="lb-floor-stroke-color"
            className="lb-swatch"
            type="color"
            value={style.strokeColor}
            onChange={(event) => onStyleChange({ strokeColor: event.target.value })}
          />
        </div>
      )}

      <div className="lb-field">
        <span className="lb-label">Precisão do contorno</span>
        <div className="lb-seg" role="radiogroup" aria-label="Precisão do contorno do chão">
          {SAMPLE_STEP_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={sampleStep === option.value}
              className="lb-seg__option"
              title={`Amostra a cada ${option.value} px — menor é mais fiel e mais lento`}
              onClick={() => onStyleChange({ sampleStep: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="lb-btn lb-btn--block" disabled={!canTraceFromBackground} onClick={onTraceFromBackground}>
        Chão a partir da imagem de fundo
      </button>
      <button type="button" className="lb-btn lb-btn--block" disabled={!canTraceFromBackground} onClick={onTraceDetailsFromBackground}>
        Linhas e portas a partir da imagem de fundo
      </button>
      <button type="button" className="lb-btn lb-btn--block" disabled={!canTraceFromBackground} onClick={onRecreateMinimapFromBackground}>
        Recriar minimapa a partir da imagem de fundo
      </button>
      <Toggle
        label="Render fiel (minimapa)"
        checked={style.renderMode === 'raster'}
        onChange={(checked) => onStyleChange({ renderMode: checked ? 'raster' : 'vector' })}
      />
      {!canTraceFromBackground && <span className="lb-label">Importe uma imagem de fundo para usar.</span>}

      <Toggle
        label="Moldura com título"
        checked={frame !== null}
        onChange={(checked) => onFrameChange(checked ? { title: DEFAULT_FRAME_TITLE, ...defaultFrameRect } : null)}
      />
      {frame !== null && (
        <div className="lb-field">
          <label className="lb-label" htmlFor="lb-map-frame-title">
            Título da moldura
          </label>
          <input
            id="lb-map-frame-title"
            className="lb-input"
            type="text"
            value={frame.title}
            onChange={(event) => onFrameChange({ ...frame, title: event.target.value })}
          />
        </div>
      )}
    </section>
  )
}
