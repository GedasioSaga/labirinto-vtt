import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, type StrokeInstruction } from 'pixi.js'
import {
  computeHatchSegments,
  createRegionsRenderer,
  readRegionStrokeJoin,
  readRegionStrokeWidth,
  resolveHighlightedRegionId,
  scanlineIntersections,
  type RegionLayers,
} from './drawRegions'
import type { Region, RegionPoint, Wall } from '../types/map'
import type { Selection } from '../types/tools'

/** Conta instruções `action: 'fill'` realmente empilhadas no GraphicsContext da instância. */
function countFillInstructions(g: Graphics): number {
  return g.context.instructions.filter((instruction) => instruction.action === 'fill').length
}

/** Conta instruções `action: 'stroke'` realmente empilhadas no GraphicsContext da instância. */
function countStrokeInstructions(g: Graphics): number {
  return g.context.instructions.filter((instruction) => instruction.action === 'stroke').length
}

/**
 * A n-ésima instrução `stroke` de fato empilhada, com `data.style` já
 * convertido pelo próprio Pixi (`GraphicsContext.d.ts`, `StrokeInstruction` —
 * tipo público, não `@internal` na prática: exportado por
 * `scene/index.d.ts:62`). `instruction.action === 'stroke'` é um type guard
 * de union discriminada — estreita `GraphicsInstructions` pra
 * `StrokeInstruction` sem cast nenhum. `at` seleciona qual stroke (default: o
 * primeiro — o contorno da região; testes de hachura pedem `at: 1`).
 */
function strokeStyleAt(g: Graphics, at = 0): StrokeInstruction['data']['style'] {
  const strokes = g.context.instructions.filter(
    (instruction): instruction is StrokeInstruction => instruction.action === 'stroke',
  )
  const stroke = strokes[at]
  if (!stroke) throw new Error(`esperava pelo menos ${at + 1} instrução(ões) de stroke, achei ${strokes.length}`)
  return stroke.data.style
}

/** Ray-casting par-ímpar clássico, independente da implementação testada. */
function isPointInPolygon(point: { x: number; y: number }, polygon: RegionPoint[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

describe('scanlineIntersections', () => {
  it('polígono convexo simples: uma faixa contínua', () => {
    const square = [
      { u: 0, v: 0 },
      { u: 10, v: 0 },
      { u: 10, v: 10 },
      { u: 0, v: 10 },
    ]
    expect(scanlineIntersections(square, 5)).toEqual([0, 10])
  })

  it('polígono côncavo (U): scanline acima da base cruza as duas pernas separadamente', () => {
    const u = [
      { u: 0, v: 0 },
      { u: 10, v: 0 },
      { u: 10, v: 10 },
      { u: 7, v: 10 },
      { u: 7, v: 3 },
      { u: 3, v: 3 },
      { u: 3, v: 10 },
      { u: 0, v: 10 },
    ]
    // v=5 fica acima da base (v 0-3): só as pernas (u 0-3 e u 7-10) existem ali.
    const atLegs = scanlineIntersections(u, 5)
    expect(atLegs).toHaveLength(4)
    expect(atLegs[0]).toBeCloseTo(0)
    expect(atLegs[1]).toBeCloseTo(3)
    expect(atLegs[2]).toBeCloseTo(7)
    expect(atLegs[3]).toBeCloseTo(10)

    // v=1 fica dentro da base: uma faixa contínua de ponta a ponta.
    const atBase = scanlineIntersections(u, 1)
    expect(atBase).toHaveLength(2)
    expect(atBase[0]).toBeCloseTo(0)
    expect(atBase[1]).toBeCloseTo(10)
  })
})

describe('computeHatchSegments', () => {
  it('região retangular: todo segmento fica dentro do contorno', () => {
    const square: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    const segments = computeHatchSegments(square)
    expect(segments.length).toBeGreaterThan(0)
    for (const seg of segments) {
      const midpoint = { x: (seg.x1 + seg.x2) / 2, y: (seg.y1 + seg.y2) / 2 }
      expect(isPointInPolygon(midpoint, square)).toBe(true)
    }
  })

  it('região em L (côncava): nenhum segmento vaza para o entalhe removido', () => {
    // L-shape: quadrado 100x100 com o quadrante [40,100]x[40,100] recortado.
    const lShape: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 40 },
      { x: 40, y: 40 },
      { x: 40, y: 100 },
      { x: 0, y: 100 },
    ]
    const segments = computeHatchSegments(lShape)
    expect(segments.length).toBeGreaterThan(0)
    for (const seg of segments) {
      const midpoint = { x: (seg.x1 + seg.x2) / 2, y: (seg.y1 + seg.y2) / 2 }
      // Nunca vaza pro contorno: o ponto médio de cada segmento tem que estar dentro do L.
      expect(isPointInPolygon(midpoint, lShape)).toBe(true)
      // Explícito: nunca cai dentro do entalhe recortado.
      const inNotch = midpoint.x > 40 && midpoint.x < 100 && midpoint.y > 40 && midpoint.y < 100
      expect(inNotch).toBe(false)
    }
  })

  it('região menor que o espaçamento da hachura: nenhum segmento gerado', () => {
    const tiny: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 0, y: 3 },
    ]
    expect(computeHatchSegments(tiny)).toEqual([])
  })
})

