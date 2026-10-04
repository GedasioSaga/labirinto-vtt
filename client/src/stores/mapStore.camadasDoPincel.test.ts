import { beforeEach, describe, expect, it } from 'vitest'
import { NOVA_CAMADA } from '../lib/camadasDoPincel'
import { centroDoBloco, type Bloco } from '../lib/floorBlocks'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'

/**
 * CAMADAS DO PINCEL pela store: a pincelada, a borracha e o balde passam pelo
 * Ctrl+Z, a camada ativa é preferência de sessão (fora do desfazer), e a
 * camada travada responde com aviso em vez de calar.
 */
const CELL = 40
const store = () => useMapStore.getState()

function faixa(row: number, de: number, ate: number): Bloco[] {
  const out: Bloco[] = []
  for (let col = de; col <= ate; col += 1) out.push({ col, row })
  return out
}

function celulas(id: string): number {
  const peca = store().map.floor.find((p) => p.id === id)
  return peca?.shape.kind === 'blocos' ? peca.shape.cells.length : -1
}

beforeEach(() => {
  store().loadMap(createEmptyMap('m', 'Teste', 20, 15, CELL))
  store().setFloorCamada('mar')
  useToastStore.setState({ toasts: [] })
})

describe('mapStore — camadas do pincel', () => {
  it('água na Camada 1, grama na Camada 2 por cima; Ctrl+Z desfaz uma de cada vez', () => {
    store().paintFloorBlocks(faixa(5, 0, 5), CELL)
    const agua = store().map.floor[0]
    expect(agua).toMatchObject({ nome: 'Camada 1', fillColor: '#2f6690' })
    expect(store().camadaDoPincelId).toBe(agua.id)

    store().setCamadaDoPincel(NOVA_CAMADA)
    store().setFloorCamada('grama')
    store().paintFloorBlocks(faixa(5, 3, 8), CELL)
    const grama = store().map.floor[1]
    expect(grama).toMatchObject({ nome: 'Camada 2', fillColor: '#4a6b35' })
    expect(celulas(agua.id)).toBe(6)
    expect(store().past).toHaveLength(2)

    store().undo()
    expect(store().map.floor.map((p) => p.id)).toEqual([agua.id])
    // A ativa apontava para a Camada 2, que o Ctrl+Z tirou: a tinta volta à de cima.
    store().paintFloorBlocks(faixa(6, 0, 1), CELL)
    expect(store().map.floor).toHaveLength(1)
    expect(celulas(agua.id)).toBe(8)
  })

  it('a borracha apaga só na ativa e é um passo de Ctrl+Z', () => {
    store().paintFloorBlocks(faixa(5, 0, 5), CELL)
    store().setCamadaDoPincel(NOVA_CAMADA)
    store().paintFloorBlocks(faixa(5, 0, 5), CELL)
    const [baixo, cima] = store().map.floor
    store().eraseFloorBlocks(faixa(5, 0, 2), CELL)
    expect(celulas(baixo.id)).toBe(6)
    expect(celulas(cima.id)).toBe(3)
    store().undo()
    expect(celulas(cima.id)).toBe(6)
  })

  it('camada travada: a pincelada não pinta, avisa, e não gasta Ctrl+Z', () => {
    store().paintFloorBlocks(faixa(5, 0, 2), CELL)
    const camada = store().map.floor[0]
    store().updateFloorPiece(camada.id, { locked: true })
    const antes = store().map
    const passos = store().past.length
    store().paintFloorBlocks(faixa(6, 0, 2), CELL)
    expect(store().map).toBe(antes)
    expect(store().past).toHaveLength(passos)
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(['Camada 1 está travada: destrave o cadeado para pintar nela.'])
  })

  it('balde na camada ativa: um passo de Ctrl+Z; sem nada para encher, devolve "vazio"', () => {
    store().paintFloorBlocks(faixa(5, 0, 19), CELL)
    expect(store().fillFloorArea(centroDoBloco({ col: 3, row: 2 }, CELL))).toBe('ok')
    const camada = store().map.floor[0]
    // A faixa da própria camada segura: encheu só a parte de cima do mapa (linhas 0..4).
    expect(celulas(camada.id)).toBe(20 + 20 * 5)
    expect(store().fillFloorArea(centroDoBloco({ col: 3, row: 5 }, CELL))).toBe('vazio')
    store().undo()
    expect(celulas(camada.id)).toBe(20)
  })

  it('abrir outro mapa esquece a camada ativa', () => {
    store().setCamadaDoPincel(NOVA_CAMADA)
    store().loadMap(createEmptyMap('m2', 'Outro', 10, 10, CELL))
    expect(store().camadaDoPincelId).toBeNull()
  })
})
