/**
 * GUIAS INTELIGENTES (pedido 3 de 30/09/2026: "as features de medição do Figma
 * e do Excalidraw ... muita coisa parece está desalinhada"). A peça que anda
 * encaixa pela BORDA ou pelo CENTRO da caixa das vizinhas, e uma guia magenta
 * fina liga as peças alinhadas. Módulo PURO: sem Pixi, sem store, sem teclado.
 * Quem monta as caixas é `lib/guideBoxes.ts`; quem desenha,
 * `pixi/drawSmartGuides.ts`.
 *
 * Por que a CAIXA e não um ponto: o alinhamento antigo
 * (`lib/alignmentGuides.ts`) alinhava só `region.points[0]`, e uma sala
 * redonda (polígono de muitos lados) nunca encaixava pelo centro — é o
 * desalinhamento da imagem do pedido. Por eixo há 3 âncoras (mínimo, centro,
 * máximo), e os dois eixos se resolvem separados.
 *
 * Decisões que valem para todo gesto com guia (a fatia 1 usa no arrasto de
 * sala; a fatia 2, em todo arrasto de corpo — parede, escada, desenho,
 * objeto, chão, seleção de vários — e de ponto — ponta, vértice, ficha):
 *
 *  (a) Candidata nunca é o que anda nem o que está selecionado
 *      (`guideBoxesForDrag`). Com o delta total do gesto, a caixa de partida
 *      da própria peça grudaria a peça na posição antiga.
 *  (b) A tecla que solta a guia é o Ctrl, em TODO gesto. Arrastando, o Ctrl
 *      já era "mover livre". Desenhando parede ou linha, o Ctrl trava o
 *      ângulo, e com a trava a guia também não encaixa: a trava é o encaixe
 *      daquele gesto, e dois encaixes disputando a mesma ponta fazem a ponta
 *      pular de um para o outro. Desenhando sala ou forma, o Ctrl não faz
 *      outra coisa, então só solta a guia. O Alt nunca solta a guia: ele é da
 *      grade e de duplicar (decisão c). Para deixar uma peça a poucos px de
 *      outra sem grudar, aproxime o zoom: a tolerância é em px de tela, e no
 *      mundo ela encolhe.
 *  (c) Grade ligada na configuração e sem Alt: a grade manda, e a guia só
 *      aparece quando o alinhamento já é exato, sem mover a peça. Com o Alt no
 *      gesto, invertendo a grade para um lado ou para o outro (inclusive o
 *      Alt+arrastar que duplica), a guia encaixa por cima da grade.
 *  (d) O Alt SEGURADO para medir é de outra fatia e usa a classificação de
 *      `lib/toqueDeAlt.ts`: toque curto endireita, segurar além da janela
 *      mede, e clique ou arrasto no meio cancelam os dois. Nada aqui lê o Alt
 *      do teclado; o arrasto só lê o `altKey` do próprio evento de ponteiro.
 */
import type { AreaBounds } from './areaSelection'
import type { Point } from './selectionHitTest'

/** Tolerância do encaixe, em px de TELA: a mesma sensação em qualquer zoom. */
export const SMART_GUIDE_SCREEN_PX = 6

/**
 * "Alinhamento exato" quando a grade manda (decisão c), em px de MUNDO. Cobre
 * só o erro de ponto flutuante e a caixa da sala redonda, que não cai inteira
 * na grade. Não é encaixe: a peça não se move por ela.
 */
export const EXACT_ALIGNMENT_WORLD_PX = 0.5

/** Abaixo disto (px de mundo) duas âncoras contam como a mesma posição. */
const SAME_POSITION_EPSILON = 1e-6

/** Índice da âncora do meio em `anchorsOf` (0 = mínimo, 2 = máximo). */
const CENTER_ANCHOR = 1

/**
 * `screenPx` de tela em px de mundo. Escala que não serve (zero, negativa,
 * NaN, infinita) conta como 1: a tolerância nunca vira Infinity, que faria
 * tudo grudar, nem NaN, que desligaria o encaixe sem aviso.
 */
