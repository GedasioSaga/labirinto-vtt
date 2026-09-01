import type { Stair, StairDirection, StairSegment, StairShape } from '../types/map'
import type { Point } from '../pixi/world'

/** Mesmo critério de isValidWallDraft (drawingFactory.ts) — arrasto de
 *  comprimento zero (clique sem mover) não vira lance de escada. */
export function isValidStairDraft(start: Point, end: Point): boolean {
  return start.x !== end.x || start.y !== end.y
}

/**
 * Escada de 1 lance. `shape` default 'straight' — a ferramenta de criação
 * (PixiCanvas, arrasto de 2 pontos) só chama este builder sem o argumento,
 * então o comportamento de hoje não muda; 'l'/'double' já existem no
 * schema/render (types/map.ts, StairShape) e este builder já aceita
 * construí-los se algum chamador futuro tiver os `segments` prontos — falta
 * só a ferramenta de 3 cliques que monta esses segments a partir do gesto do
 * usuário (fora do escopo desta tarefa, ver CONTRATO). `stepWidth` é
 * responsabilidade do chamador: o schema documenta "default na criação =
 * map.grid" (types/map.ts), então quem constrói o draft (PixiCanvas) passa
 * `map.grid`, não um literal aqui. `direction` default 'up': usuário troca
 * depois via StairControls (setStairDirection, com histórico) sem precisar
 * escolher no momento do arrasto — mesma filosofia de wallKind/polygonSides,
 * só que a troca acontece na entidade já criada em vez de numa preferência
 * "próxima escada".
 */
export function buildStairFromDraft(
  id: string,
  start: Point,
  end: Point,
  stepWidth: number,
  direction: StairDirection = 'up',
  shape: StairShape = 'straight',
): Stair {
  return {
    id,
    shape,
    direction,
    segments: [{ x1: start.x, y1: start.y, x2: end.x, y2: end.y }],
    stepWidth,
  }
}

/** Tamanho nomeado do lance — eixo diferente de `StairShape` (forma). Só os
 *  3 valores que o usuário pediu por nome (ROADMAP.md N1: "pequena média ou
 *  grande"), nunca um 4º inventado. */
export type StairSizePreset = 'small' | 'medium' | 'large'

/**
 * `stepWidth` de cada preset, como múltiplo de `map.grid` — não um px fixo,
 * porque `stepWidth` já é sempre relativo à grade do mapa (o próprio schema
 * documenta "default na criação = map.grid", ou seja, hoje toda escada nasce
 * exatamente na proporção que aqui vira "média"). Critério dos outros dois:
 * 'small' = metade de uma célula (passagem justa, mal cabe 1 token de grid
 * padrão lado a lado); 'large' = duas células (larga o bastante pra 2 tokens
 * lado a lado com folga). 1 é o único valor que precisa bater com o default
 * de criação existente — os outros dois são critério novo desta tarefa.
 */
export const STAIR_SIZE_PRESET_RATIO: Record<StairSizePreset, number> = {
  small: 0.5,
  medium: 1,
  large: 2,
}

/** `stepWidth` (px de mundo) de um preset, para o `grid` do mapa atual. */
export function stairStepWidthForPreset(preset: StairSizePreset, grid: number): number {
  return STAIR_SIZE_PRESET_RATIO[preset] * grid
}

/**
 * Preset cujo `stepWidth` bate exatamente com o valor atual — só para
 * destacar o botão ativo (`aria-checked`) no controle de presets; nunca usado
 * para decidir o que gravar (o campo numérico fino sempre grava o valor
 * exato digitado, sem arredondar para o preset mais próximo). `undefined`
 * quando o valor atual não bate com nenhum preset (usuário usou o campo
 * fino, ou a escada foi criada/editada com outro valor) — nenhum botão fica
 * marcado, que é o estado correto: nenhum dos três É o valor atual.
 */
export function stairSizePresetForStepWidth(stepWidth: number, grid: number): StairSizePreset | undefined {
  const entries = Object.entries(STAIR_SIZE_PRESET_RATIO) as Array<[StairSizePreset, number]>
  const match = entries.find(([, ratio]) => stepWidth === ratio * grid)
  return match?.[0]
}

