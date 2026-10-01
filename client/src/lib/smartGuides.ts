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
 * objeto, chão, seleção de vários — e de ponto — ponta, vértice, ficha; a
 * fatia 4, ao DESENHAR):
 *
 *  (a) Candidata nunca é o que anda nem o que está selecionado
 *      (`guideBoxesForDrag`). Com o delta total do gesto, a caixa de partida
 *      da própria peça grudaria a peça na posição antiga. Ao desenhar nada
 *      anda, e por isso nada fica de fora: a sala recém-desenhada nasce
 *      selecionada e é justamente a vizinha com que a próxima alinha.
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
 *  (d) O Alt SEGURADO para medir é da fatia 5 (`lib/altMeasure.ts`) e usa a
 *      classificação de `lib/toqueDeAlt.ts`: toque curto endireita, segurar
 *      além da janela mede, e clique ou arrasto no meio cancelam os dois. Nada
 *      aqui lê o Alt do teclado; o arrasto só lê o `altKey` do próprio evento
 *      de ponteiro.
 *
 * Fatia 3, só no arrasto de CORPO (`SnapOptions.gaps`): ESPAÇAMENTO IGUAL —
 * a peça também encaixa onde os vãos da fileira ficam iguais — e a MEDIDA
 * dos vãos (`GapMark`), que o canvas escreve em unidade do mapa. A medida só
 * aparece com encaixe ativo: o valor de cada vão igual e, com a guia de um
 * eixo, o vão no outro eixo até a peça alinhada mais perto. Medida
 * permanente para toda vizinha vira poluição; ela só aparece quando
 * significa alguma coisa, como no Excalidraw. Por eixo vence o menor ajuste,
 * e no empate o alinhamento vence o espaçamento. A fileira de um eixo depende
 * da posição no outro, então o espaçamento só move a peça se, onde ela para,
 * os vãos iguais aparecem (`snapBox`). O arrasto de ponto não tem nada disso:
 * um ponto no meio de duas salas não é fileira.
 *
 * Fatia 4, ao DESENHAR (o canvas compõe com `dragPointWithGuides`): o ponto
 * de partida encaixa no pointerdown e o ponto puxado a cada pointermove, como
 * pontos, nas mesmas candidatas e com a mesma regra de grade e de Ctrl. Na
 * Parede, na Linha e na Escada o ímã de vértice vem antes de tudo, e a trava
 * de ângulo do Ctrl dispensa a guia (decisão b). No traço e na forma de raio
 * (Círculo, Sala circular, Polígono regular) o próprio ponto de partida é
 * candidato do puxado: a ponta a poucos px da reta do começo deixa o traço
 * deitado ou em pé — o corredor torto da imagem do pedido. Na forma de canto
 * (Sala, Retângulo, Elipse) não: o canto oposto alinhado com o primeiro daria
 * largura zero. O Shift (quadrado, círculo) vem DEPOIS da guia e pode tirar o
 * canto dela; aí só aparece a guia do alinhamento que ficou exato.
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

/**
 * Vão MEDIDO entre duas peças (fatia 3): o segmento de `from` a `to` no eixo
 * `axis`, na altura `at` do outro eixo. `axis: 'x'` é o vão na horizontal
 * (segmento deitado em y = `at`); `'y'`, na vertical (em pé em x = `at`).
 * Mesma convenção da guia: o eixo é o do encaixe que o produziu.
 */
export interface GapMark {
  axis: GuideAxis
  from: number
  to: number
  at: number
}

/** O que o arrasto desenha por cima do mapa: as guias de alinhamento e os vãos medidos. */
export interface GuideOverlay {
  guides: SmartGuide[]
  gaps: GapMark[]
}

/** Ajuste que leva a caixa ao encaixe, e as guias e os vãos já na posição encaixada. */
export interface BoxSnap extends GuideOverlay {
  dx: number
  dy: number
}

export interface SnapOptions {
  /** Espaçamento igual e a medida dos vãos (fatia 3): só no arrasto de corpo. */
  gaps: boolean
}

const ALIGNMENT_ONLY: SnapOptions = { gaps: false }
const BODY_SNAP: SnapOptions = { gaps: true }

/**
 * Teto de vãos iguais seguidos que a fileira mostra para cada lado da peça.
 * Uma fileira de 1000 ladrilhos iguais faria o passo andar a fileira inteira a
 * cada pointermove; o canvas também não escreve mais que 8 números.
 */
