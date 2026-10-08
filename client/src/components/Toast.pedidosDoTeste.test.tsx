import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GRUPO_DO_TESTE, PREFIXO_DO_TESTE } from '../net/visaoDeTeste/avisosDeTeste'
import type { ToastMessage } from '../stores/toastStore'
import { Toast } from './Toast'

/**
 * Visão de jogador — os pedidos que vêm da janela de teste (`GRUPO_DO_TESTE`)
 * não usam o latão dos pedidos de verdade: a caixa "Pedidos do teste" troca a
 * variante de instrução pela do teste (tracejado neutro, Toast.css), a
 * resposta da linha é neutra e o "Deixar todos" é secundário. Os pedidos de
 * verdade, ao lado, ficam exatamente como eram.
 */

describe('Toast: a caixa "Pedidos do teste"', () => {
  let container: HTMLDivElement
  let root: Root
  /** Cada "Deixar ir" que rodou, pelo id do aviso. */
  let deixados: string[]

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    deixados = []
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function desenha(toasts: ToastMessage[], onDismiss: (id: string) => void = () => {}): void {
    act(() => root.render(<Toast toasts={toasts} onDismiss={onDismiss} />))
  }

  /** Um pedido de passagem com as ações da ponte: "Deixar ir" (em lote), "Ver" e "Não". */
  function pedido(id: string, texto: string, grupo: string, emCaixa: boolean): ToastMessage {
    return {
      id,
      kind: 'instrucao',
      text: texto,
      grupo,
      ...(emCaixa ? { sempreEmCaixa: true } : {}),
      actions: [
        { label: 'Deixar ir', run: () => deixados.push(id), emLote: true },
        { label: 'Ver', run: () => {}, mantem: true },
        { label: 'Não', run: () => {} },
      ],
    }
  }

  /** Como `avisosDeTeste.ts` põe o pedido: "Teste · ", a caixa própria, aberta mesmo sozinho. */
  const doTeste = (id: string, quem: string): ToastMessage => pedido(id, `${PREFIXO_DO_TESTE}${quem} quer passar por Porta de aço → Pátio`, GRUPO_DO_TESTE, true)
  const deVerdade = (id: string, quem: string): ToastMessage => pedido(id, `${quem} quer passar por Escada do porão → Cripta`, 'Pedidos', false)

  function caixa(nome: string): HTMLElement {
    const achada = [...container.querySelectorAll<HTMLElement>('[role="region"]')].find((el) => el.getAttribute('aria-label') === nome)
    if (achada === undefined) throw new Error(`sem a caixa "${nome}"`)
    return achada
  }

  function botao(dentro: HTMLElement, texto: string): HTMLButtonElement {
    const achado = [...dentro.querySelectorAll('button')].find((b) => b.textContent === texto)
    if (achado === undefined) throw new Error(`sem o botão "${texto}"`)
    return achado
  }

  /** Os botões de latão (a resposta esperada cheia) dentro de um cartão ou caixa. */
  function deLatao(dentro: HTMLElement): string[] {
    return [...dentro.querySelectorAll('.lb-btn--primary')].map((b) => b.textContent ?? '')
  }

  it('um pedido do teste: "Pedidos do teste (1)" com a variante do teste, e a resposta neutra', () => {
    desenha([doTeste('t1', 'Ana')])
    const doTesteAqui = caixa('Pedidos do teste (1)')
    expect(doTesteAqui.classList.contains('lb-toast--teste')).toBe(true)
    expect(doTesteAqui.classList.contains('lb-toast--instrucao')).toBe(false)
    expect(deLatao(doTesteAqui)).toEqual([])
    expect(botao(doTesteAqui, 'Deixar ir').className).toBe('lb-btn')
  })

  it('dois pedidos do teste: o "Deixar todos" é secundário e responde só os do teste', () => {
    const dispensados: string[] = []
    desenha([deVerdade('r1', 'Bruno'), deVerdade('r2', 'Caio'), doTeste('t1', 'Ana'), doTeste('t2', 'Bia')], (id) => dispensados.push(id))
    const doTesteAqui = caixa('Pedidos do teste (2)')
    const todos = botao(doTesteAqui, 'Deixar todos')
    expect(todos.classList.contains('lb-btn')).toBe(true)
    expect(todos.classList.contains('lb-btn--primary')).toBe(false)
    expect(deLatao(doTesteAqui)).toEqual([])

    act(() => todos.click())
    expect(deixados).toEqual(['t1', 't2'])
    expect(dispensados).toEqual(['t1', 't2'])
  })

  it('os pedidos de verdade ao lado ficam como eram: instrução e "Deixar todos" de latão', () => {
    desenha([deVerdade('r1', 'Bruno'), deVerdade('r2', 'Caio'), doTeste('t1', 'Ana')])
    const reais = caixa('Pedidos (2)')
    expect(reais.className).toBe('lb-panel lb-toast lb-toast--instrucao lb-toastcaixa')
    expect(deLatao(reais)).toEqual(['Deixar todos'])
    // Na linha da caixa real, a resposta só ganha o contorno cheio — como sempre.
    expect([...reais.querySelectorAll('button')].filter((b) => b.textContent === 'Deixar ir').map((b) => b.className)).toEqual(['lb-btn', 'lb-btn'])
  })

  it('caixa real de uma linha só (a porta trancada): a resposta continua de latão', () => {
    desenha([{ ...deVerdade('r1', 'Bruno'), sempreEmCaixa: true }])
    const reais = caixa('Pedidos (1)')
    expect(reais.classList.contains('lb-toast--teste')).toBe(false)
    expect(deLatao(reais)).toEqual(['Deixar ir'])
  })

  it('pedido do teste sem a caixa: o cartão solto também é do teste, e o × continua respondendo', () => {
    const dispensados: string[] = []
    const solto = { ...pedido('t1', `${PREFIXO_DO_TESTE}Ana quer passar por Porta de aço → Pátio`, GRUPO_DO_TESTE, false), onDismiss: () => dispensados.push('×') }
    desenha([solto, deVerdade('r1', 'Bruno')], (id) => dispensados.push(id))
    const [cartaoDoTeste, cartaoReal] = [...container.querySelectorAll<HTMLElement>('[role="alert"]')]
    if (cartaoDoTeste === undefined || cartaoReal === undefined) throw new Error('faltam os dois cartões soltos')
    expect(cartaoDoTeste.className).toBe('lb-panel lb-toast lb-toast--teste')
    expect(deLatao(cartaoDoTeste)).toEqual([])
    // O real, solto, como sempre: instrução com a resposta de latão.
    expect(cartaoReal.className).toBe('lb-panel lb-toast lb-toast--instrucao')
    expect(deLatao(cartaoReal)).toEqual(['Deixar ir'])

    const fechar = cartaoDoTeste.querySelector<HTMLButtonElement>('button[aria-label="Dispensar aviso"]')
    if (fechar === null) throw new Error('o cartão do teste sem o ×')
    act(() => fechar.click())
    expect(dispensados).toEqual(['t1', '×'])
  })
})
