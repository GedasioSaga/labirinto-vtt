import type { Drawing, DrawingPoint, Prop, Region, Stair, Token, Wall } from '../types/map'
import { stairSpiralCircle } from './stairs'

/**
 * Geometria PURA da borracha (Agente D, Fase 4, N1 — "apagar só uma parte ou
 * o objeto todo"). Sem Pixi, sem store: recebe um círculo (centro + raio, em
 * px de mundo — mesma unidade de todo o schema, ver cabeçalho de types/map.ts)
 * e devolve o resultado geométrico do corte. O MODO de gesto (arrastar a
 * borracha continuamente, decidir "objeto"/"parte" por preferência de sessão)
 * é do integrador — ver CONTRATO no relatório do agente.
 *
 * Duas famílias de função aqui:
 *  1. `eraseFromDrawing` — RECORTA de verdade os 3 kinds de traço aberto
 *     (freehand/curve/line): divide a lista de pontos, produzindo 0, 1 ou N
 *     `Drawing` novos.
 *  2. `eraseDecisionFor*` — para tudo que NÃO dá pra recortar por um custo
 *     razoável (área preenchida, texto, e as entidades fora de `Drawing`:
 *     Wall/Region/Token/Prop/Stair), devolve a decisão EXPLÍCITA 'remove' ou
 *     'keep' em vez de silenciar. `eraseFromDrawing` usa a mesma ideia
 *     internamente para os 5 kinds fechados de `Drawing` (circle/rect/
 *     ellipse/polygon/text).
 *
 * "Sem tocar" devolve a MESMA referência sempre que possível (Drawing
 * original, ou entidade original via 'keep') — o integrador pode comparar
 * por `===` pra saber se algo mudou de verdade e pular um `setMap`/histórico
 * à toa.
 */

export interface Point {
  x: number
  y: number
}

// ─────────────────────────────────────────────────────────────
// Primitivas de sobreposição círculo↔forma — compartilhadas por todo o
// arquivo. Nenhuma delas conhece Drawing/Wall/etc., só coordenadas cruas.
// ─────────────────────────────────────────────────────────────

/** Mesma fórmula de `selectionHitTest.ts` (`distanceToSegment`, privada lá) —
 *  duplicada aqui de propósito: este módulo é intencionalmente autocontido
 *  (nenhum import de outro arquivo `lib/`), e os dois arquivos são de agentes
 *  diferentes nesta fase (risco de colisão de escrita se um importasse do
 *  outro e o outro estivesse sendo editado ao mesmo tempo). */
function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

function circleOverlapsSegment(center: Point, radius: number, a: Point, b: Point): boolean {
  return distanceToSegment(center, a, b) <= radius
}

function circleOverlapsPolyline(center: Point, radius: number, points: readonly Point[]): boolean {
  if (points.length === 0) return false
  if (points.length === 1) return Math.hypot(points[0].x - center.x, points[0].y - center.y) <= radius
  for (let i = 0; i < points.length - 1; i += 1) {
    if (circleOverlapsSegment(center, radius, points[i], points[i + 1])) return true
  }
  return false
}

/** Círculo↔polígono: qualquer aresta perto o bastante, OU o centro do círculo
 *  caindo dentro do polígono (círculo pequeno inteiramente engolido por uma
 *  Região grande, sem tocar nenhuma aresta) — os dois casos contam como
 *  sobreposição. Ray casting par-ímpar, mesma convenção de
 *  `selectionHitTest.isPointInPolygon`, duplicada aqui pelo mesmo motivo de
 *  `distanceToSegment` acima (módulo autocontido). */
