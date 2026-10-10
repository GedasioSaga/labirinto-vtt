import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import { PenhascoControls } from './PenhascoControls'

/*
 * Painel do Penhasco: o que o próximo risco faz, a largura do pincel, e as
 * duas saídas que o painel oferece — ligar o relevo quando ele está desligado
 * (senão o risco não aparece) e apagar todos os penhascos.
 */

let raiz: Root
let palco: HTMLDivElement

beforeEach(() => {
  palco = document.createElement('div')
  document.body.appendChild(palco)
  raiz = createRoot(palco)
  useMapStore.getState().loadMap({ ...createEmptyMap('m', 'M', 20, 20, 50), continente: true })
  useMapStore.getState().setPenhascoModo('riscar')
  useMapStore.getState().setPenhascoLargura('media')
})

afterEach(() => {
  act(() => raiz.unmount())
  palco.remove()
})

function montar(): void {
  act(() => raiz.render(<PenhascoControls />))
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(palco.querySelectorAll('button')).find((b) => b.textContent === nome)
  if (achado === undefined) throw new Error(`sem o botão "${nome}"`)
  return achado
}

function temBotao(nome: string): boolean {
  return Array.from(palco.querySelectorAll('button')).some((b) => b.textContent === nome)
}

describe('PenhascoControls', () => {
  it('Riscar/Apagar e Fino/Médio/Largo escrevem a preferência da ferramenta', () => {
    montar()
    expect(botao('Riscar').getAttribute('aria-checked')).toBe('true')
    act(() => botao('Apagar').click())
    expect(useMapStore.getState().penhascoModo).toBe('apagar')
    expect(botao('Apagar').getAttribute('aria-checked')).toBe('true')
    act(() => botao('Largo').click())
    expect(useMapStore.getState().penhascoLargura).toBe('larga')
    // Preferência de ferramenta: nada entra no desfazer.
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('relevo desligado: o painel diz e oferece ligar (com desfazer)', () => {
    useMapStore.getState().loadMap({ ...useMapStore.getState().map, relevo: false })
    montar()
    act(() => botao('Ligar o relevo').click())
    expect(useMapStore.getState().map.relevo).toBeUndefined()
    expect(temBotao('Ligar o relevo')).toBe(false)
    expect(useMapStore.getState().past).toHaveLength(1)
  })

  it('"Apagar todos os penhascos" só aparece com penhasco, e limpa', () => {
    montar()
    expect(temBotao('Apagar todos os penhascos')).toBe(false)
    act(() =>
      useMapStore.getState().loadMap({
        ...useMapStore.getState().map,
        penhascos: [{ id: 'a', modo: 'riscar', raio: 10, pontos: [{ x: 0, y: 0 }] }],
      }),
    )
    act(() => botao('Apagar todos os penhascos').click())
    expect(useMapStore.getState().map.penhascos).toBeUndefined()
    expect(temBotao('Apagar todos os penhascos')).toBe(false)
  })
})
