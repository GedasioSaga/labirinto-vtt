import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../theme'
import type { DrawingTool } from '../types/tools'
import { Toolbar } from './Toolbar'
import type { ToolVariantBindings } from './ToolVariantMenu'

/**
 * BALÃO AQUECIDO na barra de ferramentas (catálogo de convenções, "Dica de
 * ferramenta": pairar espera, e o vizinho aparece na hora). O primeiro balão
 * espera `--lb-motion-tip-delay`; quando ele aparece, a barra ganha
 * `data-tip-quente` e o CSS mostra os vizinhos sem espera e sem movimento.
 * Saindo dos ícones, a barra esfria depois de uma janela curta — atravessar o
 * vão entre dois ícones não esfria nada.
 *
 * O jsdom não anima: o que se prova aqui é QUANDO o atributo entra e sai. O
 * efeito no balão é a regra do main.css (polimentoDoMestre.test.ts).
 */

const ESPERA_MS = Number.parseFloat(theme.motion.tipDelay)
/** A janela em que o vizinho ainda abre na hora depois de o ponteiro sair dos ícones. */
const JANELA_MS = 300

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
  vi.useRealTimers()
})

function bindings(): ToolVariantBindings {
  const vazio = vi.fn()
  return {
    doorKind: { value: 'normal', onChange: vazio },
    wallKind: { value: undefined, onChange: vazio },
    regionFillPattern: { value: 'solid', onChange: vazio },
    polygonSides: { value: 6, onChange: vazio },
    stairSizePreset: { value: 'medium', onChange: vazio },
    drawTexture: { value: 'pen', onChange: vazio },
    brushMode: { value: 'traco', onChange: vazio },
    eraseMode: { value: 'objeto', onChange: vazio },
    floorShapeKind: { value: 'rect', onChange: vazio },
    floorOp: { value: 'add', onChange: vazio },
    floorPolygonSides: { value: 6, onChange: vazio },
    floorBrushSize: { value: 1, onChange: vazio },
    floorCamada: { value: 'chao', onChange: vazio },
    mobiliaTipo: { value: 'mesa', onChange: vazio },
    roomFreeKind: { value: 'sala', onChange: vazio },
    roomFreeRounded: { value: false, onChange: vazio },
    drawShape: { value: 'brush', onChange: vazio },
  }
}

function montar(activeTool: DrawingTool = 'select') {
  act(() => root.render(<Toolbar activeTool={activeTool} onSelectTool={vi.fn()} lastDrawingTool="brush" variantBindings={bindings()} />))
  // Só os relógios de espera: o resto (quadro de animação da medida do balão) segue real.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
}

function barra(): HTMLElement {
  const elemento = container.querySelector<HTMLElement>('.lb-toolbar')
  if (!elemento) throw new Error('barra de ferramentas não renderizada')
  return elemento
}

function icone(nome: string): HTMLButtonElement {
  const botao = barra().querySelector<HTMLButtonElement>(`button.lb-tip[aria-label="${nome}"]`)
  if (!botao) throw new Error(`a barra deveria ter o ícone "${nome}" com balão`)
  return botao
}

/** O vão entre ícones: o grupo que os envolve, sem balão próprio. */
function vao(): HTMLElement {
  const grupo = barra().querySelector<HTMLElement>('.lb-toolbar__group')
  if (!grupo) throw new Error('a barra deveria ter grupos de ícones')
  return grupo
}

/** O ponteiro passa de `de` para `para`, como o navegador conta: sai de um, entra no outro. */
function mover(de: Element | null, para: Element | null, pointerType = 'mouse') {
  if (de) de.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType, relatedTarget: para }))
  if (para) para.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType, relatedTarget: de }))
}

const quente = () => barra().hasAttribute('data-tip-quente')

describe('Toolbar — balão aquecido', () => {
  it('a barra aquece quando o primeiro balão aparece, nem antes', () => {
    montar()
    mover(null, icone('Parede'))
    vi.advanceTimersByTime(ESPERA_MS - 1)
    expect(quente()).toBe(false)
    vi.advanceTimersByTime(1)
    expect(quente()).toBe(true)
  })

  it('atravessar o vão até o vizinho não esfria: o balão dele abre na hora', () => {
    montar()
    mover(null, icone('Parede'))
    vi.advanceTimersByTime(ESPERA_MS)
    mover(icone('Parede'), vao())
    vi.advanceTimersByTime(JANELA_MS - 1)
    mover(vao(), icone('Porta'))
    vi.advanceTimersByTime(JANELA_MS * 3)
    expect(quente()).toBe(true)
  })

  it('fora dos ícones por mais que a janela, a barra esfria e o próximo balão volta a esperar', () => {
    montar()
    mover(null, icone('Parede'))
    vi.advanceTimersByTime(ESPERA_MS)
    mover(icone('Parede'), null)
    vi.advanceTimersByTime(JANELA_MS - 1)
    expect(quente()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(quente()).toBe(false)
  })

  it('sair antes do primeiro balão não aquece: o vizinho espera o tempo todo de novo', () => {
    montar()
    mover(null, icone('Parede'))
    vi.advanceTimersByTime(ESPERA_MS - 100)
    mover(icone('Parede'), vao())
    vi.advanceTimersByTime(ESPERA_MS)
    expect(quente()).toBe(false)
    mover(vao(), icone('Porta'))
    vi.advanceTimersByTime(ESPERA_MS - 1)
    expect(quente()).toBe(false)
    vi.advanceTimersByTime(1)
    expect(quente()).toBe(true)
  })

  it('andar por dentro do mesmo ícone (do botão para o desenho dele) não conta como sair', () => {
    montar()
    const parede = icone('Parede')
    const desenho = parede.querySelector('svg')
    if (!desenho) throw new Error('o ícone deveria ter o desenho em svg')
    mover(null, parede)
    vi.advanceTimersByTime(ESPERA_MS / 2)
    mover(parede, desenho)
    vi.advanceTimersByTime(ESPERA_MS / 2)
    expect(quente()).toBe(true)
  })

  it('toque não aquece: no dedo não existe pairar', () => {
    montar()
    mover(null, icone('Parede'), 'touch')
    vi.advanceTimersByTime(ESPERA_MS * 3)
    expect(quente()).toBe(false)
  })

  it('a setinha de variantes não tem balão e não aquece a barra', () => {
    montar()
    const setinha = barra().querySelector<HTMLButtonElement>('button[aria-label="Opções de Parede"]')
    if (!setinha) throw new Error('a Parede deveria ter a setinha de variantes')
    mover(null, setinha)
    vi.advanceTimersByTime(ESPERA_MS * 3)
    expect(quente()).toBe(false)
  })

  it('desmontar a barra limpa os relógios pendentes', () => {
    montar()
    mover(null, icone('Parede'))
    expect(vi.getTimerCount()).toBe(1)
    act(() => root.unmount())
    expect(vi.getTimerCount()).toBe(0)
    // O afterEach desmonta de novo: uma raiz nova para ele não reclamar.
    root = createRoot(container)
  })
})