/** Grade de retângulos contíguos (sem gap), reproduzindo o layout real que disparava o bug. */
function buildContiguousGridRegions(cols: number, rows: number, size = 50): Region[] {
  const regions: Region[] = []
  let n = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * size
      const y = row * size
      regions.push({
        id: `region-${n++}`,
        points: [
          { x, y },
          { x: x + size, y },
          { x: x + size, y: y + size },
          { x, y: y + size },
        ],
        tag: '',
        fillColor: '#1e7a1e',
        fillPattern: 'solid',
        data: {},
      })
    }
  }
  return regions
}

/** As duas camadas que o renderer pinta: o fundo (sob os desenhos) e o contorno (sobre eles). */
function novasCamadas(): RegionLayers {
  return { fills: new Container(), strokes: new Container() }
}

/**
 * Os Graphics de uma camada, já sabendo que SÃO `Graphics` — o renderer só
 * põe `Graphics` em `fills`/`strokes` (`pixi/drawRegions.ts`), e o filtro com
 * `instanceof` estreita sem cast. Um filho de outro tipo quebraria a contagem
 * de quem chama, que é o que deve acontecer.
 */
function graphicsDe(camada: Container): Graphics[] {
  return camada.children.filter((child): child is Graphics => child instanceof Graphics)
}

/** O Graphics da camada com o `label` da sala, ou erro se ela não foi pintada. */
function graphicsDaSala(camada: Container, id: string): Graphics {
  const g = graphicsDe(camada).find((child) => child.label === id)
  if (g === undefined) throw new Error(`sem Graphics para ${id}`)
  return g
}

