// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LightControls, type LightControlsProps } from './LightControls'

// React 19 só aplica `act` sem aviso quando o ambiente declara que é de teste.
Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

const TOKENS = [
  { id: 'tok-lanterna', name: 'Lanterna' },
  { id: 'tok-pilar', name: 'Pilar A' },
]

let root: Root | null = null
let host: HTMLDivElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
})

function montar(overrides: Partial<LightControlsProps> = {}) {
  const props: LightControlsProps = {
    color: '#ff0000',
    onColorChange: vi.fn(),
    intensity: 1,
    onIntensityChange: vi.fn(),
    tokens: TOKENS,
    attachedTokenId: null,
    onAttach: vi.fn(),
    onDetach: vi.fn(),
    ...overrides,
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  const r = createRoot(host)
  root = r
  act(() => r.render(<LightControls {...props} />))
  return props
}

function seletorDePrender(): HTMLSelectElement {
  const label = Array.from(document.querySelectorAll('label')).find((l) => /prender/i.test(l.textContent ?? ''))
  if (!label) throw new Error('sem rótulo com "prender"')
  const alvo = document.getElementById(label.htmlFor)
  if (!(alvo instanceof HTMLSelectElement)) throw new Error('o rótulo de prender não aponta para um <select>')
  return alvo
}

function botaoSoltar(): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll('button')).find((b) => /^soltar/i.test((b.getAttribute('aria-label') ?? b.textContent ?? '').trim())) ?? null
}

describe('LightControls — prender a luz numa ficha', () => {
  it('oferece um <select> "Prender na ficha" com as fichas da cena pelo nome', () => {
    montar()
    const select = seletorDePrender()
    expect(Array.from(select.options).map((o) => o.text)).toEqual(expect.arrayContaining(['Lanterna', 'Pilar A']))
    expect(select.value).toBe('')
    expect(botaoSoltar()).toBeNull()
  })

  it('escolher a Lanterna chama onAttach com o id da ficha', () => {
    const props = montar()
    const select = seletorDePrender()
    act(() => {
      select.value = 'tok-lanterna'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(props.onAttach).toHaveBeenCalledWith('tok-lanterna')
  })

  it('presa: mostra a ficha escolhida e "Soltar", que chama onDetach', () => {
    const props = montar({ attachedTokenId: 'tok-lanterna' })
    expect(seletorDePrender().value).toBe('tok-lanterna')
    const soltar = botaoSoltar()
    if (soltar === null) throw new Error('presa, a luz deveria oferecer "Soltar"')
    act(() => soltar.click())
    expect(props.onDetach).toHaveBeenCalledTimes(1)
  })

  it('voltar o seletor para "nenhuma" também solta', () => {
    const props = montar({ attachedTokenId: 'tok-lanterna' })
    const select = seletorDePrender()
    act(() => {
      select.value = ''
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(props.onDetach).toHaveBeenCalledTimes(1)
    expect(props.onAttach).not.toHaveBeenCalled()
  })

  it('vínculo com ficha que sumiu da cena conta como solta (sem "Soltar" de ficha fantasma)', () => {
    montar({ attachedTokenId: 'tok-apagada' })
    expect(seletorDePrender().value).toBe('')
    expect(botaoSoltar()).toBeNull()
  })
})