export function screenPxToWorld(screenPx: number, cameraScale: number): number {
  const scale = Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1
  return screenPx / scale
}

export type GuideAxis = 'x' | 'y'

/**
 * Guia de um eixo. `axis: 'x'` é a linha VERTICAL em x = `position` (alinhou
 * no eixo x); `'y'`, a horizontal em y = `position`. O segmento vai de `from`
 * a `to` no outro eixo, só entre as peças alinhadas (não atravessa a tela), e
 * `marks` são os pontos onde cada peça encosta na linha, o meio da borda ou o
 * centro, onde se desenha o "x" como no Figma. A linha da borda passa pelo
 * meio dela, e não pelos cantos da caixa: numa sala redonda o canto da caixa
 * cai no vazio, e o meio da borda é o ponto da própria sala.
 */
export interface SmartGuide {
  axis: GuideAxis
  position: number
  from: number
  to: number
  marks: number[]
}

/** Ajuste que leva a caixa ao encaixe, e as guias já na posição encaixada. */
export interface BoxSnap {
  dx: number
  dy: number
  guides: SmartGuide[]
}

type Anchors = readonly [number, number, number]

function anchorsOf(box: AreaBounds, axis: GuideAxis): Anchors {
  return axis === 'x' ? [box.minX, (box.minX + box.maxX) / 2, box.maxX] : [box.minY, (box.minY + box.maxY) / 2, box.maxY]
}

/** Centro da caixa no OUTRO eixo: o ponto onde ela encosta numa guia deste eixo. */
function crossCenter(box: AreaBounds, axis: GuideAxis): number {
  return axis === 'x' ? (box.minY + box.maxY) / 2 : (box.minX + box.maxX) / 2
}

function squaredCenterDistance(a: AreaBounds, b: AreaBounds): number {
  const dx = (a.minX + a.maxX - b.minX - b.maxX) / 2
  const dy = (a.minY + a.maxY - b.minY - b.maxY) / 2
  return dx * dx + dy * dy
}

function translate(box: AreaBounds, dx: number, dy: number): AreaBounds {
  return { minX: box.minX + dx, minY: box.minY + dy, maxX: box.maxX + dx, maxY: box.maxY + dy }
}

interface AxisCandidate {
  delta: number
  size: number
  edgeToEdge: boolean
  distance: number
}

/**
 * Ordem de preferência: o menor ajuste; no empate, borda com borda antes de
 * qualquer par com centro (é o encaixe que fecha parede com parede); no
 * empate de novo, a caixa mais perto, que é a que o mestre está olhando.
 */
function beats(candidate: AxisCandidate, best: AxisCandidate | null): boolean {
  if (best === null) return true
  if (candidate.size < best.size - SAME_POSITION_EPSILON) return true
  if (candidate.size > best.size + SAME_POSITION_EPSILON) return false
  if (candidate.edgeToEdge !== best.edgeToEdge) return candidate.edgeToEdge
  return candidate.distance < best.distance
}

/** Ajuste do eixo que encaixa a âncora mais perto, ou `null` se nenhuma cai na tolerância. */
function axisDelta(moving: AreaBounds, others: readonly AreaBounds[], axis: GuideAxis, tolerance: number): number | null {
  const mine = anchorsOf(moving, axis)
  let best: AxisCandidate | null = null
  for (const other of others) {
    const theirs = anchorsOf(other, axis)
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        const delta = theirs[j] - mine[i]
        const size = Math.abs(delta)
        // `!(<=)` e não `>`: tolerância NaN não encaixa nada.
        if (!(size <= tolerance)) continue
        const candidate = { delta, size, edgeToEdge: i !== CENTER_ANCHOR && j !== CENTER_ANCHOR, distance: squaredCenterDistance(moving, other) }
        if (beats(candidate, best)) best = candidate
      }
    }
  }
  return best === null ? null : best.delta
}

