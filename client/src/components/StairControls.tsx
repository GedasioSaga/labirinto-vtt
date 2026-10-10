import { useState } from 'react'
import type { PinPassage, StairDirection, StairShape } from '../types/map'
import { stairSizePresetForStepWidth, stairStepWidthForPreset, type StairSizePreset } from '../lib/stairs'
import { PIN_PASSAGE_LABELS, PIN_PASSAGE_ORDER } from '../lib/pins'
import { floorSideOf, type StairTravelProps } from '../lib/stairTravel'
import { travelSceneLabel } from '../lib/pinTravel'
import { STAIR_MAX_LENGTH_CELLS, STAIR_MAX_WIDTH_CELLS, STAIR_MIN_CELLS } from '../lib/stairCurve'

export type { StairTravelProps }

export interface StairControlsProps {
  direction: StairDirection
  onDirectionChange: (direction: StairDirection) => void
  /** Forma da escada SELECIONADA ("Reta" / "Espiral"). */
  shape: StairShape
  onShapeChange: (shape: StairShape) => void
  /** `stepWidth` (largura do lance, px de mundo) da escada SELECIONADA. */
  stepWidth: number
  onStepWidthChange: (stepWidth: number) => void
  /** `map.grid` do mapa atual — só para calcular os 3 presets relativos à
   *  célula (ver STAIR_SIZE_PRESET_RATIO em lib/stairs.ts). Não editável
   *  aqui: é propriedade do mapa, não da escada. */
  grid: number
  /**
   * "Leva a…" (`stairTravelPanel`). `null` = mapa solto, sem outro andar: a
   * seção não aparece. OBRIGATÓRIO de propósito: quem monta o painel da escada
   * não pode esquecer a ligação e sumir com a seção sem o compilador ver.
   */
  travel: StairTravelProps | null
  /**
   * Comprimento e curva da escada SELECIONADA (pedido de 10/10/2026). Ausente
   * = sem os campos (quem monta o painel sem essa ligação); a largura em casas
   * aparece sempre, porque `stepWidth` já é prop.
   */
  tamanho?: StairTamanhoProps
}

export interface StairTamanhoProps {
  /** Comprimento de ponta a ponta, em px de mundo (`lib/stairCurve.ts`, `stairLength`). Na espiral, o diâmetro. */
  length: number
  onLengthChange: (length: number) => void
  /**
   * Volta da escada em graus (com o sinal da flecha) e o maior valor que esta
   * escada aguenta (`stairMaxTurnDegrees`). `null` = forma que não curva: L,
   * dupla e espiral.
   */
  curve: { degrees: number; maxDegrees: number } | null
  onCurveChange: (degrees: number) => void
}

/** − e + andam meia casa: as larguras de Pequena, Média e Grande caem nesse passo. */
const PASSO_CASAS = 0.5
const FOLGA = 1e-9

/** "4", "4,5", "0,25": casas com vírgula e no máximo duas casas decimais. */
function formatarCasas(casas: number): string {
  return String(Math.round(casas * 100) / 100).replace('.', ',')
}

/** "6,5" ou "6.5" viram 6,5; vazio ou texto que não é número, `null`. */
function lerCasas(texto: string): number | null {
  const normalizado = texto.trim().replace(',', '.')
  if (normalizado === '') return null
  const valor = Number(normalizado)
  return Number.isFinite(valor) ? valor : null
}

interface CampoEmCasasProps {
  id: string
  /** O que se lê acima do campo: "Comprimento", "Largura", "Diâmetro". */
  rotulo: string
  /** O nome nos botões para quem não vê: "o comprimento" → "Aumentar o comprimento". */
  nome: string
  px: number
  grid: number
  maxCasas: number
  onTrocar: (px: number) => void
}