describe('createRegionsRenderer', () => {
  it('regressão: 20 regiões contíguas resultam em 20 Graphics de fundo e 20 de contorno, nenhuma pulada', () => {
    const regions = buildContiguousGridRegions(5, 4) // 20 regiões, mesmo padrão do bug real (14 OK / 17 quebra)
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()

    renderer.draw(layers, regions, null)

    expect(layers.fills.children.length).toBe(regions.length)
    expect(layers.strokes.children.length).toBe(regions.length)

    // Correlaciona child→região pelo label (setado em drawRegions.ts) em vez de
    // assumir a ordem do array — prova que TODA região da lista de fato ganhou
    // um Graphics próprio, não só que a contagem bate.
    for (const camada of [layers.fills, layers.strokes]) {
      const drawnIds = new Set(camada.children.map((child) => child.label))
      expect(drawnIds.size).toBe(regions.length)
      for (const region of regions) {
        expect(drawnIds.has(region.id)).toBe(true)
      }
    }

    // O bug original: Graphics existia (contagem batia) mas nascia sem fill
    // visível porque o path acumulado corrompia fill/stroke/hachura na mesma
    // instância. Contagem de children não pega isso — inspecionar o conteúdo
    // real do GraphicsContext sim: cada região precisa ter exatamente 1
    // instrução `fill` de fato empilhada.
    for (const g of graphicsDe(layers.fills)) {
      expect(countFillInstructions(g)).toBe(1)
    }
  })

  it('cada região tem seus próprios Graphics: nenhuma instância é compartilhada entre regiões nem entre camadas', () => {
    const regions = buildContiguousGridRegions(5, 4)
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()

    renderer.draw(layers, regions, null)

    const todos = [...layers.fills.children, ...layers.strokes.children]
    expect(new Set(todos).size).toBe(2 * regions.length)
  })

  it('reutiliza os Graphics existentes em redraws e remove os de regiões que saíram do array, nas duas camadas', () => {
    const regions = buildContiguousGridRegions(5, 4)
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()

    renderer.draw(layers, regions, null)
    const firstFill = layers.fills.children[0]
    const firstStroke = layers.strokes.children[0]

    const withoutFirst = regions.slice(1)
    renderer.draw(layers, withoutFirst, null)

    expect(layers.fills.children.length).toBe(withoutFirst.length)
    expect(layers.strokes.children.length).toBe(withoutFirst.length)
    expect(layers.fills.children.includes(firstFill)).toBe(false)
    expect(layers.strokes.children.includes(firstStroke)).toBe(false)

    renderer.draw(layers, withoutFirst, null)
    expect(layers.fills.children.length).toBe(withoutFirst.length)
    expect(layers.strokes.children.length).toBe(withoutFirst.length)
  })

  it('redesenho parcial: só repinta a região que mudou de referência ou de destaque', () => {
    const regions = buildContiguousGridRegions(3, 1)
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    renderer.draw(layers, regions, null)
    const fillClears = regions.map((region) => vi.spyOn(graphicsDaSala(layers.fills, region.id), 'clear'))
    const strokeClears = regions.map((region) => vi.spyOn(graphicsDaSala(layers.strokes, region.id), 'clear'))
    const chamadas = (spies: { mock: { calls: unknown[] } }[]) => spies.map((spy) => spy.mock.calls.length)

    const moved = regions.map((r, i) => (i === 1 ? { ...r, points: r.points.map((p) => ({ x: p.x + 5, y: p.y })) } : r))
    renderer.draw(layers, moved, null)
    expect(chamadas(fillClears)).toEqual([0, 1, 0])
    expect(chamadas(strokeClears)).toEqual([0, 1, 0])

    // Destaque é só contorno: o fundo da sala selecionada não repinta.
    renderer.draw(layers, moved, regions[2].id)
    expect(chamadas(fillClears)).toEqual([0, 1, 0])
    expect(chamadas(strokeClears)).toEqual([0, 1, 1])
    // A região repintada continua com exatamente 1 fill (nada acumulou).
    expect(countFillInstructions(graphicsDaSala(layers.fills, regions[1].id))).toBe(1)
  })

  it('zoom: só o contorno da sala selecionada repinta, e acompanha a escala da câmera', () => {
    const regions = buildContiguousGridRegions(3, 1)
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    const selectedId = regions[0].id
    renderer.draw(layers, regions, selectedId, 1)
    const outlineWidth = (g: Graphics): number => {
      const first = g.context.instructions.find((instruction) => instruction.action === 'stroke')
      return first !== undefined && first.action === 'stroke' ? first.data.style.width : NaN
    }
    const widthAtScale1 = outlineWidth(graphicsDaSala(layers.strokes, selectedId))
    const strokeClears = regions.map((region) => vi.spyOn(graphicsDaSala(layers.strokes, region.id), 'clear'))
    const fillClears = regions.map((region) => vi.spyOn(graphicsDaSala(layers.fills, region.id), 'clear'))

    renderer.draw(layers, regions, selectedId, 2)
    expect(strokeClears.map((spy) => spy.mock.calls.length)).toEqual([1, 0, 0])
    expect(fillClears.map((spy) => spy.mock.calls.length)).toEqual([0, 0, 0])
    // 2 px de TELA a 200% = metade da largura de mundo: o cache não pode congelar a espessura.
    expect(outlineWidth(graphicsDaSala(layers.strokes, selectedId))).toBeLessThan(widthAtScale1)

    // Sem seleção, a escala não entra em nenhuma pintura: zoom não repinta sala nenhuma.
    renderer.draw(layers, regions, null, 2)
    renderer.draw(layers, regions, null, 4)
    expect(strokeClears.map((spy) => spy.mock.calls.length)).toEqual([2, 0, 0])
    expect(fillClears.map((spy) => spy.mock.calls.length)).toEqual([0, 0, 0])
  })

  it('mantém apenas 1 fill acumulado por Graphics mesmo com hachura (isolamento entre regiões)', () => {
    const regions = buildContiguousGridRegions(4, 5).map((r) => ({ ...r, fillPattern: 'hatch' as const }))
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()

    renderer.draw(layers, regions, null)

    expect(layers.fills.children.length).toBe(regions.length)

    // A causa raiz do bug era hachura + fill acumulando no mesmo path de uma
    // instância compartilhada. Com 1 Graphics por região isso não pode voltar a
    // acontecer — a prova real é inspecionar o GraphicsContext de cada instância:
    // no FUNDO, exatamente 1 `fill` (o preenchimento base) e 1 `stroke` (o
    // traço da hachura, que é tratamento de fundo); no CONTORNO, só o
    // `stroke` do contorno da região.
    for (const g of graphicsDe(layers.fills)) {
      expect(countFillInstructions(g)).toBe(1)
      expect(countStrokeInstructions(g)).toBe(1)
    }
    for (const g of graphicsDe(layers.strokes)) {
      expect(countFillInstructions(g)).toBe(0)
      expect(countStrokeInstructions(g)).toBe(1)
    }
  })
})

