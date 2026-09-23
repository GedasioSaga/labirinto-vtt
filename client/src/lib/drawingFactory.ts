import type { Wall, Light, Region, RegionPoint, Drawing, DrawingCap, DrawingDash, FreehandTexture } from '../types/map'
import type { Point } from '../pixi/world'
import { simplifyToControlPoints } from './curveMath'

export function isValidWallDraft(start: Point, end: Point): boolean {
  return start.x !== end.x || start.y !== end.y
}

// wallKind: preferência de ferramenta (A6, "Parede interna/externa"). Omitido
// preserva o comportamento de hoje — `wallKind: undefined` === 'exterior',
// mesma convenção documentada em types/map.ts (Wall.wallKind).
export function buildWallFromDraft(id: string, start: Point, end: Point, wallKind?: Wall['wallKind']): Wall {
  return {
    id,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    blocksLight: true,
    blocksMove: true,
    door: null,
    wallKind,
  }
}

// Luz plena da tocha no D&D 5e: 20 ft = 4 células de 5 ft.
const LIGHT_RADIUS_IN_CELLS = 4
const DEFAULT_LIGHT_COLOR = '#ffaa33'
const DEFAULT_LIGHT_INTENSITY = 0.8

// radiusOverride: usado pelo arrasto da ferramenta "Luz" (PixiCanvas) — o
// usuario arrasta pra escolher o raio em vez do padrao proporcional ao grid.
// Omitido (clique simples, sem arrasto), cai no calculo de sempre.
export function buildLightAt(id: string, point: Point, gridSize: number, radiusOverride?: number): Light {
  return {
    id,
    x: point.x,
    y: point.y,
    radius: radiusOverride ?? gridSize * LIGHT_RADIUS_IN_CELLS,
    color: DEFAULT_LIGHT_COLOR,
    intensity: DEFAULT_LIGHT_INTENSITY,
  }
}

const DEFAULT_REGION_FILL_COLOR = '#3a7ad0'
const DEFAULT_REGION_FILL_PATTERN = 'solid'

// Prefixo do nome de uma Sala recém-criada (mesmo texto usado pelo botão da
// ferramenta em components/labels.ts:19, TOOL_LABELS.room) — editável depois
// via RoomControls/setRoomName. Compartilhado pelas 3 ferramentas de Sala
// (retângulo, Circular, Polígono Regular): as três produzem uma entidade
// "Sala", só a FORMA do contorno muda (RoomMeta.shape).
export const DEFAULT_ROOM_NAME = 'Sala'

/*
 * Toda sala nascia com o MESMO nome ("Sala"), então um mapa com cinco cômodos
 * mostrava cinco rótulos idênticos e o mestre não distinguia um do outro pela
 * tela (passeio cego de 17/09/2026). O esquema novo é o mesmo já usado pelos
 * tokens — `nextTokenName` em lib/mapFactory.ts, "Token 1", "Token 2"… — só
 * que numerado por uma sequência de sessão em vez da lista de nomes já usados:
 * as duas fábricas abaixo recebem um rascunho geométrico (dois pontos), NUNCA
 * o mapa, e um módulo puro de geometria não pode importar a store sem inverter
 * a dependência (lib não conhece stores/). O contador vive aqui porque é aqui
 * que o nome nasce.
 *
 * LIMITE CONHECIDO, de propósito e não silencioso: a sequência é de sessão.
 * Recarregar a página e abrir um mapa que já tem "Sala 1" faz a próxima sala
 * nova se chamar "Sala 1" de novo. `syncRoomNameSequence` existe justamente
 * para fechar isso a partir de quem TEM a lista de regiões (o carregamento do
 * mapa, em stores/mapStore.ts) — arquivo de outra peça, não tocado aqui.
 */
let roomNameSequence = 0

/** Próximo nome sugerido para uma Sala nova: "Sala 1", "Sala 2", … */
export function nextDefaultRoomName(): string {
  roomNameSequence += 1
  return `${DEFAULT_ROOM_NAME} ${roomNameSequence}`
}

/**
 * Empurra a sequência para depois do maior "Sala N" já presente em `names`
 * (nome fora desse padrão é ignorado), para que a próxima sala criada não
 * repita um nome que já está no mapa. Lista vazia zera a sequência.
 */
