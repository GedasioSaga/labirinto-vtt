/**
 * Desenho da miniatura de uma cena (G14, visão geral das cenas): o que vai
 * para o SVG sai daqui, em px de MUNDO, sem espelhar e sem inventar. A régua
 * e2e (`task-jornada-visao-geral-das-cenas.spec.ts`) lê a cor na foto; aqui se
 * cobra a geometria e as regras que a foto não separa (camada oculta, ficha
 * fantasma, raio mínimo, porta).
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { sceneArt } from './sceneOverviewArt'

const GRADE = 50
const LARGURA = 20 * GRADE
const ALTURA = 16 * GRADE
const CHAO_CRIPTA = '#8c1e8c'
const LARANJA = '#ff5a00'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, color: LARANJA, ...extra }
}

/** A Cripta da régua: 20 x 16 quadros de 50 px, chão num retângulo com 10 px de margem. */
function cripta(tokens: Token[] = [], extra: Partial<MapData> = {}): MapData {
  const base = createEmptyMap('map_cripta', 'Cripta', 20, 16, GRADE)
  return {
    ...base,
    floor: [{ id: 'chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: CHAO_CRIPTA },
    tokens,
    ...extra,
  }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

/** Caixa que envolve os pontos de um `d` de path feito só de M, L e Z. */
function caixaDoPath(d: string): { x1: number; y1: number; x2: number; y2: number } {
  const numeros = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const xs = numeros.filter((_, i) => i % 2 === 0)
  const ys = numeros.filter((_, i) => i % 2 === 1)
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }
}

describe('sceneArt: miniatura de uma cena', () => {
  it('o quadro é o retângulo do mapa inteiro, na mesma orientação do editor', () => {
    const arte = sceneArt(cripta())
    expect(arte).not.toBeNull()
    expect(arte?.frame).toEqual({ x: 0, y: 0, width: LARGURA, height: ALTURA })
  })

  it('o chão sai com a cor do chão da cena e cobre a peça (margem de 10 px), com a precisão da amostra', () => {
    const arte = sceneArt(cripta())
    expect(arte?.floor).toHaveLength(1)
    const chao = arte?.floor[0]
    expect(chao?.color).toBe(CHAO_CRIPTA)
    const caixa = caixaDoPath(chao?.d ?? '')
    const folga = 8
    expect(caixa.x1).toBeGreaterThan(10 - folga)
    expect(caixa.x1).toBeLessThan(10 + folga)
    expect(caixa.y1).toBeGreaterThan(10 - folga)
    expect(caixa.y1).toBeLessThan(10 + folga)
    expect(caixa.x2).toBeGreaterThan(LARGURA - 10 - folga)
    expect(caixa.x2).toBeLessThan(LARGURA - 10 + folga)
    expect(caixa.y2).toBeGreaterThan(ALTURA - 10 - folga)
    expect(caixa.y2).toBeLessThan(ALTURA - 10 + folga)
  })

  it('a ficha fica onde está no mapa (canto de cima à direita), na cor dela e com o raio do editor', () => {
    const arte = sceneArt(cripta([ficha('lanterna', LARGURA - 125, 125, { name: 'Lanterna' })]))
    expect(arte?.tokens).toEqual([{ id: 'lanterna', name: 'Lanterna', cx: LARGURA - 125, cy: 125, r: GRADE / 2 - 2, color: LARANJA, ghost: false }])
  })

  it('mapa grande: a ficha nunca some da miniatura — o raio não fica abaixo do mínimo legível', () => {
    const base = createEmptyMap('grande', 'Planície', 200, 200, GRADE)
    const arte = sceneArt({ ...base, tokens: [ficha('a', 5000, 5000)] })
    const raio = arte?.tokens[0]?.r ?? 0
    // 10.000 px de mundo na miniatura mais estreita: o raio do editor (23 px) viraria meio pixel.
    expect(raio).toBeGreaterThan(GRADE / 2 - 2)
    expect(raio / (arte?.worldPerPx ?? 1)).toBeGreaterThanOrEqual(3)
  })

  it('ficha sem cor, ou com cor inválida, sai no azul de fábrica do editor', () => {
    const arte = sceneArt(cripta([ficha('a', 100, 100, { color: undefined }), ficha('b', 200, 200, { color: 'vermelho' })]))
    expect(arte?.tokens.map((t) => t.color)).toEqual(['#5a8fd6', '#5a8fd6'])
  })

  it('ficha "Oculta no editor" aparece como fantasma, como no editor', () => {
    const arte = sceneArt(cripta([ficha('a', 100, 100, { hidden: true }), ficha('b', 200, 200)]))
    expect(arte?.tokens.map((t) => t.ghost)).toEqual([true, false])
  })

  it('camada oculta no editor fica fora da miniatura: Tokens some com as fichas, Salas some com o chão', () => {
    const arte = sceneArt(cripta([ficha('a', 100, 100)], { hiddenLayers: ['tokens', 'salas'] }))
    expect(arte?.tokens).toEqual([])
    expect(arte?.floor).toEqual([])
  })

  it('parede sem porta é linha; parede com porta vira só o retângulo pequeno da porta (trancada em vermelho)', () => {
    const arte = sceneArt(
      cripta([], {
        walls: [
          parede('p1', 100, 100, 400, 100),
          parede('porta', 400, 100, 500, 100, { open: false, locked: false, kind: 'normal' }),
          parede('trancada', 500, 100, 600, 100, { open: false, locked: true, kind: 'normal' }),
        ],
      }),
    )
    const linhas = (arte?.walls ?? []).map((w) => w.d).join('')
    expect(linhas).toContain('M100 100L400 100')
    expect(linhas).not.toContain('M400 100L500 100')
    expect(arte?.doors.map((p) => [p.color, p.filled])).toEqual([
      ['#d08c3a', true],
      ['#c0392b', true],
    ])
    // A porta ocupa 60% do vão, centrada nele: de 420 a 480 no vão de 400 a 500.
    const porta = caixaDoPath(arte?.doors[0]?.d ?? '')
    expect(porta.x1).toBeCloseTo(420, 0)
    expect(porta.x2).toBeCloseTo(480, 0)
  })

  it('sala (Região) entra pintada com a cor dela; a sem fundo fica só no contorno', () => {
    const arte = sceneArt(
      cripta([], {
        floor: [],
        regions: [
          { id: 'r1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], tag: '', fillColor: '#335577', fillPattern: 'solid', data: {} },
          { id: 'r2', points: [{ x: 200, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 }], tag: '', fillColor: '#775533', fillPattern: 'solid', data: {}, filled: false },
        ],
      }),
    )
    expect(arte?.regions.map((r) => [r.color, r.filled])).toEqual([
      ['#335577', true],
      ['#775533', false],
    ])
  })

  it('conteúdo fora do retângulo do mapa alarga o quadro: nada é cortado', () => {
    const arte = sceneArt(cripta([ficha('fora', LARGURA + 200, 100)]))
    const quadro = arte?.frame
    expect((quadro?.x ?? 0) + (quadro?.width ?? 0)).toBeGreaterThanOrEqual(LARGURA + 200 + GRADE / 2 - 2)
    expect(quadro?.x).toBe(0)
  })

  it('mapa sem área desenhável e sem nada dentro: não há miniatura a desenhar', () => {
    expect(sceneArt(createEmptyMap('zero', 'Nada', 0, 0, GRADE))).toBeNull()
  })

  it('o render fiel de minimapa (raster) tem fundo preto, como no editor', () => {
    const base = cripta()
    expect(sceneArt(base)?.background).toBe('#2b2b2b')
    expect(sceneArt({ ...base, floorStyle: { ...base.floorStyle, renderMode: 'raster' } })?.background).toBe('#000000')
  })
})