/**
 * PINCEL POR BAIXO DA BORDA DA SALA (pedido de 08/10/2026): "ele pode pintar o
 * cômodo da sala porém ele fica embaixo das paredes". O fundo da sala vai numa
 * camada (por baixo dos desenhos) e o contorno em outra (por cima deles). Sem
 * desenho no meio, as duas camadas empilhadas dão a mesma sala de antes.
 */
describe('createRegionsRenderer — fundo e contorno em camadas separadas', () => {
  it('o fundo vai para `fills` e o contorno para `strokes`, os dois com o id da sala', () => {
    const layers = novasCamadas()
    createRegionsRenderer().draw(layers, [buildSquareRegion('r1')], null)

    const fundo = graphicsDaSala(layers.fills, 'r1')
    const contorno = graphicsDaSala(layers.strokes, 'r1')
    expect([countFillInstructions(fundo), countStrokeInstructions(fundo)]).toEqual([1, 0])
    expect([countFillInstructions(contorno), countStrokeInstructions(contorno)]).toEqual([0, 1])
  })

  it('sala em duas cores: as duas cores ficam no fundo, o contorno segue na cor da sala', () => {
    const layers = novasCamadas()
    const sala = { ...buildSquareRegion('r1'), split: { color: '#aa2200', direction: 'vertical' as const, at: 0.5 } }
    createRegionsRenderer().draw(layers, [sala], null)

    const fundo = graphicsDaSala(layers.fills, 'r1')
    const cores = fundo.context.instructions.flatMap((i) => (i.action === 'fill' ? [i.data.style.color] : []))
    expect(cores).toEqual([0x204060, 0xaa2200])
    expect(strokeStyleAt(graphicsDaSala(layers.strokes, 'r1')).color).toBe(0x204060)
  })

  it('a marca de telhado do editor fica no contorno, por cima da pintura', () => {
    const layers = novasCamadas()
    const sala = { ...buildSquareRegion('r1'), room: { shape: 'rect' as const, name: 'Casa', roof: true } }
    createRegionsRenderer({ roofMarker: true }).draw(layers, [sala], null)

    expect(countStrokeInstructions(graphicsDaSala(layers.strokes, 'r1'))).toBe(2)
    expect(countStrokeInstructions(graphicsDaSala(layers.fills, 'r1'))).toBe(0)
  })

  it('sala oculta para jogadores: fundo e contorno esmaecidos juntos', () => {
    const layers = novasCamadas()
    createRegionsRenderer().draw(layers, [{ ...buildSquareRegion('r1'), secret: true }], null)

    expect(graphicsDaSala(layers.fills, 'r1').alpha).toBeLessThan(1)
    expect(graphicsDaSala(layers.strokes, 'r1').alpha).toBe(graphicsDaSala(layers.fills, 'r1').alpha)
  })

  it('sub-sala inserida no meio do array reordena as duas camadas (a mãe não cobre a filha)', () => {
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    const mae = buildSquareRegion('mae')
    const vizinha = buildSquareRegion('vizinha')
    renderer.draw(layers, [mae, vizinha], null)
    renderer.draw(layers, [mae, buildSquareRegion('filha'), vizinha], null)

    expect(layers.fills.children.map((c) => c.label)).toEqual(['mae', 'filha', 'vizinha'])
    expect(layers.strokes.children.map((c) => c.label)).toEqual(['mae', 'filha', 'vizinha'])
  })
})

