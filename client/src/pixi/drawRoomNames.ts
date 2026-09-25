import { Container, Graphics, Text } from 'pixi.js'
import type { Region, RegionPoint } from '../types/map'
import { pointInPolygonInclusive } from '../lib/roomNesting'
import { roomCentroid } from '../lib/roomRotation'
import { screenLabelSizing } from './screenLabel'

export interface RoomNamesRenderer {
  /**
   * `cameraScale` omitido mantém o último zoom informado. `tokens`: o que as
   * fichas ocupam no mapa (`tokenLabelObstacles`) — o nome sai de baixo delas.
   * Omitido = nenhuma ficha, que é o editor do mestre.
   */
  draw: (container: Container, regions: Region[], grid: number, cameraScale?: number, tokens?: readonly LabelObstacle[]) => void
  /** Só o zoom mudou: reescala e mostra/esconde os nomes sem re-rasterizar. */
  setCameraScale: (cameraScale: number) => void
}

const FONT_SIZE_PER_GRID = 0.3
const MIN_FONT_SIZE = 12
const MAX_FONT_SIZE = 28
/**
 * ETIQUETA EM PÍLULA — o nome da sala deixa de ser tinta solta sobre o chão.
 *
 * O desenho anterior era letra branca com um fio escuro em volta. Sobre chão
 * escuro lia bem; sobre chão claro (pedra, areia) o branco encostava no branco
 * e sobrava o fio de 1 px segurando a leitura — e a cor do chão é escolha do
 * mestre (`#lb-region-color`), então a legibilidade do nome dependia do gosto
 * dele. Agora o nome vem sobre uma plaquinha opaca: o que está atrás das
 * letras é SEMPRE a mesma coisa, em qualquer chão.
 *
 * Por que uma plaquinha CLARA num mapa escuro, e não a pílula escura de
 * costume: a plaqueta precisa se separar dos dois extremos de chão ao mesmo
 * tempo. Em luminância relativa da WCAG, um chão claro tipo `#efe6d2` marca
 * ~0,80 e um chão de cripta tipo `#1d2026` marca ~0,01 — qualquer tom escuro
 * some contra o segundo, e qualquer tom de pergaminho some contra o primeiro.
 * Sobra a faixa do meio. `0xc9c1ac` (pedra clara, quente, quase sem croma —
 * primo do bege de escada em `constants.ts`) marca ~0,54: fica a ~0,26 do chão
 * claro, a ~0,53 do escuro, e dá 10:1 com a tinta — três vezes o mínimo AA de
 * 4,5:1. Croma baixo de propósito: o latão (`--lb-color-brass`) continua sendo
 * o único acento do mapa, e a etiqueta não disputa a cena com ele.
 */
const LABEL_PLATE_COLOR = 0xc9c1ac
/** Tinta do nome sobre a plaquinha — o mesmo quase-preto do fundo do app
 *  (`--lb-color-ink`, theme.ts). Letra escura sobre pedra clara não precisa do
 *  contorno que segurava a letra branca: o fio some junto com o problema. */
const LABEL_FILL = 0x121214
/** Respiro dos lados da plaquinha, em múltiplos do tamanho da fonte. */
const PLATE_PAD_X_PER_FONT = 0.35
/** Altura da plaquinha: a linha de texto ocupa ~1,2 da fonte, o resto é respiro. */
const PLATE_HEIGHT_PER_FONT = 1.85
/**
 * Largura mínima da plaquinha. Nome curto ("Poço") não vira lozango atarracado:
 * todas as etiquetas do mapa guardam a mesma silhueta, e o alvo de arrasto do
 * nome (é a própria plaquinha, ver `labelHalfExtents`) nunca fica pequeno
 * demais para a mão — o critério 2.5.8 da WCAG 2.2 pede alvo de 24 px, e a
 * plaquinha passa folgada disso nos dois eixos.
 */
const PLATE_MIN_WIDTH_PER_FONT = 5.5
/** A5 — nome que os jogadores não veem: esmaecido e itálico só no editor
 *  (o jogador recebe `name = ''` e nem chega a desenhar). */
const HIDDEN_NAME_ALPHA = 0.5
/** Altura das LETRAS do nome, sem a folga da pílula, em múltiplos da fonte. */
const LABEL_TEXT_HEIGHT_PER_FONT = 1.2
/**
 * Folga entre o nome que subiu e a parede de cima (e entre ele e a ficha), em
 * múltiplos da fonte: a mesma dos lados da pílula. O traço da parede e a porta
 * desenhada nele continuam inteiros, sem a plaquinha encostar.
 */
