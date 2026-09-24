import { useState } from 'react'
import type { PinPassage, StairDirection } from '../types/map'
import { stairSizePresetForStepWidth, stairStepWidthForPreset, type StairSizePreset } from '../lib/stairs'
import { PIN_PASSAGE_LABELS, PIN_PASSAGE_ORDER } from '../lib/pins'
import type { TravelSceneOption } from '../lib/pinTravel'

/**
 * "Leva a…" da escada: para qual andar (cena da aventura) ela leva e como o
 * jogador passa. A ligação mora no pino invisível da escada
 * (`lib/stairTravel.ts`) — o painel só lê e pede ao `adventureStore`.
 */
export interface StairTravelProps {
  /** As outras cenas da aventura (`travelSceneOptions`). */
  scenes: readonly TravelSceneOption[]
  /** A cena para onde a escada leva hoje; `null` = não leva a lugar nenhum. */
  linkedSceneId: string | null
  /** Modo do pino da escada (só vale com a escada ligada). */
  passage: PinPassage
  /** Liga a escada a `sceneId` com o modo `passage`: nasce lá a escada par. */
  onLink: (sceneId: string, passage: PinPassage) => void
  /** "Nenhum outro andar". */
  onUnlink: () => void
  /** Troca o modo da escada já ligada. */
  onPassageChange: (passage: PinPassage) => void
}

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
  /** Só numa aventura (há outro andar para onde ir). Ausente = mapa solto: a seção não aparece. */
  travel?: StairTravelProps
}

const MIN_STEP_WIDTH = 1

const LEVA_A_ID = 'lb-stair-leva-a'

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

/** Degraus da miniatura: base no lance, e o traço engorda e clareia rumo ao topo. */
const ART_TREADS = [
  { base: 2, width: 0.9, opacity: 0.55 },
  { base: 6, width: 1.2, opacity: 0.66 },
  { base: 10, width: 1.5, opacity: 0.78 },
  { base: 14, width: 1.8, opacity: 0.89 },
  { base: 18, width: 2.1, opacity: 1 },
]

/**
 * Miniatura do lance como o mapa desenha (`pixi/drawStairs.ts`): duas vigas
 * finas, degraus em galão apontando ladeira acima, engordando e clareando rumo
 * ao topo. "Sobe" aponta para a ponta do arrasto, "Desce" para o começo — o
 * mesmo desenho espelhado, que é justamente o que o mestre precisa reconhecer
 * no mapa sem abrir painel nenhum.
 *
 * Esquemática de propósito: a miniatura sempre deita na horizontal, enquanto o
 * lance no mapa segue o arrasto (pode estar na vertical ou na diagonal). O que
 * ela ensina é a leitura — o degrau aponta para o alto —, não a orientação
 * daquela escada. Mesmo padrão de `GridShapePicker`: o controle mostra o que
 * controla.
 */
function StairDirectionArt({ direction }: { direction: StairDirection }) {
  return (
    <svg width="34" height="26" viewBox="0 0 26 24" fill="none" stroke="currentColor" aria-hidden="true">
      <g transform={direction === 'up' ? undefined : 'translate(26 0) scale(-1 1)'} strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6H23M2 18H23" strokeWidth="0.8" opacity="0.85" />
        {ART_TREADS.map(({ base, width, opacity }) => (
          <path key={base} d={`M${base} 6L${base + 4.5} 12L${base} 18`} strokeWidth={width} opacity={opacity} />
        ))}
      </g>
    </svg>
  )
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
/**
 * "Leva a…" da escada. Escolher o andar LIGA na hora: nasce lá a escada par
 * ("Desce" para quem sobe), e nenhum pino aparece em nenhuma das duas cenas.
 * O modo vem antes de ligar — a escada já nasce livre, se o mestre quiser —
 * e, ligada, troca direto no pino dela, com desfazer.
 */
function StairTravelSection({ scenes, linkedSceneId, passage, onLink, onUnlink, onPassageChange }: StairTravelProps) {
  // Sem ligação, o modo é só a escolha para a ligação que vem: não há pino
  // onde gravar ainda. "Pede ao mestre" é o de sempre, como no pino de viagem.
  const [pendingPassage, setPendingPassage] = useState<PinPassage>('pede')
  const linked = linkedSceneId !== null
  const currentPassage = linked ? passage : pendingPassage

  return (
    <>
      <div className="lb-field">
        <label className="lb-label" htmlFor={LEVA_A_ID}>
          Leva a
        </label>
        <select
          id={LEVA_A_ID}
          className="lb-input"
          value={linkedSceneId ?? ''}
          onChange={(event) => {
            const sceneId = event.target.value
            if (sceneId === '') onUnlink()
            else onLink(sceneId, currentPassage)
          }}
        >
          <option value="">Nenhum outro andar</option>
          {scenes.map((scene) => (
            <option key={scene.id} value={scene.id} disabled={!scene.available}>
              {scene.available ? scene.name : `${scene.name} (não abriu)`}
            </option>
          ))}
        </select>
      </div>
      <div className="lb-field">
        <span className="lb-label">Passagem</span>
        <div className="lb-seg" role="radiogroup" aria-label="Passagem da escada">
          {PIN_PASSAGE_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={currentPassage === option}
              className="lb-seg__option"
              onClick={() => (linked ? onPassageChange(option) : setPendingPassage(option))}
            >
              {PIN_PASSAGE_LABELS[option]}
            </button>
          ))}
        </div>
        {linked && <p className="lb-field__hint">O jogador toca a escada e lê “Subir” ou “Descer” — nunca o nome do andar.</p>}
      </div>
    </>
  )
}

export function StairControls({ direction, onDirectionChange, stepWidth, onStepWidthChange, grid, travel }: StairControlsProps) {
  const activePreset = stairSizePresetForStepWidth(stepWidth, grid)

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Escada</h2>
      {/* Segmento Sobe | Desce (auditoria 14/09): o toggle "Sobe (desmarcado =
          desce)" pedia para ler a regra antes de clicar. A miniatura (17/09) é
          o desenho que vai para o mapa: a escolha e o resultado na mesma tela. */}
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
              <StairDirectionArt direction={option} />
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

      {travel !== undefined && <StairTravelSection {...travel} />}
    </section>
  )
}