describe('readRegionStrokeWidth', () => {
  it('undefined cai no default de hoje (2 — mesmo valor hardcoded antes do campo existir)', () => {
    expect(readRegionStrokeWidth({})).toBe(2)
    expect(readRegionStrokeWidth({ strokeWidth: undefined })).toBe(2)
  })

  it('número finito positivo é aceito como está — cobre a faixa fino(1)/médio(4)/grosso(12) do preset da UI', () => {
    expect(readRegionStrokeWidth({ strokeWidth: 1 })).toBe(1)
    expect(readRegionStrokeWidth({ strokeWidth: 4 })).toBe(4)
    expect(readRegionStrokeWidth({ strokeWidth: 12 })).toBe(12)
  })

  it('valor corrompido (0, negativo, NaN, tipo errado) cai no default — nunca propaga lixo pro stroke()', () => {
    expect(readRegionStrokeWidth({ strokeWidth: 0 })).toBe(2)
    expect(readRegionStrokeWidth({ strokeWidth: -5 })).toBe(2)
    expect(readRegionStrokeWidth({ strokeWidth: Number.NaN })).toBe(2)
    expect(readRegionStrokeWidth({ strokeWidth: '12' })).toBe(2)
  })
})

describe('readRegionStrokeJoin', () => {
  it("undefined cai no default de hoje ('miter' — o que o Pixi já aplicava sem `join` explícito no stroke())", () => {
    expect(readRegionStrokeJoin({})).toBe('miter')
    expect(readRegionStrokeJoin({ strokeJoin: undefined })).toBe('miter')
  })

  it("'round' é aceito como override explícito", () => {
    expect(readRegionStrokeJoin({ strokeJoin: 'round' })).toBe('round')
  })

  it('valor desconhecido ou corrompido cai no default', () => {
    expect(readRegionStrokeJoin({ strokeJoin: 'bevel' })).toBe('miter')
    expect(readRegionStrokeJoin({ strokeJoin: 123 })).toBe('miter')
  })
})

/**
 * Quadrado simples com campos extras opcionais (`filled`/`strokeWidth`/
 * `strokeJoin`) que ainda não existem em `Region` (types/map.ts, arquivo do
 * integrador — ver CONTRATO). Retornado por uma função (não um literal
 * anotado `: Region`), então a checagem de propriedade excedente do
 * TypeScript não se aplica — mesmo raciocínio de `readRegionStrokeWidth`
 * acima (parâmetro estrutural com prop opcional), sem nenhum `as`.
 */
function buildSquareRegion(
  id: string,
  extra: { filled?: boolean; strokeWidth?: number; strokeJoin?: Region['strokeJoin']; fillPattern?: Region['fillPattern'] } = {},
) {
  return {
    id,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ] satisfies RegionPoint[],
    tag: '',
    fillColor: '#204060',
    fillPattern: extra.fillPattern ?? 'solid',
    data: {},
    filled: extra.filled,
    strokeWidth: extra.strokeWidth,
    strokeJoin: extra.strokeJoin,
  }
}

/** O Graphics de FUNDO da primeira sala (preenchimento, segunda cor, hachura). */
function fundoDe(layers: RegionLayers): Graphics {
  const [g] = graphicsDe(layers.fills)
  if (g === undefined) throw new Error('nenhum Graphics de fundo')
  return g
}

/** O Graphics de CONTORNO da primeira sala (contorno, seleção, telhado). */
function contornoDe(layers: RegionLayers): Graphics {
  const [g] = graphicsDe(layers.strokes)
  if (g === undefined) throw new Error('nenhum Graphics de contorno')
  return g
}