export function syncRoomNameSequence(names: Iterable<string>): void {
  const prefix = `${DEFAULT_ROOM_NAME} `
  let highest = 0
  for (const name of names) {
    const trimmed = name.trim()
    if (!trimmed.startsWith(prefix)) continue
    const digits = trimmed.slice(prefix.length)
    const parsed = Number(digits)
    // `digits !== String(parsed)` descarta "01", "1.0", " 1", "1e3" e vazio:
    // só conta o que esta mesma fábrica escreveria.
    if (!Number.isInteger(parsed) || parsed <= 0 || digits !== String(parsed)) continue
    if (parsed > highest) highest = parsed
  }
  roomNameSequence = highest
}

export function buildRegionFromPoints(id: string, points: RegionPoint[], tag = 'region', fillColor = DEFAULT_REGION_FILL_COLOR, fillPattern: Region['fillPattern'] = DEFAULT_REGION_FILL_PATTERN): Region {
  return { id, points, tag, fillColor, fillPattern, data: {} }
}

/**
 * Uma parede por aresta do polígono da Sala, vinculada pelo par
 * `regionId`/`regionEdgeIndex` (0..n-1) — é essa convenção que `lib/roomLink.ts`
 * usa para reposicionar a parede quando o vértice se move e que `addDoorOnWall`
 * usa para partir a parede numa porta.
 *
 * Extraído porque as TRÊS fábricas de Sala (retângulo, polígono regular e
 * formato livre) escreviam o mesmo laço: três usos reais, uma receita só — se
 * uma delas divergisse, o vínculo daquele caminho quebraria em silêncio.
 *
 * `wallIds.length` deve ser exatamente `points.length`.
 */
function buildRoomEdgeWalls(regionId: string, points: RegionPoint[], wallIds: string[]): Wall[] {
  return wallIds.map((wallId, edgeIndex) => {
    const from = points[edgeIndex]
    const to = points[(edgeIndex + 1) % points.length]
    return {
      id: wallId,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      blocksLight: true,
      blocksMove: true,
      door: null,
      regionId,
      regionEdgeIndex: edgeIndex,
    }
  })
}

export function isValidRoomDraft(start: Point, end: Point): boolean {
  return start.x !== end.x && start.y !== end.y
}

// D1 (ROADMAP.md): esta função é a única fábrica da ferramenta "Sala"
// (retângulo) — por isso `region.room` é setado incondicionalmente aqui, não
// como parâmetro opcional que o chamador pudesse esquecer de passar. Antes
// desta mudança a Region criada aqui era indistinguível de uma Região comum
// e RoomControls (nome + resize por canto, já implementado e testado)
// nunca aparecia na prática — ver ROADMAP.md, dívida D1.
export function buildRoomFromDraft(
  regionId: string,
  wallIds: [string, string, string, string],
  start: Point,
  end: Point,
  fillColor = DEFAULT_REGION_FILL_COLOR,
  fillPattern: Region['fillPattern'] = DEFAULT_REGION_FILL_PATTERN,
  // Avaliado a CADA chamada sem 7º argumento (default de parâmetro), que é
  // como PixiCanvas.tsx:2739 chama: é isso que faz a 2ª sala nascer "Sala 2".
  roomName = nextDefaultRoomName(),
): { region: Region; walls: Wall[] } {
  const minX = Math.min(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const maxX = Math.max(start.x, end.x)
  const maxY = Math.max(start.y, end.y)

  // Sentido horário em coordenada de tela (y cresce pra baixo): topo, direita,
  // baixo, esquerda — casa com a convenção regionEdgeIndex 0..3 do vínculo Sala.
  const points: RegionPoint[] = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]

  const region: Region = {
    ...buildRegionFromPoints(regionId, points, 'region', fillColor, fillPattern),
    room: { shape: 'rect', name: roomName },
  }

  return { region, walls: buildRoomEdgeWalls(region.id, points, wallIds) }
}

// Abaixo desse raio (em px de mundo) o arrasto conta como "clique sem
// arrastar" — evita criar um poligono degenerado (todos os pontos colados)
// por causa de jitter de sub-pixel do próprio evento de mouse.
const MIN_POLYGON_RADIUS = 1

export function isValidRegularPolygonDraft(center: Point, radiusPoint: Point): boolean {
  const radius = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y)
  return radius > MIN_POLYGON_RADIUS
}