/**
 * Um tamanho da escada em CASAS, com − e + ao lado (mesma linha do campo de
 * Rotação da Sala). O número digitado vale no Enter ou ao sair do campo; Esc
 * desfaz o que foi digitado, e texto que não é número volta ao valor sem
 * gravar nada. Teclado decimal: no celular aparece a vírgula.
 */
function CampoEmCasas({ id, rotulo, nome, px, grid, maxCasas, onTrocar }: CampoEmCasasProps) {
  const casas = px / grid
  /** `null` = ninguém digitando: o campo mostra o valor de agora (a alça mexeu, o Ctrl+Z voltou). */
  const [texto, setTexto] = useState<string | null>(null)

  const gravar = (novas: number) => {
    const limitadas = Math.min(maxCasas, Math.max(STAIR_MIN_CELLS, novas))
    if (Math.abs(limitadas - casas) > FOLGA) onTrocar(limitadas * grid)
  }
  const aplicar = () => {
    if (texto === null) return
    const lidas = lerCasas(texto)
    setTexto(null)
    if (lidas !== null) gravar(lidas)
  }
  // Fora do passo (veio de uma alça sem grade), o − e o + caem primeiro na meia casa mais perto.
  const menos = () => gravar(Math.ceil(casas / PASSO_CASAS - FOLGA) * PASSO_CASAS - PASSO_CASAS)
  const mais = () => gravar(Math.floor(casas / PASSO_CASAS + FOLGA) * PASSO_CASAS + PASSO_CASAS)
  const noMinimo = casas <= STAIR_MIN_CELLS + FOLGA
  const noMaximo = casas >= maxCasas - FOLGA

  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={id}>
        {rotulo}
      </label>
      <div className="lb-rotation">
        <div className="lb-inputgroup lb-rotation__value">
          <input
            id={id}
            className="lb-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={texto ?? formatarCasas(casas)}
            onChange={(event) => setTexto(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') aplicar()
              if (event.key === 'Escape' && texto !== null) {
                // Só desfaz a digitação; o Esc seguinte (sem texto) segue para o mapa.
                event.preventDefault()
                event.stopPropagation()
                setTexto(null)
              }
            }}
            onBlur={aplicar}
          />
          <span className="lb-inputgroup__suffix">{casas === 1 ? 'casa' : 'casas'}</span>
        </div>
        <button type="button" className="lb-btn lb-rotation__step" aria-label={`Diminuir ${nome}`} aria-disabled={noMinimo || undefined} onClick={noMinimo ? undefined : menos}>
          −
        </button>
        <button type="button" className="lb-btn lb-rotation__step" aria-label={`Aumentar ${nome}`} aria-disabled={noMaximo || undefined} onClick={noMaximo ? undefined : mais}>
          +
        </button>
      </div>
    </div>
  )
}

/**
 * A curva da escada reta: deslizante de −máximo a +máximo em graus de volta,
 * 0 no meio = reta. Os dois lados são os dois lados para onde ela dobra — o
 * mesmo que puxar a alça do meio no mapa. "Endireitar" volta ao zero sem
 * precisar acertar o meio do deslizante.
 */
function CampoDeCurva({ degrees, maxDegrees, onCurveChange }: { degrees: number; maxDegrees: number; onCurveChange: (degrees: number) => void }) {
  const maximo = Math.max(0, Math.floor(maxDegrees))
  const valor = Math.max(-maximo, Math.min(maximo, Math.round(degrees)))
  const leitura = valor === 0 ? 'Reta' : `${Math.abs(valor)}°`
  return (
    <div className="lb-field">
      <div className="lb-section__row">
        <label className="lb-label" htmlFor="lb-stair-curve">
          Curva
        </label>
        <span className="lb-num">{leitura}</span>
      </div>
      <input
        id="lb-stair-curve"
        className="lb-range"
        type="range"
        min={-maximo}
        max={maximo}
        step={1}
        value={valor}
        disabled={maximo === 0}
        aria-valuetext={valor === 0 ? 'reta' : `${Math.abs(valor)} graus`}
        onChange={(event) => onCurveChange(Number(event.target.value))}
      />
      {valor !== 0 && (
        <button type="button" className="lb-btn lb-btn--block" onClick={() => onCurveChange(0)}>
          Endireitar
        </button>
      )}
    </div>
  )
}

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

