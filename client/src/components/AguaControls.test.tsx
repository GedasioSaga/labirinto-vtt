import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import { useFerramentaDaAgua } from '../stores/ferramentaDaAgua'
import type { Agua } from '../types/map'
import { AguaControls } from './AguaControls'

/**
 * Painel da ferramenta Água (MAR MAIS FÁCIL, 13/11/2026): a forma do lago e do
 * mar (o rio é só à mão) e, na água escolhida, como mexer nela (o pincel de
 * areia é só do mar).
 */
let raiz: Root
let palco: HTMLDivElement

/** Só o obrigatório: sem cor pronta, ajustes, areia nem reto. */
const MAR: Agua = { id: 'mar', tipo: 'mar', pontos: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }], cor: '#2d5f8c' }
const LAGO: Agua = { ...MAR, id: 'lago', tipo: 'lago' }

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  palco = document.createElement('div')
  document.body.appendChild(palco)
  raiz = createRoot(palco)
  useMapStore.getState().loadMap({ ...createEmptyMap('m', 'M', 20, 20, 40), aguas: [MAR, LAGO] })
  useFerramentaDaAgua.setState({ tipo: 'rio', forma: 'mao', escolhida: null, pincel: null })
})

afterEach(() => {
  act(() => raiz.unmount())
  palco.remove()
})

const rotulos = (): string[] => Array.from(palco.querySelectorAll<HTMLButtonElement>('button[role="radio"]')).map((b) => b.textContent ?? '')
const botao = (texto: string): HTMLButtonElement => {
  const achado = Array.from(palco.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === texto)
  if (achado === undefined) throw new Error(`sem o botão ${texto}`)
  return achado
}

describe('AguaControls', () => {
  it('a forma (à mão, retângulo, ponto a ponto) aparece no lago e no mar; o rio tem à mão e ponto a ponto', () => {
    act(() => raiz.render(<AguaControls />))
    expect(rotulos()).toEqual(expect.arrayContaining(['À mão', 'Ponto a ponto']))
    expect(rotulos()).not.toContain('Retângulo')
    act(() => botao('Mar').click())
    expect(rotulos()).toEqual(expect.arrayContaining(['À mão', 'Retângulo', 'Ponto a ponto']))
    act(() => botao('Ponto a ponto').click())
    expect(useFerramentaDaAgua.getState().forma).toBe('pontos')
    expect(palco.textContent).toContain('Duplo clique ou Enter fecha')
  })

  it('no mar escolhido há pincel de água e de areia; no lago, só o de água', () => {
    act(() => useFerramentaDaAgua.getState().escolher('mar'))
    act(() => raiz.render(<AguaControls />))
    expect(rotulos()).toEqual(expect.arrayContaining(['Bolinhas', 'Pincel de água', 'Pincel de areia']))
    act(() => botao('Pincel de areia').click())
    expect(useFerramentaDaAgua.getState().pincel).toBe('areia')
    expect(rotulos()).toEqual(expect.arrayContaining(['Tirar areia', 'Pôr areia']))
    expect(palco.querySelector('#lb-agua-pincel-tamanho')).not.toBeNull()
    // Outra água escolhida volta às bolinhas; o lago não tem areia.
    act(() => useFerramentaDaAgua.getState().escolher('lago'))
    expect(useFerramentaDaAgua.getState().pincel).toBeNull()
    expect(rotulos()).not.toContain('Pincel de areia')
  })
})