function circleOverlapsPolygon(center: Point, radius: number, points: readonly Point[]): boolean {
  if (points.length < 2) return false
  for (let i = 0; i < points.length; i += 1) {
    if (circleOverlapsSegment(center, radius, points[i], points[(i + 1) % points.length])) return true
  }
  if (points.length < 3) return false

  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x
    const yi = points[i].y
    const xj = points[j].x
    const yj = points[j].y
    const intersects = yi > center.y !== yj > center.y && center.x < ((xj - xi) * (center.y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function circleOverlapsCircle(center: Point, radius: number, otherCenter: Point, otherRadius: number): boolean {
  return Math.hypot(center.x - otherCenter.x, center.y - otherCenter.y) <= radius + otherRadius
}

/** `rectCx`/`rectCy` = CENTRO do retângulo (não o canto) — cada chamador
 *  normaliza antes (rect de Drawing nasce por canto x/y+w/h; Prop e a caixa
 *  de texto já são centro-relativas). Distância do centro do círculo ao
 *  ponto mais próximo do retângulo, clampado nos dois eixos. */
function circleOverlapsRect(center: Point, radius: number, rectCx: number, rectCy: number, width: number, height: number): boolean {
  const halfW = width / 2
  const halfH = height / 2
  const closestX = Math.max(rectCx - halfW, Math.min(center.x, rectCx + halfW))
  const closestY = Math.max(rectCy - halfH, Math.min(center.y, rectCy + halfH))
  return Math.hypot(center.x - closestX, center.y - closestY) <= radius
}

// ─────────────────────────────────────────────────────────────
// Recorte de polilinha por círculo — o coração de freehand/curve/line.
// ─────────────────────────────────────────────────────────────

function pointAt(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function isInsideCircle(point: Point, center: Point, radius: number): boolean {
  return Math.hypot(point.x - center.x, point.y - center.y) <= radius
}

/** Parâmetros `t` (0..1, em ORDEM crescente) onde o segmento a→b cruza o
 *  círculo — 0, 1 ou 2 valores. Equação quadrática padrão reta↔círculo;
 *  `a` (coeficiente quadrático) só é 0 quando `a === b` (segmento de
 *  comprimento zero), tratado à parte pelo chamador antes de chegar aqui
 *  (nunca divide por zero). Cruzamento EXATO na ponta do segmento (t=0 ou
 *  t=1) não conta — o estado "dentro/fora" nessa ponta já vem de
 *  `isInsideCircle` no próprio ponto, contar a interseção também duplicaria
 *  a fronteira. */
function segmentCircleCrossings(a: Point, b: Point, center: Point, radius: number): number[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const fx = a.x - center.x
  const fy = a.y - center.y

  const quadA = dx * dx + dy * dy
  const quadB = 2 * (fx * dx + fy * dy)
  const quadC = fx * fx + fy * fy - radius * radius

  const discriminant = quadB * quadB - 4 * quadA * quadC
  if (discriminant < 0) return []

  const sqrtDiscriminant = Math.sqrt(discriminant)
  const t1 = (-quadB - sqrtDiscriminant) / (2 * quadA)
  const t2 = (-quadB + sqrtDiscriminant) / (2 * quadA)

  const crossings: number[] = []
  if (t1 > 0 && t1 < 1) crossings.push(t1)
  if (t2 > 0 && t2 < 1 && t2 !== t1) crossings.push(t2)
  return crossings
}

/**
 * Recorta uma polilinha aberta (freehand/curve/line — line é só uma
 * polilinha de 2 pontos) pela parte que cai DENTRO do círculo, devolvendo os
 * pedaços que sobram FORA, em ordem, como listas de pontos separadas —
 * cruzar pra dentro fecha o pedaço atual, cruzar pra fora abre um novo.
 *
 * Casos cobertos pelos testes (ver eraseGeometry.test.ts): apagar o meio
 * (2 pedaços), apagar uma ponta (1 pedaço, mais curto), raio maior que o
 * traço inteiro (0 pedaços — `[]`), raio que não encosta (a função ainda
 * devolve 1 pedaço com os MESMOS pontos, mas por REFERÊNCIA NOVA — é
 * `eraseFromDrawing`, a chamadora, que faz o atalho de devolver o `Drawing`
 * original por igualdade de referência quando nada foi tocado; esta função
 * de geometria pura sempre recorta, nunca decide atalho de identidade),
 * segmento de comprimento zero (pontos repetidos, sem dividir por zero).
 *
 * Pedaço com menos de 2 pontos é descartado (não dá pra desenhar um traço de
 * 1 ponto só) — é isso que faz "raio maior que o traço inteiro" devolver `[]`
 * em vez de uma lista de pedaços vazios/degenerados.
 */
export function clipPolylineByCircle(points: readonly Point[], center: Point, radius: number): Point[][] {
  if (points.length === 0) return []
  if (points.length === 1) {
    return isInsideCircle(points[0], center, radius) ? [] : [[points[0]]]
  }

  const chains: Point[][] = []
  let current: Point[] = []

  const pushPoint = (p: Point) => {
    const last = current[current.length - 1]
    if (last && last.x === p.x && last.y === p.y) return
    current.push(p)
  }

  const flushChain = () => {
    if (current.length >= 2) chains.push(current)
    current = []
  }

  let insideNow = isInsideCircle(points[0], center, radius)
  if (!insideNow) pushPoint(points[0])

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]

    if (a.x === b.x && a.y === b.y) {
      // Segmento de comprimento zero (ponto repetido): sem geometria pra
      // cruzar — só carrega o estado dentro/fora de `b` adiante.
      const bInside = isInsideCircle(b, center, radius)
      if (!bInside) pushPoint(b)
      else flushChain()
      insideNow = bInside
      continue
    }

    const crossings = segmentCircleCrossings(a, b, center, radius)
    let stateInside = insideNow

    for (const t of crossings) {
      const crossingPoint = pointAt(a, b, t)
      if (stateInside) {
        // Estava dentro, cruzou pra fora: `crossingPoint` é o INÍCIO de um
        // pedaço novo.
        pushPoint(crossingPoint)
      } else {
        // Estava fora, cruzou pra dentro: `crossingPoint` é o FIM do pedaço
        // atual.
        pushPoint(crossingPoint)
        flushChain()
      }
      stateInside = !stateInside
    }

    if (!stateInside) pushPoint(b)
    else flushChain()

    insideNow = isInsideCircle(b, center, radius)
  }

  flushChain()
  return chains
}

// ─────────────────────────────────────────────────────────────
// eraseFromDrawing — os 8 kinds de Drawing.
// ─────────────────────────────────────────────────────────────

function toDrawingPoints(chain: Point[]): DrawingPoint[] {
  return chain
}

/** freehand/curve: mesma lógica, só muda o `kind` de saída — "curve"
 *  recortada continua sendo uma lista de pontos de controle (a curva
 *  resultante troca de forma sutilmente entre um ponto de controle e o
 *  próximo, mas não há pedido do usuário para preservar a curvatura exata do
 *  meio apagado — "apagar o meio de um traço gera dois traços" já está
 *  cumprido). */
function eraseFromPolylineDrawing(drawing: Drawing & { kind: 'freehand' | 'curve' }, center: Point, radius: number): Drawing[] {
  if (!circleOverlapsPolyline(center, radius, drawing.points)) return [drawing]

  const chains = clipPolylineByCircle(drawing.points, center, radius)
  return chains.map((chain) => ({
    id: crypto.randomUUID(),
    kind: drawing.kind,
    points: toDrawingPoints(chain),
    color: drawing.color,
    width: drawing.width,
    ...(drawing.cap !== undefined ? { cap: drawing.cap } : {}),
  }))
}

/**
 * Caminho: traço aberto como freehand/curve — apagar o meio da trilha deixa
 * os dois pedaços de pé, em vez de sumir com o caminho inteiro. Função
 * própria, e não um `case` a mais em `eraseFromPolylineDrawing`, porque
 * `path` não tem `cap`: a faixa nasce e morre redonda, e espalhar um
 * `'cap' in drawing` lá dentro custaria mais do que estas seis linhas.
 */
function eraseFromPathDrawing(drawing: Drawing & { kind: 'path' }, center: Point, radius: number): Drawing[] {
  if (!circleOverlapsPolyline(center, radius, drawing.points)) return [drawing]

  return clipPolylineByCircle(drawing.points, center, radius).map((chain) => ({
    id: crypto.randomUUID(),
    kind: 'path' as const,
    points: toDrawingPoints(chain),
    color: drawing.color,
    width: drawing.width,
  }))
}

function eraseFromLineDrawing(drawing: Drawing & { kind: 'line' }, center: Point, radius: number): Drawing[] {
  const a = { x: drawing.x1, y: drawing.y1 }
  const b = { x: drawing.x2, y: drawing.y2 }
  if (!circleOverlapsSegment(center, radius, a, b)) return [drawing]

  const chains = clipPolylineByCircle([a, b], center, radius)
  return chains.map((chain) => {
    const start = chain[0]
    const end = chain[chain.length - 1]
    return {
      id: crypto.randomUUID(),
      // `as const`: só estreita o literal 'line' pro discriminante de Drawing
      // (sem isso o objeto de retorno do .map() infere `kind: string`, largo
      // demais pro union) — não mente pro compilador, é o mesmo valor.
      kind: 'line' as const,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      color: drawing.color,
      width: drawing.width,
      ...(drawing.cap !== undefined ? { cap: drawing.cap } : {}),
    }
  })
}

/**
 * Ponto de entrada único para a borracha em modo "parte" sobre um `Drawing`.
 *
 * - `freehand`/`curve`: recorte de verdade (divide `points`), 0..N traços.
 * - `line`: recorte de verdade (segmento único), 0..2 linhas.
 * - `circle`/`rect`/`ellipse`/`polygon`/`text`: formas fechadas ou com área —
 *   recortar o CONTORNO de um preenchimento produziria uma forma que os
 *   kinds atuais não conseguem representar (um `rect` com um mordida
 *   circular não é mais um retângulo). Decisão explícita, documentada em
 *   `docs/DOSSIE-FEEDBACK-F4.md`/ROADMAP.md: se o círculo toca a forma,
 *   remove ela inteira; se não toca, devolve a MESMA referência (`[drawing]`,
 *   sem cópia) — nunca fica em silêncio no meio do caminho.
 */
export function eraseFromDrawing(drawing: Drawing, center: Point, radius: number): Drawing[] {
  switch (drawing.kind) {
    case 'freehand':
    case 'curve':
      return eraseFromPolylineDrawing(drawing, center, radius)

    case 'path':
      return eraseFromPathDrawing(drawing, center, radius)

    case 'line':
      return eraseFromLineDrawing(drawing, center, radius)

    case 'circle':
      return circleOverlapsCircle(center, radius, { x: drawing.cx, y: drawing.cy }, drawing.radius) ? [] : [drawing]

    case 'rect':
      return circleOverlapsRect(center, radius, drawing.x + drawing.w / 2, drawing.y + drawing.h / 2, drawing.w, drawing.h)
        ? []
        : [drawing]

    case 'ellipse':
      // Aproximação pela caixa delimitadora (2*rx × 2*ry), não pelo contorno
      // elíptico exato — não existe fórmula fechada simples pra distância
      // círculo↔elipse (mesma concessão que `selectionHitTest.findDrawingAt`
      // já assume pro hit-test de elipse vazada). Erra só "caro demais",
      // nunca "barato demais": pode decidir remover um pouco antes do
      // círculo tocar o contorno real nos 4 cantos da caixa, nunca deixa de
      // remover uma elipse que o círculo claramente atravessa.
      return circleOverlapsRect(center, radius, drawing.cx, drawing.cy, drawing.rx * 2, drawing.ry * 2) ? [] : [drawing]

    case 'polygon':
      return circleOverlapsPolygon(center, radius, drawing.points) ? [] : [drawing]

    case 'text': {
      // Mesma heurística de largura de `selectionHitTest.estimateTextWidth`
      // (0.55 × fontSize por caractere) — não duplicada por import (módulo
      // autocontido, ver cabeçalho do arquivo), mas o número é o mesmo de
      // propósito: um texto que a ferramenta Selecionar consegue clicar
      // também precisa ser alcançável pela borracha.
      const width = drawing.text.length * drawing.fontSize * 0.55
      const rectCx = drawing.x + width / 2
      const rectCy = drawing.y + drawing.fontSize / 2
      return circleOverlapsRect(center, radius, rectCx, rectCy, width, drawing.fontSize) ? [] : [drawing]
    }

    default: {
      // Exaustividade: se um 10º kind nascer em types/map.ts sem passar por
      // aqui, o `tsc` acusa (`drawing` deixa de ser `never`) em vez de
      // silenciar a borracha nesse kind novo.
      const exhaustive: never = drawing
      return [exhaustive]
    }
  }
}

// ─────────────────────────────────────────────────────────────
// eraseDecisionFor* — entidades fora de `Drawing` (Wall/Region/Token/Prop/
// Stair). Nenhuma delas tem um formato "recortável" que ainda faça sentido
// como a MESMA entidade depois do corte (uma Parede cortada no meio vira uma
// pergunta de produto — duas paredes soltas? qual fica com `door`, se
// houver? qual fica com o vínculo `regionId`/`regionEdgeIndex` de uma Sala?
// — fora do escopo de uma função de geometria pura). Por isso: decisão
// binária e explícita, nunca um recorte silenciosamente incompleto.
// ─────────────────────────────────────────────────────────────

export type EraseWholeDecision = 'remove' | 'keep'

/** Parede: segmento único (`x1,y1`→`x2,y2`), mesmo formato de `distanceToSegment`. */
export function eraseDecisionForWall(wall: Wall, center: Point, radius: number): EraseWholeDecision {
  return circleOverlapsSegment(center, radius, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }) ? 'remove' : 'keep'
}

/** Região/Sala: polígono fechado (`points`) — mesma checagem "aresta OU
 *  contido" de `circleOverlapsPolygon`. Região com menos de 2 pontos (não
 *  deveria existir, mas defensivo) nunca é removida por toque — só por
 *  gesto de "objeto inteiro" fora deste arquivo. */
export function eraseDecisionForRegion(region: Region, center: Point, radius: number): EraseWholeDecision {
  return circleOverlapsPolygon(center, radius, region.points) ? 'remove' : 'keep'
}

/** Escada: um OU MAIS segmentos (`segments`, hoje sempre 1 pra shape
 *  'straight' — ver comentário de `Stair.shape` em types/map.ts; 'l'/'double'
 *  do futuro já funcionam de graça aqui, um `.some` sobre o array). Encostar
 *  em QUALQUER segmento do lance remove a escada inteira — não existe
 *  "escada pela metade" no schema atual. Espiral: o que se apaga é o círculo
 *  desenhado (`stairSpiralCircle`), o mesmo que o clique seleciona. */
export function eraseDecisionForStair(stair: Stair, center: Point, radius: number): EraseWholeDecision {
  const circle = stairSpiralCircle(stair)
  if (circle !== null) return circleOverlapsCircle(center, radius, circle.center, circle.radius) ? 'remove' : 'keep'
  const touchesAnySegment = stair.segments.some((segment) =>
    circleOverlapsSegment(center, radius, { x: segment.x1, y: segment.y1 }, { x: segment.x2, y: segment.y2 }),
  )
  return touchesAnySegment ? 'remove' : 'keep'
}

/** Token: `drawTokens.ts` renderiza como círculo genérico quando `image` é
 *  `null` — mesmo sem imagem, `size` já é o diâmetro de referência que
 *  `findTokenAt`/o snap usam hoje, então círculo↔círculo é a aproximação
 *  certa (imagem quadrada por baixo do círculo de seleção não muda a área
 *  clicável/apagável, que já é o círculo). */
export function eraseDecisionForToken(token: Token, center: Point, radius: number): EraseWholeDecision {
  return circleOverlapsCircle(center, radius, { x: token.x, y: token.y }, token.size / 2) ? 'remove' : 'keep'
}

/** Objeto (Prop): caixa `width×height` centrada em `(x, y)` — mesma
 *  convenção de `resizePropBox`/`propBoundingBox` (objectTransform.ts, fora
 *  do meu escopo de escrita, só li a convenção). */
export function eraseDecisionForProp(prop: Prop, center: Point, radius: number): EraseWholeDecision {
  return circleOverlapsRect(center, radius, prop.x, prop.y, prop.width, prop.height) ? 'remove' : 'keep'
}
