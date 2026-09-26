import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOKEN_COLOR_OPTIONS, tokenColorName } from '../lib/tokenColor'
import { TokenColorControls } from './TokenColorControls'

/**
 * COR DA FICHA, lado do PAINEL do mestre: seis cores chapadas, um clique por
 * cor. Numa linha só (peça P4 do laudo do painel): "Cor" e as seis amostras,
 * sem bloco nem título; o nome de cada cor (com o papel: "Verde — aliado")
 * está no nome acessível e no `title` que aparece ao pairar.
 */
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

function render(color: string | null, onColorChange: (color: string | null) => void = vi.fn()) {
  act(() => root.render(<TokenColorControls color={color} onColorChange={onColorChange} />))
}

function grupo(): HTMLElement {
  const achado = container.querySelector<HTMLElement>('[role="radiogroup"]')
  if (achado === null) throw new Error('sem o grupo "Cor da ficha"')
  return achado
}

function amostras(): HTMLButtonElement[] {
  return [...grupo().querySelectorAll<HTMLButtonElement>('[role="radio"]')]
}

function amostra(nome: string): HTMLButtonElement {
  const achado = amostras().find((b) => b.getAttribute('aria-label') === nome)
  if (!achado) throw new Error(`sem a amostra "${nome}"`)
  return achado
}

describe('TokenColorControls', () => {
  it('as seis cores num grupo "Cor da ficha", com o nome (e o papel) no nome acessível e no title', () => {
    render(null)
    expect(grupo().getAttribute('aria-label')).toBe('Cor da ficha')
    expect(amostras().map((b) => b.getAttribute('aria-label'))).toEqual(TOKEN_COLOR_OPTIONS.map(tokenColorName))
    // "Roxo" sem papel: é o nome exato que a jornada condicao-na-ficha clica.
    expect(amostra('Roxo').getAttribute('title')).toBe('Roxo')
    expect(amostra('Verde — aliado').getAttribute('title')).toBe('Verde — aliado')
    for (const b of amostras()) expect(b.getAttribute('type')).toBe('button')
  })

  it('numa linha só: as seis amostras juntas, ao lado do rótulo "Cor", sem título de bloco', () => {
    render(null)
    expect(container.querySelector('h2')).toBeNull()
    const linha = grupo().closest('.lb-token-par')
    expect(linha).not.toBeNull()
    expect(linha?.textContent?.trim()).toBe('Cor')
    expect(amostras()).toHaveLength(6)
  })

  it('cada amostra é o disco da tinta que sai no mapa, decorativo para o leitor de tela', () => {
    render(null)
    const tintas = amostras().map((b) => {
      const disco = b.querySelector('svg')
      expect(disco?.getAttribute('aria-hidden')).toBe('true')
      return disco?.querySelector('circle')?.getAttribute('fill')
    })
    expect(tintas).toEqual(TOKEN_COLOR_OPTIONS.map((o) => o.value))
  })

  it('a cor da ficha aparece marcada; a de fábrica não marca nenhuma', () => {
    render('#9a5fd0')
    expect(amostra('Roxo').getAttribute('aria-checked')).toBe('true')
    expect(amostras().filter((b) => b.getAttribute('aria-checked') === 'true')).toHaveLength(1)
    render(null)
    expect(amostras().filter((b) => b.getAttribute('aria-checked') === 'true')).toHaveLength(0)
  })

  it('clicar numa amostra pede aquela cor', () => {
    const onColorChange = vi.fn()
    render(null, onColorChange)
    act(() => amostra('Vermelho — inimigo').click())
    expect(onColorChange).toHaveBeenCalledWith('#d6452f')
  })

  it('"Cor padrão" só existe com uma cor escolhida, e devolve a cor de fábrica', () => {
    const onColorChange = vi.fn()
    render(null, onColorChange)
    expect([...container.querySelectorAll('button')].some((b) => b.textContent === 'Cor padrão')).toBe(false)
    render('#35b24a', onColorChange)
    const padrao = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Cor padrão')
    expect(padrao).toBeDefined()
    act(() => padrao?.click())
    expect(onColorChange).toHaveBeenCalledWith(null)
  })
})
