import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { corredoresDaSala } from '../lib/abrirCorredor'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { addRoom, createEmptyMap } from '../lib/mapFactory'
import type { MapData, Wall } from '../types/map'
import { selectBloqueioParaAbrir, selectCorredoresParaAbrir, useMapStore } from './mapStore'

/**
 * A linha "Abrir para o corredor" do painel da Sala (`components/RoomControls.tsx`)
 * lê `selectCorredoresParaAbrir` e `selectBloqueioParaAbrir`, e o zustand
 * reavalia o seletor a cada `set()` da store — inclusive o `setCamera` de cada
 * pointermove de pan e de cada evento de roda. A conta mede toda parede solta
 * do piso contra a borda da Sala (`lib/abrirCorredor.ts`), então com o mapa e a
 * Sala iguais vale a última resposta. Mesmo cuidado de `selectEndireitarMudaria`
 * (`mapStore.memoEndireitar.test.tsx`).
 */

// Conta as chamadas da conta de verdade sem mudar o que ela devolve.
vi.mock('../lib/abrirCorredor', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/abrirCorredor')>()
  return { ...real, corredoresDaSala: vi.fn(real.corredoresDaSala) }
})
const contaDeVerdade = vi.mocked(corredoresDaSala)

/** 2 s de pan a 60 pointermove/s e um giro de roda: cada um é um `setCamera`. */
const EVENTOS_DE_PAN = 120
const EVENTOS_DE_RODA = 30

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** A "Sala 3" da imagem 4 (0..600 × 0..500) com o corredor que entra pela quina de cima. */
function salaDaImagem4(): MapData {
  const { region, walls } = buildRoomFromDraft('sala', ['s0', 's1', 's2', 's3'], { x: 0, y: 0 }, { x: 600, y: 500 }, undefined, undefined, 'Sala 3')
  const comSala = addRoom(createEmptyMap('m_memo_corredor', 'Corredor', 30, 30, 64), region, walls)
  return { ...comSala, walls: [...comSala.walls, parede('A', -200, -200, 150, 50), parede('B', -300, -100, 50, 180)] }
}

const MAPA = salaDaImagem4()

/** O painel como a linha o lê: as duas respostas vêm dos seletores, pela store. */
function RespostaDoPainel() {
  const corredores = useMapStore((state) => selectCorredoresParaAbrir(state, 'sala'))
  const bloqueio = useMapStore((state) => selectBloqueioParaAbrir(state, 'sala'))
  return <output>{`${corredores} ${bloqueio ?? 'livre'}`}</output>
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useMapStore.setState({ map: MAPA, past: [], future: [], pisoAtivo: 0 })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('selectCorredoresParaAbrir / selectBloqueioParaAbrir guardam a última resposta', () => {
  it('pan e roda com a Sala no painel não refazem a conta', () => {
    act(() => root.render(<RespostaDoPainel />))
    expect(container.textContent).toBe('1 livre')

    contaDeVerdade.mockClear()
    const { setCamera } = useMapStore.getState()
    act(() => {
      for (let i = 0; i < EVENTOS_DE_PAN; i += 1) setCamera({ x: i * 3, y: i * 2, scale: 1 })
      for (let i = 0; i < EVENTOS_DE_RODA; i += 1) setCamera({ x: 360, y: 240, scale: 1 + i * 0.05 })
    })

    expect(contaDeVerdade).toHaveBeenCalledTimes(0)
    expect(container.textContent).toBe('1 livre')
  })

  it('só refaz a conta quando o mapa ou a Sala trocam; a conta e o motivo saem da mesma passada', () => {
    // Referência que nenhum outro teste usou: a última resposta guardada é do módulo.
    const mapa: MapData = { ...MAPA }
    contaDeVerdade.mockClear()
    expect(selectCorredoresParaAbrir({ map: mapa }, 'sala')).toBe(1)
    expect(selectBloqueioParaAbrir({ map: mapa }, 'sala')).toBeNull()
    expect(selectCorredoresParaAbrir({ map: mapa }, 'sala')).toBe(1)
    expect(contaDeVerdade).toHaveBeenCalledTimes(1)

    expect(selectCorredoresParaAbrir({ map: { ...mapa } }, 'sala')).toBe(1)
    expect(contaDeVerdade).toHaveBeenCalledTimes(2)

    expect(selectCorredoresParaAbrir({ map: mapa }, 'nao-existe')).toBe(0)
    expect(selectBloqueioParaAbrir({ map: mapa }, 'nao-existe')).toBeNull()
    expect(contaDeVerdade).toHaveBeenCalledTimes(3)
  })

  it('a resposta acompanha o mapa: aberta a Sala vira 0, o Ctrl+Z traz o 1, e a Sala travada diz "travada"', () => {
    act(() => root.render(<RespostaDoPainel />))
    expect(container.textContent).toBe('1 livre')

    act(() => useMapStore.getState().abrirSalaParaCorredores('sala'))
    expect(container.textContent).toBe('0 livre')

    act(() => useMapStore.getState().undo())
    expect(container.textContent).toBe('1 livre')

    act(() => useMapStore.getState().setRegionLocked('sala', true))
    expect(container.textContent).toBe('1 travada')
  })
})
