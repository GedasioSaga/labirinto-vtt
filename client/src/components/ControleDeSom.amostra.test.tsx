import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarAudioFalso } from '../lib/sons/audioFalso.fixture'
import { RECEITAS } from '../lib/sons/receitas'
import { tocarSom } from '../lib/sons/tocarSom'
import { PREFERENCIA_DE_SOM_PADRAO, useSomStore } from '../stores/somStore'
import { ControleDeSom, SOM_DE_AMOSTRA } from './ControleDeSom'

/*
 * A AMOSTRA NO MOTOR DO APP: o controle montado como o app monta, sem `tocar`
 * de mentira, sobre o motor de som de verdade (`lib/sons`), com um
 * AudioContext falso no lugar do Web Audio. A amostra fica fora do intervalo
 * mínimo do `tocarSom`: cinco setas tocam cinco sinos, e o item de verdade
 * que chega logo depois não fica mudo por causa dela.
 */

/** Osciladores de um toque da amostra: as notas do sino de "item obtido". */
const OSCILADORES_DA_AMOSTRA = RECEITAS[SOM_DE_AMOSTRA].filter((voz) => voz.fonte === 'osc').length

describe('ControleDeSom: a amostra no motor do app', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    localStorage.clear()
    useSomStore.setState({ ...PREFERENCIA_DE_SOM_PADRAO })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  function barra(): HTMLInputElement {
    const achada = container.querySelector<HTMLInputElement>('[role="dialog"] input[type="range"]')
    if (achada === null) throw new Error('sem a barra de volume')
    return achada
  }

  /** Um toque de seta, como o navegador faz: `keydown`, o valor anda (`input`), `change` e `keyup`. */
  function tocarSeta(valor: number): void {
    const definirValor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      barra().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
      definirValor?.call(barra(), String(valor))
      barra().dispatchEvent(new Event('input', { bubbles: true }))
      barra().dispatchEvent(new Event('change', { bubbles: true }))
      barra().dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    })
  }

  it('cinco setas seguidas tocam cinco amostras, e o item de verdade logo depois toca', () => {
    expect(OSCILADORES_DA_AMOSTRA).toBeGreaterThan(0)
    const audio = criarAudioFalso()
    // O motor faz `new AudioContext()` no gesto: função comum que devolve objeto faz o `new` devolver esse objeto.
    vi.stubGlobal('AudioContext', function AudioContextFalso() {
      return audio.ctx
    })
    act(() => root.render(<ControleDeSom variante="flutuante" />))
    const alto = container.querySelector<HTMLButtonElement>('button[aria-label="Som"]')
    if (alto === null) throw new Error('sem o botão "Som"')
    // O clique no alto-falante é o gesto que cria o áudio (o controle escuta no próprio corpo) e abre o popover.
    act(() => {
      alto.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    })
    expect(audio.osciladores).toEqual([])

    for (let valor = 36; valor <= 40; valor += 1) tocarSeta(valor)
    expect(useSomStore.getState().volume).toBe(0.4)
    expect(audio.osciladores).toHaveLength(5 * OSCILADORES_DA_AMOSTRA)

    // O item pego logo depois (bem dentro dos 600 ms do intervalo dele) toca: a amostra não o alimentou.
    expect(tocarSom('item')).toBe(true)
    expect(audio.osciladores).toHaveLength(6 * OSCILADORES_DA_AMOSTRA)

    // E o item de verdade não cala a seta seguinte.
    tocarSeta(41)
    expect(audio.osciladores).toHaveLength(7 * OSCILADORES_DA_AMOSTRA)
  })
})
