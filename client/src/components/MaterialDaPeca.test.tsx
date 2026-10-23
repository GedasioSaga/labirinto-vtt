import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AparenciaDoMovelPatch } from '../lib/mobilia'
import type { Prop } from '../types/map'
import { MobiliaControls } from './MobiliaControls'

/**
 * Aparência da PEÇA NOVA (MT4) no painel: o material no lugar da cor livre.
 * Cada amostra grava o tom OFICIAL do material no campo de cor que já existe
 * (o 1º lugar na "Cor", o 2º na "Cor da linha"), a marcada é o material mais
 * perto da cor gravada, e não há "Preencher" (a peça nova sai sempre com
 * textura: o botão não mudaria nada na tela).
 */

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

let raiz: Root
let caixa: HTMLDivElement

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  caixa = document.createElement('div')
  document.body.appendChild(caixa)
  raiz = createRoot(caixa)
})

afterEach(() => {
  act(() => raiz.unmount())
  caixa.remove()
})

function pintar(prop: Prop, pedidos: AparenciaDoMovelPatch[]): void {
  act(() => {
    raiz.render(
      <MobiliaControls
        parte="aparencia"
        prop={prop}
        onTipoChange={() => undefined}
        onVistaChange={() => undefined}
        onFormaChange={() => undefined}
        onAparenciaChange={(_id, patch) => pedidos.push(patch)}
      />,
    )
  })
}

const POCO: Prop = { id: 'p', src: '', x: 0, y: 0, width: 75, height: 75, linkedMapPath: null, mobilia: 'poco' }

describe('MaterialDaPeca: o material da peça nova', () => {
  it('o poço mostra Pedras e Madeira, com o padrão marcado e escrito, e sem "Preencher"', () => {
    pintar(POCO, [])
    const grupos = [...caixa.querySelectorAll('[role="radiogroup"]')]
    expect(grupos).toHaveLength(2)
    expect(caixa.textContent).toContain('Pedras')
    expect(caixa.textContent).toContain('Granito')
    expect(caixa.textContent).toContain('Madeira')
    expect(caixa.textContent).toContain('Carvalho')
    expect(caixa.textContent).not.toContain('Preencher')
    expect(caixa.querySelector('[aria-checked="true"][aria-label="Granito"]')).not.toBeNull()
  })

  it('a amostra grava o hex oficial: a pedra na Cor, a madeira na Cor da linha', () => {
    const pedidos: AparenciaDoMovelPatch[] = []
    pintar(POCO, pedidos)
    const ardosia = caixa.querySelector<HTMLButtonElement>('[aria-label="Ardósia"]')
    const nogueira = caixa.querySelector<HTMLButtonElement>('[aria-label="Nogueira"]')
    act(() => ardosia?.click())
    act(() => nogueira?.click())
    expect(pedidos).toEqual([{ cor: '#585d61' }, { corDaLinha: '#5f4532' }])
  })

  it('cor gravada fora da lista marca o material mais perto; a seta anda e grava', () => {
    const pedidos: AparenciaDoMovelPatch[] = []
    pintar({ ...POCO, mobiliaCor: '#5a5e62' }, pedidos)
    const marcada = caixa.querySelector<HTMLButtonElement>('[aria-checked="true"]')
    expect(marcada?.getAttribute('aria-label')).toBe('Ardósia')
    expect(marcada?.tabIndex).toBe(0)
    act(() => {
      marcada?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    // Depois da ardósia, a última, a seta volta à primeira (granito).
    expect(pedidos).toEqual([{ cor: '#7e7b76' }])
  })

  it('peça de um lugar só (a lápide) tem um grupo; móvel antigo continua com as cores livres', () => {
    pintar({ ...POCO, mobilia: 'lapide' }, [])
    expect(caixa.querySelectorAll('[role="radiogroup"]')).toHaveLength(1)
    pintar({ ...POCO, mobilia: 'mesa' }, [])
    expect(caixa.textContent).toContain('Preencher')
  })
})