const LABEL_EDGE_GAP_PER_FONT = PLATE_PAD_X_PER_FONT

/** Centróide por área (fórmula do shoelace). Para polígono côncavo (sala em L)
 * a média dos vértices puxa o rótulo para o lado com mais cantos; o centróide
 * de área não. Pontos degenerados (área ~0) caem na média simples.
 *
 * A conta mora em `lib/roomRotation.ts` porque é também o PIVÔ do giro da
 * sala: uma fonte só garante que o nome fica parado quando a sala gira. */
export function roomLabelAnchor(points: readonly RegionPoint[]): { x: number; y: number } {
  return roomCentroid(points)
}

export function roomLabelFontSize(grid: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, grid * FONT_SIZE_PER_GRID))
}

/** Onde o rótulo é desenhado: âncora da sala mais o deslocamento arrastado
 * pelo mestre. Editor e jogador chamam esta mesma função pelo renderer. */
export function roomLabelPosition(region: Region): { x: number; y: number } {
  const anchor = roomLabelAnchor(region.points)
  const offset = region.room?.labelOffset
  if (!offset) return anchor
  return { x: anchor.x + offset.x, y: anchor.y + offset.y }
}

// A largura real do Text só existe depois de rasterizar, e o hit-test roda
// fora do Pixi (pointerdown e duplo clique). Estimativa por caractere com
// folga: pegar um pouco além do texto é melhor que errar o clique.
const LABEL_CHAR_WIDTH_PER_FONT = 0.62

/** Largura do nome sem rasterizar — chute por caractere, sempre um pouco
 *  acima do real em texto latino, que é o lado certo de errar num alvo de
 *  clique. */
export function estimateRoomLabelTextWidth(name: string, fontSize: number): number {
  return Math.max(1, name.length) * fontSize * LABEL_CHAR_WIDTH_PER_FONT
}

export interface RoomLabelPlate {
  width: number
  height: number
  /** Metade da altura: canto totalmente arredondado, é pílula e não caixinha. */
  radius: number
}

/** A plaquinha que fica atrás do nome, em px de mundo, a partir da largura do
 *  texto (medida no Pixi quando dá, estimada quando não dá). */
export function roomLabelPlateSize(textWidth: number, fontSize: number): RoomLabelPlate {
  const height = fontSize * PLATE_HEIGHT_PER_FONT
  const width = Math.max(textWidth + 2 * fontSize * PLATE_PAD_X_PER_FONT, fontSize * PLATE_MIN_WIDTH_PER_FONT)
  return { width, height, radius: height / 2 }
}

interface LabelHalfExtents {
  halfWidth: number
  halfHeight: number
}

/**
 * Meia-largura e meia-altura do alvo de clique do rótulo — que é exatamente a
 * plaquinha desenhada: o que o mestre vê é o que ele pega para arrastar ou
 * renomear. Aqui a largura do texto vem da estimativa, porque hit-test roda
 * fora do Pixi; como a estimativa fica acima do real, o alvo cobre a pílula.
 */
function labelHalfExtents(name: string, fontSize: number): LabelHalfExtents {
  const plate = roomLabelPlateSize(estimateRoomLabelTextWidth(name, fontSize), fontSize)
  return { halfWidth: plate.width / 2, halfHeight: plate.height / 2 }
}

/** Só as letras do nome, sem a folga da pílula: é ficha em cima DELAS que tira o nome do lugar. */
function labelTextHalfExtents(name: string, fontSize: number): LabelHalfExtents {
  return { halfWidth: estimateRoomLabelTextWidth(name, fontSize) / 2, halfHeight: (fontSize * LABEL_TEXT_HEIGHT_PER_FONT) / 2 }
}

function grown(half: LabelHalfExtents, by: number): LabelHalfExtents {
  return { halfWidth: half.halfWidth + by, halfHeight: half.halfHeight + by }
}

interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * O que o nome de uma sala não pode ficar embaixo, em px de mundo: hoje, o que
 * uma ficha ocupa no mapa (`tokenLabelObstacles`).
 */
export type LabelObstacle = Box

