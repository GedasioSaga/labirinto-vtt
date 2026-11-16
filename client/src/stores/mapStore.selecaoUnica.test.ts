import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { selecaoDoLacoNoPiso } from '../lib/pisoEmEdicao'
import { terrenoNoPonto } from '../lib/terrenoNaSelecao'
import type { Agua, BarrancoDoMapa, Carimbo, ConcealZone, MapData, Pin } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * UMA MÃO SÓ (Fase 4, 15/11/2026): o laço pega o pino, a zona oculta, a água
 * e o risco do Barranco junto com o carimbo, e o grupo anda num gesto só,
 * com um passo no Ctrl+Z. O cadeado da camada segura a água e o penhasco.
 */

const pino: Pin = { id: 'p1', x: 120, y: 120, kind: 'exclamacao', description: '', image: null }
const pinoTravado: Pin = { id: 'p2', x: 140, y: 140, kind: 'exclamacao', description: '', image: null, locked: true }
const lago: Agua = { id: 'a1', tipo: 'lago', pontos: [{ x: 200, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 300 }, { x: 200, y: 300 }], cor: '#2266aa', areia: [{ modo: 'por', raio: 10, pontos: [{ x: 210, y: 210 }] }] }
const pinheiro: Carimbo = { id: 'c1', tipo: 'pinheiro', x: 400, y: 400, tamanho: 40, giro: 0 }
const zona: ConcealZone = { id: 'z1', name: 'Cripta', revealed: false, points: [{ x: 100, y: 400 }, { x: 160, y: 400 }, { x: 160, y: 460 }, { x: 100, y: 460 }], unveiledCells: ['11,41'] }
const barranco: BarrancoDoMapa = { quadrado: 40, origem: { x: 0, y: 0 }, riscos: [{ id: 'r1', pontos: [{ x: 500, y: 100 }, { x: 560, y: 100 }], lado: 1 }], quadrados: [], rampas: [] }
const LACO_TUDO = { x1: 50, y1: 50, x2: 700, y2: 700 }

function mapa(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m-unica', 'Vale', 30, 30, 40), pins: [pino, pinoTravado], aguas: [lago], carimbos: [pinheiro], concealZones: [zona], barranco, ...extra }
}

beforeEach(() => {
  useMapStore.getState().loadMap(mapa())
})

