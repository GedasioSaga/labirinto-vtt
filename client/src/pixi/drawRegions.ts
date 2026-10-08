import { Color, Container, Graphics } from 'pixi.js'
import type { Region, RegionPoint, Wall } from '../types/map'
import type { Selection } from '../types/tools'
import { isDegenerateRegion } from './shapes'
import { SECRET_ITEM_ALPHA, SELECTION_COLOR } from './constants'
import { resolveCameraScale, selectionOutlineWidth } from './drawWalls'
import { roomHasRoof } from '../lib/roomOps'
import { readRegionSplit, splitSecondPart } from '../lib/regionSplit'

/**
 * TETO DE CONSTRUÇÃO — marca do telhado NO EDITOR. O mestre vê tudo, sempre
 * (é promessa da feature), então a sala de teto ligado não pode ser escondida
 * dele: o que ele ganha é um segundo contorno POR DENTRO, no tom do telhado
 * que o jogador vê em `player/PlayerView.tsx`, dizendo "daqui o jogador só vê
 * a silhueta". Por dentro (`alignment: 1`) para não brigar com o contorno de
 * seleção, que é desenhado por fora.
 */
const ROOF_MARK_COLOR = 0x6e6055
const ROOF_MARK_WIDTH = 3

const HATCH_SPACING = 10
const HATCH_ANGLE = Math.PI / 4 // 45°
const HATCH_COLOR = 0x000000
const HATCH_ALPHA = 0.35
const HATCH_WIDTH = 2

/**
 * Espessura/junção do contorno da região — pedido do usuário (feedback F4,
 * agente G2): "eu quero que voce adicione as propriedades das paredes/sala
 * ... se eu quero poligono finos ou medios ou gordos, e as linhas dos
 * poligonos se eu quero eles arredondados ou retos, vou usar os poligonos
 * para criar ruas ou construcoes mais artesanais".
 *
 * `2` é o valor que este arquivo já hardcodava pra região não-selecionada
 * antes de `Region.strokeWidth` existir (ver `g.stroke({ width: isSelected
 * ? 4 : 2, color })` na versão anterior) — preserva mapa salvo sem o campo
 * abrindo com aparência idêntica. `'miter'` é o default do próprio Pixi
 * quando `join` não é passado no `stroke()` (StrokeAttributes.join,
 * `node_modules/pixi.js/lib/scene/graphics/shared/FillTypes.d.ts:282`,
 * `@default 'miter'`) — mesmo comportamento de hoje, sem migração.
 */
const REGION_STROKE_WIDTH_DEFAULT = 2
const REGION_STROKE_JOIN_DEFAULT: 'round' | 'miter' = 'miter'

/**
 * Lê `Region.strokeWidth` SEM depender do campo já existir em `types/map.ts`
 * (arquivo do integrador, fora do meu escopo nesta fase — ver CONTRATO no
 * relatório do agente). Mesmo truque de `readFreehandTexture`
 * (`lib/brushTexture.ts`, Fase 4 N1): o parâmetro pede só uma propriedade
 * opcional `?: unknown` — qualquer `Region` real (com ou sem o campo)
 * satisfaz esse tipo estruturalmente, então nenhum `as`/cast é necessário
 * aqui. O valor é validado em runtime: só um número finito positivo é aceito,
 * qualquer outra coisa (`undefined` de mapa legado incluído, ou um valor
 * corrompido) cai no default de hoje. Assim que o integrador adicionar o
 * campo real, esta função continua funcionando sem mudar nenhum chamador.
 *
 * `id?: unknown` no parâmetro não é usado pelo corpo da função — está ali só
 * pra dar ao tipo estrutural uma propriedade REAL em comum com `Region`
 * (`id: string`). Sem isso o TypeScript recusa a chamada com TS2559 ("has no
 * properties in common"): um tipo cujas propriedades são TODAS opcionais
 * conta como "weak type", e passar um `Region` que não compartilha NENHUMA
 * propriedade com ele é tratado como provável erro do chamador. `kind:
 * 'freehand'` cumpre esse papel em `readFreehandTexture`
 * (`lib/brushTexture.ts`) porque lá é obrigatório e a união `Drawing` já
 * particiona por `kind`; `Region` não tem `kind`, então `id` é o campo real
 * mais simples disponível.
 */
export function readRegionStrokeWidth(region: { id?: unknown; strokeWidth?: unknown }): number {
  const raw = region.strokeWidth
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : REGION_STROKE_WIDTH_DEFAULT
}

/** Mesmo truque de `readRegionStrokeWidth` (`id?: unknown` só pra escapar do
 *  TS2559 "weak type", ver comentário acima), para `Region.strokeJoin`. Só
 *  `'round'` é tratado como override explícito — qualquer outra coisa
 *  (`undefined`, `'miter'` literal, valor corrompido) cai no default `'miter'`,
 *  que é o comportamento de hoje. */
