import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import type { Drawing, Token } from '../types/map'

/**
 * Peça "desfazer-limpo": o Ctrl+Z do mestre desfaz só o que o MESTRE fez.
 *
 * 1. Mudança vinda do jogador (movimento, porta, nome/foto da ficha; ponte do
 *    host em net/playerChanges.ts) entra pela action `applyPlayerChange`, que NÃO cria
 *    passo de desfazer e é reaplicada nos snapshots de `past`/`future` — senão
 *    o Ctrl+Z de uma parede do mestre devolveria a ficha do jogador para onde
 *    estava antes (o snapshot é o mapa inteiro).
 * 2. Digitar no rótulo (texto de rótulo, nome de sala, nome de ficha) é UM passo por edição
 *    contínua no mesmo campo, não um por letra.
 */

const token: Token = { id: 't1', characterId: null, name: 'Ana', x: 0, y: 0, size: 64, image: null }
const label: Drawing = { id: 'd1', kind: 'text', x: 10, y: 10, text: '', color: '#ffffff', fontSize: 16 }

function tokenAt(): { x: number; y: number } {
  const found = useMapStore.getState().map.tokens.find((t) => t.id === 't1')
  if (found === undefined) throw new Error('ficha t1 sumiu do mapa')
  return { x: found.x, y: found.y }
}

function labelText(): string {
  const found = useMapStore.getState().map.drawings.find((d) => d.id === 'd1')
  if (found === undefined || found.kind !== 'text') throw new Error('rótulo d1 sumiu do mapa')
  return found.text
}

function movePlayerToken(x: number, y: number): void {
  useMapStore.getState().applyPlayerChange((map) => ({
    ...map,
    tokens: map.tokens.map((t) => (t.id === 't1' ? { ...t, x, y } : t)),
  }))
}

beforeEach(() => {
  useMapStore.setState({
    map: { ...useMapStore.getState().map, tokens: [token], drawings: [label], walls: [], lights: [], regions: [] },
    past: [],
    future: [],
  })
  useMapStore.getState().setSelection([])
})

