import { beforeEach, describe, expect, it } from 'vitest'
import type { DoorState, Wall } from '../types/map'
import { validateTokenMove } from '../lib/moveValidation'
import { rotuloDoArrastoDaFicha } from '../lib/tokenDragDistance'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'

/**
 * ATRAVESSAR (pedido do mestre de 10/11/2026): Ctrl segurado no arrasto da
 * ficha, no editor, passa por parede e porta. O canvas lê o Ctrl e chama
 * `moveTokenLive(..., true)`; aqui fica a regra: com o Ctrl passa, sem ele
 * barra como sempre, e o jogador nunca passa (o host confere o pedido dele).
 */
function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: DoorState | null = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

const PORTA_FECHADA: DoorState = { open: false, locked: false, kind: 'normal' }

const ficha = () => useMapStore.getState().map.tokens[0]
const avisos = (): string[] => useToastStore.getState().toasts.map((t) => t.text)

function cenaComParede(walls: Wall[]): void {
  useMapStore.setState({
    map: {
      ...useMapStore.getState().map,
      width: 20,
      height: 20,
      grid: 50,
      walls,
      tokens: [{ id: 'f', characterId: null, name: 'Soldado', x: 100, y: 100, size: 1, image: null }],
      regions: [],
      floor: [],
      lights: [],
    },
    selection: [],
    past: [],
    future: [],
  })
}

describe('Ctrl no arrasto do mestre: a ficha atravessa parede e porta', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    cenaComParede([parede('muro', 200, 0, 200, 1000)])
  })

  it('sem Ctrl a parede barra; com Ctrl a ficha passa e, solto o Ctrl do outro lado, fica lá', () => {
    useMapStore.getState().moveTokenLive('f', 300, 100)
    expect(ficha()).toMatchObject({ x: 100, y: 100 })

    useMapStore.getState().moveTokenLive('f', 300, 100, true)
    expect(ficha()).toMatchObject({ x: 300, y: 100 })

    // Soltou o Ctrl: o passo seguinte parte do lugar novo, sem puxar a ficha de volta.
    useMapStore.getState().moveTokenLive('f', 300, 100)
    expect(ficha()).toMatchObject({ x: 300, y: 100 })
    // E a parede volta a barrar dali: voltar sem o Ctrl não passa.
    useMapStore.getState().moveTokenLive('f', 100, 100)
    expect(ficha()).toMatchObject({ x: 300, y: 100 })
  })

  it('porta fechada: com Ctrl a ficha passa sem abrir a porta e sem aviso', () => {
    cenaComParede([parede('acima', 200, 0, 200, 80), parede('vao', 200, 80, 200, 120, PORTA_FECHADA), parede('abaixo', 200, 120, 200, 1000)])
    useMapStore.getState().moveTokenLive('f', 300, 100, true)
    const { map } = useMapStore.getState()
    expect(ficha()).toMatchObject({ x: 300, y: 100 })
    expect(map.walls.find((w) => w.id === 'vao')?.door).toEqual(PORTA_FECHADA)
    expect(avisos()).toEqual([])
  })

  it('o jogador nunca passa: o host recusa o mesmo traço, e o pedido dele não tem como pedir o atravessar', () => {
    const { map } = useMapStore.getState()
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 'f', x: 300, y: 100 }, { p1: ['f'] })).toEqual({ ok: false, reason: 'wall' })
  })

  it('o rótulo do arrasto diz que o modo ligou, mesmo antes de a ficha sair da célula', () => {
    expect(rotuloDoArrastoDaFicha(null, true)).toBe('Atravessando')
    expect(rotuloDoArrastoDaFicha('3 quadrados', true)).toBe('3 quadrados · atravessando')
    expect(rotuloDoArrastoDaFicha('3 quadrados', false)).toBe('3 quadrados')
    expect(rotuloDoArrastoDaFicha(null, false)).toBeNull()
  })
})