describe('o laço com tipos misturados', () => {
  it('pega pino, zona, água, risco do Barranco e carimbo', () => {
    const laco = selecaoDoLacoNoPiso(useMapStore.getState().map, 0, LACO_TUDO)
    expect(laco).toEqual(
      expect.arrayContaining([
        { kind: 'pin', id: 'p1' },
        { kind: 'zone', id: 'z1' },
        { kind: 'agua', id: 'a1' },
        { kind: 'barranco', id: 'r1' },
        { kind: 'carimbo', id: 'c1' },
      ]),
    )
    // O pino travado por item fica de fora do laço, como todo item travado.
    expect(laco).not.toContainEqual({ kind: 'pin', id: 'p2' })
  })

  it('o grupo anda num gesto e um Ctrl+Z volta o mapa inteiro', () => {
    const store = useMapStore.getState()
    const antes = store.map
    store.setSelection(selecaoDoLacoNoPiso(antes, 0, LACO_TUDO))
    for (let i = 0; i < 10; i++) useMapStore.getState().moveSelectionLive(4, 2)
    useMapStore.getState().commitDragHistory(antes)
    const depois = useMapStore.getState().map
    expect(depois.pins.find((p) => p.id === 'p1')).toMatchObject({ x: 160, y: 140 })
    expect(depois.aguas?.[0].pontos[0]).toEqual({ x: 240, y: 220 })
    // A areia pintada anda com o lago.
    expect(depois.aguas?.[0].areia?.[0].pontos[0]).toEqual({ x: 250, y: 230 })
    expect(depois.carimbos?.[0]).toMatchObject({ x: 440, y: 420 })
    expect(depois.concealZones[0].points[0]).toEqual({ x: 140, y: 420 })
    // O pedaço revelado anda com a zona, na célula de 10 px: +4 colunas, +2 linhas.
    expect(depois.concealZones[0].unveiledCells).toEqual(['15,43'])
    expect(depois.barranco?.riscos[0].pontos[0]).toEqual({ x: 540, y: 120 })
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('Delete leva o conjunto num passo; Ctrl+Z traz tudo de volta', () => {
    const store = useMapStore.getState()
    const antes = store.map
    store.setSelection(selecaoDoLacoNoPiso(antes, 0, LACO_TUDO))
    useMapStore.getState().removeSelected()
    const depois = useMapStore.getState().map
    expect(depois.pins.map((p) => p.id)).toEqual(['p2'])
    // Sem água e sem barranco, os campos saem: o arquivo fica como o de um mapa sem eles.
    expect(depois.aguas).toBeUndefined()
    expect(depois.barranco).toBeUndefined()
    expect(depois.concealZones).toEqual([])
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })
})

describe('o pino e a zona sozinhos abrem no painel deles', () => {
  it('o laço que pega só o pino (ou só a zona) abre o pino (ou a zona), com o conjunto vazio', () => {
    useMapStore.getState().setSelection([{ kind: 'pin', id: 'p1' }])
    expect(useMapStore.getState()).toMatchObject({ selection: [], selectedPinId: 'p1', selectedConcealZoneId: null })
    useMapStore.getState().setSelection([{ kind: 'zone', id: 'z1' }])
    expect(useMapStore.getState()).toMatchObject({ selection: [], selectedPinId: null, selectedConcealZoneId: 'z1' })
    // Com outro item junto, o conjunto fica e o que estava aberto fecha.
    useMapStore.getState().setSelection([{ kind: 'zone', id: 'z1' }, { kind: 'carimbo', id: 'c1' }])
    expect(useMapStore.getState()).toMatchObject({ selection: [{ kind: 'zone', id: 'z1' }, { kind: 'carimbo', id: 'c1' }], selectedPinId: null, selectedConcealZoneId: null })
  })

  it('o Shift+clique leva o pino aberto junto, e tirar o resto o devolve ao painel', () => {
    useMapStore.getState().setSelectedPin('p1')
    useMapStore.getState().alternarNaSelecao({ kind: 'carimbo', id: 'c1' })
    expect(useMapStore.getState()).toMatchObject({ selection: [{ kind: 'pin', id: 'p1' }, { kind: 'carimbo', id: 'c1' }], selectedPinId: null })
    useMapStore.getState().somarNaSelecao([{ kind: 'agua', id: 'a1' }])
    expect(useMapStore.getState().selection).toHaveLength(3)
    useMapStore.getState().alternarNaSelecao({ kind: 'carimbo', id: 'c1' })
    useMapStore.getState().alternarNaSelecao({ kind: 'agua', id: 'a1' })
    expect(useMapStore.getState()).toMatchObject({ selection: [], selectedPinId: 'p1' })
    // Shift+clique no próprio pino aberto: sai, e nada fica aberto.
    useMapStore.getState().alternarNaSelecao({ kind: 'pin', id: 'p1' })
    expect(useMapStore.getState()).toMatchObject({ selection: [], selectedPinId: null, selectedConcealZoneId: null })
  })
})

describe('a Borracha geral no Terreno', () => {
  it('acha o carimbo, o risco do Barranco e a água no ponto e os tira, um por passo', () => {
    const antes = useMapStore.getState().map
    const noCarimbo = terrenoNoPonto(antes, 0, { x: 400, y: 380 }, true)
    const noRisco = terrenoNoPonto(antes, 0, { x: 530, y: 101 }, true)
    const naAgua = terrenoNoPonto(antes, 0, { x: 250, y: 250 }, true)
    expect(noCarimbo?.acerto).toEqual({ kind: 'carimbo', id: 'c1' })
    expect(noRisco?.acerto).toEqual({ kind: 'barranco', id: 'r1' })
    expect(naAgua?.acerto).toEqual({ kind: 'agua', id: 'a1' })
    // Sem água no pedido (há sala por baixo, que ganha dela), a água não responde.
    expect(terrenoNoPonto(antes, 0, { x: 250, y: 250 }, false)).toBeNull()
    for (const achado of [noCarimbo, noRisco, naAgua]) if (achado !== null) useMapStore.getState().apagarItemDoTerreno(achado.acerto)
    const depois = useMapStore.getState().map
    expect(depois.carimbos ?? []).toEqual([])
    expect(depois.aguas).toBeUndefined()
    expect(depois.barranco).toBeUndefined()
    useMapStore.getState().undo()
    useMapStore.getState().undo()
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('a camada travada é barreira e o carimbo travado fica', () => {
    useMapStore.getState().loadMap(mapa({ lockedLayers: ['terreno', 'salas'], carimbos: [{ ...pinheiro, locked: true }] }))
    const antes = useMapStore.getState().map
    expect(terrenoNoPonto(antes, 0, { x: 530, y: 101 }, true)?.travada).toBe('terreno')
    expect(terrenoNoPonto(antes, 0, { x: 250, y: 250 }, true)?.travada).toBe('salas')
    useMapStore.getState().apagarItemDoTerreno({ kind: 'carimbo', id: 'c1' })
    useMapStore.getState().apagarItemDoTerreno({ kind: 'barranco', id: 'r1' })
    useMapStore.getState().apagarItemDoTerreno({ kind: 'agua', id: 'a1' })
    expect(useMapStore.getState().map).toBe(antes)
  })
})

describe('o cadeado da camada segura a água e o penhasco', () => {
  // No mapa de antes das camadas livres, Salas responde por Chão (`camadaQueManda`): o cadeado é o de Salas.
  it('Chão travado: a água fica fora do laço e não muda nem sai', () => {
    useMapStore.getState().loadMap(mapa({ lockedLayers: ['salas'] }))
    const antes = useMapStore.getState().map
    expect(selecaoDoLacoNoPiso(antes, 0, LACO_TUDO)).not.toContainEqual({ kind: 'agua', id: 'a1' })
    useMapStore.getState().mudarAgua('a1', { cor: '#ff0000' })
    useMapStore.getState().apagarAgua('a1')
    useMapStore.getState().porAgua({ ...lago, id: 'a2' })
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('Terreno travado: riscar e apagar o penhasco não mudam o mapa', () => {
    const risco = { id: 'pen1', modo: 'riscar' as const, raio: 20, pontos: [{ x: 10, y: 10 }, { x: 60, y: 10 }] }
    useMapStore.getState().loadMap(mapa({ lockedLayers: ['terreno'], penhascos: [risco] }))
    const antes = useMapStore.getState().map
    useMapStore.getState().riscarPenhasco({ modo: 'apagar', raio: 20, pontos: [{ x: 10, y: 10 }, { x: 60, y: 10 }] })
    useMapStore.getState().apagarTodosOsPenhascos()
    expect(useMapStore.getState().map).toBe(antes)
    expect(selecaoDoLacoNoPiso(antes, 0, LACO_TUDO)).not.toContainEqual({ kind: 'barranco', id: 'r1' })
  })
})
