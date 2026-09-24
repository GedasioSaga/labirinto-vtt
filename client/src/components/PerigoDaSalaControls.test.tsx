import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData } from '../types/map'
import { casa, CORREDOR, COZINHA, DESPENSA } from '../lib/perigoPlanta.fixture'
import { PerigoDaSalaControls } from './PerigoDaSalaControls'

/**
 * PERIGO QUE SE ALASTRA, lado do mestre: o bloco "Perigo" no painel da Sala.
 * Sala livre oferece "Pôr fogo" / "Pôr água"; sala tomada diz o que o
 * próximo avanço atinge, pelo nome das salas, e oferece "Avançar".
 */
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(map: MapData, salaId: string) {
  const props = { map, salaId, onPor: vi.fn(), onAvancar: vi.fn(), onApagar: vi.fn() }
  act(() => root.render(<PerigoDaSalaControls {...props} />))
  return props
}

function botao(texto: string): HTMLButtonElement {
  const alvo = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)
  if (alvo === undefined) throw new Error(`o bloco Perigo não tem o botão "${texto}"`)
  return alvo
}

describe('bloco Perigo no painel da Sala', () => {
  it('sala livre: "Pôr fogo" e "Pôr água" pedem o perigo com o tipo certo', () => {
    const props = render(casa(), COZINHA)
    act(() => botao('Pôr fogo').click())
    act(() => botao('Pôr água').click())
    expect(props.onPor.mock.calls).toEqual([['fogo'], ['agua']])
  })

  it('sala em chamas: diz quais salas o próximo avanço atinge e "Avançar" manda o id do perigo', () => {
    const props = render(casa({ perigos: [{ id: 'perigo-1', tipo: 'fogo', salas: [COZINHA] }] }), COZINHA)
    expect(container.textContent).toContain('Fogo nesta sala')
    expect(container.textContent).toContain('Vai atingir: Corredor, Despensa')
    act(() => botao('Avançar').click())
    act(() => botao('Apagar perigo').click())
    expect(props.onAvancar).toHaveBeenCalledWith('perigo-1')
    expect(props.onApagar).toHaveBeenCalledWith('perigo-1')
    expect(container.textContent).not.toContain('Pôr fogo')
  })

  it('fogo cercado por porta fechada: avisa que se apaga e vira cinza', () => {
    const map = casa({ perigos: [{ id: 'perigo-1', tipo: 'fogo', salas: [COZINHA] }], cozinhaCorredor: false, cozinhaDespensa: false })
    render(map, COZINHA)
    expect(container.textContent).toContain('Nenhuma porta aberta leva o fogo adiante: ao avançar, ele se apaga e vira cinza.')
  })

  it('sala em cinza: diz que já queimou e não oferece pôr outro perigo', () => {
    render(casa({ perigos: [{ id: 'perigo-1', tipo: 'fogo', salas: [CORREDOR, DESPENSA], cinzas: [COZINHA] }] }), COZINHA)
    expect(container.textContent).toContain('Cinza: esta sala já queimou')
    expect(container.querySelectorAll('button')).toHaveLength(2)
  })
})
