import { describe, expect, it } from 'vitest'
import type { ConcealZone, MapData, Region, Token, Wall } from '../types/map'
import { createExploration, markRings } from './exploration'
import { pointInRing } from './floorContour'
import { filterMapForHost, filterMapForPlayer } from './fogFilter'
import { buildFloorPiece } from './floorTool'
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

  describe('com explorado', () => {
    /** Explorado cobrindo a sala da direita (x 520-980), onde o herói não enxerga. */
    function exploredRightRoom() {
      const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
      markRings(exp, [[{ x: 520, y: 20 }, { x: 980, y: 20 }, { x: 980, y: 980 }, { x: 520, y: 980 }]])
      return exp
    }

    function mapWithRightRoomPlan(): MapData {
      const door = { open: false, locked: false, kind: 'normal' as const }
      return twoRooms({
        regions: [
          { id: 'sala-direita', points: [{ x: 600, y: 100 }, { x: 900, y: 100 }, { x: 900, y: 400 }, { x: 600, y: 400 }], tag: '', fillColor: '#a33', fillPattern: 'solid', data: {} },
        ],
        drawings: [
          { id: 'txt-explorado', kind: 'text', x: 700, y: 300, text: 'placa-da-sala', color: '#fff', fontSize: 12 },
        ],
        walls: [wall('divisoria', 500, 0, 500, 1000), wall('porta-direita', 700, 500, 800, 500, { door })],
        stairs: [{ id: 'escada-direita', segments: [{ x1: 650, y1: 600, x2: 750, y2: 600 }] }] as MapData['stairs'],
        lines: [{ id: 'trilha-direita', points: [{ x: 600, y: 700 }, { x: 700, y: 700 }], closed: false, dotted: false, color: '#000', width: 2 }],
        markers: [{ id: 'mk-direita', cx: 850, cy: 850, w: 4, h: 4, rotation: 0, color: '#000' }],
        props: [{ id: 'bau-direita', src: '', x: 820, y: 220, width: 40, height: 40, linkedMapPath: null }],
        lights: [{ id: 'tocha-direita', x: 820, y: 240, radius: 50, color: '#fff', intensity: 1 }],
      })
    }

    it('sala só explorada é enviada, com texto, escada, porta, linha e marcador', () => {
      const { map: out } = filterMapForPlayer(mapWithRightRoomPlan(), 'p1', ownership, RADIUS, exploredRightRoom())
      expect(out.regions.map((r) => r.id)).toEqual(['sala-direita'])
      expect(out.drawings.map((d) => d.id)).toEqual(['txt-explorado'])
      expect(out.stairs.map((s) => s.id)).toEqual(['escada-direita'])
      expect(out.walls.map((w) => w.id)).toEqual(['divisoria', 'porta-direita'])
      expect(out.lines.map((l) => l.id)).toEqual(['trilha-direita'])
      expect(out.markers.map((m) => m.id)).toEqual(['mk-direita'])
    })

    it('SEGURANÇA: token, prop e luz dentro da área explorada mas fora da visão NÃO saem no JSON', () => {
      const { map: out } = filterMapForPlayer(mapWithRightRoomPlan(), 'p1', ownership, RADIUS, exploredRightRoom())
      const json = JSON.stringify(out)
      expect(json).not.toContain('espiao')
      expect(json).not.toContain('ladino')
      expect(json).not.toContain('bau-direita')
      expect(json).not.toContain('tocha-direita')
      expect(out.tokens.map((t) => t.id).sort()).toEqual(['aliado', 'heroi'])
    })

    it('texto e sala não explorados nem visíveis não são enviados', () => {
      const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
      markRings(exp, [[{ x: 520, y: 900 }, { x: 980, y: 900 }, { x: 980, y: 980 }, { x: 520, y: 980 }]])
      const { map: out } = filterMapForPlayer(mapWithRightRoomPlan(), 'p1', ownership, RADIUS, exp)
      const json = JSON.stringify(out)
      expect(json).not.toContain('placa-da-sala')
      expect(json).not.toContain('sala-direita')
      expect(json).not.toContain('porta-direita')
      expect(out.markers).toEqual([])
    })

    it('SEGURANÇA: porta explorada nunca vista com estado sai fechada e destrancada; a memória vale fora da visão', () => {
      const map = mapWithRightRoomPlan()
      const live: MapData = {
        ...map,
        walls: map.walls.map((w) => (w.id === 'porta-direita' ? { ...w, door: { open: true, locked: true, kind: 'double' as const } } : w)),
      }
      const never = filterMapForPlayer(live, 'p1', ownership, RADIUS, exploredRightRoom()).map
      expect(never.walls.find((w) => w.id === 'porta-direita')?.door).toEqual({ open: false, locked: false, kind: 'double' })
      const remembered = new Map([['porta-direita', { open: true, locked: false, kind: 'double' as const }]])
      const withMemory = filterMapForPlayer(live, 'p1', ownership, RADIUS, exploredRightRoom(), remembered)
      expect(withMemory.map.walls.find((w) => w.id === 'porta-direita')?.door).toEqual({ open: true, locked: false, kind: 'double' })
      expect(withMemory.visibleDoorIds).toEqual([])
      // Memória é só leitura: o filtro não a altera.
      expect(remembered.get('porta-direita')).toEqual({ open: true, locked: false, kind: 'double' })
    })

    it('camada oculta e item hidden continuam fora mesmo explorados', () => {
      const map = mapWithRightRoomPlan()
      const hidden: MapData = { ...map, regions: map.regions.map((r) => ({ ...r, hidden: true })), hiddenLayers: ['anotacoes'] }
      const { map: out } = filterMapForPlayer(hidden, 'p1', ownership, RADIUS, exploredRightRoom())
      expect(out.regions).toEqual([])
      expect(JSON.stringify(out)).not.toContain('placa-da-sala')
    })
  })

  it('SEGURANÇA: scenarioLink, ownerId e fog.revealed do mestre não saem; camadas seguem para o render', () => {
    const map = twoRooms({
      scenarioLink: 'C:\\cenarios\\link-secreto.json',
      ownerId: 'dono-mestre-123',
      fog: { mode: 'per-token', revealed: ['area-revelada-secreta'] },
      hiddenLayers: ['anotacoes'],
      lockedLayers: ['paredes'],
    })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    const json = JSON.stringify(out)
    expect(json).not.toContain('link-secreto')
    expect(json).not.toContain('dono-mestre-123')
    expect(json).not.toContain('area-revelada-secreta')
    expect(out.scenarioLink).toBeNull()
    expect(out.ownerId).toBeNull()
    expect(out.fog).toEqual({ mode: 'per-token', revealed: [] })
    expect(out.hiddenLayers).toEqual(['anotacoes'])
    expect(out.lockedLayers).toEqual(['paredes'])
  })

  it('jogador sem token não vê entidade nenhuma', () => {
    const { map, vision } = filterMapForPlayer(twoRooms(), 'ninguem', ownership, RADIUS)
    expect(map.tokens).toEqual([])
    expect(vision).toEqual([])
  })
})