interface GuideGroup {
  position: number
  marks: number[]
}

function sortedDistinct(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.filter((value, index) => index === 0 || value - sorted[index - 1] > SAME_POSITION_EPSILON)
}

/**
 * Todas as caixas alinhadas com a caixa JÁ encaixada, numa guia por posição:
 * várias vizinhas na mesma altura dividem uma linha só, com uma marca para
 * cada uma, como no Figma.
 */
function axisGuides(moving: AreaBounds, others: readonly AreaBounds[], axis: GuideAxis): SmartGuide[] {
  const mine = anchorsOf(moving, axis)
  const groups: GuideGroup[] = []
  for (const other of others) {
    const theirs = anchorsOf(other, axis)
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        if (Math.abs(theirs[j] - mine[i]) > SAME_POSITION_EPSILON) continue
        const position = theirs[j]
        const group = groups.find((g) => Math.abs(g.position - position) <= SAME_POSITION_EPSILON)
        if (group) group.marks.push(crossCenter(other, axis))
        else groups.push({ position, marks: [crossCenter(moving, axis), crossCenter(other, axis)] })
      }
    }
  }
  return groups
    .sort((a, b) => a.position - b.position)
    .map(({ position, marks }) => {
      const distinct = sortedDistinct(marks)
      return { axis, position, from: distinct[0], to: distinct[distinct.length - 1], marks: distinct }
    })
}

/**
 * Encaixa `moving` nas âncoras de `others` que estão a até `tolerance` (px de
 * mundo), eixo a eixo. `dx`/`dy` são o AJUSTE a somar na caixa; as guias já
 * descrevem a posição encaixada.
 */
export function snapBox(moving: AreaBounds, others: readonly AreaBounds[], tolerance: number): BoxSnap {
  const dx = axisDelta(moving, others, 'x', tolerance)
  const dy = axisDelta(moving, others, 'y', tolerance)
  if (dx === null && dy === null) return { dx: 0, dy: 0, guides: [] }
  const snapped = translate(moving, dx ?? 0, dy ?? 0)
  return {
    dx: dx ?? 0,
    dy: dy ?? 0,
    guides: [...(dx === null ? [] : axisGuides(snapped, others, 'x')), ...(dy === null ? [] : axisGuides(snapped, others, 'y'))],
  }
}

/**
 * As mesmas guias, na mesma ordem? Quem desenha usa isto para não refazer o
 * Graphics à toa: enquanto a peça fica presa no encaixe, dezenas de
 * pointermove dão a mesma guia, e cada redesenho no grupo de render do mapa
 * refaz os lotes do mapa inteiro (ver o `hoverGraphics` em PixiCanvas.tsx).
 */
export function sameGuides(a: readonly SmartGuide[], b: readonly SmartGuide[]): boolean {
  if (a.length !== b.length) return false
  return a.every((guide, index) => {
    const other = b[index]
    return (
      guide.axis === other.axis &&
      guide.position === other.position &&
      guide.from === other.from &&
      guide.to === other.to &&
      guide.marks.length === other.marks.length &&
      guide.marks.every((mark, i) => mark === other.marks[i])
    )
  })
}

/**
 * Quem manda no gesto:
 *  - 'free': Ctrl, sem guia nenhuma (decisão b);
 *  - 'gridExact': a grade da configuração, sem Alt; guia só no exato (decisão c);
 *  - 'snap': a guia encaixa (sem grade, ou com o Alt no gesto).
 */
export type GuideMode = 'free' | 'snap' | 'gridExact'

export interface GuideModifiers {
  /** Ctrl ou Cmd segurado (`isFreeMoveModifier`). */
  free: boolean
  /** Alt segurado NESTE evento: ele inverte a grade do gesto. */
  altKey: boolean
  /** A grade do alvo está ligada na configuração (`snapTargets`), antes do Alt. */
  gridBySetting: boolean
}

