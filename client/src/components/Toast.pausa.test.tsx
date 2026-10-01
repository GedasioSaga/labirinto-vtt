import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore, type ToastMessage } from '../stores/toastStore'
import { Toast } from './Toast'

/**
 * A pilha espera quem está lendo: o ponteiro em cima de um aviso, ou o foco
 * dentro da pilha, pausam o relógio; os dois fora o põem para correr de novo.
 * A saída é conferida também quando o aviso sob o ponteiro (ou com o foco) sai
 * da tela — dispensado, respondido —, que é quando a pilha não recebe mais
 * evento nenhum dele.
 */

const SALVO: ToastMessage = { id: 'a1', kind: 'info', text: 'Mapa salvo' }
const EXPORTADO: ToastMessage = { id: 'a2', kind: 'info', text: 'Mapa exportado em C:/mapas/taverna' }
const PERGUNTA: ToastMessage = {
  id: 'p1',
  kind: 'instrucao',
  text: 'Grog quer passar',
  actions: [
    { label: 'Deixar ir', run: () => {} },
    { label: 'Não', run: () => {} },
  ],
}

let container: HTMLDivElement
let mapa: HTMLButtonElement
let root: Root
const onPausar = vi.fn()
const onRetomar = vi.fn()

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  onPausar.mockReset()
  onRetomar.mockReset()
  // O resto da tela, fora da pilha: para onde o ponteiro e o foco saem.
  mapa = document.createElement('button')
  mapa.textContent = 'mapa'
  document.body.appendChild(mapa)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  mapa.remove()
})

function mostrar(toasts: ToastMessage[]): void {
  act(() => root.render(<Toast toasts={toasts} onDismiss={() => {}} onPausar={onPausar} onRetomar={onRetomar} />))
}

function aviso(texto: string): HTMLElement {
  const achado = Array.from(container.querySelectorAll<HTMLElement>('.lb-toast')).find((node) => (node.textContent ?? '').includes(texto))
  if (achado === undefined) throw new Error(`sem o aviso ${texto}`)
  return achado
}

function botao(dentro: ParentNode, texto: string): HTMLButtonElement {
  const achado = Array.from(dentro.querySelectorAll('button')).find((node) => (node.textContent ?? '').trim() === texto)
  if (achado === undefined) throw new Error(`sem o botão ${texto}`)
  return achado
}

/** O ponteiro entra em `alvo` (o `pointerover` que o navegador manda ao cruzar a borda dele). */
function passarPor(alvo: Element): void {
  act(() => {
    alvo.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerId: 1 }))
  })
}

/** O ponteiro sai da janela: `pointerout` sem destino. */
function sairDaJanela(de: Element): void {
  act(() => {
    de.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerId: 1, relatedTarget: null }))
  })
}

