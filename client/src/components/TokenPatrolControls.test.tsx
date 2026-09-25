import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TokenPatrol } from '../types/map'
import { TokenPatrolControls } from './TokenPatrolControls'

/**
 * ROTA DE PATRULHA, lado do PAINEL do mestre: "Marcar ponto aqui" grava onde a
 * ficha está como próximo ponto da rota; "Avançar patrulha" leva o NPC um
 * passo. Sem dois pontos não há para onde andar: o botão fica indisponível e
 * diz por quê, em vez de ficar clicável sem efeito.
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

function render(node: React.ReactNode) {
  act(() => root.render(node))
}

function botao(rotulo: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((b) => b.textContent === rotulo)
}

function botaoCerto(rotulo: string): HTMLButtonElement {
  const achado = botao(rotulo)
  if (achado === undefined) throw new Error(`sem o botão "${rotulo}"`)
  return achado
}

const RONDA: TokenPatrol = {
  pontos: [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 400 },
  ],
  atual: 1,
}

describe('TokenPatrolControls', () => {
  it('ficha sem rota: só "Marcar ponto aqui" age; "Avançar patrulha" indisponível, com o motivo ao lado', () => {
    render(<TokenPatrolControls patrol={null} onPatrolOp={vi.fn()} />)
    expect(container.querySelector('h2')?.textContent).toBe('Patrulha')
    expect(botaoCerto('Marcar ponto aqui').disabled).toBe(false)
    const avancar = botaoCerto('Avançar patrulha')
    expect(avancar.disabled).toBe(true)
    const motivo = document.getElementById(avancar.getAttribute('aria-describedby') ?? 'sem-id')
    expect(motivo?.textContent).toContain('2 pontos')
    expect(botao('Tirar último ponto')).toBeUndefined()
    expect(botao('Apagar rota')).toBeUndefined()
  })

  it('um ponto só: ainda não anda', () => {
    render(<TokenPatrolControls patrol={{ pontos: [{ x: 1, y: 1 }], atual: 0 }} onPatrolOp={vi.fn()} />)
    expect(botaoCerto('Avançar patrulha').disabled).toBe(true)
    expect(container.textContent).toContain('1 ponto')
  })

  it('com rota: diz quantos pontos e onde o NPC está, e cada botão pede a sua operação', () => {
    const onPatrolOp = vi.fn()
    render(<TokenPatrolControls patrol={RONDA} onPatrolOp={onPatrolOp} />)
    expect(container.textContent).toContain('3 pontos')
    expect(container.textContent).toContain('no ponto 2')
    const avancar = botaoCerto('Avançar patrulha')
    expect(avancar.disabled).toBe(false)
    act(() => avancar.click())
    expect(onPatrolOp).toHaveBeenLastCalledWith('avancar')
    act(() => botaoCerto('Marcar ponto aqui').click())
    expect(onPatrolOp).toHaveBeenLastCalledWith('marcar')
    act(() => botaoCerto('Tirar último ponto').click())
    expect(onPatrolOp).toHaveBeenLastCalledWith('desfazer')
    act(() => botaoCerto('Apagar rota').click())
    expect(onPatrolOp).toHaveBeenLastCalledWith('apagar')
    expect(onPatrolOp).toHaveBeenCalledTimes(4)
  })

  it('o mestre fica sabendo que a rota não vai para a mesa', () => {
    render(<TokenPatrolControls patrol={RONDA} onPatrolOp={vi.fn()} />)
    expect(container.textContent).toContain('A rota só você vê')
  })
})