const MAX_EQUAL_GAPS_PER_SIDE = 8

type Anchors = readonly [number, number, number]

function anchorsOf(box: AreaBounds, axis: GuideAxis): Anchors {
  return axis === 'x' ? [box.minX, (box.minX + box.maxX) / 2, box.maxX] : [box.minY, (box.minY + box.maxY) / 2, box.maxY]
}

/** O outro eixo. Exportado com `low` e `high` para a medida do Alt (`lib/altMeasure.ts`) falar a mesma língua das guias. */
export function crossAxis(axis: GuideAxis): GuideAxis {
  return axis === 'x' ? 'y' : 'x'
}

/** A borda de baixo da caixa no eixo: a esquerda em x, a de cima em y. */
export function low(box: AreaBounds, axis: GuideAxis): number {
  return axis === 'x' ? box.minX : box.minY
}

/** A borda de cima da caixa no eixo: a direita em x, a de baixo em y. */
export function high(box: AreaBounds, axis: GuideAxis): number {
  return axis === 'x' ? box.maxX : box.maxY
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

/**
 * Quantas vizinhas alinhadas cada guia liga, as mais perto da peça ao longo da
 * linha. Num mapa denso (salas em grade, todas alinhadas por acaso) a guia
 * ligava a coluna inteira e atravessava a tela com um "x" em cada sala
 * (conferência guias-4e5, print 22); com as 2 mais perto ela continua dizendo
 * "alinhou aqui" e fica no pedaço do mapa que o mestre está olhando — o ajuste
 * que o risco do plano guias-figma já previa.
 */
const MAX_ALIGNED_PER_GUIDE = 2

interface GuideGroup {
  position: number
  /** Onde cada vizinha alinhada encosta (uma vizinha pode repetir: o ponto alinha pelas 3 âncoras). */
  others: number[]
}

function sortedDistinct(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.filter((value, index) => index === 0 || value - sorted[index - 1] > SAME_POSITION_EPSILON)
}

/** As `MAX_ALIGNED_PER_GUIDE` marcas de vizinha mais perto de `own`, sem repetir a mesma vizinha. */
function nearestMarks(own: number, others: number[]): number[] {
  return sortedDistinct(others)
    .sort((a, b) => Math.abs(a - own) - Math.abs(b - own))
    .slice(0, MAX_ALIGNED_PER_GUIDE)
}

/**
 * As caixas alinhadas com a caixa JÁ encaixada, numa guia por posição:
 * várias vizinhas na mesma altura dividem uma linha só, com uma marca para
 * cada uma, como no Figma — até as `MAX_ALIGNED_PER_GUIDE` mais perto.
 */
function axisGuides(moving: AreaBounds, others: readonly AreaBounds[], axis: GuideAxis): SmartGuide[] {
  const mine = anchorsOf(moving, axis)
  // Onde a peça que anda encosta na linha: o mesmo ponto em toda guia do eixo.
  const own = crossCenter(moving, axis)
  const groups: GuideGroup[] = []
  for (const other of others) {
    const theirs = anchorsOf(other, axis)
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        if (Math.abs(theirs[j] - mine[i]) > SAME_POSITION_EPSILON) continue
        const position = theirs[j]
        const group = groups.find((g) => Math.abs(g.position - position) <= SAME_POSITION_EPSILON)
        if (group) group.others.push(crossCenter(other, axis))
        else groups.push({ position, others: [crossCenter(other, axis)] })
      }
    }
  }
  return groups
    .sort((a, b) => a.position - b.position)
    .map(({ position, others: otherMarks }) => {
      const distinct = sortedDistinct([own, ...nearestMarks(own, otherMarks)])
      return { axis, position, from: distinct[0], to: distinct[distinct.length - 1], marks: distinct }
    })
}

/** A caixa não tem espessura no eixo: parede solta e linha retas, deitadas ou em pé. */
function isFlat(box: AreaBounds, axis: GuideAxis): boolean {
  return high(box, axis) - low(box, axis) <= SAME_POSITION_EPSILON
}

/**
 * As duas caixas se sobrepõem no OUTRO eixo, e por isso estão na mesma
 * fileira (eixo x) ou coluna (eixo y)? Só encostar não conta: duas salas
 * empilhadas, uma tocando a outra, não são fileira.
 *
 * Duas retas sem espessura nesse eixo, na mesma coordenada, são da mesma
 * fileira: são pedaços da mesma reta, a parede cortada pelas portas. A
 * sobreposição estrita nunca as juntaria, porque nenhuma tem interior.
 */
