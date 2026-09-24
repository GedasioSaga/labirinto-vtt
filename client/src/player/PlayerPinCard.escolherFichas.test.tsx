/**
 * ESCOLHER FICHAS NO PINO no cartão do jogador: com duas ou mais fichas dele
 * perto do pino, a pergunta de passar traz "Quem passa?", uma caixa por ficha
 * (todas marcadas de início). O pedido leva as marcadas; sem nenhuma marcada o
 * cartão diz isso junto ao grupo e não deixa pedir. Com uma ficha só, o cartão
 * é o de sempre.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

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

const ESCOTILHA: Pin = { id: 'escotilha', x: 300, y: 200, kind: 'viagem', description: 'Escotilha', image: null }
const DUAS = [
  { id: 'rufo', name: 'Rufo' },
  { id: 'enzo', name: 'Enzo' },
]

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

function caixa(nome: string): HTMLInputElement {
  const rotulo = Array.from(container.querySelectorAll('label')).find((l) => l.textContent === nome)
  const input = rotulo?.querySelector('input[type="checkbox"]')
  if (!(input instanceof HTMLInputElement)) throw new Error(`sem a caixa ${nome}`)
  return input
}

describe('PlayerPinCard: quem passa pelo pino', () => {
  it('duas fichas perto: "Quem passa?" com uma caixa marcada por ficha, e o pedido leva as duas', () => {
    const onRequestTravel = vi.fn()
    act(() => root.render(<PlayerPinCard pin={ESCOTILHA} onClose={() => {}} onRequestTravel={onRequestTravel} travelers={DUAS} />))
    act(() => botao('Pedir para passar').click())
    const grupo = container.querySelector('fieldset')
    expect(grupo?.querySelector('legend')?.textContent).toBe('Quem passa?')
    expect([caixa('Rufo').checked, caixa('Enzo').checked]).toEqual([true, true])
    act(() => botao('Pedir').click())
    expect(onRequestTravel).toHaveBeenCalledWith(undefined, ['rufo', 'enzo'])
  })

  it('desmarcar o Rufo: o pedido leva só o Enzo', () => {
    const onRequestTravel = vi.fn()
    act(() => root.render(<PlayerPinCard pin={ESCOTILHA} onClose={() => {}} onRequestTravel={onRequestTravel} travelers={DUAS} />))
    act(() => botao('Pedir para passar').click())
    // O rótulo alterna a caixa, como o quadrado.
    const rotuloRufo = Array.from(container.querySelectorAll('label')).find((l) => l.textContent === 'Rufo')
    act(() => rotuloRufo?.click())
    expect(caixa('Rufo').checked).toBe(false)
    act(() => botao('Pedir').click())
    expect(onRequestTravel).toHaveBeenCalledWith(undefined, ['enzo'])
  })

  it('nenhuma marcada: o cartão diz que falta escolher, junto ao grupo, e o "Pedir" fica desligado', () => {
    const onRequestTravel = vi.fn()
    act(() => root.render(<PlayerPinCard pin={ESCOTILHA} onClose={() => {}} onRequestTravel={onRequestTravel} travelers={DUAS} />))
    act(() => botao('Pedir para passar').click())
    act(() => caixa('Rufo').click())
    act(() => caixa('Enzo').click())
    expect(botao('Pedir').disabled).toBe(true)
    const aviso = container.querySelector('fieldset [role="status"]')
    expect(aviso?.textContent).toBe('Escolha ao menos uma ficha.')
    act(() => botao('Pedir').click())
    expect(onRequestTravel).not.toHaveBeenCalled()
  })

  it('uma ficha só: nada de "Quem passa?", e o pedido sai sem lista, como sempre', () => {
    const onRequestTravel = vi.fn()
    act(() => root.render(<PlayerPinCard pin={ESCOTILHA} onClose={() => {}} onRequestTravel={onRequestTravel} travelers={[{ id: 'enzo', name: 'Enzo' }]} />))
    act(() => botao('Pedir para passar').click())
    expect(container.querySelector('fieldset')).toBeNull()
    act(() => botao('Pedir').click())
    expect(onRequestTravel).toHaveBeenCalledWith()
  })
})
