/**
 * "Reunir o grupo aqui" com a lista AGRUPADA POR CENA: uma caixa por grupo
 * ("PC - Cais (3)") que marca e desmarca todos de uma vez, e quem já está no
 * pino por último e desmarcado — o caso comum é trazer quem está longe.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GatherCandidate } from '../lib/gatherParty'
import { GATHER_LABEL, GatherControls } from './GatherControls'

function candidato(name: string, sceneId: string, sceneLabel: string, alreadyHere = false): GatherCandidate {
  return { playerId: `p-${name}`, name, color: '#3cff00', sceneId, sceneLabel, alreadyHere }
}

/** Os 7 da simulação: 3 no Cais, 3 no Sobrado, 1 já no pino (chegou primeiro). */
const SETE: GatherCandidate[] = [
  candidato('Hugo', 'porto', 'Porto Cinza', true),
  candidato('Bruno', 'cais', 'PC - Cais'),
  candidato('Elisa', 'sobrado', 'Sobrado'),
  candidato('Carla', 'cais', 'PC - Cais'),
  candidato('Fabio', 'sobrado', 'Sobrado'),
  candidato('Duda', 'cais', 'PC - Cais'),
  candidato('Gabi', 'sobrado', 'Sobrado'),
]

describe('GatherControls: lista agrupada por cena', () => {
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

  function abrir(candidates: GatherCandidate[], onGather: (ids: string[]) => void = () => {}): void {
    act(() => root.render(<GatherControls candidates={candidates} onGather={onGather} />))
    const botao = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === GATHER_LABEL)
    if (botao === undefined) throw new Error('botão "Reunir o grupo aqui" não apareceu')
    act(() => botao.click())
  }

  /** A caixa cujo rótulo visível é exatamente `nome` (jogador ou grupo). */
  function caixa(nome: string): HTMLInputElement {
    const rotulo = Array.from(container.querySelectorAll('label')).find((l) => l.textContent === nome)
    const input = rotulo?.querySelector('input[type="checkbox"]')
    if (!(input instanceof HTMLInputElement)) throw new Error(`sem caixa "${nome}"`)
    return input
  }

  function rotulosDeGrupo(): string[] {
    return Array.from(container.querySelectorAll('.lb-gather__group > label')).map((l) => l.textContent ?? '')
  }

  it('abre com um grupo por cena, "Já aqui" por último, os de longe marcados e quem já está no pino desmarcado', () => {
    abrir(SETE)
    expect(rotulosDeGrupo()).toEqual(['PC - Cais (3)', 'Sobrado (3)', 'Já aqui (1)'])
    const marcados = ['Bruno', 'Carla', 'Duda', 'Elisa', 'Fabio', 'Gabi', 'Hugo'].map((nome) => [nome, caixa(nome).checked])
    expect(marcados).toEqual([
      ['Bruno', true],
      ['Carla', true],
      ['Duda', true],
      ['Elisa', true],
      ['Fabio', true],
      ['Gabi', true],
      ['Hugo', false],
    ])
    expect([caixa('PC - Cais (3)').checked, caixa('Sobrado (3)').checked, caixa('Já aqui (1)').checked]).toEqual([true, true, false])
  })

  it('desmarca o Sobrado num clique; Reunir traz só os 3 do Cais', () => {
    const onGather = vi.fn()
    abrir(SETE, onGather)
    act(() => caixa('Sobrado (3)').click())
    expect(['Elisa', 'Fabio', 'Gabi'].map((nome) => caixa(nome).checked)).toEqual([false, false, false])
    const reunir = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Reunir')
    if (reunir === undefined) throw new Error('sem botão "Reunir"')
    act(() => reunir.click())
    expect(onGather).toHaveBeenCalledTimes(1)
    expect(onGather).toHaveBeenCalledWith(['p-Bruno', 'p-Carla', 'p-Duda'])
  })

  it('grupo com parte marcada fica "misto"; clicar nele marca o grupo inteiro', () => {
    abrir(SETE)
    act(() => caixa('Carla').click())
    const cais = caixa('PC - Cais (3)')
    expect([cais.checked, cais.indeterminate]).toEqual([false, true])
    act(() => cais.click())
    expect(['Bruno', 'Carla', 'Duda'].map((nome) => caixa(nome).checked)).toEqual([true, true, true])
    expect(cais.indeterminate).toBe(false)
  })

  it('quem já está no pino pode ser marcado à mão e entra na reunião', () => {
    const onGather = vi.fn()
    abrir([candidato('Hugo', 'porto', 'Porto Cinza', true), candidato('Bruno', 'cais', 'PC - Cais')], onGather)
    act(() => caixa('Hugo').click())
    const reunir = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Reunir')
    if (reunir === undefined) throw new Error('sem botão "Reunir"')
    act(() => reunir.click())
    // Na ordem da lista: quem vem de longe primeiro, quem já está aqui por último.
    expect(onGather).toHaveBeenCalledWith(['p-Bruno', 'p-Hugo'])
  })
})