export function readRegionStrokeJoin(region: { id?: unknown; strokeJoin?: unknown }): 'round' | 'miter' {
  return region.strokeJoin === 'round' ? 'round' : REGION_STROKE_JOIN_DEFAULT
}

/**
 * ONDA 3 (PLANO-REFINAMENTO.md), item 22 — bug conhecido desde o dossiê da
 * Fase 4 (bug3): quando o SELECIONADO é a parede-dona-de-uma-Sala (uma
 * `Wall` com `regionId` apontando pra esta região — ver `types/map.ts`), a
 * região não pintava com `SELECTION_COLOR`. A causa era literal:
 * `createRegionsRenderer().draw()`, abaixo, só recebia o id da região quando
 * `selection.kind === 'region'` — nunca quando `selection.kind === 'wall'` e
 * a parede em questão era dona de uma região. O usuário via as alças de
 * edição nos cantos (desenhadas por `drawEditHandles.ts`, fora deste
 * arquivo) mas a sala continuava com a cor normal — seleção que não
 * confirma visualmente o que foi selecionado.
 *
 * Esta função decide qual `Region.id` deve renderizar como selecionado,
 * cobrindo os dois casos (seleção direta da região, OU seleção de uma
 * parede cujo `regionId` aponta pra ela) — `draw()` continua recebendo só um
 * `string | null`, exatamente como antes; muda apenas QUEM calcula esse
 * valor. É por isso que o CONTRATO desta entrega não precisa tocar a
 * assinatura de `draw()`, só trocar a expressão inline que o integrador já
 * passa pra ela (ver relatório).
 */
export function resolveHighlightedRegionId(walls: Wall[], selection: Selection | null | undefined): string | null {
  if (!selection) return null
  if (selection.kind === 'region') return selection.id
  if (selection.kind === 'wall') {
    const wall = walls.find((w) => w.id === selection.id)
    return wall?.regionId ?? null
  }
  return null
}