describe('mudança do jogador não entra no histórico do mestre', () => {
  it('movimento do jogador não cria passo de desfazer', () => {
    movePlayerToken(128, 64)
    expect(tokenAt()).toEqual({ x: 128, y: 64 })
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('Ctrl+Z depois do movimento do jogador desfaz a ação do mestre, não o movimento', () => {
    useMapStore.getState().addLight({ id: 'l1', x: 0, y: 0, radius: 8, color: '#ffaa33', intensity: 0.8 })
    movePlayerToken(128, 64)

    useMapStore.getState().undo()

    expect(useMapStore.getState().map.lights).toHaveLength(0)
    expect(tokenAt()).toEqual({ x: 128, y: 64 })
  })

  it('Ctrl+Y (refazer) também preserva o movimento feito pelo jogador no meio', () => {
    useMapStore.getState().addLight({ id: 'l1', x: 0, y: 0, radius: 8, color: '#ffaa33', intensity: 0.8 })
    useMapStore.getState().undo()
    movePlayerToken(192, 0)

    useMapStore.getState().redo()

    expect(useMapStore.getState().map.lights).toHaveLength(1)
    expect(tokenAt()).toEqual({ x: 192, y: 0 })
  })

  it('arrasto do mestre em andamento: desfazer o arrasto não volta a ficha que o jogador moveu no meio', () => {
    useMapStore.getState().addLight({ id: 'l1', x: 0, y: 0, radius: 8, color: '#ffaa33', intensity: 0.8 })
    const before = useMapStore.getState().map
    useMapStore.getState().updateLightIntensityLive('l1', 0.2)
    movePlayerToken(128, 64)
    useMapStore.getState().updateLightIntensityLive('l1', 0.4)
    useMapStore.getState().commitDragHistory(before)

    useMapStore.getState().undo()

    expect(useMapStore.getState().map.lights[0]?.intensity).toBe(0.8)
    expect(tokenAt()).toEqual({ x: 128, y: 64 })
  })

  it('arrasto do mestre que não mudou nada, com o jogador se mexendo no meio, não vira passo de desfazer', () => {
    const before = useMapStore.getState().map
    movePlayerToken(128, 64)
    useMapStore.getState().commitDragHistory(before)

    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('gesto parado que começa depois de um movimento do jogador também não vira passo, e um gesto real vira um passo só', () => {
    movePlayerToken(64, 0)
    const idleBefore = useMapStore.getState().map
    movePlayerToken(128, 0)
    movePlayerToken(192, 0)
    useMapStore.getState().commitDragHistory(idleBefore)
    expect(useMapStore.getState().past).toHaveLength(0)

    useMapStore.getState().addLight({ id: 'l1', x: 0, y: 0, radius: 8, color: '#ffaa33', intensity: 0.8 })
    movePlayerToken(256, 0)
    const dragBefore = useMapStore.getState().map
    useMapStore.getState().updateLightIntensityLive('l1', 0.3)
    movePlayerToken(320, 0)
    useMapStore.getState().commitDragHistory(dragBefore)

    expect(useMapStore.getState().past).toHaveLength(2)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.lights[0]?.intensity).toBe(0.8)
    expect(tokenAt()).toEqual({ x: 320, y: 0 })
  })
})

describe('digitar no rótulo é um passo só', () => {
  it('três letras seguidas no mesmo rótulo = um Ctrl+Z', () => {
    useMapStore.getState().updateTextLabel('d1', { text: 'S' })
    useMapStore.getState().updateTextLabel('d1', { text: 'Sa' })
    useMapStore.getState().updateTextLabel('d1', { text: 'Sal' })

    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(labelText()).toBe('')
  })

  it('outra ação do mestre no meio encerra a edição: a digitação seguinte é outro passo', () => {
    useMapStore.getState().updateTextLabel('d1', { text: 'Sa' })
    useMapStore.getState().addLight({ id: 'l1', x: 0, y: 0, radius: 8, color: '#ffaa33', intensity: 0.8 })
    useMapStore.getState().updateTextLabel('d1', { text: 'Sal' })

    useMapStore.getState().undo()
    expect(labelText()).toBe('Sa')
    expect(useMapStore.getState().map.lights).toHaveLength(1)
  })

  it('trocar a seleção encerra a edição contínua', () => {
    useMapStore.getState().updateTextLabel('d1', { text: 'Sa' })
    useMapStore.getState().setSelection([])
    useMapStore.getState().updateTextLabel('d1', { text: 'Sal' })

    expect(useMapStore.getState().past).toHaveLength(2)
  })

  it('mudar a cor do rótulo continua sendo um passo por mudança (só o texto agrupa)', () => {
    useMapStore.getState().updateTextLabel('d1', { color: '#ff0000' })
    useMapStore.getState().updateTextLabel('d1', { color: '#00ff00' })

    expect(useMapStore.getState().past).toHaveLength(2)
  })

  it('movimento do jogador no meio da digitação não quebra o passo único nem é desfeito', () => {
    useMapStore.getState().updateTextLabel('d1', { text: 'S' })
    movePlayerToken(128, 64)
    useMapStore.getState().updateTextLabel('d1', { text: 'Sa' })

    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(labelText()).toBe('')
    expect(tokenAt()).toEqual({ x: 128, y: 64 })
  })

  it('digitar o nome da sala também é um passo só', () => {
    useMapStore.setState({
      map: {
        ...useMapStore.getState().map,
        regions: [{
          id: 'r1',
          points: [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }, { x: 0, y: 64 }],
          tag: '',
          fillColor: '#3a7ad0',
          fillPattern: 'solid',
          data: {},
          room: { name: '', shape: 'rect' },
        }],
      },
      past: [],
      future: [],
    })
    useMapStore.getState().setRoomName('r1', 'S')
    useMapStore.getState().setRoomName('r1', 'Sa')

    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.regions[0]?.room?.name).toBe('')
  })

  it('digitar o nome da ficha no painel também é um passo só', () => {
    useMapStore.getState().renameToken('t1', 'Z')
    useMapStore.getState().renameToken('t1', 'Zé')

    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.tokens[0]?.name).toBe('Ana')
  })
})

describe('mapa que volta ao editor não reaplica mudança velha do jogador', () => {
  it('cena que sai e volta: o gesto seguinte não repete o que o jogador fez na outra cena', () => {
    const cenaA = { ...useMapStore.getState().map, lights: [{ id: 'l1', x: 0, y: 0, radius: 8, color: '#ffaa33', intensity: 0.8 }] }
    useMapStore.getState().loadMap(cenaA)
    // Outra cena com a MESMA ficha (ela atravessou), onde o jogador anda.
    useMapStore.getState().loadMap({ ...cenaA, id: 'cena-b', lights: [] })
    movePlayerToken(500, 500)
    // A cena A volta ao editor pelo mesmo objeto (é assim que o cache de cenas a guarda).
    useMapStore.getState().loadMap(cenaA)

    const before = useMapStore.getState().map
    useMapStore.getState().updateLightIntensityLive('l1', 0.2)
    useMapStore.getState().commitDragHistory(before)
    useMapStore.getState().undo()

    expect(useMapStore.getState().map.lights[0]?.intensity).toBe(0.8)
    expect(tokenAt()).toEqual({ x: 0, y: 0 })
  })
})
