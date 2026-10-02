import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TokenPatrol } from '../types/map'
import { TokenPatrolControls, type TokenPatrolControlsProps } from './TokenPatrolControls'

/**
 * PATRULHA AUTOMÁTICA, lado do PAINEL: "Patrulhar sozinha" liga a ronda que
 * anda sozinha (e vira "Parar"); velocidade e modo da ronda ficam na rota.
 * Sem dois pontos não há ronda: o botão fica indisponível, com o mesmo motivo
 * do "Avançar patrulha".
 */
let container: HTMLDivElement
let root: Root

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
})

const RONDA: TokenPatrol = {
  pontos: [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
  ],
  atual: 0,
}

function render(patrol: TokenPatrol | null, extra: Partial<TokenPatrolControlsProps> = {}) {
  act(() => root.render(<TokenPatrolControls patrol={patrol} onPatrolOp={vi.fn()} onPatrulhar={vi.fn()} onConfig={vi.fn()} {...extra} />))
}

function botao(rotulo: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === rotulo)
  if (achado === undefined) throw new Error(`sem o botão "${rotulo}"`)
  return achado
}

function lista(rotulo: string): HTMLSelectElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === rotulo)
  const select = label === undefined ? null : document.getElementById(label.htmlFor)
  if (!(select instanceof HTMLSelectElement)) throw new Error(`sem a lista "${rotulo}"`)
  return select
}

function escolher(select: HTMLSelectElement, valor: string) {
  act(() => {
    select.value = valor
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('TokenPatrolControls — patrulha automática', () => {
  it('com rota de 2 pontos, "Patrulhar sozinha" liga a ronda', () => {
    const onPatrulhar = vi.fn()
    render(RONDA, { onPatrulhar })
    const ligar = botao('Patrulhar sozinha')
    expect(ligar.disabled).toBe(false)
    expect(ligar.getAttribute('aria-pressed')).toBe('false')
    act(() => ligar.click())
    expect(onPatrulhar).toHaveBeenCalledWith(true)
  })

  it('andando, o botão vira "Parar" e desliga', () => {
    const onPatrulhar = vi.fn()
    render(RONDA, { onPatrulhar, patrulhando: true })
    const parar = botao('Parar')
    expect(parar.getAttribute('aria-pressed')).toBe('true')
    act(() => parar.click())
    expect(onPatrulhar).toHaveBeenCalledWith(false)
    // O passo manual continua lá.
    expect(botao('Avançar patrulha').disabled).toBe(false)
  })

  it('um ponto só: não há ronda, e o motivo é o mesmo do "Avançar patrulha"', () => {
    render({ pontos: [{ x: 1, y: 1 }], atual: 0 })
    const ligar = botao('Patrulhar sozinha')
    expect(ligar.disabled).toBe(true)
    expect(document.getElementById(ligar.getAttribute('aria-describedby') ?? 'sem-id')?.textContent).toContain('2 pontos')
  })

  it('velocidade e modo: começam no padrão e cada escolha vai para a rota', () => {
    const onConfig = vi.fn()
    render(RONDA, { onConfig })
    expect(lista('Velocidade').value).toBe('2')
    expect(lista('Ronda').value).toBe('circuito')
    escolher(lista('Velocidade'), '4')
    expect(onConfig).toHaveBeenLastCalledWith({ velocidade: 4 })
    escolher(lista('Ronda'), 'vai-e-volta')
    expect(onConfig).toHaveBeenLastCalledWith({ modo: 'vai-e-volta' })
  })

  it('a configuração gravada aparece; velocidade fora da lista ganha a própria opção', () => {
    render({ ...RONDA, velocidade: 2.5, modo: 'vai-e-volta' })
    expect(lista('Velocidade').value).toBe('2.5')
    expect(lista('Ronda').value).toBe('vai-e-volta')
  })

  it('sem quem ligue, o botão e as listas não aparecem (controle sem efeito não entra)', () => {
    act(() => root.render(<TokenPatrolControls patrol={RONDA} onPatrolOp={vi.fn()} />))
    expect([...container.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Patrulhar sozinha')).toBe(false)
    expect(container.querySelector('select')).toBeNull()
  })
})
