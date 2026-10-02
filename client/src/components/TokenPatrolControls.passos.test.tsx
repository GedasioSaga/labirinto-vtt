import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TokenPatrol } from '../types/map'
import { TokenPatrolControls, type TokenPatrolControlsProps } from './TokenPatrolControls'

/**
 * MACRO POR PONTO, lado do PAINEL: a lista de pontos da rota, cada um com o
 * resumo dos passos; abrir um ponto mostra os passos dele, um por linha, com o
 * valor, remover, subir/descer e alça de arrastar; "+ Adicionar passo" com os
 * 7 tipos. Toda edição sai inteira por `onPassos` (o store a põe no Ctrl+Z).
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
    {
      x: 300,
      y: 100,
      passos: [
        { tipo: 'esperar', segundos: 3 },
        { tipo: 'olhar', graus: 90 },
        { tipo: 'falar', texto: 'Alto!' },
      ],
    },
  ],
  atual: 0,
}

function render(extra: Partial<TokenPatrolControlsProps> = {}, patrol: TokenPatrol = RONDA) {
  act(() =>
    root.render(<TokenPatrolControls patrol={patrol} onPatrolOp={vi.fn()} onPatrulhar={vi.fn()} onConfig={vi.fn()} onPassos={vi.fn()} onAbrirPonto={vi.fn()} pontoAberto={null} {...extra} />),
  )
}

function botao(rotulo: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(rotulo) || b.getAttribute('aria-label') === rotulo)
  if (achado === undefined) throw new Error(`sem o botão "${rotulo}"`)
  return achado
}

function linhas(): HTMLLIElement[] {
  return [...container.querySelectorAll<HTMLLIElement>('.lb-passo')]
}

function mudar(el: HTMLInputElement | HTMLSelectElement, valor: string) {
  act(() => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, valor)
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}

describe('TokenPatrolControls — macro por ponto', () => {
  it('lista os pontos com o resumo dos passos; ponto de mapa antigo diz "Esperar 2 s"', () => {
    render()
    expect(botao('Ponto 1').textContent).toContain('2 s')
    const p2 = botao('Ponto 2')
    expect(p2.textContent).toContain('3 s')
    expect(p2.textContent).toContain('Falar')
    expect(p2.getAttribute('aria-expanded')).toBe('false')
  })

  it('clicar no ponto o abre (e clicar de novo fecha)', () => {
    const onAbrirPonto = vi.fn()
    render({ onAbrirPonto })
    act(() => botao('Ponto 2').click())
    expect(onAbrirPonto).toHaveBeenLastCalledWith(1)
    render({ onAbrirPonto, pontoAberto: 1 })
    expect(botao('Ponto 2').getAttribute('aria-expanded')).toBe('true')
    act(() => botao('Ponto 2').click())
    expect(onAbrirPonto).toHaveBeenLastCalledWith(null)
  })

  it('ponto aberto: um passo por linha, com o valor no campo', () => {
    render({ pontoAberto: 1 })
    expect(linhas()).toHaveLength(3)
    expect(linhas()[0]?.querySelector('input')?.value).toBe('3')
    expect(linhas()[1]?.querySelector('select')?.value).toBe('90')
    expect(linhas()[2]?.querySelector('input')?.value).toBe('Alto!')
  })

  it('editar o valor sai ao confirmar (sair do campo), não a cada tecla', () => {
    const onPassos = vi.fn()
    render({ pontoAberto: 1, onPassos })
    const campo = linhas()[0]?.querySelector('input')
    if (!(campo instanceof HTMLInputElement)) throw new Error('sem campo')
    mudar(campo, '5')
    expect(onPassos).not.toHaveBeenCalled()
    act(() => campo.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(onPassos).toHaveBeenLastCalledWith(1, [{ tipo: 'esperar', segundos: 5 }, { tipo: 'olhar', graus: 90 }, { tipo: 'falar', texto: 'Alto!' }])
  })

  it('a direção do "Olhar" sai na hora (lista)', () => {
    const onPassos = vi.fn()
    render({ pontoAberto: 1, onPassos })
    const lista = linhas()[1]?.querySelector('select')
    if (!(lista instanceof HTMLSelectElement)) throw new Error('sem lista')
    mudar(lista, '180')
    expect(onPassos).toHaveBeenLastCalledWith(1, [{ tipo: 'esperar', segundos: 3 }, { tipo: 'olhar', graus: 180 }, { tipo: 'falar', texto: 'Alto!' }])
  })

  it('"+ Adicionar passo" oferece os 7 tipos e põe o escolhido no fim', () => {
    const onPassos = vi.fn()
    render({ pontoAberto: 1, onPassos })
    const menu = container.querySelector<HTMLSelectElement>('select[aria-label="Adicionar passo"]')
    if (menu === null) throw new Error('sem menu')
    expect([...menu.options].filter((o) => o.value !== '')).toHaveLength(7)
    mudar(menu, 'esperarMestre')
    expect(onPassos).toHaveBeenLastCalledWith(1, [...(RONDA.pontos[1]?.passos ?? []), { tipo: 'esperarMestre' }])
  })

  it('remover, subir e descer', () => {
    const onPassos = vi.fn()
    render({ pontoAberto: 1, onPassos })
    act(() => botao('Remover passo 2').click())
    expect(onPassos).toHaveBeenLastCalledWith(1, [{ tipo: 'esperar', segundos: 3 }, { tipo: 'falar', texto: 'Alto!' }])
    act(() => botao('Subir passo 3').click())
    expect(onPassos).toHaveBeenLastCalledWith(1, [{ tipo: 'esperar', segundos: 3 }, { tipo: 'falar', texto: 'Alto!' }, { tipo: 'olhar', graus: 90 }])
    act(() => botao('Descer passo 1').click())
    expect(onPassos).toHaveBeenLastCalledWith(1, [{ tipo: 'olhar', graus: 90 }, { tipo: 'esperar', segundos: 3 }, { tipo: 'falar', texto: 'Alto!' }])
    expect(botao('Subir passo 1').disabled).toBe(true)
    expect(botao('Descer passo 3').disabled).toBe(true)
  })

  it('arrastar pela alça reordena', () => {
    const onPassos = vi.fn()
    render({ pontoAberto: 1, onPassos })
    const alca = linhas()[0]?.querySelector('.lb-passo__alca')
    const alvo = linhas()[2]
    if (alca === null || alca === undefined || alvo === undefined) throw new Error('sem alça')
    act(() => {
      alca.dispatchEvent(new Event('dragstart', { bubbles: true }))
      alvo.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }))
      alvo.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }))
    })
    expect(onPassos).toHaveBeenLastCalledWith(1, [{ tipo: 'olhar', graus: 90 }, { tipo: 'falar', texto: 'Alto!' }, { tipo: 'esperar', segundos: 3 }])
  })

  it('esperando o mestre: o painel diz e "Seguir" solta', () => {
    const onSeguir = vi.fn()
    render({ patrulhando: true, esperandoMestre: true, onSeguir })
    expect(container.textContent).toContain('Esperando você')
    act(() => botao('Seguir').click())
    expect(onSeguir).toHaveBeenCalled()
  })
})