/**
 * Poligono regular inscrito num círculo — base compartilhada por "Sala
 * Circular" (sides=24 fixo) e "Poligono Regular" (sides configurável, 3..12).
 * O primeiro vértice fica sob `radiusPoint` (ângulo inicial = ângulo de
 * `radiusPoint` em relação a `center`), os demais seguem em passos iguais de
 * 2π/sides — mesma convenção de arrasto "centro pra fora" da ferramenta
 * Círculo de desenho já existente.
 *
 * `wallIds.length` deve ser exatamente `sides`: cada parede vincula à região
 * pelo mesmo par `regionId`/`regionEdgeIndex` (0..sides-1) que `buildRoomFromDraft`
 * usa pro retângulo — é essa convenção compartilhada (ver roomLink.ts) que faz
 * toda a edição de vértice já construída pra Sala funcionar de graça aqui.
 *
 * D1 (ROADMAP.md): igual a `buildRoomFromDraft`, `region.room` é setado
 * incondicionalmente aqui — só que `shape: 'polygon'`, não `'rect'`. É essa
 * distinção de `shape` (types/map.ts, `RoomMeta`) que faz o hit-test do
 * PixiCanvas escolher resize por canto (rect) vs. arrasto de vértice/inserção
 * de ponto médio livre (polygon, comportamento de sempre) — ver PixiCanvas.tsx,
 * bloco `if (region.room?.shape === 'rect') {...} else {...}`.
 */
export function buildRegularPolygonRoomFromDraft(
  regionId: string,
  wallIds: string[],
  center: Point,
  radiusPoint: Point,
  sides: number,
  fillColor = DEFAULT_REGION_FILL_COLOR,
  fillPattern: Region['fillPattern'] = DEFAULT_REGION_FILL_PATTERN,
  // Mesma sequência da Sala retangular (ver buildRoomFromDraft): as três
  // ferramentas de Sala numeram na mesma corrida, sem "Sala 1" repetido.
  roomName = nextDefaultRoomName(),
): { region: Region; walls: Wall[] } {
  const radius = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y)
  const angle0 = Math.atan2(radiusPoint.y - center.y, radiusPoint.x - center.x)

  const points: RegionPoint[] = Array.from({ length: sides }, (_, i) => {
    const angle = angle0 + (i * 2 * Math.PI) / sides
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
  })

  const region: Region = {
    ...buildRegionFromPoints(regionId, points, 'region', fillColor, fillPattern),
    room: { shape: 'polygon', name: roomName },
  }

  return { region, walls: buildRoomEdgeWalls(region.id, points, wallIds) }
}

/**
 * Descarta vértice repetido de um rascunho clicado canto a canto (Região e
 * Sala livre, que compartilham o mesmo traçado em pixi/PixiCanvas.tsx): o
 * duplo clique que fecha deixa o último ponto duas vezes, e a mão que tenta
 * "fechar" clicando de volta no primeiro canto deixa outro repetido no fim.
 *
 * Na Região isso era só um ponto morto no polígono. Na Sala livre cada
 * repetido vira uma parede de comprimento ZERO — que não desenha nada, não
 * bloqueia movimento nenhum e ainda desloca o `regionEdgeIndex` de todas as
 * arestas seguintes, quebrando o vínculo de que porta e arrasto de vértice
 * dependem (lib/roomLink.ts).
 *
 * Compara por igualdade exata porque os pontos vêm do MESMO `applySnap` do
 * clique: dois cliques no mesmo lugar dão exatamente o mesmo número.
 */
export function normalizeDraftPolygonPoints(points: Point[]): Point[] {
  const out: Point[] = []
  for (const point of points) {
    const last = out[out.length - 1]
    if (last && last.x === point.x && last.y === point.y) continue
    out.push(point)
  }
  // O fechamento é implícito (aresta n-1 → 0): um último ponto igual ao
  // primeiro é a mesma repetição, só que dando a volta.
  const first = out[0]
  const last = out[out.length - 1]
  if (out.length > 1 && first && last && first.x === last.x && first.y === last.y) out.pop()
  return out
}

/** Polígono de verdade precisa de 3 cantos distintos. */
export function isValidFreeRoomDraft(points: Point[]): boolean {
  return points.length >= 3
}