describe('Toast: a pilha espera quem está lendo', () => {
  it('ponteiro num aviso pausa uma vez; ponteiro de volta ao mapa retoma uma vez', () => {
    mostrar([SALVO])
    passarPor(aviso('Mapa salvo'))
    expect(onPausar).toHaveBeenCalledTimes(1)
    expect(onRetomar).not.toHaveBeenCalled()
    passarPor(mapa)
    expect(onRetomar).toHaveBeenCalledTimes(1)
  })

  it('andar de um aviso para outro, ou para dentro do texto, não retoma no meio', () => {
    mostrar([SALVO, EXPORTADO])
    passarPor(aviso('Mapa salvo'))
    passarPor(aviso('Mapa salvo').querySelector('.lb-toast__text') ?? mapa)
    passarPor(aviso('Mapa exportado'))
    expect(onPausar).toHaveBeenCalledTimes(1)
    expect(onRetomar).not.toHaveBeenCalled()
  })

  it('ponteiro que sai da janela retoma', () => {
    mostrar([SALVO])
    passarPor(aviso('Mapa salvo'))
    sairDaJanela(aviso('Mapa salvo'))
    expect(onRetomar).toHaveBeenCalledTimes(1)
  })

  it('foco num botão da pilha pausa; trocar de botão dentro dela não retoma; foco fora retoma', () => {
    mostrar([PERGUNTA])
    act(() => botao(container, 'Deixar ir').focus())
    expect(onPausar).toHaveBeenCalledTimes(1)
    act(() => botao(container, 'Não').focus())
    expect(onRetomar).not.toHaveBeenCalled()
    act(() => mapa.focus())
    expect(onRetomar).toHaveBeenCalledTimes(1)
    expect(onPausar).toHaveBeenCalledTimes(1)
  })

  it('ponteiro e foco juntos: só retoma quando os dois saem', () => {
    mostrar([PERGUNTA])
    passarPor(aviso('Grog quer passar'))
    act(() => botao(container, 'Deixar ir').focus())
    passarPor(mapa)
    expect(onRetomar).not.toHaveBeenCalled()
    act(() => mapa.focus())
    expect(onPausar).toHaveBeenCalledTimes(1)
    expect(onRetomar).toHaveBeenCalledTimes(1)
  })

  it('o último aviso sai com o ponteiro em cima: a pilha retoma, e o próximo aviso não nasce parado', () => {
    mostrar([SALVO])
    passarPor(aviso('Mapa salvo'))
    mostrar([])
    expect(onRetomar).toHaveBeenCalledTimes(1)
  })

  it('o aviso com o foco sai da tela (dispensado pelo teclado) e o foco não fica em lugar nenhum dela: retoma', () => {
    mostrar([SALVO, EXPORTADO])
    act(() => botao(aviso('Mapa salvo'), '×').focus())
    expect(onPausar).toHaveBeenCalledTimes(1)
    mostrar([EXPORTADO])
    expect(onRetomar).toHaveBeenCalledTimes(1)
  })

  it('desmontar a pilha pausada retoma', () => {
    mostrar([SALVO])
    passarPor(aviso('Mapa salvo'))
    act(() => root.unmount())
    expect(onRetomar).toHaveBeenCalledTimes(1)
    root = createRoot(container)
  })

  it('sem quem pause, nada quebra: os avisos continuam como sempre', () => {
    act(() => root.render(<Toast toasts={[SALVO]} onDismiss={() => {}} />))
    passarPor(aviso('Mapa salvo'))
    passarPor(mapa)
    expect(aviso('Mapa salvo')).not.toBeNull()
  })
})

describe('Toast + toastStore: o aviso fica enquanto o ponteiro está em cima', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    useToastStore.getState().retomar()
    vi.useRealTimers()
  })

  it('o ponteiro chega com o aviso quase indo: ele passa do prazo e fica; o ponteiro sai e ele some 1,5 s depois', () => {
    vi.useFakeTimers()
    const { push, dismiss, pausar, retomar } = useToastStore.getState()
    push('info', 'Mapa exportado em C:/mapas/taverna')
    act(() => root.render(<Toast toasts={useToastStore.getState().toasts} onDismiss={dismiss} onPausar={pausar} onRetomar={retomar} />))
    vi.advanceTimersByTime(3000)
    passarPor(aviso('Mapa exportado'))
    vi.advanceTimersByTime(30_000)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    passarPor(mapa)
    vi.advanceTimersByTime(1499)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('o ponteiro chega com o aviso recém-chegado: ao sair, ele ainda tem o prazo inteiro', () => {
    vi.useFakeTimers()
    const { push, dismiss, pausar, retomar } = useToastStore.getState()
    push('info', 'Mapa salvo')
    act(() => root.render(<Toast toasts={useToastStore.getState().toasts} onDismiss={dismiss} onPausar={pausar} onRetomar={retomar} />))
    passarPor(aviso('Mapa salvo'))
    vi.advanceTimersByTime(30_000)
    passarPor(mapa)
    vi.advanceTimersByTime(3999)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
