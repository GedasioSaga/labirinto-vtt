import type { FloorPiece, FloorShape, LayerId, MapData } from '../types/map'
import {
  areaFechadaAPartirDe,
  blocoNoPonto,
  buildBlocosShape,
  centroDoBloco,
  tirarBlocosDasPecas,
  type Bloco,
} from './floorBlocks'
import { compileFloor, pieceDistance } from './floorSdf'
import { isLayerLocked, isLayerVisible } from './layers'

/**
 * Ferramenta "Chão" — a parte PURA do gesto: de "pressionou aqui, soltou ali"
 * (ou "clicou nestes pontos") para a `FloorShape` que a peça guarda, mais o
 * hit-test de seleção. Fora de `pixi/PixiCanvas.tsx` pelo mesmo motivo de
 * `lib/shapeConstraint.ts`/`lib/dimensionText.ts`: testável sem Pixi nem DOM.
 */

interface Point {
  x: number
  y: number
}

/**
 * Forma que nasce de UM arrasto de dois pontos (canto a canto ou centro a
 * borda). Separada de `FloorShapeKind` porque só estas três passam por
 * `buildFloorShapeFromDrag` — e o tipo é o que impede o corredor, o pincel e o
 * balde de chegarem lá por engano.
 */
export type FloorDragShapeKind = 'rect' | 'ellipse' | 'polygon'

/**
 * O que a ferramenta "Chão" pode ter na mão — `poly` fica de fora: só nasce de
 * imagem (`lib/traceImage.ts`). `blocos` é o pincel preso à grade e `balde`
 * enche a área fechada de uma vez; os dois desenham a mesma `FloorShape`
 * (`kind: 'blocos'`), a diferença está no gesto.
 */
export type FloorShapeKind = FloorDragShapeKind | 'corridor' | 'blocos' | 'balde'

/** Estreita para as formas de arrasto — usado onde o corredor/pincel/balde não cabem. */
export function isFloorDragShape(kind: FloorShapeKind): kind is FloorDragShapeKind {
  return kind === 'rect' || kind === 'ellipse' || kind === 'polygon'
}

/** Chão por peças mora na camada das Regiões (ver `redrawShapes` em PixiCanvas.tsx). */
export const FLOOR_LAYER: LayerId = 'salas'

/**
 * Abaixo disso (px de mundo, em qualquer eixo) o gesto conta como clique
 * parado, não arrasto — sem este piso, um clique vira uma peça de 0 px que
 * ninguém enxerga nem consegue selecionar.
 */
export const MIN_FLOOR_DRAG_SIZE = 2

export const FLOOR_POLYGON_SIDES_MIN = 3
export const FLOOR_POLYGON_SIDES_MAX = 12

export interface FloorDragResult {
  shape: FloorShape
  /** Graus; só o polígono gira (para o primeiro vértice cair sob o cursor). */
  rotation: number
}

export function clampFloorPolygonSides(sides: number): number {
  return Math.min(FLOOR_POLYGON_SIDES_MAX, Math.max(FLOOR_POLYGON_SIDES_MIN, Math.round(sides)))
}

function normalizeDegrees(degrees: number): number {
  const wrapped = ((degrees % 360) + 360) % 360
  // 2 casas bastam para o vértice cair sob o cursor e deixam o campo do painel legível.
  return Math.round(wrapped * 100) / 100
}

/**
 * Retângulo: de canto a canto (mesmo gesto da Sala e do Retângulo).
 * Elipse e polígono: centro no `start`, borda no `end` (mesmo gesto da Elipse
 * e do Polígono Regular). `null` = arrasto pequeno demais para virar peça.
 */
export function buildFloorShapeFromDrag(
  kind: FloorDragShapeKind,
  start: Point,
  end: Point,
  sides: number,
): FloorDragResult | null {
  const dx = end.x - start.x
  const dy = end.y - start.y

  if (kind === 'rect') {
    const w = Math.abs(dx)
    const h = Math.abs(dy)
    if (w < MIN_FLOOR_DRAG_SIZE || h < MIN_FLOOR_DRAG_SIZE) return null
    return { shape: { kind: 'rect', cx: (start.x + end.x) / 2, cy: (start.y + end.y) / 2, w, h }, rotation: 0 }
  }

  if (kind === 'ellipse') {
    const rx = Math.abs(dx)
    const ry = Math.abs(dy)
    if (rx < MIN_FLOOR_DRAG_SIZE || ry < MIN_FLOOR_DRAG_SIZE) return null
    return { shape: { kind: 'ellipse', cx: start.x, cy: start.y, rx, ry }, rotation: 0 }
  }

  const radius = Math.hypot(dx, dy)
  if (radius < MIN_FLOOR_DRAG_SIZE) return null
  // O motor desenha o primeiro vértice para cima (-90°, `regularPolygonVertices`);
  // girar por ângulo+90 põe esse vértice sob o cursor, igual ao Polígono Regular.
  const rotation = normalizeDegrees((Math.atan2(dy, dx) * 180) / Math.PI + 90)
  return {
    shape: { kind: 'polygon', cx: start.x, cy: start.y, radius, sides: clampFloorPolygonSides(sides) },
    rotation,
  }
}