/** Espaçamento (px de mundo) entre degraus ao longo do lance — puramente
 *  visual, não afeta jogo/colisão (escada não bloqueia nem restringe hoje,
 *  mesmo padrão de Prop). 16px dá 4 degraus por célula de grid default (64px),
 *  densidade legível sem virar rabisco em lance curto. */
export const STAIR_STEP_SPACING = 16

export interface StairStepLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Gera as linhas perpendiculares dos degraus de um StairSegment — geometria
 * pura, sem nada de Pixi, pra drawStairs.ts (render) e drawDraft.ts (preview
 * do arrasto) reusarem a mesma fonte de verdade. Um degrau em cada ponta do
 * lance (t=0 e t=1) mais um a cada STAIR_STEP_SPACING entre elas, sempre
 * espaçados igualmente (divide o comprimento pelo nº de passos, não corta em
 * pedaços de tamanho fixo com sobra no fim). Segmento de comprimento zero
 * devolve lista vazia — não há lance pra desenhar degrau nenhum.
 */
export function computeStairSteps(segment: StairSegment, stepWidth: number): StairStepLine[] {
  const dx = segment.x2 - segment.x1
  const dy = segment.y2 - segment.y1
  const length = Math.hypot(dx, dy)
  if (length === 0) return []

  const ux = dx / length
  const uy = dy / length
  // perpendicular unitário (rotação de 90° do vetor de avanço)
  const px = -uy
  const py = ux
  const halfWidth = stepWidth / 2

  const stepCount = Math.max(1, Math.round(length / STAIR_STEP_SPACING))
  const steps: StairStepLine[] = []
  for (let i = 0; i <= stepCount; i += 1) {
    const t = i / stepCount
    const cx = segment.x1 + ux * length * t
    const cy = segment.y1 + uy * length * t
    steps.push({
      x1: cx + px * halfWidth,
      y1: cy + py * halfWidth,
      x2: cx - px * halfWidth,
      y2: cy - py * halfWidth,
    })
  }
  return steps
}

const STAIR_ARROW_SIZE = 10 // px de mundo — comprimento das hastes traseiras da seta
const STAIR_ARROW_SPREAD = Math.PI / 7 // ângulo de abertura entre as duas hastes

export interface StairArrow {
  tip: Point
  back1: Point
  back2: Point
}

/**
 * Triângulo (seta) indicando o sentido de subida do lance — geometria pura,
 * 3 pontos em espaço de mundo prontos pro `Graphics.poly` de drawStairs.ts.
 * 'up': a ponta fica no fim do segmento (x2,y2), apontando no sentido de
 * avanço do traço — "sobe pra lá". 'down': a ponta fica no início (x1,y1),
 * apontando no sentido CONTRÁRIO ao traço — "desce pra cá", entrando na
 * escada a partir de quem está no nível de cima olhando pra baixo.
 * Segmento de comprimento zero degenera (ponta e hastes coincidem no mesmo
 * ponto) — sem caso especial: length=0 não quebra a trigonometria, só produz
 * um triângulo de área zero, invisível, o que é o comportamento correto pra
 * um lance ainda sem arrasto.
 */
export function computeStairArrow(segment: StairSegment, direction: StairDirection): StairArrow {
  const dx = segment.x2 - segment.x1
  const dy = segment.y2 - segment.y1
  const forwardAngle = Math.atan2(dy, dx)
  const angle = direction === 'up' ? forwardAngle : forwardAngle + Math.PI
  const tip = direction === 'up' ? { x: segment.x2, y: segment.y2 } : { x: segment.x1, y: segment.y1 }
  const back1: Point = {
    x: tip.x - STAIR_ARROW_SIZE * Math.cos(angle - STAIR_ARROW_SPREAD),
    y: tip.y - STAIR_ARROW_SIZE * Math.sin(angle - STAIR_ARROW_SPREAD),
  }
  const back2: Point = {
    x: tip.x - STAIR_ARROW_SIZE * Math.cos(angle + STAIR_ARROW_SPREAD),
    y: tip.y - STAIR_ARROW_SIZE * Math.sin(angle + STAIR_ARROW_SPREAD),
  }
  return { tip, back1, back2 }
}