describe('filterMapForPlayer — A5: oculto para jogadores e zona oculta', () => {
  /** Retângulo 260..360 × 220..300: cobre o 'aliado' (300,250), longe do 'heroi' (200,200). */
  const ZONE_POINTS = [
    { x: 260, y: 220 },
    { x: 360, y: 220 },
    { x: 360, y: 300 },
    { x: 260, y: 300 },
  ]

  function zone(revealed: boolean): ConcealZone {
    return { id: 'zona-cripta', name: 'nome-da-zona-cripta', revealed, points: ZONE_POINTS }
  }

  function room(id: string, name: string, points: Region['points'], extra: Partial<Region> = {}): Region {
    return { id, points, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name }, ...extra }
  }

  /** Sala pequena e texto inteiros dentro da zona, na mesma sala do herói (sem parede no caminho). */
  function mapWithZone(revealed: boolean): MapData {
    return twoRooms({
      concealZones: [zone(revealed)],
      regions: [room('sala-na-zona', 'nome-sala-na-zona', [{ x: 270, y: 230 }, { x: 350, y: 230 }, { x: 350, y: 290 }, { x: 270, y: 290 }])],
      drawings: [{ id: 'txt-na-zona', kind: 'text', x: 300, y: 270, text: 'segredo-na-zona', color: '#fff', fontSize: 12 }],
    })
  }

  it('SEGURANÇA: token, sala e texto dentro de zona ativa não saem no JSON; voltam depois de Revelar', () => {
    const hidden = filterMapForPlayer(mapWithZone(false), 'p1', ownership, RADIUS)
    const hiddenJson = JSON.stringify(hidden.map)
    expect(hiddenJson).not.toContain('aliado')
    expect(hiddenJson).not.toContain('sala-na-zona')
    expect(hiddenJson).not.toContain('segredo-na-zona')
    // Nome e id da zona são do mestre: só a geometria sai, em `concealed`.
    expect(JSON.stringify(hidden)).not.toContain('nome-da-zona-cripta')
    expect(JSON.stringify(hidden)).not.toContain('zona-cripta')
    expect(hidden.concealed).toEqual([ZONE_POINTS])
    expect(hidden.map.tokens.map((t) => t.id)).toEqual(['heroi'])

    const revealed = filterMapForPlayer(mapWithZone(true), 'p1', ownership, RADIUS)
    const revealedJson = JSON.stringify(revealed.map)
    expect(revealedJson).toContain('aliado')
    expect(revealedJson).toContain('sala-na-zona')
    expect(revealedJson).toContain('segredo-na-zona')
    expect(revealed.concealed).toEqual([])
  })

  it('SEGURANÇA: explorado de antes da zona não vaza a planta de dentro dela', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    markRings(exp, [[{ x: 0, y: 0 }, { x: 490, y: 0 }, { x: 490, y: 490 }, { x: 0, y: 490 }]])
    // Jogador sem token: nada visível, só o explorado poderia mandar a planta.
    const { map: out } = filterMapForPlayer(mapWithZone(false), 'ninguem', ownership, RADIUS, exp)
    const json = JSON.stringify(out)
    expect(json).not.toContain('sala-na-zona')
    expect(json).not.toContain('segredo-na-zona')
    const { map: open } = filterMapForPlayer(mapWithZone(true), 'ninguem', ownership, RADIUS, exp)
    expect(JSON.stringify(open)).toContain('segredo-na-zona')
  })

  it('SEGURANÇA: parede e porta com o meio dentro de zona ativa não saem; parede fora continua', () => {
    const door = { open: false, locked: false, kind: 'normal' as const }
    const map = twoRooms({
      concealZones: [zone(false)],
      walls: [
        wall('divisoria', 500, 0, 500, 1000),
        wall('parede-na-zona', 280, 240, 340, 240),
        wall('porta-na-zona', 280, 280, 340, 280, { door }),
        wall('parede-fora', 100, 400, 150, 400),
      ],
    })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    const json = JSON.stringify(out)
    expect(json).not.toContain('parede-na-zona')
    expect(json).not.toContain('porta-na-zona')
    expect(out.walls.map((w) => w.id).sort()).toEqual(['divisoria', 'parede-fora'])
  })

  it('SEGURANÇA: item secret (token, sala, objeto, escada, desenho) não sai; token próprio secreto sai', () => {
    const map = twoRooms({
      tokens: [token('heroi', 200, 200, { secret: true }), token('aliado', 300, 250, { secret: true })],
      regions: [room('sala-secreta-comum', 'x', [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 }], { room: undefined, secret: true })],
      props: [{ id: 'bau-secreto', src: '', x: 250, y: 300, width: 40, height: 40, linkedMapPath: null, secret: true }],
      stairs: [{ id: 'escada-secreta', shape: 'straight', direction: 'up', stepWidth: 40, segments: [{ x1: 150, y1: 300, x2: 250, y2: 300 }], secret: true }],
      drawings: [
        { id: 'txt-secreto', kind: 'text', x: 220, y: 260, text: 'texto-secreto', color: '#fff', fontSize: 12, secret: true },
        { id: 'linha-secreta', kind: 'line', x1: 150, y1: 150, x2: 250, y2: 150, color: '#fff', width: 2, secret: true },
      ],
    })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    const json = JSON.stringify(out)
    for (const id of ['aliado', 'sala-secreta-comum', 'bau-secreto', 'escada-secreta', 'texto-secreto', 'linha-secreta']) {
      expect(json).not.toContain(id)
    }
    expect(out.tokens.map((t) => t.id)).toEqual(['heroi'])
  })

  it('SEGURANÇA: Sala secret leva junto as paredes dela e os textos dentro dela', () => {
    const points = [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 }]
    const map = twoRooms({
      regions: [room('sala-secreta', 'nome-sala-secreta', points, { secret: true })],
      walls: [wall('divisoria', 500, 0, 500, 1000), wall('parede-da-sala-secreta', 100, 400, 400, 400, { regionId: 'sala-secreta' })],
      drawings: [
        { id: 'txt-dentro', kind: 'text', x: 300, y: 300, text: 'texto-dentro-da-sala-secreta', color: '#fff', fontSize: 12 },
        // Fora da sala e sem a parede dela no caminho do herói (200,200).
        { id: 'txt-fora', kind: 'text', x: 450, y: 150, text: 'texto-fora', color: '#fff', fontSize: 12 },
      ],
    })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    const json = JSON.stringify(out)
    expect(json).not.toContain('sala-secreta')
    expect(json).not.toContain('parede-da-sala-secreta')
    expect(json).not.toContain('texto-dentro-da-sala-secreta')
    expect(json).toContain('texto-fora')
  })

  it('SEGURANÇA: nome oculto da Sala sai vazio, com a sala', () => {
    const points = [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 }]
    const map = twoRooms({ regions: [room('sala-nome-oculto', 'nome-que-o-jogador-nao-ve', points)] })
    const hiddenName: MapData = {
      ...map,
      regions: map.regions.map((r) => (r.room ? { ...r, room: { ...r.room, nameHiddenFromPlayers: true } } : r)),
    }
    const { map: out } = filterMapForPlayer(hiddenName, 'p1', ownership, RADIUS)
    expect(JSON.stringify(out)).not.toContain('nome-que-o-jogador-nao-ve')
    expect(out.regions.map((r) => r.room?.name)).toEqual([''])
    // Com o nome visível, o mesmo mapa manda o nome.
    expect(JSON.stringify(filterMapForPlayer(map, 'p1', ownership, RADIUS).map)).toContain('nome-que-o-jogador-nao-ve')
  })

  describe('sub-salas', () => {
    const casa = [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 }]
    const quarto = [{ x: 150, y: 250 }, { x: 250, y: 250 }, { x: 250, y: 350 }, { x: 150, y: 350 }]
    const armario = [{ x: 160, y: 260 }, { x: 200, y: 260 }, { x: 200, y: 300 }, { x: 160, y: 300 }]

    function nested(casaExtra: Partial<Region>, casaName = 'nome-casa'): MapData {
      return twoRooms({
        regions: [
          room('casa', casaName, casa, casaExtra),
          room('quarto-filho', 'nome-quarto-filho', quarto, { parentId: 'casa' }),
          room('armario-neto', 'nome-armario-neto', armario, { parentId: 'quarto-filho' }),
        ],
        walls: [
          wall('divisoria', 500, 0, 500, 1000),
          wall('parede-do-quarto', 250, 250, 250, 350, { regionId: 'quarto-filho', regionEdgeIndex: 1 }),
          wall('parede-do-armario', 200, 260, 200, 300, { regionId: 'armario-neto', regionEdgeIndex: 1 }),
        ],
      })
    }

    it('SEGURANÇA: mãe secreta esconde filha, neta e as paredes delas', () => {
      const { map: out } = filterMapForPlayer(nested({ secret: true }), 'p1', ownership, RADIUS)
      const json = JSON.stringify(out)
      for (const id of ['casa', 'quarto-filho', 'armario-neto', 'parede-do-quarto', 'parede-do-armario']) expect(json).not.toContain(id)
      expect(out.walls.map((w) => w.id)).toEqual(['divisoria'])
    })

    it('SEGURANÇA: mãe oculta no editor esconde a filha e as paredes dela', () => {
      const { map: out } = filterMapForPlayer(nested({ hidden: true } as Partial<Region>), 'p1', ownership, RADIUS)
      const json = JSON.stringify(out)
      expect(json).not.toContain('quarto-filho')
      expect(json).not.toContain('parede-do-quarto')
    })

    it('nome oculto da mãe não oculta o nome da filha; órfã sai como sala de topo', () => {
      const map = nested({})
      const hiddenName: MapData = {
        ...map,
        regions: map.regions.map((r) => (r.id === 'casa' && r.room ? { ...r, room: { ...r.room, nameHiddenFromPlayers: true } } : r)),
      }
      const { map: out } = filterMapForPlayer(hiddenName, 'p1', ownership, RADIUS)
      const names = Object.fromEntries(out.regions.map((r) => [r.id, r.room?.name]))
      expect(names).toEqual({ casa: '', 'quarto-filho': 'nome-quarto-filho', 'armario-neto': 'nome-armario-neto' })
      expect(JSON.stringify(out)).toContain('parede-do-quarto')

      const orphan = twoRooms({ regions: [room('orfa', 'nome-orfa', quarto, { parentId: 'nao-existe' })] })
      expect(filterMapForPlayer(orphan, 'p1', ownership, RADIUS).map.regions.map((r) => r.id)).toEqual(['orfa'])
    })
  })
})

