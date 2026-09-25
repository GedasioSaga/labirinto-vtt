import { describe, expect, it } from 'vitest'
import type { DoorState, FloorPiece, MapData, Pin, Region, Token, Wall } from '../types/map'
import { createExploration, markAll, markRings } from './exploration'
import { emptyPlanMemory, filterMapForPlayer, planOfWholeMap, playerBlockedRings, type PlanMemory, type PlayerMapView } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * MEMÓRIA SEM SPOILER, no recorte: fora da visão, o explorado mostra a versão
 * que o jogador VIU de cada item da planta — nunca a que o mestre deixou depois.
 * Mapa de 1000 × 1000 px, raio 300: o herói vê a sala de cima em (200, 200) e
 * anda até (800, 800), de onde a sala de cima fica explorada e fora da visão.
 */

const RADIUS = 300
const OWN = { p1: ['heroi'] }
const PERTO = { x: 200, y: 200 }
const LONGE = { x: 800, y: 800 }

function token(at: { x: number; y: number }): Token {
  return { id: 'heroi', characterId: null, name: 'Heroi', x: at.x, y: at.y, size: 1, image: null }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number, door: DoorState | null = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function pin(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description: `desc-${id}`, image: null, ...extra }
}

function sala(id: string, name: string, extra: Partial<Region['room']> = {}): Region {
  return {
    id,
    points: [
      { x: 120, y: 120 },
      { x: 280, y: 120 },
      { x: 280, y: 280 },
      { x: 120, y: 280 },
    ],
    tag: '',
    fillColor: '#333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name, ...extra },
  }
}

function chao(id: string, cx: number, cy: number, op: FloorPiece['op'] = 'add'): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w: 80, h: 80 }, op, modifiers: {} }
}

function mapa(heroi: { x: number; y: number }, patch: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 25, 25, 40), tokens: [token(heroi)], ...patch }
}

/** Um jogador com memória, como o host guarda: explorado, portas vistas e planta lembrada. */
function jogador(plan: PlanMemory = emptyPlanMemory()) {
  const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
  const doors = new Map<string, DoorState>()
  let memory = plan
  const ver = (map: MapData): PlayerMapView => {
    const view = filterMapForPlayer(map, 'p1', OWN, RADIUS, exp, doors, undefined, undefined, undefined, undefined, undefined, memory)
    markRings(exp, view.vision, view.blocked)
    memory = view.plan
    for (const w of map.walls) {
      if (w.door !== null && view.visibleDoorIds.includes(w.id)) doors.set(w.id, { ...w.door })
    }
    return view
  }
  return { ver, exp, plano: () => memory }
}

const ABERTA: DoorState = { open: true, locked: false, kind: 'normal' }
const FECHADA_TRANCADA: DoorState = { open: false, locked: true, kind: 'normal' }

