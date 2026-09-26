import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOKEN_CONDITION_SYMBOLS } from '../lib/tokenConditions'
import type { TokenCondition } from '../types/map'
import { CONDICOES_HINT, TokenConditionControls } from './TokenConditionControls'

/**
 * CONDIÇÃO NA FICHA, lado do PAINEL do mestre. Com a ficha selecionada, as
 * cinco condições são botões de ligar/desligar, cada um com o nome que a
 * pessoa lê e a mesma pastilha que sai no mapa; o marcado diz que está
 * marcado (`aria-pressed`), e clicar pede para alternar.
 *
 * Sem marca, o bloco é UMA linha "Condições" com "+" (peça P4 do laudo do
 * painel, o opcional vazio do Figma UI3); o "+" abre, o "−" fecha, e a escolha
 * é lembrada como a das seções recolhíveis do painel.
 */
let container: HTMLDivElement
let root: Root

/** Chave da escolha lembrada, a mesma família `lb-section:` de `CollapsibleSection`. */
const CHAVE = 'lb-section:ficha-condicoes'

/** O botão que a jornada `condicao-na-ficha` procura quando as condições não estão à vista. */
const ABRIR_CONDICOES = /^\s*condi[çc](ão|ao|ões|oes)\b/i

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

function render(conditions: readonly TokenCondition[], onToggleCondition: (c: TokenCondition) => void = vi.fn()) {
  act(() => root.render(<TokenConditionControls conditions={conditions} onToggleCondition={onToggleCondition} />))
}

/** Remonta do zero, como o painel faz quando a seleção sai e volta. */
function remontar(conditions: readonly TokenCondition[]) {
  act(() => root.unmount())
  root = createRoot(container)
  render(conditions)
}

function grupo(): HTMLElement {
  const achado = container.querySelector<HTMLElement>('[role="group"]')
  if (achado === null) throw new Error('sem o grupo das condições')
  return achado
}

function pastilhas(): HTMLButtonElement[] {
  return [...grupo().querySelectorAll('button')]
}

function pastilha(nome: string): HTMLButtonElement {
  const achado = pastilhas().find((b) => b.textContent?.trim() === nome)
  if (!achado) throw new Error(`sem a pastilha "${nome}"`)
  return achado
}

/** A linha "Condições": o botão fora do grupo (ou `null` quando ela é cabeçalho parado). */
function linha(): HTMLButtonElement | null {
  return [...container.querySelectorAll('button')].find((b) => !grupo().contains(b)) ?? null
}

/** O corpo que a linha abre (`aria-controls`), fechado com `hidden`. */
function corpoVisivel(): boolean {
  return grupo().closest('[hidden]') === null
}