/** Uma ficha como ela aparece no mapa, na régua de que o nome da sala precisa. */
export interface TokenOnMap {
  x: number
  y: number
  /** Raio do disco desenhado, em px de mundo. */
  radius: number
  name: string
  /** Fonte do nome da ficha, em px de mundo (sem a compensação de zoom). */
  nameFontSize: number
  /** Faixa vertical do nome, contada do centro da ficha para baixo, em px de mundo. */
  nameTop: number
  nameBottom: number
}

/**
 * O que uma ficha ocupa no mapa: o disco e a faixa do nome embaixo dele. A
 * largura do nome é a mesma estimativa por caractere do nome da sala, que erra
 * sobrando — o lado certo de errar num obstáculo. Ficha sem nome é só o disco.
 */
export function tokenLabelObstacles(token: TokenOnMap): LabelObstacle[] {
  const disc = { minX: token.x - token.radius, minY: token.y - token.radius, maxX: token.x + token.radius, maxY: token.y + token.radius }
  if (token.name.trim() === '') return [disc]
  const halfName = estimateRoomLabelTextWidth(token.name, token.nameFontSize) / 2
  return [disc, { minX: token.x - halfName, minY: token.y + token.nameTop, maxX: token.x + halfName, maxY: token.y + token.nameBottom }]
}

