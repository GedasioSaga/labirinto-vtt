import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useContaGotasStore } from '../stores/contaGotasStore'
import { CampoDeCorComPipeta } from './CampoDeCorComPipeta'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useContaGotasStore.setState({ donoId: null, aoPegar: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function pipeta(nome = 'Pegar cor do mapa'): HTMLButtonElement {
  const achado = container.querySelector<HTMLButtonElement>(`button[aria-label="${nome}"]`)
  if (!achado) throw new Error(`pipeta "${nome}" não achada`)
  return achado
}

function amostra(): HTMLInputElement {
  const achado = container.querySelector<HTMLInputElement>('input[type="color"]')
  if (!achado) throw new Error('amostra não achada')
  return achado
}

function teclar(key: string) {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  act(() => {
    document.body.dispatchEvent(evento)
  })
  return evento
}

describe('CampoDeCorComPipeta', () => {
  it('a amostra continua sendo o input de cor, com id e classe do painel', () => {
    const onChange = vi.fn()
    act(() => root.render(<CampoDeCorComPipeta id="lb-x" value="#112233" onChange={onChange} />))
    expect(amostra().id).toBe('lb-x')
    expect(amostra().className).toBe('lb-swatch')
    expect(amostra().value).toBe('#112233')
  })

  it('clicar na pipeta liga o modo; a cor do mapa chega pelo onChange e desliga', () => {
    const onChange = vi.fn()
    act(() => root.render(<CampoDeCorComPipeta value="#112233" onChange={onChange} />))
    expect(pipeta().getAttribute('aria-pressed')).toBe('false')

    act(() => pipeta().click())
    expect(useContaGotasStore.getState().donoId).not.toBeNull()
    expect(pipeta().getAttribute('aria-pressed')).toBe('true')

    act(() => useContaGotasStore.getState().entregar('#a0b1c2'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('#a0b1c2')
    expect(pipeta().getAttribute('aria-pressed')).toBe('false')
  })

  it('entrega para o onChange mais recente, não o do momento do clique', () => {
    const antigo = vi.fn()
    const novo = vi.fn()
    act(() => root.render(<CampoDeCorComPipeta value="#000000" onChange={antigo} />))
    act(() => pipeta().click())
    act(() => root.render(<CampoDeCorComPipeta value="#000000" onChange={novo} />))
    act(() => useContaGotasStore.getState().entregar('#ffffff'))
    expect(antigo).not.toHaveBeenCalled()
    expect(novo).toHaveBeenCalledWith('#ffffff')
  })

  it('Esc cancela sem chegar aos atalhos do mapa (que largariam a seleção)', () => {
    const atalhoDoMapa = vi.fn()
    window.addEventListener('keydown', atalhoDoMapa)
    try {
      act(() => root.render(<CampoDeCorComPipeta value="#000000" onChange={vi.fn()} />))
      act(() => pipeta().click())
      const evento = teclar('Escape')
      expect(useContaGotasStore.getState().donoId).toBeNull()
      expect(evento.defaultPrevented).toBe(true)
      expect(atalhoDoMapa).not.toHaveBeenCalled()

      // Desarmada, o Esc volta a ser do mapa.
      teclar('Escape')
      expect(atalhoDoMapa).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', atalhoDoMapa)
    }
  })

  it('clicar de novo na pipeta cancela', () => {
    const onChange = vi.fn()
    act(() => root.render(<CampoDeCorComPipeta value="#000000" onChange={onChange} />))
    act(() => pipeta().click())
    act(() => pipeta().click())
    expect(useContaGotasStore.getState().donoId).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('a pipeta de outro campo troca quem recebe a cor', () => {
    const doChao = vi.fn()
    const doContorno = vi.fn()
    act(() =>
      root.render(
        <>
          <CampoDeCorComPipeta value="#000000" onChange={doChao} rotuloDaPipeta="Chão" />
          <CampoDeCorComPipeta value="#000000" onChange={doContorno} rotuloDaPipeta="Contorno" />
        </>,
      ),
    )
    act(() => pipeta('Chão').click())
    act(() => pipeta('Contorno').click())
    expect(pipeta('Chão').getAttribute('aria-pressed')).toBe('false')
    expect(pipeta('Contorno').getAttribute('aria-pressed')).toBe('true')
    act(() => useContaGotasStore.getState().entregar('#123123'))
    expect(doChao).not.toHaveBeenCalled()
    expect(doContorno).toHaveBeenCalledWith('#123123')
  })

  it('o campo saindo da tela com a pipeta armada desliga o modo', () => {
    act(() => root.render(<CampoDeCorComPipeta value="#000000" onChange={vi.fn()} />))
    act(() => pipeta().click())
    act(() => root.render(<></>))
    expect(useContaGotasStore.getState().donoId).toBeNull()
  })

  it('campo desabilitado: pipeta desabilitada, e desabilitar com ela armada desliga', () => {
    act(() => root.render(<CampoDeCorComPipeta value="#000000" onChange={vi.fn()} />))
    act(() => pipeta().click())
    act(() => root.render(<CampoDeCorComPipeta value="#000000" onChange={vi.fn()} disabled />))
    expect(pipeta().disabled).toBe(true)
    expect(useContaGotasStore.getState().donoId).toBeNull()
  })
})