describe('TokenConditionControls', () => {
  it('as cinco condições, pelo nome, como botões de ligar/desligar num grupo com rótulo', () => {
    render([])
    expect(pastilhas().map((b) => b.textContent?.trim())).toEqual(['Envenenado', 'Caído', 'Dormindo', 'Atordoado', 'Invisível'])
    for (const b of pastilhas()) {
      expect(b.getAttribute('type')).toBe('button')
      expect(b.getAttribute('aria-pressed')).toBe('false')
    }
    expect(grupo().getAttribute('aria-label')).toBe('Condições da ficha')
  })

  it('o que está marcado na ficha aparece pressionado; o resto não', () => {
    render(['caido', 'invisivel'])
    expect(pastilha('Caído').getAttribute('aria-pressed')).toBe('true')
    expect(pastilha('Invisível').getAttribute('aria-pressed')).toBe('true')
    expect(pastilha('Envenenado').getAttribute('aria-pressed')).toBe('false')
  })

  it('clicar pede para alternar AQUELA condição (marcar e desmarcar são o mesmo gesto)', () => {
    const onToggleCondition = vi.fn()
    render(['caido'], onToggleCondition)
    act(() => pastilha('Envenenado').click())
    act(() => pastilha('Caído').click())
    expect(onToggleCondition.mock.calls).toEqual([['envenenado'], ['caido']])
  })

  it('cada botão mostra a pastilha do mapa (a cor dela), decorativa para o leitor de tela', () => {
    render([])
    const cores = pastilhas().map((b) => {
      const arte = b.querySelector('svg')
      expect(arte?.getAttribute('aria-hidden')).toBe('true')
      return arte?.querySelector('circle')?.getAttribute('fill')
    })
    expect(cores).toEqual(['envenenado', 'caido', 'dormindo', 'atordoado', 'invisivel'].map((c) => TOKEN_CONDITION_SYMBOLS[c as keyof typeof TOKEN_CONDITION_SYMBOLS].fill))
  })

  it('diz onde a marca aparece — inclusive para os jogadores —, ligado à linha e ao grupo', () => {
    render([])
    const dica = document.getElementById(grupo().getAttribute('aria-describedby') ?? 'sem-id')
    expect(dica?.textContent).toBe(CONDICOES_HINT)
    expect(dica?.textContent).toMatch(/jogador/i)
    expect(dica?.classList.contains('lb-field__hint')).toBe(true)
    expect(linha()?.getAttribute('aria-describedby')).toBe(dica?.id)
  })

  it('sem marca e sem escolha lembrada: uma linha "Condições" com "+", fechada, sem título de bloco', () => {
    render([])
    const botao = linha()
    expect(botao?.textContent?.trim()).toBe('Condições')
    expect(botao?.textContent).toMatch(ABRIR_CONDICOES)
    expect(botao?.getAttribute('aria-expanded')).toBe('false')
    // O "+" é só desenho: o nome da linha é o texto dela.
    expect(botao?.querySelector('svg')?.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(document.getElementById(botao?.getAttribute('aria-controls') ?? 'sem-id')?.contains(grupo())).toBe(true)
    expect(corpoVisivel()).toBe(false)
    expect(container.querySelector('h2')).toBeNull()
  })

  it('o "+" abre as pastilhas e o painel lembra: remontado, o bloco nasce aberto', () => {
    render([])
    act(() => linha()?.click())
    expect(linha()?.getAttribute('aria-expanded')).toBe('true')
    expect(corpoVisivel()).toBe(true)
    expect(window.localStorage.getItem(CHAVE)).toBe('1')

    remontar([])
    expect(linha()?.getAttribute('aria-expanded')).toBe('true')
    expect(corpoVisivel()).toBe(true)
  })

  it('o "−" recolhe de volta à linha, e o painel lembra fechado', () => {
    window.localStorage.setItem(CHAVE, '1')
    render([])
    expect(corpoVisivel()).toBe(true)
    act(() => linha()?.click())
    expect(linha()?.getAttribute('aria-expanded')).toBe('false')
    expect(corpoVisivel()).toBe(false)
    expect(window.localStorage.getItem(CHAVE)).toBe('0')

    remontar([])
    expect(corpoVisivel()).toBe(false)
  })

  it('com marca, as pastilhas ficam à vista mesmo com o bloco lembrado fechado, e a linha vira cabeçalho parado', () => {
    window.localStorage.setItem(CHAVE, '0')
    render(['envenenado'])
    expect(corpoVisivel()).toBe(true)
    expect(pastilha('Envenenado').getAttribute('aria-pressed')).toBe('true')
    // Sem botão de recolher: o que está na ficha não se esconde atrás de um clique.
    expect(linha()).toBeNull()
    expect(container.textContent).toContain('Condições')
  })

  it('desmarcar a última condição não recolhe as pastilhas debaixo do ponteiro (e o bloco fica lembrado aberto)', () => {
    window.localStorage.setItem(CHAVE, '0')
    const onToggleCondition = vi.fn()
    render(['caido'], onToggleCondition)
    act(() => pastilha('Caído').click())
    expect(onToggleCondition).toHaveBeenCalledWith('caido')
    // O store tira a marca; a ficha volta sem condição nenhuma.
    render([], onToggleCondition)
    expect(corpoVisivel()).toBe(true)
    expect(linha()?.getAttribute('aria-expanded')).toBe('true')
    expect(window.localStorage.getItem(CHAVE)).toBe('1')
  })

  it('sem armazenamento (janela privada), nasce fechada e o "+" abre do mesmo jeito', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    render([])
    expect(corpoVisivel()).toBe(false)
    act(() => linha()?.click())
    expect(corpoVisivel()).toBe(true)
  })
})