function boundsOfPoints(points: readonly RegionPoint[]): Box | null {
  if (points.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/** Filhas de cada sala, pela chave `parentId` da filha. */
type ChildRoomIndex = ReadonlyMap<string, readonly Region[]>

const NO_CHILDREN: readonly Region[] = []

/**
 * Índice das filhas, montado UMA vez por cena e reaproveitado. Varrer a cena
 * inteira para cada sala nomeada custava N² por redesenho — na cidade-torre
 * (2.828 salas) era a maior parte do custo de selecionar, arrastar e trocar de
 * cena.
 *
 * A chave do cache é a IDENTIDADE do array: o estado do mapa é imutável
 * (zustand; nenhum código faz push/splice em `regions` nem reescreve
 * `parentId`/`points` no lugar), então mudou a sala, mudou o array, e o índice
 * é refeito. Redesenho que não mexeu nas salas (seleção, zoom) reusa o mesmo.
 * WeakMap: cena velha some da memória junto com o array.
 */
const childIndexCache = new WeakMap<readonly Region[], ChildRoomIndex>()

function childRoomIndex(regions: readonly Region[]): ChildRoomIndex {
  const cached = childIndexCache.get(regions)
  if (cached) return cached
  const index = new Map<string, Region[]>()
  for (const region of regions) {
    const parentId = region.parentId
    if (parentId === undefined || region.points.length < 3) continue
    const siblings = index.get(parentId)
    if (siblings) siblings.push(region)
    else index.set(parentId, [region])
  }
  childIndexCache.set(regions, index)
  return index
}

/** Salas desenhadas DENTRO desta: a hierarquia já existe no dado
 *  (`Region.parentId`, escrita por lib/roomNesting.ts ao criar a sala), então
 *  não há por que redescobri-la por geometria. Neta não entra na conta: ela
 *  está dentro de uma filha, que já é obstáculo. Polígono com menos de 3
 *  pontos não esconde nada e fica de fora. */
export function childRoomsOf(regions: readonly Region[], parentId: string): readonly Region[] {
  return childRoomIndex(regions).get(parentId) ?? NO_CHILDREN
}

/** Quantos passos a busca dá em cada eixo da caixa da sala. 16 passos = 17×17
 *  candidatos: fino o bastante para achar a folga ao lado de uma sala filha e
 *  barato o bastante para rodar a cada redesenho. */
const LABEL_SEARCH_STEPS = 16

function overlapsBox(x: number, y: number, half: LabelHalfExtents, box: Box): boolean {
  return (
    x - half.halfWidth < box.maxX &&
    x + half.halfWidth > box.minX &&
    y - half.halfHeight < box.maxY &&
    y + half.halfHeight > box.minY
  )
}

/**
 * Ponto mais próximo do centróide em que o retângulo do rótulo NÃO cai sobre
 * nenhuma sala filha. Devolve o próprio centróide quando ele já está livre (o
 * caso de toda sala sem filha) ou quando a sala está tão tomada pelas filhas
 * que não sobra lugar nenhum — preferível a jogar o nome para fora da sala.
 * A busca é a de `nearestFreeLabelPoint`, com as filhas como obstáculo.
 *
 * Obstáculo é a CAIXA da filha, não o polígono dela: para uma filha redonda a
 * caixa é maior que a sala, e errar sobrando é o lado certo de errar aqui.
 */
function freeRoomLabelAnchor(
  points: readonly RegionPoint[],
  children: readonly Region[],
  half: LabelHalfExtents,
): { x: number; y: number } {
  const anchor = roomLabelAnchor(points)
  const blocked = boxesOf(children)
  if (blocked.length === 0 || !blocked.some((box) => overlapsBox(anchor.x, anchor.y, half, box))) return anchor
  return nearestFreeLabelPoint(points, blocked, half, anchor) ?? anchor
}

function boxesOf(regions: readonly Region[]): Box[] {
  const boxes: Box[] = []
  for (const region of regions) {
    const box = boundsOfPoints(region.points)
    if (box) boxes.push(box)
  }
  return boxes
}

/** A plaquinha inteira em (`x`, `y`) cabe no polígono (os quatro cantos dentro, borda inclusive). */
function wholeLabelInside(x: number, y: number, half: LabelHalfExtents, points: readonly RegionPoint[]): boolean {
  return (
    pointInPolygonInclusive({ x: x - half.halfWidth, y: y - half.halfHeight }, points) &&
    pointInPolygonInclusive({ x: x + half.halfWidth, y: y - half.halfHeight }, points) &&
    pointInPolygonInclusive({ x: x + half.halfWidth, y: y + half.halfHeight }, points) &&
    pointInPolygonInclusive({ x: x - half.halfWidth, y: y + half.halfHeight }, points)
  )
}

/**
 * O candidato mais perto de `target`, numa grade dentro da caixa da sala, em
 * que a plaquinha (mais `clearance` de cada lado) não cai sobre nada de
 * `blocked`. Prefere, em ordem: (1) a plaquinha INTEIRA dentro do polígono;
 * (2) só o centro dentro — é o que salva um nome comprido numa faixa estreita,
 * onde nenhuma posição comporta a caixa toda. Empate de distância fica com o
 * primeiro da varredura, que é sempre a mesma: o resultado é determinístico.
 * `null` = nenhum lugar livre.
 */
function nearestFreeLabelPoint(
  points: readonly RegionPoint[],
  blocked: readonly Box[],
  half: LabelHalfExtents,
  target: { x: number; y: number },
  clearance = 0,
): { x: number; y: number } | null {
  const area = boundsOfPoints(points)
  if (!area || points.length < 3) return null
  const reach = grown(half, clearance)

  let best: { x: number; y: number } | null = null
  let bestDistance = Infinity
  let fallback: { x: number; y: number } | null = null
  let fallbackDistance = Infinity

  for (let iy = 0; iy <= LABEL_SEARCH_STEPS; iy++) {
    const y = area.minY + ((area.maxY - area.minY) * iy) / LABEL_SEARCH_STEPS
    for (let ix = 0; ix <= LABEL_SEARCH_STEPS; ix++) {
      const x = area.minX + ((area.maxX - area.minX) * ix) / LABEL_SEARCH_STEPS
      if (blocked.some((box) => overlapsBox(x, y, reach, box))) continue
      if (!pointInPolygonInclusive({ x, y }, points)) continue
      const distance = (x - target.x) ** 2 + (y - target.y) ** 2
      if (wholeLabelInside(x, y, half, points)) {
        if (distance < bestDistance) {
          best = { x, y }
          bestDistance = distance
        }
      } else if (distance < fallbackDistance) {
        fallback = { x, y }
        fallbackDistance = distance
      }
    }
  }

  return best ?? fallback
}

/**
 * Onde o nome fica encostado na parede de CIMA, na coluna `x`: o topo do
 * trecho de chão que a vertical por `x` atravessa na altura `nearY` (numa sala
 * em U a vertical cruza dois trechos), mais a folga e meia plaquinha. `null`
 * quando a vertical não entra na sala ou o trecho é baixo demais para a
 * plaquinha.
 */
function topEdgeLabelPoint(
  points: readonly RegionPoint[],
  x: number,
  nearY: number,
  half: LabelHalfExtents,
  gap: number,
): { x: number; y: number } | null {
  const crossings: number[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    // Meio-aberto: o vértice que cai bem na vertical conta uma vez só, e a aresta em pé não conta.
    if ((a.x <= x && x < b.x) || (b.x <= x && x < a.x)) crossings.push(a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x))
  }
  crossings.sort((p, q) => p - q)
  let span: { top: number; bottom: number } | null = null
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const segment = { top: crossings[i], bottom: crossings[i + 1] }
    if (span === null) span = segment
    if (segment.top <= nearY && nearY <= segment.bottom) {
      span = segment
      break
    }
  }
  if (span === null) return null
  const y = span.top + gap + half.halfHeight
  return y + half.halfHeight <= span.bottom ? { x, y } : null
}