/**
 * Sala de formato livre — os cantos vêm clicados um a um pelo usuário
 * (`regionDraftPoints` em pixi/PixiCanvas.tsx), sem nenhuma restrição de
 * forma: não é retângulo (`buildRoomFromDraft`) nem polígono regular
 * (`buildRegularPolygonRoomFromDraft`).
 *
 * `shape: 'polygon'` de propósito, o MESMO das outras salas não-retangulares:
 * é o que faz o hit-test do PixiCanvas escolher arrasto de vértice e inserção
 * de ponto médio em vez do resize por canto, e o que esconde largura/altura
 * numérica no painel (RoomControls) — medida que não existe num polígono
 * arbitrário. Nenhum campo novo entra no arquivo de mapa, então não há linha
 * de migração em lib/mapFile.ts.
 *
 * `points` já deve ter passado por `normalizeDraftPolygonPoints`, e
 * `wallIds.length` deve ser exatamente `points.length`.
 */
export function buildFreeRoomFromPoints(
  regionId: string,
  wallIds: string[],
  points: Point[],
  fillColor = DEFAULT_REGION_FILL_COLOR,
  fillPattern: Region['fillPattern'] = DEFAULT_REGION_FILL_PATTERN,
  // Mesma sequência das outras Salas (ver buildRoomFromDraft): as quatro
  // ferramentas de Sala numeram na mesma corrida, sem "Sala 1" repetido.
  roomName = nextDefaultRoomName(),
): { region: Region; walls: Wall[] } {
  const vertices: RegionPoint[] = points.map((point) => ({ x: point.x, y: point.y }))

  const region: Region = {
    ...buildRegionFromPoints(regionId, vertices, 'region', fillColor, fillPattern),
    room: { shape: 'polygon', name: roomName },
  }

  return { region, walls: buildRoomEdgeWalls(region.id, vertices, wallIds) }
}

export function isValidFreehandDraft(points: Point[]): boolean {
  return points.length >= 2
}

// cap: opcional de propósito (Bug B2) — omitido, o objeto retornado NÃO tem
// a chave `cap` (spread condicional abaixo), igual ao que já saía daqui antes
// desta mudança: mesma convenção de `undefined` === 'round' documentada em
// types/map.ts (DrawingCap) e respeitada por drawDrawings.ts. Mantém
// `buildFreehandDrawing('id', pts, color, width)` (sem 5º argumento)
// compilando e com o mesmo objeto de sempre — não quebra os call sites
// existentes em PixiCanvas.tsx nem os testes abaixo que comparam por igualdade
// estrutural sem a chave `cap`.
// texture: mesma convenção opcional, agora pro pincel (N1, "caneta/lápis/
// marcador" — Fase 4). `undefined` === 'pen', mesma regra de `readFreehandTexture`
// (lib/brushTexture.ts).
export function buildFreehandDrawing(id: string, points: Point[], color: string, width: number, cap?: DrawingCap, texture?: FreehandTexture): Drawing {
  return { id, kind: 'freehand', points, color, width, ...(cap !== undefined ? { cap } : {}), ...(texture !== undefined ? { texture } : {}) }
}

export function isValidLineDraft(start: Point, end: Point): boolean {
  return start.x !== end.x || start.y !== end.y
}

// dash: mesma convenção opcional de `cap` acima — omitido ou 'solid', a chave
// NÃO entra no objeto, que sai idêntico ao de antes desta mudança (é o que
// mantém `buildLineDrawing(id, a, b, cor, 3)` com o mesmo resultado de sempre
// e o mapa salvo antes desta feature abrindo igual). `undefined` === 'solid',
// regra de `readDash` (lib/dashPattern.ts) e de `types/map.ts` (DrawingDash).
export function buildLineDrawing(id: string, start: Point, end: Point, color: string, width: number, cap?: DrawingCap, dash?: DrawingDash): Drawing {
  return {
    id,
    kind: 'line',
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    color,
    width,
    ...(cap !== undefined ? { cap } : {}),
    ...(dash !== undefined && dash !== 'solid' ? { dash } : {}),
  }
}

export function isValidCircleDraft(radius: number): boolean {
  return radius > 0
}

