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

})

/**
 * Os avisos de instrução (os que esperam a pessoa: pedidos soltos, "Abra a
 * sala antes…", "A borracha não apaga o chão…") também na torrada. A store
 * continua mandando no prazo (a instrução não tem nenhum), o papel continua
 * `alert` (o leitor de tela interrompe: o gesto dela não foi adiante) e a
 * resposta esperada continua de latão.
 *
 * EXCEÇÃO, de propósito: as caixas agrupadas ("Pedidos (N)", e o "Pedidos (1)"
 * de `sempreEmCaixa`, como a oferta de troca com o "Desfazer") ficam na casca
 * de hoje. Uma caixa é uma `region` com título vivo, várias linhas e "Deixar
 * todos"; a torrada é de um aviso só.
 */
describe('Instrução na Torrada do Grimório', () => {
  const PEDIDO: ToastMessage = { id: 'i1', kind: 'instrucao', text: 'Ana quer passar', actions: [{ label: 'Deixar ir', run: () => {} }, { label: 'Não', run: () => {} }] }

  it('a instrução solta é torrada, com papel alert, a classe de instrução e a resposta esperada em latão', () => {
    mostrar([PEDIDO])
    const [torrada] = torradas()
    expect(torradas()).toHaveLength(1)
    expect(torrada.getAttribute('role')).toBe('alert')
    expect(torrada.classList.contains('lb-toast--instrucao')).toBe(true)
    expect(torrada.querySelector('.lb-toast__text')?.textContent).toBe('Ana quer passar')
    const latao = Array.from(torrada.querySelectorAll('button')).filter((b) => b.classList.contains('gr-bt--latao'))
    expect(latao.map((b) => b.textContent)).toEqual(['Deixar ir'])
  })

  it('sem prazo: um minuto depois a instrução continua na tela, sem sair, até alguém responder', () => {
    mostrar([PEDIDO])
    passar(60_000)
    expect(torradas()).toHaveLength(1)
    expect(torradas()[0].classList.contains('gr-sai')).toBe(false)
  })

  it('respondida, a store a tira e ela sai animada no lugar onde estava, inerte', () => {
    comTransicao()
    const deixar = vi.fn()
    const onDismiss = vi.fn()
    mostrar([{ ...PEDIDO, actions: [{ label: 'Deixar ir', run: deixar }] }, SALVO], onDismiss)
    const antes = torradas()[0]
    act(() => Array.from(antes.querySelectorAll('button')).find((b) => b.textContent === 'Deixar ir')?.click())
    expect(deixar).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledWith('i1')
    mostrar([SALVO])
    expect(torradas()[0]).toBe(antes)
    expect(antes.classList.contains('gr-sai')).toBe(true)
    expect(antes.hasAttribute('inert')).toBe(true)
  })

  it('o chamado com "Responder" na torrada: o campo abre na linha e "Enviar" manda o texto e tira o aviso', () => {
    const enviar = vi.fn()
    const onDismiss = vi.fn()
    mostrar([{ id: 'c1', kind: 'instrucao', text: 'Carla chama o mestre', grupo: 'Chamados', resposta: { rotulo: 'Responder', maxLength: 80, enviar } }], onDismiss)
    expect(torradas()).toHaveLength(1)
    const responder = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Responder')
    act(() => responder?.click())
    const campo = container.querySelector<HTMLInputElement>('input[aria-label="Resposta para Carla chama o mestre"]')
    if (campo === null) throw new Error('o campo de resposta não abriu')
    expect(document.activeElement).toBe(campo)
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, ' Já vou ')
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const enviarBotao = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Enviar')
    expect(enviarBotao?.className).toContain('gr-bt--latao')
    act(() => enviarBotao?.click())
    expect(enviar).toHaveBeenCalledWith('Já vou')
    expect(onDismiss).toHaveBeenCalledWith('c1')
  })

  it('EXCEÇÃO: a caixa "Pedidos (1)" da oferta de troca fica na casca de hoje, e o "Desfazer" desfaz e tira a linha', () => {
    const desfazer = vi.fn()
    const onDismiss = vi.fn()
    const oferta: ToastMessage = {
      id: 't1',
      kind: 'instrucao',
      text: 'Oferta a Ana: 3 moedas de ouro',
      actions: [{ label: 'Desfazer', run: desfazer }],
      grupo: 'Pedidos',
      sempreEmCaixa: true,
    }
    mostrar([oferta], onDismiss)
    expect(torradas()).toHaveLength(0)
    const caixa = container.querySelector<HTMLElement>('[role="region"][aria-label="Pedidos (1)"]')
    if (caixa === null) throw new Error('sem a caixa "Pedidos (1)"')
    expect(caixa.querySelector('[aria-live="polite"]')?.textContent).toBe('Pedidos (1)')
    act(() => Array.from(caixa.querySelectorAll('button')).find((b) => b.textContent === 'Desfazer')?.click())
    expect(desfazer).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledWith('t1')
  })
})