describe('filterMapForPlayer — revisão de segurança da visibilidade', () => {
  /** Retângulo 260..360 × 220..300, na sala do herói (200,200). */
  const ZONE = [
    { x: 260, y: 220 },
    { x: 360, y: 220 },
    { x: 360, y: 300 },
    { x: 260, y: 300 },
  ]
  const activeZone: ConcealZone = { id: 'zona', name: 'zona', revealed: false, points: ZONE }
  const SECRET_RIGHT = [{ x: 600, y: 100 }, { x: 900, y: 100 }, { x: 900, y: 400 }, { x: 600, y: 400 }]

  function room(id: string, name: string, points: Region['points'], extra: Partial<Region> = {}): Region {
    return { id, points, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name }, ...extra }
  }

  function wholeMapExplored() {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    markRings(exp, [[{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }]])
    return exp
  }

  it('SEGURANÇA: anel de visão não tem a sombra das paredes da sala secreta; token atrás dela continua fora', () => {
    const points = [{ x: 300, y: 150 }, { x: 400, y: 150 }, { x: 400, y: 250 }, { x: 300, y: 250 }]
    const secretWalls = [
      wall('ss-1', 300, 150, 400, 150, { regionId: 'sala-secreta' }),
      wall('ss-2', 400, 150, 400, 250, { regionId: 'sala-secreta' }),
      wall('ss-3', 400, 250, 300, 250, { regionId: 'sala-secreta' }),
      wall('ss-4', 300, 250, 300, 150, { regionId: 'sala-secreta' }),
    ]
    const tokens = [token('heroi', 200, 200), token('atras-da-sala', 450, 200)]
    const plain = filterMapForPlayer(twoRooms({ tokens }), 'p1', ownership, RADIUS)
    const secret = filterMapForPlayer(
      twoRooms({ tokens, regions: [room('sala-secreta', 's', points, { secret: true })], walls: [wall('divisoria', 500, 0, 500, 1000), ...secretWalls] }),
      'p1',
      ownership,
      RADIUS,
    )
    expect(JSON.stringify(secret.vision)).toBe(JSON.stringify(plain.vision))
    // A autoridade continua usando as paredes: o que está atrás delas não sai.
    expect(JSON.stringify(secret.map)).not.toContain('atras-da-sala')
  })

  it('SEGURANÇA: parede e porta dentro de zona ativa não mudam o anel de visão (abrir/fechar a porta não aparece)', () => {
    const door = { open: false, locked: false, kind: 'normal' as const }
    const tokens = [token('heroi', 200, 200)]
    const base = filterMapForPlayer(twoRooms({ tokens, concealZones: [activeZone] }), 'p1', ownership, RADIUS).vision
    const withWalls = (open: boolean) =>
      filterMapForPlayer(
        twoRooms({
          tokens,
          concealZones: [activeZone],
          walls: [wall('divisoria', 500, 0, 500, 1000), wall('pz', 280, 240, 340, 240), wall('portaz', 280, 280, 340, 280, { door: { ...door, open } })],
        }),
        'p1',
        ownership,
        RADIUS,
      ).vision
    expect(JSON.stringify(withWalls(false))).toBe(JSON.stringify(base))
    expect(JSON.stringify(withWalls(true))).toBe(JSON.stringify(base))
  })

  it('SEGURANÇA: marcador, linha e escada dentro de sala secreta não saem, mesmo explorados', () => {
    const map = twoRooms({
      regions: [room('sala-secreta', 's', SECRET_RIGHT, { secret: true })],
      markers: [
        { id: 'mk-na-secreta', cx: 700, cy: 200, w: 4, h: 4, rotation: 0, color: '#000' },
        { id: 'mk-fora', cx: 700, cy: 700, w: 4, h: 4, rotation: 0, color: '#000' },
      ],
      lines: [{ id: 'linha-na-secreta', points: [{ x: 650, y: 300 }, { x: 750, y: 300 }], closed: false, dotted: false, color: '#000', width: 2 }],
      stairs: [{ id: 'escada-na-secreta', shape: 'straight', direction: 'up', stepWidth: 40, segments: [{ x1: 650, y1: 250, x2: 750, y2: 250 }] }],
    })
    const { map: out } = filterMapForPlayer(map, 'ninguem', ownership, RADIUS, wholeMapExplored())
    const json = JSON.stringify(out)
    expect(json).not.toContain('mk-na-secreta')
    expect(json).not.toContain('linha-na-secreta')
    expect(json).not.toContain('escada-na-secreta')
    expect(json).toContain('mk-fora')
  })

  it('SEGURANÇA: peça de chão dentro de sala secreta ou de zona ativa não sai; o chão principal sai', () => {
    const map = twoRooms({
      concealZones: [activeZone],
      regions: [room('sala-secreta', 's', SECRET_RIGHT, { secret: true })],
      floor: [
        buildFloorPiece('chao-principal', { kind: 'rect', cx: 500, cy: 500, w: 1000, h: 1000 }, 'add'),
        buildFloorPiece('chao-secreto', { kind: 'rect', cx: 750, cy: 250, w: 200, h: 200 }, 'add'),
        buildFloorPiece('chao-na-zona', { kind: 'rect', cx: 310, cy: 260, w: 60, h: 40 }, 'add'),
      ],
    })
    const json = JSON.stringify(filterMapForPlayer(map, 'p1', ownership, RADIUS).map)
    expect(json).not.toContain('chao-secreto')
    expect(json).not.toContain('chao-na-zona')
    expect(json).toContain('chao-principal')
  })

  it('SEGURANÇA: a borda do chão da sala secreta não desenha o formato dela no anel de visão', () => {
    const principal = buildFloorPiece('chao-principal', { kind: 'rect', cx: 250, cy: 500, w: 500, h: 1000 }, 'add')
    const base = { tokens: [token('heroi', 200, 200)], walls: [] }
    const plain = filterMapForPlayer(twoRooms({ ...base, floor: [principal] }), 'p1', ownership, RADIUS).vision
    const secret = filterMapForPlayer(
      twoRooms({
        ...base,
        regions: [room('sala-secreta', 's', [{ x: 500, y: 100 }, { x: 700, y: 100 }, { x: 700, y: 300 }, { x: 500, y: 300 }], { secret: true })],
        floor: [principal, buildFloorPiece('chao-secreto', { kind: 'rect', cx: 600, cy: 200, w: 200, h: 200 }, 'add')],
      }),
      'p1',
      ownership,
      RADIUS,
    ).vision
    expect(JSON.stringify(secret)).toBe(JSON.stringify(plain))
  })

  it('SEGURANÇA: sala com a maioria das amostras dentro de zona ativa sai sem nome', () => {
    const map = twoRooms({
      concealZones: [activeZone],
      regions: [room('sala-na-borda', 'nome-escondido-borda', [{ x: 250, y: 230 }, { x: 350, y: 230 }, { x: 350, y: 290 }, { x: 250, y: 290 }])],
    })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    expect(JSON.stringify(out)).not.toContain('nome-escondido-borda')
    expect(out.regions.map((r) => r.room?.name)).toEqual([''])
  })

  it('SEGURANÇA: parede sem porta, desenho de traço e linha com uma ponta dentro de zona ativa não saem', () => {
    const map = twoRooms({
      concealZones: [activeZone],
      walls: [wall('divisoria', 500, 0, 500, 1000), wall('parede-borda', 300, 280, 450, 280)],
      drawings: [
        { id: 'traco-borda', kind: 'line', x1: 300, y1: 250, x2: 450, y2: 250, color: '#fff', width: 2 },
        { id: 'mao-borda', kind: 'freehand', points: [{ x: 450, y: 240 }, { x: 400, y: 240 }, { x: 300, y: 240 }], color: '#fff', width: 2 },
      ],
      lines: [{ id: 'trilha-borda', points: [{ x: 300, y: 235 }, { x: 450, y: 235 }], closed: false, dotted: false, color: '#000', width: 2 }],
    })
    const json = JSON.stringify(filterMapForPlayer(map, 'p1', ownership, RADIUS).map)
    for (const id of ['parede-borda', 'traco-borda', 'mao-borda', 'trilha-borda']) expect(json).not.toContain(id)
    expect(json).toContain('divisoria')
  })
})