describe('createRegionsRenderer — Region.filled (pedido N2, "só contorno sem fundo")', () => {
  it('filled ausente (undefined): preenche igual hoje — 1 fill + 1 stroke', () => {
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    renderer.draw(layers, [buildSquareRegion('r1')], null)

    expect(countFillInstructions(fundoDe(layers))).toBe(1)
    expect(countStrokeInstructions(contornoDe(layers))).toBe(1)
  })

  it('filled: false — não preenche mais: 0 fill, contorno (stroke) continua desenhando', () => {
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    renderer.draw(layers, [buildSquareRegion('r1', { filled: false })], null)

    expect(countFillInstructions(fundoDe(layers))).toBe(0)
    expect(countStrokeInstructions(contornoDe(layers))).toBe(1)
  })

  it('filled: false + fillPattern hatch: hachura também não desenha (é tratamento de fundo) — só 1 stroke, o do contorno', () => {
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    renderer.draw(layers, [buildSquareRegion('r1', { filled: false, fillPattern: 'hatch' })], null)

    expect(countFillInstructions(fundoDe(layers))).toBe(0)
    expect(countStrokeInstructions(fundoDe(layers))).toBe(0)
    expect(countStrokeInstructions(contornoDe(layers))).toBe(1)
  })
})

describe('createRegionsRenderer — Region.strokeWidth/strokeJoin (pedido G2, "rua/construção artesanal")', () => {
  it('strokeWidth ausente: contorno sai com 2px (comportamento de hoje) e junção miter (default do Pixi)', () => {
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    renderer.draw(layers, [buildSquareRegion('r1')], null)

    const style = strokeStyleAt(contornoDe(layers))
    expect(style.width).toBe(2)
    expect(style.join).toBe('miter')
  })

  it('strokeWidth: 12 (preset "grosso") é aplicado ao contorno de verdade', () => {
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    renderer.draw(layers, [buildSquareRegion('r1', { strokeWidth: 12 })], null)

    expect(strokeStyleAt(contornoDe(layers)).width).toBe(12)
  })

  it('região SELECIONADA mantém o strokeWidth configurado; o destaque é um contorno à parte, por fora', () => {
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    renderer.draw(layers, [buildSquareRegion('r1', { strokeWidth: 12 })], 'r1', 1)

    const g = contornoDe(layers)
    // [0] contorno de seleção: meia espessura real + 2 px de tela, alinhado por fora.
    expect(strokeStyleAt(g, 0)).toMatchObject({ color: 0xffdd55, width: 12 / 2 + 2, alignment: 0 })
    // [1] contorno real, intacto.
    expect(strokeStyleAt(g, 1).width).toBe(12)
  })

  it("strokeJoin: 'round' é aplicado ao contorno de verdade", () => {
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    renderer.draw(layers, [buildSquareRegion('r1', { strokeJoin: 'round' })], null)

    expect(strokeStyleAt(contornoDe(layers)).join).toBe('round')
  })
})

/** Parede mínima válida (`types/map.ts`), com `regionId` opcional pro teste do bug 22. */
function buildWall(id: string, regionId?: string): Wall {
  return { id, x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, regionId }
}

describe('resolveHighlightedRegionId (bug 22 — parede-dona-de-Sala confirma a seleção da região)', () => {
  it('sem seleção: null', () => {
    expect(resolveHighlightedRegionId([], null)).toBeNull()
    expect(resolveHighlightedRegionId([], undefined)).toBeNull()
  })

  it("seleção kind 'region': devolve o próprio id, sem olhar pra walls", () => {
    const selection: Selection = { kind: 'region', id: 'r1' }
    expect(resolveHighlightedRegionId([], selection)).toBe('r1')
  })

  it("seleção kind 'wall' cuja parede é DONA de uma região (Wall.regionId setado): devolve o regionId — o caso do bug", () => {
    const walls = [buildWall('w1', 'r1'), buildWall('w2', 'r1'), buildWall('w3')]
    const selection: Selection = { kind: 'wall', id: 'w1' }
    expect(resolveHighlightedRegionId(walls, selection)).toBe('r1')
  })

  it("seleção kind 'wall' de uma parede SOLTA (sem regionId): null — não inventa destaque", () => {
    const walls = [buildWall('w3')]
    const selection: Selection = { kind: 'wall', id: 'w3' }
    expect(resolveHighlightedRegionId(walls, selection)).toBeNull()
  })

  it("seleção kind 'wall' de um id que não existe mais em `walls` (janela de corrida): null, não lança", () => {
    const selection: Selection = { kind: 'wall', id: 'inexistente' }
    expect(resolveHighlightedRegionId([buildWall('w1', 'r1')], selection)).toBeNull()
  })

  it("outros kinds ('token', 'light', 'stair', 'prop', 'drawing'): null", () => {
    for (const kind of ['token', 'light', 'stair', 'prop', 'drawing'] as const) {
      expect(resolveHighlightedRegionId([], { kind, id: 'x' })).toBeNull()
    }
  })
})