function sameRow(a: AreaBounds, b: AreaBounds, axis: GuideAxis): boolean {
  const cross = crossAxis(axis)
  if (isFlat(a, cross) && isFlat(b, cross)) return Math.abs(low(a, cross) - low(b, cross)) <= SAME_POSITION_EPSILON
  return low(a, cross) < high(b, cross) - SAME_POSITION_EPSILON && low(b, cross) < high(a, cross) - SAME_POSITION_EPSILON
}

/**
 * A vizinha logo ANTES de `of` no eixo, entre as caixas da fileira: a que
 * termina mais tarde entre as que terminam antes de `of` começar, e que divide
 * fileira com `of`. Caixa que cruza `of` no eixo (a sala que contém o objeto
 * arrastado, por exemplo) não fica antes nem depois.
 */
function neighborBefore(of: AreaBounds, row: readonly AreaBounds[], axis: GuideAxis): AreaBounds | null {
  let best: AreaBounds | null = null
  for (const box of row) {
    if (box === of || high(box, axis) > low(of, axis) + SAME_POSITION_EPSILON || !sameRow(box, of, axis)) continue
    if (best === null || high(box, axis) > high(best, axis)) best = box
  }
  return best
}

/** O espelho de `neighborBefore`: a vizinha logo DEPOIS de `of`. */
function neighborAfter(of: AreaBounds, row: readonly AreaBounds[], axis: GuideAxis): AreaBounds | null {
  let best: AreaBounds | null = null
  for (const box of row) {
    if (box === of || low(box, axis) < high(of, axis) - SAME_POSITION_EPSILON || !sameRow(box, of, axis)) continue
    if (best === null || low(box, axis) < low(best, axis)) best = box
  }
  return best
}

function rowOf(moving: AreaBounds, others: readonly AreaBounds[], axis: GuideAxis): AreaBounds[] {
  return others.filter((box) => sameRow(box, moving, axis))
}

/**
 * Ajuste do eixo que deixa os vãos da fileira iguais, ou `null` se nenhum cai
 * na tolerância. Três jeitos, todos com as vizinhas IMEDIATAS (como o Figma):
 * centralizar entre a vizinha de antes e a de depois; repetir, depois da de
 * antes, o vão que ela já tem com a anterior a ela; e o espelho disso antes da
 * de depois. Vão de zero (encostar) é o encaixe de borda com borda, não daqui.
 */
function spacingDelta(moving: AreaBounds, others: readonly AreaBounds[], axis: GuideAxis, tolerance: number): number | null {
  const row = rowOf(moving, others, axis)
  // Espaçamento compara dois vãos: com menos de duas vizinhas não há o que repetir.
  if (row.length < 2) return null
  const size = high(moving, axis) - low(moving, axis)
  const previous = neighborBefore(moving, row, axis)
  const next = neighborAfter(moving, row, axis)
  const deltas: number[] = []
  if (previous !== null && next !== null) {
    const gap = (low(next, axis) - high(previous, axis) - size) / 2
    if (gap > SAME_POSITION_EPSILON) deltas.push(high(previous, axis) + gap - low(moving, axis))
  }
  const beforePrevious = previous === null ? null : neighborBefore(previous, row, axis)
  if (previous !== null && beforePrevious !== null) {
    const gap = low(previous, axis) - high(beforePrevious, axis)
    if (gap > SAME_POSITION_EPSILON) deltas.push(high(previous, axis) + gap - low(moving, axis))
  }
  const afterNext = next === null ? null : neighborAfter(next, row, axis)
  if (next !== null && afterNext !== null) {
    const gap = low(afterNext, axis) - high(next, axis)
    if (gap > SAME_POSITION_EPSILON) deltas.push(low(next, axis) - gap - high(moving, axis))
  }
  let best: number | null = null
  for (const delta of deltas) {
    // `!(<=)` e não `>`: tolerância NaN não encaixa nada.
    if (!(Math.abs(delta) <= tolerance)) continue
    if (best === null || Math.abs(delta) < Math.abs(best)) best = delta
  }
  return best
}

/** O ajuste escolhido num eixo, e se ele veio do espaçamento igual (e não do alinhamento). */
interface AxisChoice {
  delta: number
  bySpacing: boolean
}