/**
 * Corredor a partir dos cliques. Duplo clique entrega o último ponto duas
 * vezes (dois pointerdown antes do dblclick) — repetição consecutiva é
 * descartada. Menos de 2 pontos distintos não é corredor.
 */
export function buildCorridorShape(points: readonly Point[], width: number): FloorShape | null {
  if (!(width > 0)) return null
  const distinct: Point[] = []
  for (const point of points) {
    const last = distinct[distinct.length - 1]
    if (!last || last.x !== point.x || last.y !== point.y) distinct.push(point)
  }
  if (distinct.length < 2) return null
  return { kind: 'corridor', points: distinct.map((p) => ({ x: p.x, y: p.y, width })) }
}

/**
 * O que fazer com o traço de Corredor ABERTO quando a pessoa troca de forma
 * no menu do Chão (achado 7 do passeio de 20/09/2026: o traço sumia calado).
 *
 * - `finalizar`: 2 pontos distintos ou mais já são corredor — vira chão como
 *   está, igual ao Enter. Os pontos foram clicados de propósito; jogá-los fora
 *   por um clique no menu é punir o gesto errado.
 * - `descartar`: 1 ponto só não tem comprimento; não há o que salvar, mas quem
 *   chama AVISA, porque o rascunho estava na tela e vai sumir.
 * - `nada`: não havia traço aberto.
 *
 * "Distinto" é a mesma conta de `buildCorridorShape` (repetição consecutiva,
 * como o duplo clique, não conta), para a decisão nunca prometer um corredor
 * que a construção recusaria.
 */
export function corridorDraftOnShapeChange(points: readonly Point[]): 'finalizar' | 'descartar' | 'nada' {
  let distintos = 0
  let anterior: Point | undefined
  for (const point of points) {
    if (!anterior || anterior.x !== point.x || anterior.y !== point.y) distintos += 1
    anterior = point
  }
  if (distintos === 0) return 'nada'
  return distintos >= 2 ? 'finalizar' : 'descartar'
}

export function buildFloorPiece(id: string, shape: FloorShape, op: FloorPiece['op'], rotation = 0): FloorPiece {
  // `rotation` ausente === 0 (types/map.ts) — não grava o campo à toa.
  return rotation === 0 ? { id, shape, op, modifiers: {} } : { id, shape, op, rotation, modifiers: {} }
}

/** `PointerEvent.button` do botão direito do mouse. */
const BOTAO_DIREITO = 2

/**
 * O traço do Pincel de blocos apaga (em vez de pintar)?
 *
 * Duas portas de entrada para apagar, e qualquer uma basta:
 *  - o botão DIREITO apaga em qualquer operação — decisão do usuário de
 *    15/09/2026, é o atalho que a descrição do pincel ensina;
 *  - a OPERAÇÃO "Subtrair" apaga também com o botão esquerdo. Antes o pincel
 *    olhava só o botão e Subtrair pintava igual a Somar, contrariando a
 *    promessa da própria opção ("abre um buraco no chão desenhado antes
 *    dela") — achado 8 do passeio de 20/09/2026.
 *
 * Apagar reaproveita `apagarBlocosDoChao`, que só abre buraco onde HÁ chão:
 * Subtrair no vazio não cria nada.
 */
export function pincelDeBlocosApaga(op: FloorPiece['op'], botao: number): boolean {
  return botao === BOTAO_DIREITO || op === 'subtract'
}

/**
 * Aviso da borracha ao cair num chão sem nada por cima. A borracha não apaga
 * chão de propósito (decisão de 22/09/2026): a pessoa passaria a borracha para
 * limpar um risco e levaria o piso junto. Mas calar fazia ela achar que errou
 * o alvo — então a frase diz os dois caminhos que de fato apagam chão. Numa
 * linha só: o card do aviso mostra o texto inteiro num bloco.
 */
