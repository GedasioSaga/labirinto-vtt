import type { StairDirection } from '../types/map'
import { stairSizePresetForStepWidth, stairStepWidthForPreset, type StairSizePreset } from '../lib/stairs'

export interface StairControlsProps {
  direction: StairDirection
  onDirectionChange: (direction: StairDirection) => void
  /** `stepWidth` (largura do lance, px de mundo) da escada SELECIONADA. */
  stepWidth: number
  onStepWidthChange: (stepWidth: number) => void
  /** `map.grid` do mapa atual — só para calcular os 3 presets relativos à
   *  célula (ver STAIR_SIZE_PRESET_RATIO em lib/stairs.ts). Não editável
   *  aqui: é propriedade do mapa, não da escada. */
  grid: number
}

const MIN_STEP_WIDTH = 1

const PRESET_ORDER: StairSizePreset[] = ['small', 'medium', 'large']

const DIRECTION_ORDER: StairDirection[] = ['up', 'down']

const DIRECTION_LABELS: Record<StairDirection, string> = {
  up: 'Sobe',
  down: 'Desce',
}

const PRESET_LABELS: Record<StairSizePreset, string> = {
  small: 'Pequena',
  medium: 'Média',
  large: 'Grande',
}

/**
 * Sentido de subida e largura do lance (`stepWidth`) da escada SELECIONADA.
 *
 * `stepWidth` ganhou controle nesta rodada (F4, N1 "escada pequena média
 * grande") — a rodada anterior (F2) omitia de propósito, ver
 * docs/PLANO-FASES.md §3. Dois jeitos de editar o mesmo valor: 3 presets
 * P/M/G (múltiplos de `grid`, critério em lib/stairs.ts) para o caso comum,
 * mais um campo numérico fino para quem quiser um valor entre eles — mesmo
 * padrão de dois controles pro mesmo eixo que `PolygonSidesControls` (slider)
 * versus a setinha de variantes (presets curados) usa para `polygonSides`.
 *
 * Ao contrário de WallStyleControls, não existe (ainda) uma preferência
 * "próxima escada" para `stepWidth` aqui dentro — este componente só edita a
 * entidade JÁ SELECIONADA: `selectedStair.stepWidth`/`(w) =>
 * setStairStepWidth(selectedStair.id, w)`. A preferência de sessão para a
 * PRÓXIMA escada (mesma classe de `wallKind`/`polygonSides`) é o que a
 * setinha de variantes da Toolbar edita — ver CONTRATO do agente.
 */
export function StairControls({ direction, onDirectionChange, stepWidth, onStepWidthChange, grid }: StairControlsProps) {
  const activePreset = stairSizePresetForStepWidth(stepWidth, grid)

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Escada</h2>
      {/* Segmento Sobe | Desce (auditoria 14/09): o toggle "Sobe (desmarcado =
          desce)" pedia para ler a regra antes de clicar. */}
      <div className="lb-field">
        <span className="lb-label">Sentido</span>
        <div className="lb-seg" role="radiogroup" aria-label="Sentido da escada">
          {DIRECTION_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={direction === option}
              className="lb-seg__option"
              onClick={() => onDirectionChange(option)}
            >
              {DIRECTION_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="lb-field">
        <span className="lb-label">Tamanho</span>
        <div className="lb-seg" role="radiogroup" aria-label="Tamanho da escada">
          {PRESET_ORDER.map((preset) => (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={activePreset === preset}
              className="lb-seg__option"
              onClick={() => onStepWidthChange(stairStepWidthForPreset(preset, grid))}
            >
              {PRESET_LABELS[preset]}
            </button>
          ))}
        </div>
      </div>

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-stair-step-width">
          Largura do lance (px)
        </label>
        <input
          id="lb-stair-step-width"
          className="lb-input"
          type="number"
          min={MIN_STEP_WIDTH}
          step={1}
          value={stepWidth}
          onChange={(event) => {
            // Campo apagado (digitando de novo) chega como '' -> Number('') é
            // 0, não NaN, então cairia direto no clamp de MIN_STEP_WIDTH sem
            // deixar o usuário passar por um estado intermediário vazio. Só
            // dado realmente não-numérico (não deveria acontecer num
            // type="number", mas o valor do evento sempre chega como string)
            // é descartado em vez de gravar NaN na entidade.
            const parsed = Number(event.target.value)
            if (Number.isNaN(parsed)) return
            onStepWidthChange(Math.max(MIN_STEP_WIDTH, parsed))
          }}
        />
      </div>
    </section>
  )
}
