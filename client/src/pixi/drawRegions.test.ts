import { describe, expect, it } from 'vitest'
import { Container, Graphics, type StrokeInstruction } from 'pixi.js'
import {
  computeHatchSegments,
  createRegionsRenderer,
  readRegionStrokeJoin,
  readRegionStrokeWidth,
  resolveHighlightedRegionId,
  scanlineIntersections,
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

describe('createRegionsRenderer', () => {
  it('regressão: 20 regiões contíguas resultam em 20 Graphics filhos, nenhuma pulada', () => {
    const regions = buildContiguousGridRegions(5, 4) // 20 regiões, mesmo padrão do bug real (14 OK / 17 quebra)
    const container = new Container()
    const renderer = createRegionsRenderer()

    renderer.draw(container, regions, null)

    expect(container.children.length).toBe(regions.length)

    // Correlaciona child→região pelo label (setado em drawRegions.ts) em vez de
    // assumir a ordem do array — prova que TODA região da lista de fato ganhou
    // um Graphics próprio, não só que a contagem bate.
    const drawnIds = new Set(container.children.map((child) => child.label))
    expect(drawnIds.size).toBe(regions.length)
    for (const region of regions) {
      expect(drawnIds.has(region.id)).toBe(true)
    }

    // O bug original: Graphics existia (contagem batia) mas nascia sem fill
    // visível porque o path acumulado corrompia fill/stroke/hachura na mesma
    // instância. Contagem de children não pega isso — inspecionar o conteúdo
    // real do GraphicsContext sim: cada região precisa ter exatamente 1
    // instrução `fill` de fato empilhada.
    for (const child of container.children) {
      expect(countFillInstructions(child as Graphics)).toBe(1)
    }
  })

  it('cada região tem seu próprio Graphics: nenhuma instância é compartilhada entre regiões', () => {
    const regions = buildContiguousGridRegions(5, 4)
    const container = new Container()
    const renderer = createRegionsRenderer()

    renderer.draw(container, regions, null)

    const uniqueChildren = new Set(container.children)
    expect(uniqueChildren.size).toBe(container.children.length)
  })

  it('reutiliza o Graphics existente em redraws e remove o de regiões que saíram do array', () => {
    const regions = buildContiguousGridRegions(5, 4)
    const container = new Container()
    const renderer = createRegionsRenderer()

    renderer.draw(container, regions, null)
    const firstChild = container.children[0]

    const withoutFirst = regions.slice(1)
    renderer.draw(container, withoutFirst, null)

    expect(container.children.length).toBe(withoutFirst.length)
    expect(container.children.includes(firstChild)).toBe(false)

    renderer.draw(container, withoutFirst, null)
    expect(container.children.length).toBe(withoutFirst.length)
  })

  it('mantém apenas 1 fill acumulado por Graphics mesmo com hachura (isolamento entre regiões)', () => {
    const regions = buildContiguousGridRegions(4, 5).map((r) => ({ ...r, fillPattern: 'hatch' as const }))
    const container = new Container()
    const renderer = createRegionsRenderer()

    renderer.draw(container, regions, null)

    expect(container.children.length).toBe(regions.length)

    // A causa raiz do bug era hachura + fill acumulando no mesmo path de uma
    // instância compartilhada. Com 1 Graphics por região isso não pode voltar a
    // acontecer — a prova real é inspecionar o GraphicsContext de cada instância:
    // exatamente 1 `fill` (o preenchimento base da região) e exatamente 2
    // `stroke` (contorno da região + traço da hachura), nunca mais que isso.
    for (const child of container.children) {
      const g = child as Graphics
      expect(countFillInstructions(g)).toBe(1)
      expect(countStrokeInstructions(g)).toBe(2)
    }
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

/**
 * `container.children[0]` já sabendo que É um `Graphics` de verdade — mesmo
 * cast que o resto deste arquivo já usa (`child as Graphics`, no teste de
 * hachura acima): `Container.children` é tipado `ContainerChild[]` (tipo
 * genérico da própria lib, `node_modules/pixi.js/lib/scene/container/
 * Container.d.ts:639`), mas o único código que popula este `container` nos
 * testes abaixo é `createRegionsRenderer`, que só adiciona instâncias de
 * `Graphics` (`pixi/drawRegions.ts`) — nunca outro tipo de `ContainerChild`.
 * Centralizado aqui (1 cast comentado) em vez de repetido em cada teste.
 */
function firstGraphics(container: Container): Graphics {
  return container.children[0] as Graphics
}

describe('createRegionsRenderer — Region.filled (pedido N2, "só contorno sem fundo")', () => {
  it('filled ausente (undefined): preenche igual hoje — 1 fill + 1 stroke', () => {
    const container = new Container()
    const renderer = createRegionsRenderer()
    renderer.draw(container, [buildSquareRegion('r1')], null)

    const g = firstGraphics(container)
    expect(countFillInstructions(g)).toBe(1)
    expect(countStrokeInstructions(g)).toBe(1)
  })

  it('filled: false — não preenche mais: 0 fill, contorno (stroke) continua desenhando', () => {
    const container = new Container()
    const renderer = createRegionsRenderer()
    renderer.draw(container, [buildSquareRegion('r1', { filled: false })], null)

    const g = firstGraphics(container)
    expect(countFillInstructions(g)).toBe(0)
    expect(countStrokeInstructions(g)).toBe(1)
  })

  it('filled: false + fillPattern hatch: hachura também não desenha (é tratamento de fundo) — só 1 stroke, o do contorno', () => {
    const container = new Container()
    const renderer = createRegionsRenderer()
    renderer.draw(container, [buildSquareRegion('r1', { filled: false, fillPattern: 'hatch' })], null)

    const g = firstGraphics(container)
    expect(countFillInstructions(g)).toBe(0)
    expect(countStrokeInstructions(g)).toBe(1)
  })
})

describe('createRegionsRenderer — Region.strokeWidth/strokeJoin (pedido G2, "rua/construção artesanal")', () => {
  it('strokeWidth ausente: contorno sai com 2px (comportamento de hoje) e junção miter (default do Pixi)', () => {
    const container = new Container()
    const renderer = createRegionsRenderer()
    renderer.draw(container, [buildSquareRegion('r1')], null)

    const style = strokeStyleAt(firstGraphics(container))
    expect(style.width).toBe(2)
    expect(style.join).toBe('miter')
  })

  it('strokeWidth: 12 (preset "grosso") é aplicado ao contorno de verdade', () => {
    const container = new Container()
    const renderer = createRegionsRenderer()
    renderer.draw(container, [buildSquareRegion('r1', { strokeWidth: 12 })], null)

    expect(strokeStyleAt(firstGraphics(container)).width).toBe(12)
  })

  it('região SELECIONADA mantém o strokeWidth configurado; o destaque é um contorno à parte, por fora', () => {
    const container = new Container()
    const renderer = createRegionsRenderer()
    renderer.draw(container, [buildSquareRegion('r1', { strokeWidth: 12 })], 'r1', 1)

    const g = firstGraphics(container)
    // [0] contorno de seleção: meia espessura real + 2 px de tela, alinhado por fora.
    expect(strokeStyleAt(g, 0)).toMatchObject({ color: 0xffdd55, width: 12 / 2 + 2, alignment: 0 })
    // [1] contorno real, intacto.
    expect(strokeStyleAt(g, 1).width).toBe(12)
  })

  it("strokeJoin: 'round' é aplicado ao contorno de verdade", () => {
    const container = new Container()
    const renderer = createRegionsRenderer()
    renderer.draw(container, [buildSquareRegion('r1', { strokeJoin: 'round' })], null)

    expect(strokeStyleAt(firstGraphics(container)).join).toBe('round')
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
    const container = new Container()
    const renderer = createRegionsRenderer()
    const region = buildSquareRegion('sala-1')
    const walls = [buildWall('w1', 'sala-1')]

    const highlighted = resolveHighlightedRegionId(walls, { kind: 'region', id: 'sala-1' })
    renderer.draw(container, [region], highlighted, 1)

    const g = firstGraphics(container)
    // Auditoria 14/09: o amarelo pintava por cima da cor e da hachura. Agora
    // [0] é o contorno de seleção (sem fill próprio) e [1] o contorno real.
    expect(strokeStyleAt(g, 0)).toMatchObject({ color: 0xffdd55, alignment: 0, width: 2 / 2 + 2 })
    expect(strokeStyleAt(g, 1)).toMatchObject({ color: 0x204060, width: 2 })
    const fillsOf = g.context.instructions.filter((i) => i.action === 'fill')
    expect(fillsOf).toHaveLength(1)
    expect(fillsOf[0].action === 'fill' && fillsOf[0].data.style).toMatchObject({ color: 0x204060, alpha: 1 })
  })

  it('BUG 22 corrigido: parede-dona-de-Sala selecionada (kind "wall") também destaca a região', () => {
    const container = new Container()
    const renderer = createRegionsRenderer()
    const region = buildSquareRegion('sala-1')
    const walls = [buildWall('w1', 'sala-1'), buildWall('w2', 'sala-1'), buildWall('w3', 'sala-1'), buildWall('w4', 'sala-1')]

    // Usuário clicou numa das 4 paredes que a Sala gerou — não na região.
    const highlighted = resolveHighlightedRegionId(walls, { kind: 'wall', id: 'w3' })
    renderer.draw(container, [region], highlighted, 1)

    const g = firstGraphics(container)
    expect(strokeStyleAt(g, 0).color).toBe(0xffdd55) // contorno de seleção
    expect(strokeStyleAt(g, 1).color).toBe(0x204060) // cor real preservada
  })

  it('região hachurada selecionada: a hachura continua desenhada', () => {
    const container = new Container()
    const renderer = createRegionsRenderer()
    renderer.draw(container, [buildSquareRegion('sala-1', { fillPattern: 'hatch' })], 'sala-1', 1)

    const g = firstGraphics(container)
    // seleção + contorno real + hachura
    expect(countStrokeInstructions(g)).toBe(3)
  })

  it('contorno de seleção tem 2 px de TELA: a zoom 50% ele vale 4 de mundo', () => {
    const container = new Container()
    const renderer = createRegionsRenderer()
    renderer.draw(container, [buildSquareRegion('sala-1')], 'sala-1', 0.5)

    expect(strokeStyleAt(firstGraphics(container), 0).width).toBe(2 / 2 + 4)
  })

  it('parede selecionada que NÃO é dona de nenhuma região: a região continua com a cor normal (sem falso positivo)', () => {
    const container = new Container()
    const renderer = createRegionsRenderer()
    const region = buildSquareRegion('sala-1')
    const walls = [buildWall('solta')] // sem regionId

    const highlighted = resolveHighlightedRegionId(walls, { kind: 'wall', id: 'solta' })
    renderer.draw(container, [region], highlighted)

    const g = firstGraphics(container)
    expect(strokeStyleAt(g).color).toBe(0x204060) // fillColor de buildSquareRegion, não SELECTION_COLOR
    expect(strokeStyleAt(g).width).toBe(2) // default, sem o realce de +2 de seleção
  })
})