/**
 * Ajuste de um eixo: o alinhamento (borda e centro) e, com os vãos ligados, o
 * espaçamento igual. Vence o menor; no empate, o alinhamento, que é o encaixe
 * que fecha parede com parede.
 */
function chooseAxis(aligned: number | null, spaced: number | null): AxisChoice | null {
  if (spaced !== null && (aligned === null || Math.abs(spaced) < Math.abs(aligned) - SAME_POSITION_EPSILON)) return { delta: spaced, bySpacing: true }
  return aligned === null ? null : { delta: aligned, bySpacing: false }
}

/** Eixo sem encaixe não ajusta nada. */
function deltaOf(choice: AxisChoice | null): number {
  return choice === null ? 0 : choice.delta
}

function sameGap(a: number, b: number): boolean {
  return Math.abs(a - b) <= SAME_POSITION_EPSILON
}

/**
 * O vão de `first` (antes) até `second` (depois), medido no meio da faixa que
 * as duas dividem no outro eixo. As duas são sempre da mesma fileira
 * (`neighborBefore`/`neighborAfter` só devolvem quem divide fileira), então a
 * faixa nunca é vazia; entre dois pedaços da mesma reta, ela é a própria reta.
 */
function gapBetween(first: AreaBounds, second: AreaBounds, axis: GuideAxis): GapMark {
  const cross = crossAxis(axis)
  const shared = (Math.max(low(first, cross), low(second, cross)) + Math.min(high(first, cross), high(second, cross))) / 2
  return { axis, from: high(first, axis), to: low(second, axis), at: shared }
}

/** Os vãos iguais a `gap` em sequência, de `start` para trás na fileira. */
function equalGapsBefore(start: AreaBounds, gap: number, row: readonly AreaBounds[], axis: GuideAxis): GapMark[] {
  const marks: GapMark[] = []
  let current = start
  while (marks.length < MAX_EQUAL_GAPS_PER_SIDE) {
    const previous = neighborBefore(current, row, axis)
    if (previous === null || !sameGap(low(current, axis) - high(previous, axis), gap)) break
    marks.push(gapBetween(previous, current, axis))
    current = previous
  }
  return marks
}

/** O espelho de `equalGapsBefore`: de `start` para a frente. */
function equalGapsAfter(start: AreaBounds, gap: number, row: readonly AreaBounds[], axis: GuideAxis): GapMark[] {
  const marks: GapMark[] = []
  let current = start
  while (marks.length < MAX_EQUAL_GAPS_PER_SIDE) {
    const next = neighborAfter(current, row, axis)
    if (next === null || !sameGap(low(next, axis) - high(current, axis), gap)) break
    marks.push(gapBetween(current, next, axis))
    current = next
  }
  return marks
}

/** Intercala as duas listas: o vão de cada lado da peça vem antes dos mais longe, e ganha número primeiro. */
function interleave(left: readonly GapMark[], right: readonly GapMark[]): GapMark[] {
  const marks: GapMark[] = []
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if (i < left.length) marks.push(left[i])
    if (i < right.length) marks.push(right[i])
  }
  return marks
}

/**
 * Os vãos iguais que a caixa JÁ encaixada forma na fileira do eixo: os dois
 * lados dela quando está centralizada, e de cada lado a sequência de vãos
 * iguais ao dela (a fileira inteira de salas espaçadas por igual aparece).
 */
function spacingMarks(moving: AreaBounds, others: readonly AreaBounds[], axis: GuideAxis): GapMark[] {
  const row = rowOf(moving, others, axis)
  const previous = neighborBefore(moving, row, axis)
  const next = neighborAfter(moving, row, axis)
  const left = previous === null ? 0 : low(moving, axis) - high(previous, axis)
  const right = next === null ? 0 : low(next, axis) - high(moving, axis)
  const centered = previous !== null && next !== null && left > SAME_POSITION_EPSILON && sameGap(left, right)
  const leftRun = previous !== null && left > SAME_POSITION_EPSILON ? equalGapsBefore(previous, left, row, axis) : []
  const rightRun = next !== null && right > SAME_POSITION_EPSILON ? equalGapsAfter(next, right, row, axis) : []
  const leftMarks = previous !== null && (centered || leftRun.length > 0) ? [gapBetween(previous, moving, axis), ...leftRun] : []
  const rightMarks = next !== null && (centered || rightRun.length > 0) ? [gapBetween(moving, next, axis), ...rightRun] : []
  return interleave(leftMarks, rightMarks)
}

