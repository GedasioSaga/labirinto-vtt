import { beforeEach, describe, expect, it } from 'vitest'
import type { DoorState, Wall } from '../types/map'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'

/**
 * Aviso do editor do mestre ao arrastar uma ficha contra PORTA SECRETA. Ligar
 * "Aberta" não a faz passar (`collision.isDoorPassable` exige `secret !== true`),
 * então o aviso tem de mandar revelar a passagem, não abrir a porta.
 */
function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: DoorState | null = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

/** Lado vertical em x=200 partido em 3; o pedaço do meio (y 80..120) é a porta, na altura do arrasto. */
function ladoComPorta(door: DoorState): Wall[] {
  return [parede('acima', 200, 0, 200, 80), parede('vao', 200, 80, 200, 120, door), parede('abaixo', 200, 120, 200, 400)]
}

const avisos = (): string[] => useToastStore.getState().toasts.map((t) => t.text)

describe('mapStore: arrastar ficha contra porta secreta', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    useMapStore.setState({
      map: {
        ...useMapStore.getState().map,
        walls: ladoComPorta({ open: false, locked: false, kind: 'normal', secret: true }),
        tokens: [{ id: 'f', characterId: null, name: 'Gabi', x: 100, y: 100, size: 1, image: null }],
        regions: [],
        floor: [],
        lights: [],
      },
      selection: [],
      past: [],
      future: [],
    })
  })

  it('manda revelar a passagem, não ligar "Aberta"; a ficha não passa e a porta não abre sozinha', () => {
    useMapStore.getState().moveTokenLive('f', 300, 100)
    const { map } = useMapStore.getState()
    expect(map.tokens[0]).toMatchObject({ x: 100, y: 100 })
    expect(map.walls.find((w) => w.id === 'vao')?.door).toEqual({ open: false, locked: false, kind: 'normal', secret: true })
    expect(avisos()).toHaveLength(1)
    expect(avisos()[0]).toContain('Revelar passagem')
    expect(avisos()[0]).not.toContain('Ligue "Aberta"')
    // Palavra proibida nos avisos de caminho (ver `BLOCKED_MOVE_TEXT`).
    expect(avisos()[0].toLowerCase()).not.toContain('parede')
  })

  it('com a porta secreta já aberta, o aviso continua o mesmo (abrir não resolve)', () => {
    // Ids próprios: o aviso repetido do MESMO pedaço é engolido por `noticeMoveOnce` durante a janela do aviso.
    const aberta = ladoComPorta({ open: true, locked: false, kind: 'normal', secret: true }).map((w) => ({ ...w, id: `aberta-${w.id}` }))
    useMapStore.setState({ map: { ...useMapStore.getState().map, walls: aberta } })
    useMapStore.getState().moveTokenLive('f', 300, 100)
    expect(useMapStore.getState().map.tokens[0]).toMatchObject({ x: 100, y: 100 })
    expect(avisos()).toHaveLength(1)
    expect(avisos()[0]).toContain('Revelar passagem')
  })
})