/**
 * Onde o rótulo é desenhado quando se sabe quem são as vizinhas: igual a
 * `roomLabelPosition`, mas desviando das salas filhas.
 *
 * O desvio vale SÓ enquanto o mestre não arrastou o nome: com `labelOffset` na
 * mão, quem manda é ele, e o rótulo fica exatamente onde foi solto (é também o
 * que mantém o arrasto coerente — PixiCanvas.tsx:1389 calcula o offset a
 * partir do centróide cru).
 *
 * O tamanho da fonte usado para escolher o lugar é o do grid, SEM a compensação
 * de zoom (screenLabel.ts): assim o rótulo não sai andando enquanto o mestre
 * dá zoom.
 */
export function roomLabelPositionAvoidingChildren(
  region: Region,
  regions: readonly Region[],
  grid: number,
): { x: number; y: number } {
  if (region.room?.labelOffset) return roomLabelPosition(region)
  const name = region.room?.name.trim() ?? ''
  if (name === '') return roomLabelAnchor(region.points)
  const children = childRoomsOf(regions, region.id)
  if (children.length === 0) return roomLabelAnchor(region.points)
  return freeRoomLabelAnchor(region.points, children, labelHalfExtents(name, roomLabelFontSize(grid)))
}

/**
 * FICHA EM CIMA DO NOME (simulação de 7 jogadores, cenário vila*). A camada
 * das fichas é desenhada por cima da dos nomes: o Ladino parado no meio do
 * Quarto do Prefeito tapava "Quarto do Prefeito", que sobrava como um borrão
 * dos dois lados do disco. Quando uma ficha cai sobre as LETRAS do nome, ele
 * sobe para a borda de cima da sala, por dentro da parede e na mesma coluna;
 * se lá também houver ficha (ou uma sala filha), vai para o lugar livre mais
 * perto dessa borda. Ficha só encostada na folga da pílula não mexe no nome:
 * ele pular por um pixel de sobra incomodaria mais do que o pixel.
 *
 * O nome arrastado pelo mestre (`labelOffset`) fica onde ele soltou. Sem
 * fichas é exatamente `roomLabelPositionAvoidingChildren` — o editor do mestre
 * não passa fichas, e lá nada muda. A régua é a do grid, sem a compensação de
 * zoom, pelo mesmo motivo de lá: o nome não anda enquanto se dá zoom.
 */
export function roomLabelPositionAvoidingTokens(
  region: Region,
  regions: readonly Region[],
  grid: number,
  tokens: readonly LabelObstacle[],
): { x: number; y: number } {
  const base = roomLabelPositionAvoidingChildren(region, regions, grid)
  if (tokens.length === 0 || region.room?.labelOffset) return base
  const name = region.room?.name.trim() ?? ''
  if (name === '' || region.points.length < 3) return base
  const fontSize = roomLabelFontSize(grid)
  const letters = labelTextHalfExtents(name, fontSize)
  if (!tokens.some((box) => overlapsBox(base.x, base.y, letters, box))) return base

  const half = labelHalfExtents(name, fontSize)
  const gap = fontSize * LABEL_EDGE_GAP_PER_FONT
  const blocked = [...boxesOf(childRoomsOf(regions, region.id)), ...tokens]
  const top = topEdgeLabelPoint(region.points, base.x, base.y, half, gap)
  const reach = grown(half, gap)
  if (top !== null && wholeLabelInside(top.x, top.y, half, region.points) && !blocked.some((box) => overlapsBox(top.x, top.y, reach, box))) {
    return top
  }
  return nearestFreeLabelPoint(region.points, blocked, half, top ?? base, gap) ?? top ?? base
}

/** Retângulo (mundo) aproximado do rótulo de uma Sala; `null` sem nome ou
 *  com o nome escondido pelo zoom. `cameraScale` acompanha a escala de tela
 *  mínima do rótulo (screenLabel.ts). `regions` (a cena inteira) faz a caixa
 *  acompanhar o desvio das salas filhas, e `tokens` o desvio das fichas —
 *  sem eles, o toque cairia onde o nome estaria, e não no rótulo que está na
 *  tela. */