/** Só as formas que a UI produz: 'l' e 'double' existem no schema, mas ninguém as desenha ainda. */
const SHAPE_ORDER = ['straight', 'spiral'] as const satisfies readonly StairShape[]

const SHAPE_LABELS: Record<(typeof SHAPE_ORDER)[number], string> = {
  straight: 'Reta',
  spiral: 'Espiral',
}

/** Largura do viewBox da miniatura; a altura é 24, a mesma dos ícones da barra, desenhada a 18 px. */
const ART_VIEWBOX_WIDTH = 48

/** Placa deitada, centrada no viewBox (41 x 13): "Desce" espelha só os degraus. */
const ART_PLATE = { x: 3.5, y: 5.5, width: 41, height: 13 }

/** 4 unidades = 3 px a 18 px, o vão em que o mapa ainda desenha degrau (`MIN_TREAD_GAP_SCREEN_PX`). */
const ART_TREAD_PITCH = 4

/** Sete degraus deixam 13 unidades de patamar: quadrado, como no mapa, e mais que o triplo do vão. */
const ART_TREAD_COUNT = 7

/** Degraus de "Sobe", do pé para o topo: o primeiro a um vão da borda esquerda da placa. */
const ART_TREADS_UP = Array.from({ length: ART_TREAD_COUNT }, (_, i) => ART_PLATE.x + (i + 1) * ART_TREAD_PITCH)

/**
 * Miniatura do lance como o mapa desenha (`pixi/stairFlight.ts`): placa de
 * moldura fina, muitos degraus finos de trilho a trilho e o patamar quadrado
 * marcando o topo. No mapa o patamar é chapado; aqui é o trecho da placa sem
 * degrau, porque a miniatura segue a família de contorno de `icons.tsx` (cor
 * do texto, traço de 1,6 no viewBox de altura 24 desenhado a 18 px = 1,2 px, o
 * mesmo da barra). "Sobe" põe o patamar na ponta do arrasto (direita), "Desce"
 * no começo (esquerda): o mesmo desenho espelhado, que é o que o mestre precisa
 * reconhecer no mapa sem abrir painel nenhum.
 *
 * Longa e cheia de degraus de propósito: numa placa curta com três ou quatro
 * barras e um vão vazio na ponta, o olho lê bateria, não escada. Esquemática
 * também de propósito: sempre deitada, enquanto o lance no mapa segue o arrasto
 * (vertical, diagonal). O que ela ensina é a leitura — o patamar é o alto —,
 * não a orientação daquela escada. Os degraus ficam com passo igual porque o
 * aperto de perspectiva do mapa (`STAIR_PERSPECTIVE_RATIO`) poria o vão do pé
 * abaixo dos 3 px, e o patamar já diz sozinho onde é o topo. Mesmo padrão de
 * `GridShapePicker`: o controle mostra o que controla.
 */