export function guideModeForDrag({ free, altKey, gridBySetting }: GuideModifiers): GuideMode {
  if (free) return 'free'
  if (gridBySetting && !altKey) return 'gridExact'
  return 'snap'
}

export interface BoxDragInput {
  /** Caixa da peça no pointerdown. */
  startBounds: AreaBounds
  /**
   * Dois pontos cujo delta é o deslocamento do gesto: o ponteiro do
   * pointerdown e o de agora, com a grade do gesto aplicada aos DOIS; ou, no
   * objeto, o centro de partida e o destino dele já na grade.
   */
  startPointer: Point
  pointer: Point
  others: readonly AreaBounds[]
  /** Tolerância do encaixe em px de mundo (`screenPxToWorld`). */
  tolerance: number
  mode: GuideMode
}

/** Deslocamento TOTAL da peça desde o pointerdown (não o passo deste evento). */
export interface BoxDrag {
  offsetX: number
  offsetY: number
  guides: SmartGuide[]
}

/**
 * A posição tentativa sai do delta TOTAL do gesto (ponteiro de agora menos o
 * do pointerdown), nunca do passo incremental. Com o passo, o encaixe comia
 * cada pequeno movimento do cursor: a peça grudava e o cursor ia se afastando
 * dela, a guia "grudenta" clássica. Com o total, a peça solta assim que o
 * cursor passa da tolerância.
 */
export function dragBoxWithGuides(input: BoxDragInput): BoxDrag {
  const offsetX = input.pointer.x - input.startPointer.x
  const offsetY = input.pointer.y - input.startPointer.y
  if (input.mode === 'free') return { offsetX, offsetY, guides: [] }
  const tentative = translate(input.startBounds, offsetX, offsetY)
  if (input.mode === 'gridExact') {
    return { offsetX, offsetY, guides: snapBox(tentative, input.others, EXACT_ALIGNMENT_WORLD_PX).guides }
  }
  const snap = snapBox(tentative, input.others, input.tolerance)
  return { offsetX: offsetX + snap.dx, offsetY: offsetY + snap.dy, guides: snap.guides }
}

/**
 * O ponto como caixa sem tamanho: as três âncoras dele coincidem, e ponto e
 * caixa encaixam pelas mesmas regras (`snapBox`). É assim que a ponta de uma
 * parede vira candidata, e que a ponta arrastada encaixa na caixa da sala.
 */
export function pointBox(point: Point): AreaBounds {
  return { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y }
}

export interface PointDragInput {
  /** Onde o ponto iria sem guia: o ponteiro, já com a grade do gesto. */
  point: Point
  /** Caixas das peças e pontos soltos (`pointBox`). */
  others: readonly AreaBounds[]
  /** Tolerância do encaixe em px de mundo (`screenPxToWorld`). */
  tolerance: number
  mode: GuideMode
}

export interface PointDrag {
  point: Point
  guides: SmartGuide[]
}

/**
 * Arrasto de PONTO (fatia 2): a ponta da parede ou da linha, o vértice da
 * sala, o centro da ficha. Encaixa na borda e no centro das caixas vizinhas e
 * nos pontos soltos, eixo a eixo, e a guia vai do ponto até a peça alinhada,
 * com a mesma escolha do arrasto de caixa. O ponto é o do ponteiro, e não um
 * deslocamento: não há deriva a evitar aqui.
 */
export function dragPointWithGuides(input: PointDragInput): PointDrag {
  const point = { x: input.point.x, y: input.point.y }
  if (input.mode === 'free') return { point, guides: [] }
  if (input.mode === 'gridExact') return { point, guides: snapBox(pointBox(point), input.others, EXACT_ALIGNMENT_WORLD_PX).guides }
  const snap = snapBox(pointBox(point), input.others, input.tolerance)
  return { point: { x: point.x + snap.dx, y: point.y + snap.dy }, guides: snap.guides }
}
