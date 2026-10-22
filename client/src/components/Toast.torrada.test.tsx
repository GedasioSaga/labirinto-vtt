import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToastMessage } from '../stores/toastStore'
import { SAIDA_DA_TORRADA_MS } from './grimorio/comum'
import { Toast } from './Toast'

/**
 * Fatia 20: os avisos de informação e de erro na Torrada do Grimório. A API da
 * pilha não muda (a `toastStore` manda no prazo e na ordem); a torrada ganha o
 * "Desfazer" em latão e a saída animada, com a pilha guardando a cópia do que
 * some no lugar onde estava.
 */

const SALVO: ToastMessage = { id: 'a1', kind: 'info', text: 'Mapa salvo' }
const FALHOU: ToastMessage = { id: 'a2', kind: 'error', text: 'Não deu para salvar' }

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
})

const mostrar = (toasts: ToastMessage[], onDismiss: (id: string) => void = () => {}) =>
  act(() => root.render(<Toast toasts={toasts} onDismiss={onDismiss} />))
const torradas = () => Array.from(container.querySelectorAll<HTMLElement>('.gr-torrada'))
const passar = (ms: number) => act(() => vi.advanceTimersByTime(ms))

/**
 * O jsdom não tem transição nem `getAnimations`: o teste põe uma transição de
 * saída de mentira em toda caixa e devolve o "fim" dela. Sem relógio: quem
 * tira a torrada é o fim da transição do CSS, não um prazo.
 */
function comTransicao(): () => void {
  let terminar = () => {}
  const fim = new Promise<void>((resolve) => {
    terminar = resolve
  })
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', { configurable: true, writable: true, value: () => [{ finished: fim }] })
  return () => terminar()
}