export const AVISO_BORRACHA_NAO_APAGA_CHAO =
  'A borracha não apaga chão. Para abrir um buraco no chão, use a ferramenta Chão com o Pincel de blocos e o botão direito (ou a operação Subtrair), ou selecione a peça de chão e apague.'

/**
 * Peça sob o ponto: a MAIS RECENTE (fim da lista) cujo interior contém o
 * ponto — é a que foi aplicada por último, logo a que o usuário vê "por
 * cima". Uma peça 'subtract' é achada dentro do próprio buraco, que é o
 * único lugar onde dá para clicar nela. Camada 'salas' oculta ou travada, e
 * peça `hidden`/`locked`, não são selecionáveis — mesma regra de
 * `hitTestMap` em PixiCanvas.tsx para as outras entidades.
 */
export function findFloorPieceAt(map: Pick<MapData, 'floor' | 'hiddenLayers' | 'lockedLayers'>, point: Point): FloorPiece | null {
  if (!isLayerVisible(map.hiddenLayers, FLOOR_LAYER) || isLayerLocked(map.lockedLayers, FLOOR_LAYER)) return null
  for (let i = map.floor.length - 1; i >= 0; i -= 1) {
    const piece = map.floor[i]
    if (piece.hidden || piece.locked) continue
    if (pieceDistance(piece, point.x, point.y) < 0) return piece
  }
  return null
}

/**
 * Lista de peças depois de apagar `blocos` com o botão direito do pincel.
 *
 * Dois passos, nessa ordem, porque nem todo chão nasceu do pincel:
 *  1. as células saem de toda peça de blocos (o caso comum — apagar o que você
 *     acabou de pintar não deixa lixo na lista);
 *  2. a célula que AINDA tem chão depois disso veio de peça de outra forma
 *     (retângulo, corredor, imagem convertida): só um buraco a tira, então
 *     entra numa peça `blocos` 'subtract' no fim da lista.
 *
 * `pieces` de volta sem mudança nenhuma devolve `null` — quem chama não gasta
 * uma entrada de Ctrl+Z por um gesto que não apagou nada.
 */
export function apagarBlocosDoChao(
  pieces: readonly FloorPiece[],
  blocos: readonly Bloco[],
  cell: number,
  novoId: () => string,
): FloorPiece[] | null {
  const semBlocos = tirarBlocosDasPecas(pieces, blocos, cell)
  const base = semBlocos ?? [...pieces]
  // Peça TRAVADA que soma chão fica de fora da conta: abrir um buraco por cima
  // dela seria apagá-la por outro caminho, que é exatamente o que a trava
  // proíbe. Peça travada que SUBTRAI continua contando — ela só tira chão, e
  // ignorá-la faria nascer um buraco em cima de vazio.
  const compilado = compileFloor(base.filter((p) => !(p.locked && p.op === 'add')))
  const aindaComChao = blocos.filter((bloco) => {
    const centro = centroDoBloco(bloco, cell)
    return compilado.sample(centro.x, centro.y) < 0
  })
  if (aindaComChao.length === 0) return semBlocos
  const shape = buildBlocosShape(cell, aindaComChao)
  if (!shape) return semBlocos
  return [...base, buildFloorPiece(novoId(), shape, 'subtract')]
}

/**
 * Peça de chão que o balde cria ao clicar em `point` — `null` quando não há o
 * que encher: a área já tem chão, ou ela não é fechada (ver
 * `areaFechadaAPartirDe`, que chama de aberta tudo que escapa pela borda do
 * mapa, onde não existe parede nenhuma).
 */
export function baldeNoPonto(
  map: Pick<MapData, 'floor' | 'grid' | 'width' | 'height'>,
  point: Point,
  novoId: () => string,
): FloorPiece | null {
  const cell = map.grid
  if (!(cell > 0)) return null
  const compilado = compileFloor(map.floor)
  const temChao = (col: number, row: number): boolean => {
    const centro = centroDoBloco({ col, row }, cell)
    return compilado.sample(centro.x, centro.y) < 0
  }
  const area = areaFechadaAPartirDe(temChao, blocoNoPonto(point.x, point.y, cell), map.width, map.height)
  if (area === null) return null
  const shape = buildBlocosShape(cell, area)
  return shape ? buildFloorPiece(novoId(), shape, 'add') : null
}