export function roomLabelBounds(
  region: Region,
  grid: number,
  cameraScale = 1,
  regions: readonly Region[] = [],
  tokens: readonly LabelObstacle[] = [],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const name = region.room?.name.trim() ?? ''
  if (name === '') return null
  const sizing = screenLabelSizing(roomLabelFontSize(grid), cameraScale)
  if (!sizing.visible) return null
  const fontSize = roomLabelFontSize(grid) * sizing.scale
  const center = roomLabelPositionAvoidingTokens(region, regions, grid, tokens)
  const { halfWidth, halfHeight } = labelHalfExtents(name, fontSize)
  return { minX: center.x - halfWidth, minY: center.y - halfHeight, maxX: center.x + halfWidth, maxY: center.y + halfHeight }
}

/** Sala cujo rótulo contém o ponto. Percorre de trás para a frente porque a
 * região desenhada por último fica por cima. `tokens`: as mesmas fichas que o
 * desenho recebeu — o toque acha o nome onde ele está na tela. */
export function findRoomLabelAt(
  regions: Region[],
  point: { x: number; y: number },
  grid: number,
  cameraScale = 1,
  tokens: readonly LabelObstacle[] = [],
): Region | null {
  for (let i = regions.length - 1; i >= 0; i--) {
    const bounds = roomLabelBounds(regions[i], grid, cameraScale, regions, tokens)
    if (bounds && point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY) {
      return regions[i]
    }
  }
  return null
}

/**
 * Largura que o texto REALMENTE ocupa depois de rasterizado. Só o Pixi sabe,
 * e só onde existe canvas 2D: no jsdom dos testes de unidade tanto
 * `getLocalBounds()` quanto `.width` estouram (medido em 21/09/2026), então o
 * chamador cai na estimativa por caractere. `null` = não deu para medir.
 */
function measuredTextWidth(textObj: Text): number | null {
  try {
    const width = textObj.getLocalBounds().width
    return Number.isFinite(width) && width > 0 ? width : null
  } catch {
    return null
  }
}

/**
 * Cache de Text e da plaquinha por id, fechado por closure (instanciar uma vez
 * por mount).
 *
 * Região que some do `draw` — trocou de cena, perdeu o nome, foi apagada —
 * tem o Text e a plaquinha DESTRUÍDOS, não só escondidos. Escondendo, cada cena
 * visitada deixava os seus objetos (e a textura rasterizada de cada nome) vivos
 * até fechar o app: 60 MB viravam 197 MB em 5 trocas na torre (HANDOFF.md).
 *
 * Por que isto não cai no crash de `TexturePool.returnTexture` que fez o resto
 * do projeto nunca destruir Text (PlayerView.tsx, drawPins.ts): o objeto sai do
 * container ANTES do destroy. No Pixi 8.20, tirar o filho zera o
 * `parentRenderGroup` dele e marca `structureDidChange` no grupo
 * (RenderGroup.removeChild); com isso (1) o `unload` que o destroy emite não
 * tem grupo onde se reenfileirar (ViewContainer.unload → onViewUpdate) e (2)
 * uma atualização que já estava na fila é descartada sem ser processada
 * (RenderGroupSystem._updateRenderGroups → clearList). A textura do nome volta
 * ao pool pela contagem de referência do CanvasTextPipe (onTextUnload) — o
 * mesmo caminho de um Text que o GC do Pixi descarrega. O que esvaziava o pool
 * GLOBAL era `app.destroy(true)` com Text de outro app vivo; não é mais usado.
 */
