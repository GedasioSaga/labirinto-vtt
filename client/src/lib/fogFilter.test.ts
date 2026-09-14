import { describe, expect, it } from 'vitest'
import type { MapData, Token, Wall } from '../types/map'
import { pointInRing } from './floorContour'
import { filterMapForHost, filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

/** Duas salas separadas por uma parede vertical em x=500. */
function twoRooms(patch: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    walls: [wall('divisoria', 500, 0, 500, 1000)],
    tokens: [token('heroi', 200, 200), token('aliado', 300, 250), token('espiao', 800, 200), token('ladino', 800, 800)],
    ...patch,
  }
}

const ownership = { p1: ['heroi'], p2: ['ladino'] }
const RADIUS = 700

describe('filterMapForPlayer', () => {
  it('token de outro jogador atrás de parede não aparece no JSON enviado', () => {
    const { map } = filterMapForPlayer(twoRooms(), 'p1', ownership, RADIUS)
    const json = JSON.stringify(map)
    expect(json).not.toContain('espiao')
    expect(json).not.toContain('ladino')
    expect(json).toContain('nome-heroi')
  })

  it('token visível na mesma sala é mantido', () => {
    const { map, vision } = filterMapForPlayer(twoRooms(), 'p1', ownership, RADIUS)
    expect(map.tokens.map((t) => t.id).sort()).toEqual(['aliado', 'heroi'])
    expect(vision).toHaveLength(1)
  })

  it('dois jogadores recebem conjuntos diferentes', () => {
    const own = { p1: ['heroi'], p2: ['ladino'] }
    const a = filterMapForPlayer(twoRooms(), 'p1', own, RADIUS).map.tokens.map((t) => t.id).sort()
    const b = filterMapForPlayer(twoRooms(), 'p2', own, RADIUS).map.tokens.map((t) => t.id).sort()
    expect(a).toEqual(['aliado', 'heroi'])
    expect(b).toEqual(['espiao', 'ladino'])
  })

  it('porta aberta deixa ver o outro lado; fechada não', () => {
    const door = { open: true, locked: false, kind: 'normal' as const }
    const walls = [wall('cima', 500, 0, 500, 150), wall('porta', 500, 150, 500, 250, { door }), wall('baixo', 500, 250, 500, 1000)]
    const open = filterMapForPlayer(twoRooms({ walls }), 'p1', ownership, RADIUS).map
    expect(open.tokens.map((t) => t.id)).toContain('espiao')
    const closedWalls = walls.map((w) => (w.id === 'porta' ? { ...w, door: { ...door, open: false } } : w))
    const closed = filterMapForPlayer(twoRooms({ walls: closedWalls }), 'p1', ownership, RADIUS).map
    expect(closed.tokens.map((t) => t.id)).not.toContain('espiao')
  })

  it('remove itens hidden sempre, mesmo dentro da visão, e o próprio token oculto', () => {
    const map = twoRooms({
      tokens: [token('heroi', 200, 200), token('fantasma', 220, 200, { hidden: true })],
      lights: [{ id: 'luz-oculta', x: 210, y: 210, radius: 50, color: '#fff', intensity: 1, hidden: true }],
    })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    expect(JSON.stringify(out)).not.toContain('fantasma')
    expect(out.lights).toEqual([])
  })

  it('mantém planta inteira (paredes sem porta, chão, moldura) e corta entidades fora da visão', () => {
    const map = twoRooms({
      markers: [
        { id: 'mk-perto', cx: 250, cy: 250, w: 4, h: 4, rotation: 0, color: '#000' },
        { id: 'mk-longe', cx: 800, cy: 250, w: 4, h: 4, rotation: 0, color: '#000' },
      ],
      drawings: [{ id: 'txt-longe', kind: 'text', x: 900, y: 900, text: 'segredo', color: '#fff', fontSize: 12 }],
      frame: { title: 'Masmorra', x: 0, y: 0, w: 1000, h: 1000 },
    })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    expect(out.walls.map((w) => w.id)).toEqual(['divisoria'])
    expect(out.markers.map((m) => m.id)).toEqual(['mk-perto'])
    expect(JSON.stringify(out)).not.toContain('segredo')
    expect(out.frame).toEqual(map.frame)
  })

  it('benchmark: 8 tokens × 800 paredes × 2000 entidades', () => {
    const walls: Wall[] = []
    for (let i = 0; i < 800; i += 1) {
      const x = (i * 37) % 2000
      const y = (i * 91) % 2000
      walls.push(wall(`w${i}`, x, y, x + 30 + (i % 5) * 10, y + ((i % 7) - 3) * 10))
    }
    const tokens: Token[] = []
    for (let k = 0; k < 8; k += 1) tokens.push(token(`t${k}`, 250 * k + 100, 250 * k + 100))
    const markers = []
    for (let i = 0; i < 2000; i += 1) {
      markers.push({ id: `mk${i}`, cx: (i * 53) % 2000, cy: (i * 97) % 2000, w: 4, h: 4, rotation: 0, color: '#000' })
    }
    const map = { ...createEmptyMap('m', 'M', 2000, 2000, 40), walls, tokens, markers }
    const own = { p1: tokens.map((t) => t.id) }
    const start = performance.now()
    const { map: out, vision } = filterMapForPlayer(map, 'p1', own, 600)
    console.log(`filterMapForPlayer benchmark: ${(performance.now() - start).toFixed(1)} ms, ${out.markers.length} marcadores visíveis`)
    expect(vision).toHaveLength(8)
    // Equivalência: o pré-filtro por caixa envolvente não muda quem é visível.
    const expected = markers
      .filter((m) => vision.some((ring) => ring.length >= 3 && pointInRing({ x: m.cx, y: m.cy }, ring)))
      .map((m) => m.id)
    expect(out.markers.map((m) => m.id)).toEqual(expected)
    expect(expected.length).toBeGreaterThan(0)
    expect(expected.length).toBeLessThan(markers.length)
  })

  it('camada oculta não sai e caminho local (fundo, token, prop) é removido', () => {
    const map = twoRooms({
      background: { type: 'image', src: 'C:\\mapas\\fundo.png' },
      tokens: [token('heroi', 200, 200, { image: 'C:\\imagens\\heroi.png' }), token('aliado', 300, 250)],
      props: [
        { id: 'bau', src: 'C:\\props\\bau.png', x: 220, y: 220, width: 40, height: 40, linkedMapPath: 'C:\\mapas\\andar2.json' },
        { id: 'vaso-decor', src: 'C:\\props\\vaso.png', x: 230, y: 230, width: 40, height: 40, linkedMapPath: null, layer: 'decoracao' },
      ],
      lights: [{ id: 'tocha-camada-oculta', x: 210, y: 210, radius: 50, color: '#fff', intensity: 1 }],
      drawings: [{ id: 'nota-camada-oculta', kind: 'text', x: 210, y: 210, text: 'anotacao', color: '#fff', fontSize: 12 }],
      hiddenLayers: ['iluminacao', 'anotacoes', 'decoracao'],
    })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    const json = JSON.stringify(out)
    expect(json).not.toContain('C:\\\\')
    expect(json).not.toContain('tocha-camada-oculta')
    expect(json).not.toContain('nota-camada-oculta')
    expect(json).not.toContain('vaso-decor')
    expect(out.props.map((p) => p.id)).toEqual(['bau'])
    expect(out.tokens.find((t) => t.id === 'heroi')?.image).toBeNull()
    expect(out.background).toEqual({ type: 'image', src: '' })
    // O mapa do mestre não é mutado.
    expect(map.tokens[0]?.image).toBe('C:\\imagens\\heroi.png')
  })

  it('fundo de cor segue igual', () => {
    const map = twoRooms()
    expect(filterMapForPlayer(map, 'p1', ownership, RADIUS).map.background).toEqual(map.background)
  })

  it('linha, desenho e região: qualquer vértice dentro da visão basta; centro fora não esconde', () => {
    const map = twoRooms({
      // Primeiro ponto do outro lado da parede, último dentro da sala do herói.
      lines: [{ id: 'trilha', points: [{ x: 800, y: 200 }, { x: 250, y: 200 }], closed: false, dotted: false, color: '#000', width: 2 }],
      drawings: [
        { id: 'traco', kind: 'freehand', points: [{ x: 900, y: 900 }, { x: 260, y: 260 }], color: '#000', width: 2 },
        { id: 'retangulo', kind: 'rect', x: 450, y: 100, w: 400, h: 100, color: '#000', width: 2, filled: false, fillAlpha: 0 },
        { id: 'traco-longe', kind: 'freehand', points: [{ x: 900, y: 900 }, { x: 800, y: 800 }], color: '#000', width: 2 },
      ],
      regions: [
        {
          id: 'sala-larga',
          points: [{ x: 300, y: 300 }, { x: 990, y: 300 }, { x: 990, y: 990 }],
          tag: '',
          fillColor: '#000',
          fillPattern: 'solid',
          data: {},
        },
      ],
    })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    expect(out.lines.map((l) => l.id)).toEqual(['trilha'])
    expect(out.drawings.map((d) => d.id)).toEqual(['traco', 'retangulo'])
    expect(out.regions.map((r) => r.id)).toEqual(['sala-larga'])
  })

  it('jogador sem token não vê entidade nenhuma', () => {
    const { map, vision } = filterMapForPlayer(twoRooms(), 'ninguem', ownership, RADIUS)
    expect(map.tokens).toEqual([])
    expect(vision).toEqual([])
  })
})

describe('filterMapForHost', () => {
  it('devolve o mapa sem cortes', () => {
    const map = twoRooms()
    expect(filterMapForHost(map)).toBe(map)
  })
})
