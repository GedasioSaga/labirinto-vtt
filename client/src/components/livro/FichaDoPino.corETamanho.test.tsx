import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FichaDoPino, type FichaDoPinoProps } from './FichaDoPino'

/**
 * Ficha do pino (fatia 14), COR E TAMANHO: moram na ficha recolhida
 * "Aparência", valem para todo tipo de pino, e os dois "padrão" chamam `null`
 * (quem grava transforma em AUSENTE). Sem o callback, sem o controle.
 */

describe('FichaDoPino: cor e tamanho', () => {
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
    window.localStorage.clear()
  })

  function render(extra: Partial<FichaDoPinoProps>): void {
    const props: FichaDoPinoProps = {
      pinId: 'pin-1',
      kind: 'exclamacao',
      onKindChange: () => {},
      description: 'Baú',
      onDescriptionChange: () => {},
      locked: false,
      onLockedChange: () => {},
      marco: false,
      onMarcoChange: () => {},
      lerDePerto: null,
      onLerDePertoChange: () => {},
      image: null,
      onChooseImage: () => {},
      onClearImage: () => {},
      iconChoice: null,
      quemVe: null,
      ...extra,
    }
    act(() => root.render(<FichaDoPino {...props} />))
  }

  function abrirAparencia(): void {
    const botao = Array.from(container.querySelectorAll('button[aria-expanded]')).find((b) => (b.textContent ?? '').includes('Aparência'))
    if (!(botao instanceof HTMLButtonElement)) throw new Error('sem a ficha Aparência')
    if (botao.getAttribute('aria-expanded') === 'false') act(() => botao.click())
  }

  const botaoChamado = (nome: string): HTMLButtonElement | null =>
    Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === nome) ?? null

  function clicar(nome: string): void {
    const botao = botaoChamado(nome)
    if (!botao) throw new Error(`sem o botão "${nome}"`)
    act(() => botao.click())
  }

  function mudarValor(input: HTMLInputElement, valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    if (!setter) throw new Error('sem o setter de value')
    act(() => {
      setter.call(input, valor)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('nasce dentro da Aparência fechada', () => {
    render({ cor: null, onCorChange: () => {}, escala: 1, onEscalaChange: () => {} })
    // Fechada, o miolo fica inerte (fora do Tab e do leitor de tela).
    const faixa = container.querySelector('input[type="range"]')
    expect(faixa?.closest('[inert]')).not.toBeNull()
    expect(container.querySelector('input[type="color"]')?.closest('[inert]')).not.toBeNull()
    abrirAparencia()
    expect(container.querySelector('input[type="range"]')?.closest('[inert]')).toBeNull()
  })

  it('a paleta, "Outra cor…" e "Cor padrão" chamam onCorChange; o padrão chama null', () => {
    const onCorChange = vi.fn()
    render({ cor: null, onCorChange, escala: 1, onEscalaChange: () => {} })
    abrirAparencia()
    const grupo = Array.from(container.querySelectorAll('[role="radiogroup"]')).find((g) => {
      const id = g.getAttribute('aria-labelledby')
      return id !== null && document.getElementById(id)?.textContent === 'Cor do pino'
    })
    if (!grupo) throw new Error('sem a paleta "Cor do pino"')
    const cores = Array.from(grupo.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
    expect(cores).toHaveLength(8)
    expect(cores.every((c) => c.getAttribute('aria-checked') === 'false')).toBe(true)
    act(() => cores[7].click())
    expect(onCorChange).toHaveBeenLastCalledWith('#5b6670')

    const outra = grupo.querySelector<HTMLInputElement>('input[type="color"][aria-label="Outra cor…"]')
    if (!outra) throw new Error('sem "Outra cor…"')
    expect(outra.value).toBe('#f2c14e')
    mudarValor(outra, '#123456')
    expect(onCorChange).toHaveBeenLastCalledWith('#123456')

    clicar('Cor padrão')
    expect(onCorChange).toHaveBeenLastCalledWith(null)
  })

  it('cor fora da paleta marca o "Outra cor…"; cor da paleta marca a bolinha', () => {
    render({ cor: '#123456', onCorChange: () => {} })
    abrirAparencia()
    expect(container.querySelector('.lb-pin-outra-cor--marcada')).not.toBeNull()
    render({ cor: '#79A9CC', onCorChange: () => {} })
    expect(container.querySelector('.lb-pin-outra-cor--marcada')).toBeNull()
    expect(container.querySelector('.gr-cores [role="radio"][aria-checked="true"]')?.getAttribute('aria-label')).toBe('Cor #79a9cc')
  })

  it('o deslizante "Tamanho" vai de 0,5 a 3, fala "1,5x" e chama onEscalaChange; "Padrão" chama null', () => {
    const onEscalaChange = vi.fn()
    render({ escala: 1.5, onEscalaChange })
    abrirAparencia()
    const faixa = container.querySelector<HTMLInputElement>('input[type="range"]')
    if (!faixa) throw new Error('sem o deslizante')
    expect(faixa.labels?.[0]?.textContent).toBe('Tamanho')
    expect([faixa.min, faixa.max, faixa.step, faixa.value]).toEqual(['0.5', '3', '0.25', '1.5'])
    expect(faixa.getAttribute('aria-valuetext')).toBe('1,5x')
    mudarValor(faixa, '2.75')
    expect(onEscalaChange).toHaveBeenLastCalledWith(2.75)
    clicar('Tamanho padrão')
    expect(onEscalaChange).toHaveBeenLastCalledWith(null)
    expect(botaoChamado('Tamanho padrão')?.textContent).toBe('Padrão')
  })

  it('vale para todo tipo: viagem, alavanca e minigame também', () => {
    for (const kind of ['viagem', 'alavanca', 'minigame'] as const) {
      render({ kind, cor: null, onCorChange: () => {}, escala: 1, onEscalaChange: () => {} })
      abrirAparencia()
      expect(container.querySelector('input[type="range"]'), kind).not.toBeNull()
      expect(botaoChamado('Cor padrão'), kind).not.toBeNull()
    }
  })

  it('sem os callbacks, sem os controles', () => {
    render({})
    abrirAparencia()
    expect(container.querySelector('input[type="range"]')).toBeNull()
    expect(container.querySelector('input[type="color"]')).toBeNull()
    expect(botaoChamado('Cor padrão')).toBeNull()
  })
})