// fillAlpha: opcional de propósito — mantém compatível a assinatura já usada
// pelo call site existente (PixiCanvas) e por drawingFactory.test.ts, que não
// o passam. Omitido, cai na mesma regra de sempre (mesma da migração de
// círculo legado em mapFile.ts:51: círculo novo e círculo migrado nascem com
// o mesmo fillAlpha para o mesmo `filled`). Passado, é o valor de
// `drawFillAlpha` (preferência de "próxima forma" — ver DrawingStyleControls).
export function buildCircleDrawing(id: string, center: Point, radius: number, color: string, width: number, filled: boolean, fillAlpha?: number): Drawing {
  return { id, kind: 'circle', cx: center.x, cy: center.y, radius, color, width, filled, fillAlpha: fillAlpha ?? (filled ? 0.5 : 0) }
}

export function isValidRectDraft(start: Point, end: Point): boolean {
  return start.x !== end.x && start.y !== end.y
}

// start/end = os dois cantos arrastados (qualquer ordem) — normaliza pro
// canto superior-esquerdo (x, y) + largura/altura positivas, mesma convenção
// de buildRoomFromDraft.
export function buildRectDrawing(id: string, start: Point, end: Point, color: string, width: number, filled: boolean, fillAlpha: number): Drawing {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const w = Math.abs(end.x - start.x)
  const h = Math.abs(end.y - start.y)
  return { id, kind: 'rect', x, y, w, h, color, width, filled, fillAlpha }
}

export function isValidEllipseDraft(rx: number, ry: number): boolean {
  return rx > 0 && ry > 0
}

// center = clique inicial (fixo); rx/ry = já calculados pelo chamador a
// partir do ponto de arrasto (Math.abs(dx), Math.abs(dy)) — mesma convenção
// de isValidCircleDraft, que recebe o raio já calculado, não os dois pontos.
export function buildEllipseDrawing(id: string, center: Point, rx: number, ry: number, color: string, width: number, filled: boolean, fillAlpha: number): Drawing {
  return { id, kind: 'ellipse', cx: center.x, cy: center.y, rx, ry, color, width, filled, fillAlpha }
}

export function isValidPolygonDraft(points: Point[]): boolean {
  return points.length >= 3
}

// Polígono livre (clique por vértice, fecha no duplo clique) — mesmo fluxo de
// buildRegionFromPoints, mas produzindo um Drawing em vez de uma Region.
export function buildPolygonDrawing(id: string, points: Point[], color: string, width: number, filled: boolean, fillAlpha: number): Drawing {
  return { id, kind: 'polygon', points, color, width, filled, fillAlpha }
}

export function isValidCurveDraft(points: Point[]): boolean {
  return points.length >= 2
}

export function buildCurveDrawing(id: string, rawPoints: Point[], color: string, width: number, cap?: DrawingCap, dash?: DrawingDash): Drawing {
  return {
    id,
    kind: 'curve',
    points: simplifyToControlPoints(rawPoints),
    color,
    width,
    ...(cap !== undefined ? { cap } : {}),
    ...(dash !== undefined && dash !== 'solid' ? { dash } : {}),
  }
}

// Leitura B do pedido do usuário ("dobrar essa linha") — caminho mais barato
// encontrado: reaproveitar a Curva já existente (edição de vértice/inserção de
// ponto médio pronta em mapStore.ts: insertCurvePoint/updateCurvePoint) em vez
// de inventar edição de ponto de controle nova para `line`. Preserva id/cor/
// espessura/cap; os dois extremos viram os dois pontos de controle da curva —
// sozinhos ainda desenham reta (catmullRomToBezierSegments de 2 pontos não tem
// pra onde curvar), é arrastar o midpoint que a Curva já expõe (drawDrawings.ts
// desenha o midpoint vazado só quando selecionada, PixiCanvas.tsx:719 já trata
// esse gesto) que efetivamente "dobra" — ver CONTRATO. Não-`line` retorna o
// MESMO objeto (===), sem cópia: chamador não precisa checar o kind antes de
// chamar, e o caso "nada a converter" não aloca nem perde identidade.
export function convertLineToCurve(drawing: Drawing): Drawing {
  if (drawing.kind !== 'line') return drawing
  const points: Point[] = [{ x: drawing.x1, y: drawing.y1 }, { x: drawing.x2, y: drawing.y2 }]
  return {
    id: drawing.id,
    kind: 'curve',
    points,
    color: drawing.color,
    width: drawing.width,
    ...(drawing.cap !== undefined ? { cap: drawing.cap } : {}),
    // Dobrar a linha não pode trocar o estilo do traço: uma passagem secreta
    // continua pontilhada depois de virar curva.
    ...(drawing.dash !== undefined ? { dash: drawing.dash } : {}),
  }
}

