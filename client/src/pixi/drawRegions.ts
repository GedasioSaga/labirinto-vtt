import { Color, Container, Graphics } from 'pixi.js'
import type { Region, RegionPoint, Wall } from '../types/map'
import type { Selection } from '../types/tools'
import { isDegenerateRegion } from './shapes'
import { SELECTION_COLOR } from './constants'

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
/** Realce de seleção somado à espessura base — mesma convenção de
 *  `drawDrawings.ts` (`width = isSelected ? drawing.width + 2 : drawing.width`),
 *  escolhida em vez do valor fixo `4` que o código anterior usava porque
 *  agora a base é configurável (1–20): +2 escala com contorno fino OU grosso,
 *  em vez de "achatar" tudo pra um valor fixo quando selecionado. Com o
 *  default de hoje (2), dá exatamente 4 — idêntico ao comportamento anterior. */
const REGION_SELECTED_STROKE_BONUS = 2

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

export interface RegionsRenderer {
  draw: (container: Container, regions: Region[], selectedRegionId?: string | null) => void
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
 * Como cada Graphics isolado nunca acumula mais que 1 fill (mesmo com hachura),
 * fill + stroke + hachura da mesma região podem ficar na mesma instância sem
 * risco de corromper o path de outra região.
 */
export function createRegionsRenderer(): RegionsRenderer {
  const cache = new Map<string, Graphics>()

  function draw(container: Container, regions: Region[], selectedRegionId: string | null = null): void {
    const visibleRegions = regions.filter((region) => !isDegenerateRegion(region.points))
    const currentIds = new Set(visibleRegions.map((r) => r.id))

    for (const [id, g] of cache) {
      if (!currentIds.has(id)) {
        container.removeChild(g)
        g.destroy()
        cache.delete(id)
      }
    }

    for (const region of visibleRegions) {
      let g = cache.get(region.id)
      if (!g) {
        g = new Graphics()
        g.label = region.id
        cache.set(region.id, g)
        container.addChild(g)
      }
      g.clear()

      const [first, ...rest] = region.points
      g.moveTo(first.x, first.y)
      for (const point of rest) {
        g.lineTo(point.x, point.y)
      }
      g.closePath()
      const isSelected = region.id === selectedRegionId
      const color = isSelected ? SELECTION_COLOR : new Color(region.fillColor).toNumber()
      // Pedido N2 do usuário ("tirar o fundo" de Região/Sala) — `Region.filled`
      // já existe no schema e a store já tem `setRegionFilled`/`FillControls`
      // ligados (App.tsx), mas nada lia o campo aqui: `g.fill(...)` disparava
      // incondicional. `undefined` conta como `true` (preenche, aparência
      // idêntica à de hoje), mesmo padrão de wallKind/locked/hidden.
      const isFilled = region.filled !== false
      if (isFilled) {
        g.fill({ color, alpha: isSelected ? 0.85 : 1 })
      }
      const baseStrokeWidth = readRegionStrokeWidth(region)
      const strokeWidth = isSelected ? baseStrokeWidth + REGION_SELECTED_STROKE_BONUS : baseStrokeWidth
      g.stroke({ width: strokeWidth, color, join: readRegionStrokeJoin(region) })

      // Hachura é tratamento de FUNDO (alternativa a preenchimento sólido) —
      // sem fundo, não faz sentido desenhar diagonais soltas por cima do
      // contorno. Serve exatamente o caso "rua"/"construção artesanal" do
      // usuário: contorno só, sem nenhum traço extra por dentro.
      if (!isSelected && isFilled && region.fillPattern === 'hatch') {
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
  }

  return { draw }
}