describe('filterMapForPlayer: memória da planta sem spoiler', () => {
  it('porta: fora da visão sai como foi vista; porta nova e parede que virou porta longe não contam', () => {
    const j = jogador()
    const visto = { walls: [wall('porta', 150, 320, 250, 320, ABERTA), wall('muro', 100, 100, 300, 100)] }
    j.ver(mapa(PERTO, visto))
    j.ver(mapa(LONGE, visto))
    const view = j.ver(
      mapa(LONGE, {
        walls: [wall('porta', 150, 320, 250, 320, FECHADA_TRANCADA), wall('muro', 100, 100, 300, 100, ABERTA), wall('porta-nova', 100, 150, 100, 250, ABERTA)],
      }),
    )
    expect(view.map.walls.map((w) => w.id).sort()).toEqual(['muro', 'porta'])
    expect(view.map.walls.find((w) => w.id === 'porta')?.door).toEqual(ABERTA)
    // O muro que virou porta longe dele continua muro na memória.
    expect(view.map.walls.find((w) => w.id === 'muro')?.door).toBeNull()
    expect(view.visibleDoorIds).toEqual([])
  })

  it('o que ele vê sumir, some da memória — e não volta quando ele se afasta de novo', () => {
    const j = jogador()
    const comPino = { pins: [pin('bau', 180, 160)] }
    j.ver(mapa(PERTO, comPino))
    j.ver(mapa(LONGE, comPino))
    // O mestre apaga o pino: longe, ela ainda lembra dele.
    expect(j.ver(mapa(LONGE)).map.pins.map((p) => p.id)).toEqual(['bau'])
    // Volta e vê o lugar vazio.
    expect(j.ver(mapa(PERTO)).map.pins).toEqual([])
    expect(j.plano().pins.has('bau')).toBe(false)
    expect(j.ver(mapa(LONGE)).map.pins).toEqual([])
  })

  it('nome de sala que o mestre esconde depois não volta pela memória', () => {
    const j = jogador()
    j.ver(mapa(PERTO, { regions: [sala('cripta', 'Cripta do Rei')] }))
    j.ver(mapa(LONGE, { regions: [sala('cripta', 'Cripta do Rei')] }))
    const view = j.ver(mapa(LONGE, { regions: [sala('cripta', 'Cripta do Rei', { nameHiddenFromPlayers: true })] }))
    expect(view.map.regions.map((r) => r.id)).toEqual(['cripta'])
    expect(view.map.regions[0]?.room?.name).toBe('')
    expect(JSON.stringify(view.map)).not.toContain('Cripta do Rei')
  })

  it('chão: o buraco novo longe não aparece e a peça apagada longe continua lembrada', () => {
    const j = jogador()
    const antes = { floor: [chao('lajota', 200, 160)] }
    j.ver(mapa(PERTO, antes))
    j.ver(mapa(LONGE, antes))
    const view = j.ver(mapa(LONGE, { floor: [chao('buraco', 200, 240, 'subtract')] }))
    expect(view.map.floor.map((f) => f.id)).toEqual(['lajota'])
  })

  it('zona oculta nova por cima do que ele lembra esconde a lembrança', () => {
    const j = jogador()
    const comPino = { pins: [pin('altar', 200, 150)] }
    j.ver(mapa(PERTO, comPino))
    j.ver(mapa(LONGE, comPino))
    const zona = { id: 'z', name: 'Segredo', points: [{ x: 150, y: 100 }, { x: 250, y: 100 }, { x: 250, y: 200 }, { x: 150, y: 200 }], revealed: false }
    const view = j.ver(mapa(LONGE, { ...comPino, concealZones: [zona] }))
    expect(view.map.pins).toEqual([])
    expect(JSON.stringify(view.map)).not.toContain('altar')
  })

  it('zona oculta ligada e desligada com ele longe devolve a lembrança: chão, sala e muro como ele viu', () => {
    const j = jogador()
    // O muro fica na borda de cima da lajota: com chão no mapa a visão para na
    // borda dele, e o jogador só recebe a parede que viu (paredes-so-as-vistas).
    const visto = { walls: [wall('muro', 160, 120, 240, 120)], floor: [chao('lajota', 200, 160)], regions: [sala('sala', 'Salao')] }
    j.ver(mapa(PERTO, visto))
    const ids = (view: PlayerMapView) => [view.map.walls.map((w) => w.id), view.map.floor.map((f) => f.id), view.map.regions.map((r) => r.id)]
    expect(ids(j.ver(mapa(LONGE, visto)))).toEqual([['muro'], ['lajota'], ['sala']])
    const zona = { id: 'z', name: 'Segredo', points: [{ x: 50, y: 50 }, { x: 350, y: 50 }, { x: 350, y: 350 }, { x: 50, y: 350 }], revealed: false }
    // Enquanto a zona está ligada, nada do lugar sai — e o mestre ainda mexe na lajota por baixo dela.
    const escondido = j.ver(mapa(LONGE, { ...visto, floor: [{ ...chao('lajota', 200, 160), shape: { kind: 'rect', cx: 200, cy: 160, w: 200, h: 200 } }], concealZones: [zona] }))
    expect(ids(escondido)).toEqual([[], [], []])
    expect(JSON.stringify(escondido.map)).not.toContain('Salao')
    // Zona desligada, ele ainda longe: volta a lembrança, na versão que ele viu (e não a mexida).
    const depois = j.ver(mapa(LONGE, { ...visto, floor: [{ ...chao('lajota', 200, 160), shape: { kind: 'rect', cx: 200, cy: 160, w: 200, h: 200 } }] }))
    expect(ids(depois)).toEqual([['muro'], ['lajota'], ['sala']])
    expect(depois.map.floor[0]?.shape).toEqual({ kind: 'rect', cx: 200, cy: 160, w: 80, h: 80 })
    expect(depois.map.regions[0]?.room?.name).toBe('Salao')
  })

  it('sala marcada secreta e desmarcada com ele longe volta com o chão e o pino de dentro', () => {
    const j = jogador()
    const visto = { floor: [chao('lajota', 200, 160)], regions: [sala('sala', 'Salao')], pins: [pin('bau', 180, 160)] }
    j.ver(mapa(PERTO, visto))
    j.ver(mapa(LONGE, visto))
    const secreta = j.ver(mapa(LONGE, { ...visto, regions: [{ ...sala('sala', 'Salao'), secret: true }] }))
    expect(secreta.map.regions).toEqual([])
    expect(secreta.map.pins).toEqual([])
    expect(JSON.stringify(secreta.map)).not.toContain('Salao')
    const desmarcada = j.ver(mapa(LONGE, visto))
    expect(desmarcada.map.regions.map((r) => r.id)).toEqual(['sala'])
    expect(desmarcada.map.floor.map((f) => f.id)).toEqual(['lajota'])
    expect(desmarcada.map.pins.map((p) => p.id)).toEqual(['bau'])
  })

  it('item escondido enquanto ele olha o lugar é esquecido: reaparecer longe dele não o devolve', () => {
    const j = jogador()
    const comPino = { pins: [pin('bau', 180, 160)] }
    j.ver(mapa(PERTO, comPino))
    // O mestre oculta o pino com ele olhando: ele vê o lugar sem o pino.
    expect(j.ver(mapa(PERTO, { pins: [pin('bau', 180, 160, { hidden: true })] })).map.pins).toEqual([])
    expect(j.plano().pins.has('bau')).toBe(false)
    j.ver(mapa(LONGE, { pins: [pin('bau', 180, 160, { hidden: true })] }))
    expect(j.ver(mapa(LONGE, comPino)).map.pins).toEqual([])
  })

  it('camada escondida não sai, mas religá-la devolve a lembrança (não apaga o explorado de ninguém)', () => {
    const j = jogador()
    const comPino = { pins: [pin('bau', 180, 160)] }
    j.ver(mapa(PERTO, comPino))
    j.ver(mapa(LONGE, comPino))
    const escondida = j.ver(mapa(LONGE, { ...comPino, hiddenLayers: ['anotacoes'] }))
    expect(escondida.map.pins).toEqual([])
    expect(JSON.stringify(escondida.map)).not.toContain('bau')
    expect(j.ver(mapa(LONGE, comPino)).map.pins.map((p) => p.id)).toEqual(['bau'])
  })

  it('"Revelar planta" lembra o presente, mas nunca devolve pino oculto nem chegada oculta, mesmo apagados depois', () => {
    const revelado = mapa(LONGE, {
      pins: [
        pin('visivel', 200, 200),
        pin('oculto', 220, 200, { hidden: true }),
        pin('chegada', 240, 200, { kind: 'viagem', soChegada: true, destino: { sceneId: 'cena-x', pinId: 'p' } }),
      ],
    })
    const j = jogador(planOfWholeMap(revelado))
    markAll(j.exp)
    // O mestre apaga os três: fica a lembrança do que o jogador podia ver.
    const view = j.ver(mapa(LONGE))
    expect(view.map.pins.map((p) => p.id)).toEqual(['visivel'])
    expect(JSON.stringify(view.map)).not.toContain('chegada')
    expect(JSON.stringify(view.map)).not.toContain('oculto')
  })

  /** "Revelar planta" como o host faz: marca o explorado fora do bloqueado e guarda a planta de agora. */
  function revelar(map: MapData) {
    const j = jogador(planOfWholeMap(map))
    markAll(j.exp, playerBlockedRings(map))
    return j
  }

  const ZONA_GRANDE = { id: 'z', name: 'Segredo', points: [{ x: 50, y: 50 }, { x: 350, y: 50 }, { x: 350, y: 350 }, { x: 50, y: 350 }], revealed: false }

  it('"Revelar planta" com zona oculta ativa não guarda o que está sob ela: desligar a zona longe não entrega nada', () => {
    const debaixo = {
      regions: [sala('tesouro', 'Tesouro Escondido')],
      pins: [pin('bau', 180, 160), pin('fora', 600, 150)],
      drawings: [{ id: 'bilhete', kind: 'text' as const, x: 250, y: 150, text: 'bilhete sob a zona', color: '#fff', fontSize: 12 }],
      markers: [{ id: 'marca', cx: 200, cy: 200, w: 20, h: 20, rotation: 0, color: '#fff' }],
    }
    const j = revelar(mapa(LONGE, { ...debaixo, concealZones: [ZONA_GRANDE] }))
    expect(j.plano().pins.has('bau')).toBe(false)
    expect(j.plano().regions.has('tesouro')).toBe(false)
    const semZona = j.ver(mapa(LONGE, debaixo))
    const json = JSON.stringify(semZona.map)
    expect(json).not.toContain('Tesouro Escondido')
    expect(json).not.toContain('bilhete sob a zona')
    expect(semZona.map.regions).toEqual([])
    expect(semZona.map.markers).toEqual([])
    // Controle: o que estava fora da zona continua lembrado.
    expect(semZona.map.pins.map((p) => p.id)).toEqual(['fora'])
  })

  it('"Revelar planta" com sala secreta não guarda a sala nem o que está dentro: desmarcar longe não entrega nada', () => {
    const dentro = { pins: [pin('bau', 180, 160), pin('fora', 600, 150)] }
    const j = revelar(mapa(LONGE, { ...dentro, regions: [{ ...sala('cofre', 'Cofre do Rei'), secret: true }] }))
    const desmarcada = j.ver(mapa(LONGE, { ...dentro, regions: [sala('cofre', 'Cofre do Rei')] }))
    expect(JSON.stringify(desmarcada.map)).not.toContain('Cofre do Rei')
    expect(desmarcada.map.regions).toEqual([])
    expect(desmarcada.map.pins.map((p) => p.id)).toEqual(['fora'])
  })

  it('"Revelar planta" com teto guarda a silhueta do prédio, não o interior: tirar o teto longe não entrega o de dentro', () => {
    const dentro = { pins: [pin('bau', 180, 160), pin('fora', 600, 150)] }
    const j = revelar(mapa(LONGE, { ...dentro, regions: [sala('predio', 'Armazem', { roof: true })] }))
    // A silhueta do prédio não é segredo: continua lembrada, sem nome.
    expect(j.plano().regions.has('predio')).toBe(true)
    const comTeto = j.ver(mapa(LONGE, { ...dentro, regions: [sala('predio', 'Armazem', { roof: true })] }))
    expect(comTeto.map.regions.map((r) => r.id)).toEqual(['predio'])
    expect(comTeto.map.pins.map((p) => p.id)).toEqual(['fora'])
    const semTeto = j.ver(mapa(LONGE, { ...dentro, regions: [sala('predio', 'Armazem')] }))
    expect(semTeto.map.pins.map((p) => p.id)).toEqual(['fora'])
    expect(JSON.stringify(semTeto.map)).not.toContain('desc-bau')
  })
})