describe('createRegionsRenderer — bug 22, os dois casos visuais lado a lado', () => {
  it('região selecionada DIRETAMENTE (kind "region"): ganha contorno SELECTION_COLOR por fora e mantém a cor real', () => {
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    const region = buildSquareRegion('sala-1')
    const walls = [buildWall('w1', 'sala-1')]

    const highlighted = resolveHighlightedRegionId(walls, { kind: 'region', id: 'sala-1' })
    renderer.draw(layers, [region], highlighted, 1)

    const g = contornoDe(layers)
    // Auditoria 14/09: o amarelo pintava por cima da cor e da hachura. Agora
    // [0] é o contorno de seleção (sem fill próprio) e [1] o contorno real.
    expect(strokeStyleAt(g, 0)).toMatchObject({ color: 0xffdd55, alignment: 0, width: 2 / 2 + 2 })
    expect(strokeStyleAt(g, 1)).toMatchObject({ color: 0x204060, width: 2 })
    expect(countFillInstructions(g)).toBe(0)
    const fillsOf = fundoDe(layers).context.instructions.filter((i) => i.action === 'fill')
    expect(fillsOf).toHaveLength(1)
    expect(fillsOf[0].action === 'fill' && fillsOf[0].data.style).toMatchObject({ color: 0x204060, alpha: 1 })
  })

  it('BUG 22 corrigido: parede-dona-de-Sala selecionada (kind "wall") também destaca a região', () => {
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    const region = buildSquareRegion('sala-1')
    const walls = [buildWall('w1', 'sala-1'), buildWall('w2', 'sala-1'), buildWall('w3', 'sala-1'), buildWall('w4', 'sala-1')]

    // Usuário clicou numa das 4 paredes que a Sala gerou — não na região.
    const highlighted = resolveHighlightedRegionId(walls, { kind: 'wall', id: 'w3' })
    renderer.draw(layers, [region], highlighted, 1)

    const g = contornoDe(layers)
    expect(strokeStyleAt(g, 0).color).toBe(0xffdd55) // contorno de seleção
    expect(strokeStyleAt(g, 1).color).toBe(0x204060) // cor real preservada
  })

  it('região hachurada selecionada: a hachura continua desenhada', () => {
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    renderer.draw(layers, [buildSquareRegion('sala-1', { fillPattern: 'hatch' })], 'sala-1', 1)

    // seleção + contorno real no contorno; a hachura, no fundo
    expect(countStrokeInstructions(contornoDe(layers))).toBe(2)
    expect(countStrokeInstructions(fundoDe(layers))).toBe(1)
  })

  it('contorno de seleção tem 2 px de TELA: a zoom 50% ele vale 4 de mundo', () => {
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    renderer.draw(layers, [buildSquareRegion('sala-1')], 'sala-1', 0.5)

    expect(strokeStyleAt(contornoDe(layers), 0).width).toBe(2 / 2 + 4)
  })

  it('parede selecionada que NÃO é dona de nenhuma região: a região continua com a cor normal (sem falso positivo)', () => {
    const layers = novasCamadas()
    const renderer = createRegionsRenderer()
    const region = buildSquareRegion('sala-1')
    const walls = [buildWall('solta')] // sem regionId

    const highlighted = resolveHighlightedRegionId(walls, { kind: 'wall', id: 'solta' })
    renderer.draw(layers, [region], highlighted)

    const g = contornoDe(layers)
    expect(strokeStyleAt(g).color).toBe(0x204060) // fillColor de buildSquareRegion, não SELECTION_COLOR
    expect(strokeStyleAt(g).width).toBe(2) // default, sem o realce de +2 de seleção
  })
})
