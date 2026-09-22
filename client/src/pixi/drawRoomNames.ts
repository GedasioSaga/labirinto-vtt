import { Container, Graphics, Text } from 'pixi.js'
import type { Region, RegionPoint } from '../types/map'
import { pointInPolygonInclusive } from '../lib/roomNesting'
import { roomCentroid } from '../lib/roomRotation'
import { screenLabelSizing } from './screenLabel'

export interface RoomNamesRenderer {
  /** `cameraScale` omitido mantém o último zoom informado. */
  draw: (container: Container, regions: Region[], grid: number, cameraScale?: number) => void
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

interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
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

/** Salas desenhadas DENTRO desta: a hierarquia já existe no dado
 *  (`Region.parentId`, escrita por lib/roomNesting.ts ao criar a sala), então
 *  não há por que redescobri-la por geometria. Neta não entra na conta: ela
 *  está dentro de uma filha, que já é obstáculo. */
export function childRoomsOf(regions: readonly Region[], parentId: string): Region[] {
  return regions.filter((r) => r.parentId === parentId && r.points.length >= 3)
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
 *
 * A busca varre uma grade de candidatos dentro da caixa da sala e prefere, em
 * ordem: (1) o rótulo INTEIRO dentro do polígono e fora das filhas; (2) só o
 * centro dentro do polígono e o rótulo fora das filhas — é o que salva um nome
 * comprido numa faixa estreita, onde nenhuma posição comporta a caixa toda.
 * Empate de distância fica com o primeiro da varredura, que é sempre a mesma:
 * o resultado é determinístico.
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
  const blocked: Box[] = []
  for (const child of children) {
    const box = boundsOfPoints(child.points)
    if (box) blocked.push(box)
  }
  const hitsChild = (x: number, y: number) => blocked.some((box) => overlapsBox(x, y, half, box))
  if (blocked.length === 0 || !hitsChild(anchor.x, anchor.y)) return anchor

  const area = boundsOfPoints(points)
  if (!area || points.length < 3) return anchor

  let best: { x: number; y: number } | null = null
  let bestDistance = Infinity
  let fallback: { x: number; y: number } | null = null
  let fallbackDistance = Infinity

  for (let iy = 0; iy <= LABEL_SEARCH_STEPS; iy++) {
    const y = area.minY + ((area.maxY - area.minY) * iy) / LABEL_SEARCH_STEPS
    for (let ix = 0; ix <= LABEL_SEARCH_STEPS; ix++) {
      const x = area.minX + ((area.maxX - area.minX) * ix) / LABEL_SEARCH_STEPS
      if (hitsChild(x, y)) continue
      if (!pointInPolygonInclusive({ x, y }, points)) continue
      const distance = (x - anchor.x) ** 2 + (y - anchor.y) ** 2
      const wholeLabelInside =
        pointInPolygonInclusive({ x: x - half.halfWidth, y: y - half.halfHeight }, points) &&
        pointInPolygonInclusive({ x: x + half.halfWidth, y: y - half.halfHeight }, points) &&
        pointInPolygonInclusive({ x: x + half.halfWidth, y: y + half.halfHeight }, points) &&
        pointInPolygonInclusive({ x: x - half.halfWidth, y: y + half.halfHeight }, points)
      if (wholeLabelInside) {
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

  return best ?? fallback ?? anchor
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

/** Retângulo (mundo) aproximado do rótulo de uma Sala; `null` sem nome ou
 *  com o nome escondido pelo zoom. `cameraScale` acompanha a escala de tela
 *  mínima do rótulo (screenLabel.ts). `regions` (a cena inteira) faz a caixa
 *  acompanhar o desvio das salas filhas — sem ela, o clique cairia no
 *  centróide cru e não no rótulo que está na tela. */
export function roomLabelBounds(
  region: Region,
  grid: number,
  cameraScale = 1,
  regions: readonly Region[] = [],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const name = region.room?.name.trim() ?? ''
  if (name === '') return null
  const sizing = screenLabelSizing(roomLabelFontSize(grid), cameraScale)
  if (!sizing.visible) return null
  const fontSize = roomLabelFontSize(grid) * sizing.scale
  const center = roomLabelPositionAvoidingChildren(region, regions, grid)
  const { halfWidth, halfHeight } = labelHalfExtents(name, fontSize)
  return { minX: center.x - halfWidth, minY: center.y - halfHeight, maxX: center.x + halfWidth, maxY: center.y + halfHeight }
}

/** Sala cujo rótulo contém o ponto. Percorre de trás para a frente porque a
 * região desenhada por último fica por cima. */
export function findRoomLabelAt(regions: Region[], point: { x: number; y: number }, grid: number, cameraScale = 1): Region | null {
  for (let i = regions.length - 1; i >= 0; i--) {
    const bounds = roomLabelBounds(regions[i], grid, cameraScale, regions)
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

/** Cache de Text e da plaquinha por id, fechado por closure (instanciar uma vez
 * por mount). NUNCA destrói Text durante a sessão: Text destruído antes de
 * renderizar derruba o Pixi 8.20 em TexturePool.returnTexture (ver PlayerView.tsx).
 * Região que some ou perde o nome só fica invisível; tudo morre no app.destroy. */
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

  function setCameraScale(cameraScale: number): void {
    lastCameraScale = cameraScale
    for (const id of namedIds) applySizing(id, lastFontSize)
  }

  function draw(container: Container, regions: Region[], grid: number, cameraScale?: number): void {
    if (cameraScale !== undefined) lastCameraScale = cameraScale
    const named = regions.filter((r) => r.room !== undefined && r.room.name.trim() !== '')
    namedIds = new Set(named.map((r) => r.id))
    for (const [id, textObj] of cache) {
      if (!namedIds.has(id)) textObj.visible = false
    }
    for (const [id, plate] of plateCache) {
      if (!namedIds.has(id)) plate.visible = false
    }

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
      const position = roomLabelPositionAvoidingChildren(region, regions, grid)
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