export function createRoomNamesRenderer(): RoomNamesRenderer {
  const cache = new Map<string, Text>()
  const plateCache = new Map<string, Graphics>()
  const styledKey = new Map<string, string>()
  const plateKey = new Map<string, string>()
  /** Nomes desenhados no último `draw` (os demais ficam invisíveis). */
  let namedIds = new Set<string>()
  let lastFontSize = roomLabelFontSize(0)
  let lastCameraScale = 1

  function applySizing(id: string, fontSize: number): void {
    const sizing = screenLabelSizing(fontSize, lastCameraScale)
    const textObj = cache.get(id)
    if (textObj) {
      textObj.scale.set(sizing.scale)
      textObj.visible = sizing.visible
    }
    const plate = plateCache.get(id)
    if (plate) {
      plate.scale.set(sizing.scale)
      plate.visible = sizing.visible
    }
  }

  /** Destrói o Text e a plaquinha de toda sala fora de `keep`: tira do
   *  container e só então destrói (ver o cabeçalho sobre o pool de texturas). */
  function forgetRoomsOutside(keep: ReadonlySet<string>): void {
    for (const [id, textObj] of cache) {
      if (keep.has(id)) continue
      textObj.removeFromParent()
      textObj.destroy()
      cache.delete(id)
      styledKey.delete(id)
    }
    for (const [id, plate] of plateCache) {
      if (keep.has(id)) continue
      plate.removeFromParent()
      plate.destroy()
      plateCache.delete(id)
      plateKey.delete(id)
    }
  }

  function setCameraScale(cameraScale: number): void {
    lastCameraScale = cameraScale
    for (const id of namedIds) applySizing(id, lastFontSize)
  }

  function draw(container: Container, regions: Region[], grid: number, cameraScale?: number, tokens: readonly LabelObstacle[] = []): void {
    if (cameraScale !== undefined) lastCameraScale = cameraScale
    const named = regions.filter((r) => r.room !== undefined && r.room.name.trim() !== '')
    namedIds = new Set(named.map((r) => r.id))
    forgetRoomsOutside(namedIds)

    const fontSize = roomLabelFontSize(grid)
    lastFontSize = fontSize
    for (const region of named) {
      let textObj = cache.get(region.id)
      if (!textObj) {
        textObj = new Text()
        textObj.anchor.set(0.5)
        cache.set(region.id, textObj)
      }
      let plate = plateCache.get(region.id)
      if (!plate) {
        plate = new Graphics()
        plateCache.set(region.id, plate)
      }
      // Container pode ter sido trocado entre redraws; addChild reparenta sem duplicar.
      if (plate.parent !== container) container.addChild(plate)
      if (textObj.parent !== container) container.addChild(textObj)
      // `regions` (a cena toda, não só as nomeadas): o desvio precisa enxergar
      // a sala filha mesmo quando ela ainda não tem nome.
      const position = roomLabelPositionAvoidingTokens(region, regions, grid, tokens)
      textObj.text = region.room?.name ?? ''
      textObj.position.set(position.x, position.y)
      // redrawShapes dispara a cada mudança do mapa; recriar o estilo toda vez
      // força o Pixi a re-rasterizar o texto mesmo sem nada ter mudado.
      // Compara com o último estilo aplicado, não com style.fontSize: o default
      // do Pixi (26) coincide com grid ~86,7 e o nome nasceria com o tamanho
      // errado sem nunca ser corrigido.
      const hiddenFromPlayers = !!region.room?.nameHiddenFromPlayers
      const key = `${fontSize}|${hiddenFromPlayers}`
      if (styledKey.get(region.id) !== key) {
        styledKey.set(region.id, key)
        textObj.style = {
          fontSize,
          fontStyle: hiddenFromPlayers ? 'italic' : 'normal',
          fill: LABEL_FILL,
          align: 'center',
        }
      }

      // A plaquinha nasce do texto que ela carrega: medida quando o Pixi
      // consegue medir, estimada quando não (teste de unidade roda em jsdom,
      // que não tem canvas 2D — medir ali estoura, sonda de 21/09/2026).
      // Redesenhar só quando o tamanho muda: `draw` roda a cada mexida no mapa.
      const size = roomLabelPlateSize(measuredTextWidth(textObj) ?? estimateRoomLabelTextWidth(textObj.text, fontSize), fontSize)
      const plateShape = `${size.width}|${size.height}`
      if (plateKey.get(region.id) !== plateShape) {
        plateKey.set(region.id, plateShape)
        plate.clear()
        plate.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, size.radius).fill({ color: LABEL_PLATE_COLOR })
      }
      plate.position.set(position.x, position.y)

      const alpha = hiddenFromPlayers ? HIDDEN_NAME_ALPHA : 1
      textObj.alpha = alpha
      plate.alpha = alpha
      applySizing(region.id, fontSize)
    }

    // Toda plaquinha desce para o fundo do container: com duas salas coladas,
    // a etiqueta de uma não pode tapar o nome da outra.
    let index = 0
    for (const region of named) {
      const plate = plateCache.get(region.id)
      if (plate && plate.parent === container) container.setChildIndex(plate, index++)
    }
  }

  return { draw, setCameraScale }
}