// Sentido inverso de convertLineToCurve (Fase 4, Agente B — CONTRATO item 2:
// "entregue se for barata e sem perda destrutiva surpreendente"). SÓ é segura
// quando a curve tem EXATAMENTE 2 pontos de controle (os dois extremos, sem
// nenhum midpoint jamais inserido — ver PixiCanvas.tsx:719, insertCurvePoint):
// nesse caso os 2 pontos SÃO literalmente x1,y1/x2,y2, zero perda. Uma curve
// com 3+ pontos (usuário já arrastou o midpoint pelo menos uma vez) SEMPRE
// perderia os pontos intermediários virando line — por isso o retorno é a
// MESMA referência (no-op), no mesmo padrão do caso "não é line" acima:
// destruir dado em silêncio é proibido, e uma função pura não tem como avisar
// o usuário — quem decide avisar/desabilitar é a UI (LineShapeControls só
// oferece "Reta" quando `curve.points.length === 2`, ver CONTRATO).
export function convertCurveToLine(drawing: Drawing): Drawing {
  if (drawing.kind !== 'curve') return drawing
  if (drawing.points.length !== 2) return drawing
  const [p1, p2] = drawing.points
  return {
    id: drawing.id,
    kind: 'line',
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
    color: drawing.color,
    width: drawing.width,
    ...(drawing.cap !== undefined ? { cap: drawing.cap } : {}),
    ...(drawing.dash !== undefined ? { dash: drawing.dash } : {}),
  }
}

/**
 * Largura padrão do Caminho, em CÉLULAS da grade. Uma célula é a largura de
 * passagem de uma figura no tabuleiro: é a trilha por onde se anda, não um
 * risco de caneta.
 */
export const DEFAULT_PATH_WIDTH_CELLS = 1

/** Faixa que o painel oferece — meia célula é uma vereda, quatro é uma estrada. */
export const MIN_PATH_WIDTH_CELLS = 0.5
export const MAX_PATH_WIDTH_CELLS = 4

/**
 * Prende a largura na faixa oferecida e descarta lixo (`NaN`, vindo de um
 * campo vazio ou de um mapa adulterado): largura zero desenharia um caminho
 * invisível, e a pessoa acharia que a ferramenta não funciona.
 */
export function clampPathWidthCells(widthCells: number): number {
  if (!Number.isFinite(widthCells)) return DEFAULT_PATH_WIDTH_CELLS
  return Math.min(MAX_PATH_WIDTH_CELLS, Math.max(MIN_PATH_WIDTH_CELLS, widthCells))
}

/** Dois pontos distintos já são um caminho; um ponto só não leva a lugar nenhum. */
export function isValidPathDraft(points: Point[]): boolean {
  return points.length >= 2
}

/**
 * Caminho com cor PRÓPRIA (fatia 3 do plano): os pontos vêm clicados um a um,
 * a cor e a largura vêm da preferência da ferramenta lida ANTES do primeiro
 * ponto (`pathColor`/`pathWidthCells` no mapStore) — é isso que separa "um
 * caminho de terra e outro de pedra" de "a cor do chão", que vale para o mapa
 * inteiro.
 *
 * `widthCells` × `gridSize` = espessura em px de mundo, congelada no objeto:
 * mudar a grade do mapa depois não reescreve caminho já traçado.
 */
export function buildPathDrawing(id: string, points: Point[], color: string, widthCells: number, gridSize: number): Drawing {
  return {
    id,
    kind: 'path',
    points: points.map((point) => ({ x: point.x, y: point.y })),
    color,
    width: widthCells * gridSize,
  }
}

export function isValidTextDraft(): boolean {
  return true
}

// Mesmo default do PIXI.TextStyle (ver drawTextLabels.ts e o fallback de
// leitura em App.tsx) — mantém a aparência de rótulo já existente antes
// deste campo existir.
export const DEFAULT_TEXT_FONT_FAMILY = 'Arial'

export function buildTextDrawing(id: string, point: Point, color: string, fontSize: number, fontFamily = DEFAULT_TEXT_FONT_FAMILY): Drawing {
  return { id, kind: 'text', x: point.x, y: point.y, text: 'Rótulo', color, fontSize, fontFamily }
}