/**
 * Onde duas caixas alinham no eixo, para a medida correr pela guia: o centro,
 * se os centros alinham (a medida no meio das duas); senão a primeira borda
 * alinhada. `null` = não alinham.
 */
function alignedPosition(mine: Anchors, theirs: Anchors): number | null {
  if (Math.abs(theirs[CENTER_ANCHOR] - mine[CENTER_ANCHOR]) <= SAME_POSITION_EPSILON) return theirs[CENTER_ANCHOR]
  for (const their of theirs) {
    if (mine.some((anchor) => Math.abs(their - anchor) <= SAME_POSITION_EPSILON)) return their
  }
  return null
}

/**
 * Com a guia do eixo `axis`, o vão no OUTRO eixo até a peça alinhada mais
 * perto: a sala que encaixou pela borda com a de cima mostra a distância
 * vertical entre as duas. Encostada ou sobreposta no outro eixo não tem vão.
 */
function alignedGap(moving: AreaBounds, others: readonly AreaBounds[], axis: GuideAxis): GapMark | null {
  const cross = crossAxis(axis)
  const mine = anchorsOf(moving, axis)
  let best: { other: AreaBounds; distance: number; at: number } | null = null
  for (const other of others) {
    const at = alignedPosition(mine, anchorsOf(other, axis))
    if (at === null) continue
    const distance = Math.max(low(other, cross) - high(moving, cross), low(moving, cross) - high(other, cross))
    if (!(distance > SAME_POSITION_EPSILON)) continue
    if (best === null || distance < best.distance) best = { other, distance, at }
  }
  if (best === null) return null
  const otherFirst = high(best.other, cross) <= low(moving, cross)
  const [first, second] = otherFirst ? [best.other, moving] : [moving, best.other]
  return { axis: cross, from: high(first, cross), to: low(second, cross), at: best.at }
}

function sameSpan(a: GapMark, b: GapMark): boolean {
  return a.axis === b.axis && sameGap(a.from, b.from) && sameGap(a.to, b.to)
}

/**
 * As medidas da caixa JÁ encaixada, nos eixos que encaixaram: primeiro os
 * vãos iguais, depois a medida até a alinhada. A medida que repete um vão
 * igual (a mesma vizinha, o mesmo vão) sai uma vez só, sem dois números
 * iguais um em cima do outro.
 */
function gapMarks(moving: AreaBounds, others: readonly AreaBounds[], axes: readonly GuideAxis[]): GapMark[] {
  const marks = axes.flatMap((axis) => spacingMarks(moving, others, axis))
  for (const axis of axes) {
    const mark = alignedGap(moving, others, axis)
    if (mark !== null && !marks.some((existing) => sameSpan(existing, mark))) marks.push(mark)
  }
  return marks
}

/**
 * O encaixe do eixo aparece com a caixa nesta posição? O alinhamento sempre:
 * a guia não depende do outro eixo. O espaçamento, só se os vãos iguais ainda
 * estão lá, porque a fileira muda com a posição no OUTRO eixo.
 */
function choiceShows(choice: AxisChoice | null, box: AreaBounds, others: readonly AreaBounds[], axis: GuideAxis): boolean {
  return choice === null || !choice.bySpacing || spacingMarks(box, others, axis).length > 0
}

/**
 * Encaixa `moving` nas âncoras de `others` que estão a até `tolerance` (px de
 * mundo), eixo a eixo — e, com `options.gaps`, também no espaçamento igual.
 * `dx`/`dy` são o AJUSTE a somar na caixa; as guias e os vãos já descrevem a
 * posição encaixada.
 *
 * O espaçamento de um eixo depende da fileira, e a fileira, de onde a caixa
 * está no OUTRO eixo: a borda de cima que encaixa na de baixo da fileira tira
 * a peça dela. Por isso o espaçamento de x é procurado com y já alinhado (e
 * vice-versa), que é também o que põe na reta a parede arrastada com a mão
 * tremendo. E, na posição final, ele é conferido: o eixo que andaria por um
 * espaçamento cujos vãos iguais não aparecem fica com o alinhamento dele, ou
 * parado. A peça nunca pula por um motivo que não está na tela.
 */