describe('Toast na Torrada do Grimório', () => {
  it('informação é status e erro é alerta, ambos na torrada, com o texto de sempre em .lb-toast__text', () => {
    mostrar([SALVO, FALHOU])
    const [info, erro] = torradas()
    expect(info.getAttribute('role')).toBe('status')
    expect(erro.getAttribute('role')).toBe('alert')
    expect(info.classList.contains('lb-toast')).toBe(true)
    expect(info.querySelector('.lb-toast__text')?.textContent).toBe('Mapa salvo')
    expect(container.querySelector('.lb-toaststack')?.contains(info)).toBe(true)
  })

  it('"Desfazer" é o botão de latão: desfaz e tira o aviso; o × dispensa e chama o onDismiss do aviso', () => {
    const desfazer = vi.fn()
    const aoDispensar = vi.fn()
    const onDismiss = vi.fn()
    mostrar([{ id: 'p', kind: 'info', text: '"Loja" saiu do pino.', actions: [{ label: 'Desfazer', run: desfazer }], onDismiss: aoDispensar }], onDismiss)
    const botao = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Desfazer')
    expect(botao?.className).toContain('gr-bt--latao')
    act(() => botao?.click())
    expect(desfazer).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledWith('p')
    expect(aoDispensar).not.toHaveBeenCalled()
    const fechar = container.querySelector<HTMLButtonElement>('button[aria-label="Dispensar aviso"]')
    act(() => fechar?.click())
    expect(aoDispensar).toHaveBeenCalledTimes(1)
  })

  it('a store tirou o aviso: o MESMO nó fica no lugar, inerte e saindo, e some quando a transição do CSS acaba', async () => {
    const terminar = comTransicao()
    mostrar([SALVO, FALHOU])
    const antes = torradas()[0]
    mostrar([FALHOU])
    const [primeira, segunda] = torradas()
    expect(primeira).toBe(antes)
    expect(primeira.textContent).toContain('Mapa salvo')
    expect(primeira.classList.contains('gr-sai')).toBe(true)
    expect(primeira.hasAttribute('inert')).toBe(true)
    expect(segunda.classList.contains('gr-sai')).toBe(false)
    passar(SAIDA_DA_TORRADA_MS * 4)
    expect(torradas()).toHaveLength(2)
    await act(async () => terminar())
    expect(torradas().map((torrada) => torrada.textContent)).toEqual(['Não deu para salvar×'])
  })

  it('o mesmo aviso de novo no meio da saída volta a valer: o mesmo nó, sem gr-sai, e o fim da transição não o tira', async () => {
    const terminar = comTransicao()
    mostrar([SALVO])
    const antes = torradas()[0]
    mostrar([])
    mostrar([SALVO])
    expect(torradas()).toEqual([antes])
    expect(antes.classList.contains('gr-sai')).toBe(false)
    await act(async () => terminar())
    expect(torradas()).toEqual([antes])
  })

  it('duas torradas que saem em fotos seguidas (o retomar da pausa) ficam na ordem de antes: nenhum nó troca de lugar no meio da saída', async () => {
    const terminar = comTransicao()
    const primeira: ToastMessage = { id: 'x', kind: 'info', text: 'Primeira' }
    const segunda: ToastMessage = { id: 'y', kind: 'info', text: 'Segunda' }
    const fica: ToastMessage = { id: 'z', kind: 'error', text: 'Fica' }
    mostrar([primeira, segunda, fica])
    const nos = torradas()
    mostrar([segunda, fica])
    mostrar([fica])
    expect(torradas()).toEqual(nos)
    expect(torradas().map((torrada) => torrada.classList.contains('gr-sai'))).toEqual([true, true, false])
    await act(async () => terminar())
    expect(torradas()).toEqual([nos[2]])
  })

  it('a transição de saída cancelada no meio (o nó mudou de lugar) não prende a torrada: ela sai e a pilha some', async () => {
    let cancelar = () => {}
    const cancelada = new Promise<void>((_, rejeitar) => {
      cancelar = () => rejeitar(new DOMException('Transição cancelada', 'AbortError'))
    })
    let correndo = true
    Object.defineProperty(HTMLElement.prototype, 'getAnimations', { configurable: true, writable: true, value: () => (correndo ? [{ finished: cancelada }] : []) })
    mostrar([SALVO])
    mostrar([])
    expect(torradas()).toHaveLength(1)
    // Cancelada, a transição deixa de correr: o navegador não a devolve mais.
    correndo = false
    await act(async () => cancelar())
    expect(container.querySelector('.lb-toaststack')).toBeNull()
  })

  it('a saída cancelada porque o mesmo aviso voltou não o tira: o mesmo nó fica, sem gr-sai', async () => {
    let cancelar = () => {}
    const cancelada = new Promise<void>((_, rejeitar) => {
      cancelar = () => rejeitar(new DOMException('Transição cancelada', 'AbortError'))
    })
    Object.defineProperty(HTMLElement.prototype, 'getAnimations', { configurable: true, writable: true, value: () => [{ finished: cancelada }] })
    mostrar([SALVO])
    const antes = torradas()[0]
    mostrar([])
    mostrar([SALVO])
    await act(async () => cancelar())
    expect(torradas()).toEqual([antes])
    expect(antes.classList.contains('gr-sai')).toBe(false)
  })

  it('sem transição no CSS (movimento zerado), a torrada sai na hora', () => {
    mostrar([SALVO])
    mostrar([])
    expect(container.querySelector('.lb-toaststack')).toBeNull()
  })

  it('o aviso com o foco sai: o foco não fica preso no aviso que está saindo', () => {
    comTransicao()
    mostrar([SALVO])
    const fechar = container.querySelector<HTMLButtonElement>('button[aria-label="Dispensar aviso"]')
    act(() => fechar?.focus())
    mostrar([])
    expect(torradas()).toHaveLength(1)
    expect(torradas()[0].contains(document.activeElement)).toBe(false)
  })

  it('pedidos e instruções não viram torrada: esperam resposta e não saem animados', () => {
    const pedido: ToastMessage = { id: 'i1', kind: 'instrucao', text: 'Ana quer passar', actions: [{ label: 'Deixar ir', run: () => {} }] }
    mostrar([pedido])
    expect(torradas()).toHaveLength(0)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Ana quer passar')
    mostrar([])
    expect(container.querySelector('.lb-toaststack')).toBeNull()
  })
})