describe('filterMapForHost', () => {
  it('devolve o mapa sem cortes', () => {
    const map = twoRooms()
    expect(filterMapForHost(map)).toBe(map)
  })
})

describe('filterMapForPlayer — tocha presa na ficha', () => {
  it('a tocha presa na própria ficha chega com o vínculo (a tela do jogador leva a luz junto)', () => {
    const map = twoRooms({ lights: [{ id: 'tocha', x: 250, y: 200, radius: 80, color: '#f00', intensity: 1, attachedTokenId: 'heroi' }] })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    expect(out.lights).toEqual([{ id: 'tocha', x: 250, y: 200, radius: 80, color: '#f00', intensity: 1, attachedTokenId: 'heroi' }])
  })

  it('luz visível presa numa ficha que a NÉVOA esconde chega sem o vínculo: nem o id da ficha vaza', () => {
    const map = twoRooms({
      tokens: [token('heroi', 200, 200), token('espiao', 800, 200)],
      lights: [{ id: 'tocha-do-espiao', x: 450, y: 200, radius: 80, color: '#f00', intensity: 1, attachedTokenId: 'espiao' }],
    })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    expect(out.lights).toEqual([{ id: 'tocha-do-espiao', x: 450, y: 200, radius: 80, color: '#f00', intensity: 1 }])
    expect(JSON.stringify(out)).not.toContain('"espiao"')
  })

  it('SEGURANÇA: tocha presa numa ficha que o MESTRE esconde (oculta ou secreta) não sai: seria a posição do NPC', () => {
    // As tochas ficam no centro de cada ficha, em plena vista do herói.
    const escondidas = [
      token('fantasma', 230, 230, { hidden: true }),
      token('assassino', 260, 230, { secret: true }),
    ]
    const tochas = [
      { id: 'tocha-do-fantasma', x: 230, y: 230, radius: 80, color: '#f00', intensity: 1, attachedTokenId: 'fantasma' },
      { id: 'tocha-do-assassino', x: 260, y: 230, radius: 80, color: '#f00', intensity: 1, attachedTokenId: 'assassino' },
      { id: 'tocha-do-aliado', x: 300, y: 250, radius: 80, color: '#f00', intensity: 1, attachedTokenId: 'aliado' },
    ]
    const map = twoRooms({ tokens: [token('heroi', 200, 200), token('aliado', 300, 250), ...escondidas], lights: tochas })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    expect(out.lights.map((l) => l.id)).toEqual(['tocha-do-aliado'])
    const json = JSON.stringify(out)
    for (const vazado of ['fantasma', 'assassino', '"x":230', '"x":260']) expect(json).not.toContain(vazado)
  })

  it('a tocha presa na PRÓPRIA ficha secreta do jogador chega com o vínculo: é ele quem a carrega', () => {
    const map = twoRooms({
      tokens: [token('heroi', 200, 200, { secret: true })],
      lights: [{ id: 'tocha', x: 200, y: 200, radius: 80, color: '#f00', intensity: 1, attachedTokenId: 'heroi' }],
    })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    expect(out.lights).toEqual([{ id: 'tocha', x: 200, y: 200, radius: 80, color: '#f00', intensity: 1, attachedTokenId: 'heroi' }])
  })

  it('tocha presa na própria ficha mas fora da visão continua fora do que é enviado', () => {
    const map = twoRooms({ lights: [{ id: 'tocha-longe', x: 800, y: 800, radius: 80, color: '#f00', intensity: 1, attachedTokenId: 'heroi' }] })
    const { map: out } = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    expect(out.lights).toEqual([])
  })
})
