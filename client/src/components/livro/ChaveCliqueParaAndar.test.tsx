import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../../lib/mapFactory'
import { useMapStore } from '../../stores/mapStore'
import { ChaveCliqueParaAndar } from './ChaveCliqueParaAndar'

/*
 * CLICAR PARA ANDAR (CAMINHOS F2): a chave do mestre por cena, na página Cena
 * do livro. Nasce ligada (mapa sem o campo); desligar grava `false` na cena
 * aberta, com desfazer; religar tira o campo (o mapa volta ao de antes).
 */

let raiz: Root
let caixa: HTMLDivElement

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useMapStore.setState({ map: createEmptyMap('m-chave', 'Chave', 10, 10, 50) })
  caixa = document.createElement('div')
  document.body.appendChild(caixa)
  raiz = createRoot(caixa)
  act(() => raiz.render(<ChaveCliqueParaAndar />))
})

afterEach(() => {
  act(() => raiz.unmount())
  caixa.remove()
})

function chave(): HTMLInputElement {
  const input = Array.from(caixa.querySelectorAll('label')).find((l) => l.textContent?.includes('Clicar para andar'))?.querySelector('input')
  if (!input) throw new Error('sem a chave "Clicar para andar"')
  return input
}

describe('chave "Clicar para andar" da cena', () => {
  it('nasce ligada, com um texto simples que diz o que ela faz', () => {
    expect(chave().checked).toBe(true)
    const dica = document.getElementById(chave().getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toMatch(/clica no chão/)
  })

  it('desligar grava false na cena; religar tira o campo; desfazer volta', () => {
    act(() => chave().click())
    expect(useMapStore.getState().map.cliqueParaAndar).toBe(false)
    expect(chave().checked).toBe(false)
    act(() => chave().click())
    expect('cliqueParaAndar' in useMapStore.getState().map).toBe(false)
    act(() => useMapStore.getState().undo())
    expect(useMapStore.getState().map.cliqueParaAndar).toBe(false)
  })
})
