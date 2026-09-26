import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PatrolOp } from '../lib/npcPatrol'
import type { TokenPatrol } from '../types/map'
import { PATRULHA_HINT, TokenPatrolControls } from './TokenPatrolControls'

/**
 * ROTA DE PATRULHA, lado do PAINEL do mestre: "Marcar ponto aqui" grava onde a
 * ficha está como próximo ponto da rota; "Avançar patrulha" leva o NPC um
 * passo. Sem dois pontos não há para onde andar: o botão fica indisponível e
 * diz por quê, em vez de ficar clicável sem efeito.
 *
 * Sem rota, o bloco é UMA linha "Patrulha" com "+" (peça P4 do laudo do
 * painel); com rota, fica à vista, com o resumo no cabeçalho.
 */
let container: HTMLDivElement
let root: Root

const CHAVE = 'lb-section:ficha-patrulha'

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

function render(patrol: TokenPatrol | null, onPatrolOp: (op: PatrolOp) => void = vi.fn()) {
  act(() => root.render(<TokenPatrolControls patrol={patrol} onPatrolOp={onPatrolOp} />))
}

function botao(rotulo: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === rotulo)
}

function botaoCerto(rotulo: string): HTMLButtonElement {
  const achado = botao(rotulo)
  if (achado === undefined) throw new Error(`sem o botão "${rotulo}"`)
  return achado
}

/** À vista = fora de todo `hidden` (o corpo fechado da linha "+"). */
function aVista(el: Element): boolean {
  return el.closest('[hidden]') === null
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
  it('ficha sem rota: uma linha "Patrulha" com "+", fechada, que diz para que serve ao pairar', () => {
    render(null)
    const linha = botaoCerto('Patrulha')
    expect(linha.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById(linha.getAttribute('aria-describedby') ?? 'sem-id')?.textContent).toBe(PATRULHA_HINT)
    expect(aVista(botaoCerto('Marcar ponto aqui'))).toBe(false)
    expect(container.querySelector('h2')).toBeNull()
  })

  it('aberta sem rota: só "Marcar ponto aqui" age; "Avançar patrulha" indisponível, com o motivo ao lado', () => {
    render(null)
    act(() => botaoCerto('Patrulha').click())
    expect(botaoCerto('Patrulha').getAttribute('aria-expanded')).toBe('true')
    expect(aVista(botaoCerto('Marcar ponto aqui'))).toBe(true)
    expect(botaoCerto('Marcar ponto aqui').disabled).toBe(false)
    const avancar = botaoCerto('Avançar patrulha')
    expect(avancar.disabled).toBe(true)
    const motivo = document.getElementById(avancar.getAttribute('aria-describedby') ?? 'sem-id')
    expect(motivo?.textContent).toContain('2 pontos')
    expect(botao('Tirar último ponto')).toBeUndefined()
    expect(botao('Apagar rota')).toBeUndefined()
  })

  it('o "+" é lembrado: remontado, o bloco nasce aberto; o "−" fecha e lembra fechado', () => {
    render(null)
    act(() => botaoCerto('Patrulha').click())
    expect(window.localStorage.getItem(CHAVE)).toBe('1')
    act(() => root.unmount())
    root = createRoot(container)
    render(null)
    expect(aVista(botaoCerto('Marcar ponto aqui'))).toBe(true)
    act(() => botaoCerto('Patrulha').click())
    expect(aVista(botaoCerto('Marcar ponto aqui'))).toBe(false)
    expect(window.localStorage.getItem(CHAVE)).toBe('0')
  })

  it('um ponto só: o bloco fica à vista com o resumo no cabeçalho, e ainda não anda', () => {
    render({ pontos: [{ x: 1, y: 1 }], atual: 0 })
    expect(botao('Patrulha')).toBeUndefined()
    expect(container.textContent).toContain('1 ponto · no ponto 1')
    expect(aVista(botaoCerto('Avançar patrulha'))).toBe(true)
    expect(botaoCerto('Avançar patrulha').disabled).toBe(true)
  })

  it('com rota: diz quantos pontos e onde o NPC está, e cada botão pede a sua operação', () => {
    const onPatrolOp = vi.fn()
    render(RONDA, onPatrolOp)
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
    render(RONDA)
    expect(container.textContent).toContain('A rota só você vê')
  })

  it('"Apagar rota" não recolhe o bloco debaixo do ponteiro, e o foco vai para "Marcar ponto aqui"', () => {
    window.localStorage.setItem(CHAVE, '0')
    const onPatrolOp = vi.fn()
    render(RONDA, onPatrolOp)
    const apagar = botaoCerto('Apagar rota')
    act(() => apagar.focus())
    act(() => apagar.click())
    expect(onPatrolOp).toHaveBeenCalledWith('apagar')
    // O store apaga a rota: a ficha volta sem patrulha.
    render(null, onPatrolOp)
    expect(aVista(botaoCerto('Marcar ponto aqui'))).toBe(true)
    expect(document.activeElement).toBe(botaoCerto('Marcar ponto aqui'))
    expect(window.localStorage.getItem(CHAVE)).toBe('1')
  })
})