interface HatchSegment {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Gera segmentos de linha diagonal (45°) confinados ao polígono da região.
 * Funciona rotacionando os pontos pra um espaço onde as linhas de hachura viram
 * horizontais, aplicando o algoritmo clássico de scanline (par-ímpar) pra achar
 * os trechos que ficam dentro do polígono — o mesmo método usado pra preencher
 * polígonos côncavos — e rotacionando os segmentos resultantes de volta. Como os
 * segmentos já nascem recortados ao polígono, nunca vazam pra fora do contorno,
 * mesmo em regiões não-retangulares (formato em L, muitos vértices).
 */
export function computeHatchSegments(points: RegionPoint[]): HatchSegment[] {
  const cos = Math.cos(-HATCH_ANGLE)
  const sin = Math.sin(-HATCH_ANGLE)
  const rotated = points.map((p) => ({ u: p.x * cos - p.y * sin, v: p.x * sin + p.y * cos }))

  const vValues = rotated.map((p) => p.v)
  const vMin = Math.min(...vValues)
  const vMax = Math.max(...vValues)

  const cosBack = Math.cos(HATCH_ANGLE)
  const sinBack = Math.sin(HATCH_ANGLE)

  const segments: HatchSegment[] = []
  for (let v = vMin + HATCH_SPACING; v < vMax; v += HATCH_SPACING) {
    const us = scanlineIntersections(rotated, v)
    for (let i = 0; i + 1 < us.length; i += 2) {
      const u1 = us[i]
      const u2 = us[i + 1]
      segments.push({
        x1: u1 * cosBack - v * sinBack,
        y1: u1 * sinBack + v * cosBack,
        x2: u2 * cosBack - v * sinBack,
        y2: u2 * sinBack + v * cosBack,
      })
    }
  }
  return segments
}

/** Interseções da reta v=constante com as arestas do polígono, em ordem crescente de u. */
export function scanlineIntersections(points: { u: number; v: number }[], v: number): number[] {
  const us: number[] = []
  const n = points.length
  for (let i = 0; i < n; i++) {
    const a = points[i]
    const b = points[(i + 1) % n]
    const crosses = (a.v <= v && b.v > v) || (b.v <= v && a.v > v)
    if (!crosses) continue
    const t = (v - a.v) / (b.v - a.v)
    us.push(a.u + t * (b.u - a.u))
  }
  return us.sort((x, y) => x - y)
}

export interface RegionsRendererOptions {
  /**
   * Desenha a marca de "Teto fechado para jogadores" (`RoomMeta.roof`). Só o
   * EDITOR liga: na tela do jogador a sala de teto fechado já vem coberta pela
   * silhueta chapada, e a sala de teto ABERTO chega sem o campo — marcar ali
   * seria contar ao jogador uma decisão que é do mestre.
   */
  roofMarker?: boolean
}

/**
 * As duas camadas de uma sala no palco (pedido de 08/10/2026: "ele pode pintar
 * o cômodo da sala porém ele fica embaixo das paredes"). Os desenhos do botão
 * Desenho entram ENTRE as duas: a tinta cobre o chão da sala e a borda dela
 * fica por cima da tinta, sob paredes, portas e escadas. Sem desenho no meio,
 * empilhar as duas dá a mesma sala de antes.
 */
export interface RegionLayers {
  /** Fundo: preenchimento, a segunda cor da sala em duas cores e a hachura. */
  fills: Container
  /** Borda: contorno da sala, contorno de seleção e marca de telhado. */
  strokes: Container
}

export interface RegionsRenderer {
  /** `cameraScale` dá ao contorno de seleção 2 px de TELA; omitido, vem da
   *  escala de mundo de `layers.strokes` no último render (`resolveCameraScale`). */
  draw: (layers: RegionLayers, regions: Region[], selectedRegionId?: string | null, cameraScale?: number) => void
}

function traceRegionPath(g: Graphics, points: RegionPoint[]): void {
  const [first, ...rest] = points
  g.moveTo(first.x, first.y)
  for (const point of rest) {
    g.lineTo(point.x, point.y)
  }
  g.closePath()
}

/**
 * Cria um renderer de regiões com cache de Graphics por id, fechado por closure —
 * mesma lifecycle de createPropsRenderer/createTextLabelsRenderer: instanciar uma
 * vez dentro do setup() de cada mount do PixiCanvas, nunca em escopo de módulo.
 *
 * Um Graphics próprio por região (em vez de um único Graphics compartilhado
 * desenhando fill/stroke de todas em sequência) elimina o bug em que, com muitas
 * regiões (~15+), algumas nasciam sem preenchimento visível — batching interno do
 * Pixi 8 Graphics quando o path acumulado numa mesma instância cresce demais.
 * Cada região ganha DOIS Graphics, um em cada camada de `RegionLayers` (fundo e
 * borda); nenhum acumula mais que 1 fill de região (o fundo tem o fill e, na
 * sala em duas cores, o da segunda cor), então o isolamento entre regiões
 * continua o mesmo.
 */
export function createRegionsRenderer(options: RegionsRendererOptions = {}): RegionsRenderer {
  const cache = new Map<string, { fill: Graphics; stroke: Graphics }>()
  const roofMarker = options.roofMarker === true
  // Redesenho parcial: o que cada Graphics pintou da última vez. A store é
  // imutável (`moveRegion` só recria a sala movida), então mesma referência =
  // pintura idêntica — arrastar 1 sala repinta só ela. O destaque e a largura
  // do contorno de seleção só mexem na BORDA, e só na sala selecionada (é a
  // única que a usa): no zoom, só a borda dela repinta, com 2 px de tela.
  const paintedFill = new Map<string, Region>()
  const paintedStroke = new Map<string, { region: Region; outlineWidth: number | null }>()

  function graphicsOf(layers: RegionLayers, region: Region): { fill: Graphics; stroke: Graphics } {
    const cached = cache.get(region.id)
    if (cached) return cached
    const created = { fill: new Graphics(), stroke: new Graphics() }
    created.fill.label = region.id
    created.stroke.label = region.id
    layers.fills.addChild(created.fill)
    layers.strokes.addChild(created.stroke)
    cache.set(region.id, created)
    return created
  }

  function draw(layers: RegionLayers, regions: Region[], selectedRegionId: string | null = null, cameraScale?: number): void {
    const outlineWidth = selectionOutlineWidth(resolveCameraScale(layers.strokes, cameraScale))
    const visibleRegions = regions.filter((region) => !isDegenerateRegion(region.points))
    const currentIds = new Set(visibleRegions.map((r) => r.id))

    for (const [id, pair] of cache) {
      if (!currentIds.has(id)) {
        layers.fills.removeChild(pair.fill)
        layers.strokes.removeChild(pair.stroke)
        pair.fill.destroy()
        pair.stroke.destroy()
        cache.delete(id)
        paintedFill.delete(id)
        paintedStroke.delete(id)
      }
    }

    for (const region of visibleRegions) {
      const { fill, stroke } = graphicsOf(layers, region)
      if (paintedFill.get(region.id) !== region) {
        paintedFill.set(region.id, region)
        paintRegionFill(fill, region)
      }
      const paintedOutline = region.id === selectedRegionId ? outlineWidth : null
      const last = paintedStroke.get(region.id)
      if (last === undefined || last.region !== region || last.outlineWidth !== paintedOutline) {
        paintedStroke.set(region.id, { region, outlineWidth: paintedOutline })
        paintRegionStroke(stroke, region, paintedOutline, roofMarker)
      }
    }

    // Ordem do array = ordem de pintura, nas DUAS camadas. O Graphics em cache
    // fica na posição em que nasceu; sub-sala inserida no meio do array
    // (`lib/roomNesting.ts`) e Ctrl+Z que devolve a sala de fora precisam
    // reordenar, senão a mãe cobre a filha. Cada camada só guarda Graphics de
    // região.
    visibleRegions.forEach((region, index) => {
      const pair = cache.get(region.id)
      if (!pair) return
      if (layers.fills.getChildIndex(pair.fill) !== index) layers.fills.setChildIndex(pair.fill, index)
      if (layers.strokes.getChildIndex(pair.stroke) !== index) layers.strokes.setChildIndex(pair.stroke, index)
    })
  }

  return { draw }
}

/** O FUNDO da sala: preenchimento, a segunda cor e a hachura — o chão que a tinta cobre. */
function paintRegionFill(g: Graphics, region: Region): void {
  g.clear()
  g.alpha = region.secret ? SECRET_ITEM_ALPHA : 1
  // Pedido N2 do usuário ("tirar o fundo" de Região/Sala) — `Region.filled`
  // já existe no schema e a store já tem `setRegionFilled`/`FillControls`
  // ligados (App.tsx), mas nada lia o campo aqui: `g.fill(...)` disparava
  // incondicional. `undefined` conta como `true` (preenche, aparência
  // idêntica à de hoje), mesmo padrão de wallKind/locked/hidden.
  if (region.filled === false) return

  traceRegionPath(g, region.points)
  g.fill({ color: new Color(region.fillColor).toNumber(), alpha: 1 })
  // SALA EM DUAS CORES: o lado de lá da reta por cima do fundo. O contorno,
  // na outra camada, segue na cor da sala.
  const split = readRegionSplit(region.split)
  const secondPart = split ? splitSecondPart(region.points, split) : []
  if (split && secondPart.length > 0) {
    traceRegionPath(g, secondPart)
    g.fill({ color: new Color(split.color).toNumber(), alpha: 1 })
  }

  // Hachura é tratamento de FUNDO (alternativa a preenchimento sólido) —
  // sem fundo, não faz sentido desenhar diagonais soltas por cima do
  // contorno. Serve exatamente o caso "rua"/"construção artesanal" do
  // usuário: contorno só, sem nenhum traço extra por dentro. Continua
  // visível com a região selecionada. Mora no fundo: a tinta que pinta o
  // cômodo cobre a hachura como cobre o preenchimento.
  if (region.fillPattern === 'hatch') {
    const segments = computeHatchSegments(region.points)
    for (const segment of segments) {
      g.moveTo(segment.x1, segment.y1)
      g.lineTo(segment.x2, segment.y2)
    }
    if (segments.length > 0) {
      g.stroke({ width: HATCH_WIDTH, color: HATCH_COLOR, alpha: HATCH_ALPHA })
    }
  }
}

/**
 * A BORDA da sala: contorno de seleção, contorno real e marca de telhado — o
 * que fica por cima da tinta. `outlineWidth` só vem na sala selecionada.
 */
function paintRegionStroke(g: Graphics, region: Region, outlineWidth: number | null, roofMarker: boolean): void {
  g.clear()
  g.alpha = region.secret ? SECRET_ITEM_ALPHA : 1
  const color = new Color(region.fillColor).toNumber()
  const strokeWidth = readRegionStrokeWidth(region)
  const join = readRegionStrokeJoin(region)

  // Auditoria 14/09: a seleção pintava a região inteira de amarelo (fill
  // 0.85 + contorno), escondendo a cor e a hachura que o usuário acabou de
  // escolher. Agora é um contorno POR FORA, desenhado antes (por baixo):
  // `alignment: 0` põe o traço do lado de fora do polígono, e a largura
  // cobre a metade externa do contorno real + 2 px de tela.
  if (outlineWidth !== null) {
    traceRegionPath(g, region.points)
    g.stroke({ width: strokeWidth / 2 + outlineWidth, color: SELECTION_COLOR, alignment: 0, join })
  }

  traceRegionPath(g, region.points)
  g.stroke({ width: strokeWidth, color, join })

  if (roofMarker && roomHasRoof(region.room)) {
    traceRegionPath(g, region.points)
    // `alignment: 1` = traço inteiro POR DENTRO do polígono (0 = por fora,
    // 0,5 = centrado; StrokeAttributes.alignment do Pixi 8). Por fora é
    // onde mora o contorno de seleção, e os dois brigariam.
    g.stroke({ width: ROOF_MARK_WIDTH, color: ROOF_MARK_COLOR, alignment: 1, join })
  }
}