function StairDirectionArt({ direction }: { direction: StairDirection }) {
  const treads = direction === 'up' ? ART_TREADS_UP : ART_TREADS_UP.map((x) => ART_VIEWBOX_WIDTH - x)
  const railTop = ART_PLATE.y
  const railBottom = ART_PLATE.y + ART_PLATE.height
  return (
    <svg
      width="36"
      height="18"
      viewBox={`0 0 ${ART_VIEWBOX_WIDTH} 24`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x={ART_PLATE.x} y={railTop} width={ART_PLATE.width} height={ART_PLATE.height} rx="1" />
      <path d={treads.map((x) => `M${x} ${railTop}V${railBottom}`).join('')} />
    </svg>
  )
}

/**
 * "Leva a…" da escada. Escolher o andar LIGA na hora: nasce lá a escada par
 * ("Desce" para quem sobe), e nenhum pino aparece em nenhuma das duas cenas.
 * O modo vem antes de ligar — a escada já nasce livre, se o mestre quiser —
 * e, ligada, troca direto no pino dela, com desfazer.
 */
function StairTravelSection({
  scenes,
  linkedSceneId,
  passage,
  onLink,
  onUnlink,
  onPassageChange,
  onCreateFloor,
  direction,
}: StairTravelProps & { direction: StairDirection }) {
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
              {scene.available ? travelSceneLabel(scene) : `${travelSceneLabel(scene)} (não abriu)`}
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
      {/* Sem ligação ainda: o andar que falta nasce daqui, já ligado, com o
          modo escolhido acima. Escada que sobe cria o de cima; que desce, o de baixo. */}
      {!linked && (
        <div className="lb-field">
          <button type="button" className="lb-btn lb-btn--block" onClick={() => onCreateFloor(currentPassage)}>
            Criar andar de {floorSideOf(direction)}
          </button>
          <p className="lb-field__hint">Copia a parede externa do prédio e põe a escada par no mesmo ponto.</p>
        </div>
      )}
    </>
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
export function StairControls({ direction, onDirectionChange, shape, onShapeChange, stepWidth, onStepWidthChange, grid, travel, tamanho }: StairControlsProps) {
  const activePreset = stairSizePresetForStepWidth(stepWidth, grid)

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Escada</h2>
      {/* Segmento Sobe | Desce (auditoria 14/09): o toggle "Sobe (desmarcado =
          desce)" pedia para ler a regra antes de clicar. A miniatura é a placa
          que vai para o mapa, com o patamar no topo (28/09; antes era um galão
          que se lia como seta): a escolha e o resultado na mesma tela. */}
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
        <span className="lb-label">Forma</span>
        <div className="lb-seg" role="radiogroup" aria-label="Forma da escada">
          {SHAPE_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={shape === option}
              className="lb-seg__option"
              onClick={() => onShapeChange(option)}
            >
              {SHAPE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      {/* A espiral tem o tamanho do círculo (o arrasto é o diâmetro): a largura
          do lance não muda nada nela, então o controle sai em vez de mentir. */}
      {shape !== 'spiral' && (
        <>
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

          {/* Comprimento, largura e curva (pedido de 10/10/2026): os mesmos
              números que as alças do mapa mudam, em casas. A largura era em
              px; em casas ela fala a língua do mapa e dos presets acima. */}
          {tamanho !== undefined && (
            <CampoEmCasas
              id="lb-stair-length"
              rotulo="Comprimento"
              nome="o comprimento"
              px={tamanho.length}
              grid={grid}
              maxCasas={STAIR_MAX_LENGTH_CELLS}
              onTrocar={tamanho.onLengthChange}
            />
          )}
          <CampoEmCasas
            id="lb-stair-step-width"
            rotulo="Largura"
            nome="a largura"
            px={stepWidth}
            grid={grid}
            maxCasas={STAIR_MAX_WIDTH_CELLS}
            onTrocar={onStepWidthChange}
          />
          {tamanho?.curve != null && (
            <CampoDeCurva degrees={tamanho.curve.degrees} maxDegrees={tamanho.curve.maxDegrees} onCurveChange={tamanho.onCurveChange} />
          )}
        </>
      )}

      {/* Espiral: o arrasto é o diâmetro do círculo, e é ele que dá o tamanho. */}
      {shape === 'spiral' && tamanho !== undefined && (
        <CampoEmCasas
          id="lb-stair-length"
          rotulo="Diâmetro"
          nome="o diâmetro"
          px={tamanho.length}
          grid={grid}
          maxCasas={STAIR_MAX_LENGTH_CELLS}
          onTrocar={tamanho.onLengthChange}
        />
      )}

      {travel !== null && <StairTravelSection {...travel} direction={direction} />}
    </section>
  )
}