export function snapBox(moving: AreaBounds, others: readonly AreaBounds[], tolerance: number, options: SnapOptions = ALIGNMENT_ONLY): BoxSnap {
  const alignedX = axisDelta(moving, others, 'x', tolerance)
  const alignedY = axisDelta(moving, others, 'y', tolerance)
  const spacedX = options.gaps ? spacingDelta(translate(moving, 0, alignedY ?? 0), others, 'x', tolerance) : null
  const spacedY = options.gaps ? spacingDelta(translate(moving, alignedX ?? 0, 0), others, 'y', tolerance) : null
  let x = chooseAxis(alignedX, spacedX)
  let y = chooseAxis(alignedY, spacedY)
  let snapped = translate(moving, deltaOf(x), deltaOf(y))
  // Toda volta que não sai troca ao menos um espaçamento pelo alinhamento do
  // eixo, que sempre aparece: no máximo duas trocas, e a terceira volta sai.
  for (;;) {
    const keepX = choiceShows(x, snapped, others, 'x')
    const keepY = choiceShows(y, snapped, others, 'y')
    if (keepX && keepY) break
    if (!keepX) x = chooseAxis(alignedX, null)
    if (!keepY) y = chooseAxis(alignedY, null)
    snapped = translate(moving, deltaOf(x), deltaOf(y))
  }
  if (x === null && y === null) return { dx: 0, dy: 0, guides: [], gaps: [] }
  // Só os eixos que encaixaram: num eixo sem encaixe nada está alinhado nem espaçado por igual.
  const axes: GuideAxis[] = []
  if (x !== null) axes.push('x')
  if (y !== null) axes.push('y')
  return {
    dx: deltaOf(x),
    dy: deltaOf(y),
    guides: axes.flatMap((axis) => axisGuides(snapped, others, axis)),
    gaps: options.gaps ? gapMarks(snapped, others, axes) : [],
  }
}

/** As duas pontas do vão em px de mundo: quem escreve o número mede de uma à outra. */
export function gapEnds(gap: GapMark): { start: Point; end: Point } {
  return gap.axis === 'x'
    ? { start: { x: gap.from, y: gap.at }, end: { x: gap.to, y: gap.at } }
    : { start: { x: gap.at, y: gap.from }, end: { x: gap.at, y: gap.to } }
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
 * As mesmas guias e os mesmos vãos? O motivo de `sameGuides`, agora também
 * para os números: refazer a pílula e o texto a cada pointermove preso no
 * encaixe é trabalho jogado fora.
 */
export function sameOverlay(a: GuideOverlay, b: GuideOverlay): boolean {
  return sameGuides(a.guides, b.guides) && sameGaps(a.gaps, b.gaps)
}

/** Os mesmos vãos, na mesma ordem? Serve às guias e à medida do Alt segurado (`lib/altMeasure.ts`). */
export function sameGaps(a: readonly GapMark[], b: readonly GapMark[]): boolean {
  if (a.length !== b.length) return false
  return a.every((gap, index) => {
    const other = b[index]
    return gap.axis === other.axis && gap.from === other.from && gap.to === other.to && gap.at === other.at
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

/** Deslocamento TOTAL da peça desde o pointerdown (não o passo deste evento), com as guias e os vãos. */
export interface BoxDrag extends GuideOverlay {
  offsetX: number
  offsetY: number
}

/**
 * A posição tentativa sai do delta TOTAL do gesto (ponteiro de agora menos o
 * do pointerdown), nunca do passo incremental. Com o passo, o encaixe comia
 * cada pequeno movimento do cursor: a peça grudava e o cursor ia se afastando
 * dela, a guia "grudenta" clássica. Com o total, a peça solta assim que o
 * cursor passa da tolerância.
 *
 * Arrasto de corpo: encaixa também no espaçamento igual e mede os vãos
 * (fatia 3), com as mesmas regras de grade e de Ctrl da guia.
 */
export function dragBoxWithGuides(input: BoxDragInput): BoxDrag {
  const offsetX = input.pointer.x - input.startPointer.x
  const offsetY = input.pointer.y - input.startPointer.y
  if (input.mode === 'free') return { offsetX, offsetY, guides: [], gaps: [] }
  const tentative = translate(input.startBounds, offsetX, offsetY)
  if (input.mode === 'gridExact') {
    const exact = snapBox(tentative, input.others, EXACT_ALIGNMENT_WORLD_PX, BODY_SNAP)
    return { offsetX, offsetY, guides: exact.guides, gaps: exact.gaps }
  }
  const snap = snapBox(tentative, input.others, input.tolerance, BODY_SNAP)
  return { offsetX: offsetX + snap.dx, offsetY: offsetY + snap.dy, guides: snap.guides, gaps: snap.gaps }
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
