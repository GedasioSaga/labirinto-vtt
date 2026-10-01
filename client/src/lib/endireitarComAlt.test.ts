import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { avisoDoEndireitar } from '../components/labels'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import type { Drawing, MapData, Wall } from '../types/map'
import { buildLineDrawing, buildWallFromDraft } from './drawingFactory'
import { instalarEndireitarComAlt, type EstadoDoEndireitarComAlt, type FonteDoEndireitar } from './endireitarComAlt'
import { createEmptyMap } from './mapFactory'
import { ALT_TOQUE_JANELA_MS } from './toqueDeAlt'

/**
 * Pedido 5, fatia 2: o Alt TOCADO liga o endireitar de verdade (store,
 * histórico, aviso). Todo outro Alt — segurado (é do medir, pedido 3),
 * combinado com clique, arrasto, rolagem ou tecla, dentro de campo de texto,
 * atrás de janela modal, fora do Selecionar — fica mudo e não chama
 * `preventDefault`, para não roubar a tecla de quem é dona dela.
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return buildWallFromDraft(id, { x: x1, y: y1 }, { x: x2, y: y2 })
}

function linha(id: string, x1: number, y1: number, x2: number, y2: number): Drawing {
  return buildLineDrawing(id, { x: x1, y: y1 }, { x: x2, y: y2 }, '#ffffff', 2)
}

/** Uma linha torta solta, uma reta, e uma parede torta presa nas duas pontas. */
const MAPA: MapData = {
  ...createEmptyMap('m_alt_endireitar', 'Alt endireita', 30, 20, 64),
  walls: [parede('presa', 0, 300, 100, 320), parede('p', 0, 300, 0, 250), parede('q', 100, 320, 100, 400)],
  drawings: [linha('torta', 300, 200, 360, 420), linha('reta', 0, 40, 200, 40)],
}

const TORTA = [{ kind: 'drawing' as const, id: 'torta' }]

function tecla(tipo: 'keydown' | 'keyup', key: string, timeStamp: number, extra: KeyboardEventInit = {}): KeyboardEvent {
  const evento = new KeyboardEvent(tipo, { key, bubbles: true, cancelable: true, ...extra })
  // O detector mede a janela pelo `timeStamp` do próprio evento: o teste fixa o relógio.
  Object.defineProperty(evento, 'timeStamp', { value: timeStamp })
  return evento
}

/** Toca o Alt em `alvo` e devolve o keyup, para ler o `defaultPrevented`. */
function tocarAlt(alvo: EventTarget = document.body, apertouEm = 0, soltouEm = 100): KeyboardEvent {
  alvo.dispatchEvent(tecla('keydown', 'Alt', apertouEm, { altKey: true }))
  const soltura = tecla('keyup', 'Alt', soltouEm)
  alvo.dispatchEvent(soltura)
  return soltura
}

function ponteiro(tipo: string, x: number, y: number, buttons: number): void {
  document.body.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, buttons, pointerId: 1, isPrimary: true }))
}

function linhaTorta(): Extract<Drawing, { kind: 'line' }> {
  const d = useMapStore.getState().map.drawings.find((x) => x.id === 'torta')
  if (d === undefined || d.kind !== 'line') throw new Error('a linha torta sumiu')
  return d
}

/** O mapa não mudou e nada entrou no histórico. */
function nadaMudou(): void {
  expect(useMapStore.getState().map).toBe(MAPA)
  expect(useMapStore.getState().past).toHaveLength(0)
}

let desligar: () => void = () => {}

beforeEach(() => {
  useMapStore.setState({ map: MAPA, selection: [], past: [], future: [], activeTool: 'select' })
  useToastStore.setState({ toasts: [] })
  desligar = instalarEndireitarComAlt(window)
})

afterEach(() => {
  desligar()
  document.body.replaceChildren()
})

describe('instalarEndireitarComAlt: o toque endireita', () => {
  it('linha torta selecionada: o toque endireita num passo só de desfazer, e o keyup sai com preventDefault', () => {
    useMapStore.setState({ selection: TORTA })
    const soltura = tocarAlt()
    expect(linhaTorta().x1).toBe(linhaTorta().x2)
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(soltura.defaultPrevented).toBe(true)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(MAPA)
  })

  it('só parede presa selecionada: nada muda, mas o mestre ouve o porquê', () => {
    useMapStore.setState({ selection: [{ kind: 'wall', id: 'presa' }] })
    const soltura = tocarAlt()
    nadaMudou()
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual([avisoDoEndireitar({ presas: 1, travados: 0 })])
    expect(soltura.defaultPrevented).toBe(true)
  })

  it('o toque chama a ação UMA vez, e instalar de novo troca o anterior em vez de somar', () => {
    const acao = vi.fn(() => ({ alterados: 1, ignorados: { presas: 0, travados: 0, sala: 0 } }))
    const outra = vi.fn(() => ({ alterados: 1, ignorados: { presas: 0, travados: 0, sala: 0 } }))
    const loja = (endireitarSelecionados: EstadoDoEndireitarComAlt['endireitarSelecionados']): FonteDoEndireitar => ({
      getState: () => ({ map: MAPA, selection: TORTA, activeTool: 'select', endireitarSelecionados }),
    })
    instalarEndireitarComAlt(window, loja(acao))
    const ultimo = instalarEndireitarComAlt(window, loja(outra))
    tocarAlt()
    expect(acao).not.toHaveBeenCalled()
    expect(outra).toHaveBeenCalledTimes(1)
    ultimo()
  })
})

describe('instalarEndireitarComAlt: todo outro Alt fica mudo', () => {
  it('seleção vazia, ou só linha reta: nada muda e o keyup segue sem preventDefault', () => {
    expect(tocarAlt().defaultPrevented).toBe(false)
    nadaMudou()

    useMapStore.setState({ selection: [{ kind: 'drawing', id: 'reta' }] })
    expect(tocarAlt(document.body, 200, 300).defaultPrevented).toBe(false)
    nadaMudou()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('Alt segurado além da janela é do medir (pedido 3): soltar não endireita', () => {
    useMapStore.setState({ selection: TORTA })
    expect(tocarAlt(document.body, 0, ALT_TOQUE_JANELA_MS + 100).defaultPrevented).toBe(false)
    nadaMudou()
  })

  it('botão do mouse apertado (arrasto em andamento): o toque não endireita; soltando o botão, volta a valer', () => {
    useMapStore.setState({ selection: TORTA })
    ponteiro('pointerdown', 50, 50, 1)
    tocarAlt(document.body, 0, 100)
    nadaMudou()

    ponteiro('pointerup', 50, 50, 0)
    tocarAlt(document.body, 200, 300)
    expect(linhaTorta().x1).toBe(linhaTorta().x2)
  })

  it('clique no meio do Alt (Alt+clique duplica, inverte o pincel): não endireita', () => {
    useMapStore.setState({ selection: TORTA })
    document.body.dispatchEvent(tecla('keydown', 'Alt', 0, { altKey: true }))
    ponteiro('pointerdown', 50, 50, 1)
    ponteiro('pointerup', 50, 50, 0)
    document.body.dispatchEvent(tecla('keyup', 'Alt', 100))
    nadaMudou()
  })

  it('mexer o mouse mais de 3 px com o Alt apertado (medir ou mirar): não endireita', () => {
    useMapStore.setState({ selection: TORTA })
    ponteiro('pointermove', 100, 100, 0)
    document.body.dispatchEvent(tecla('keydown', 'Alt', 0, { altKey: true }))
    ponteiro('pointermove', 120, 100, 0)
    document.body.dispatchEvent(tecla('keyup', 'Alt', 100))
    nadaMudou()
  })

  it('rolagem ou outra tecla no meio (Alt+roda, Alt+setas): não endireita', () => {
    useMapStore.setState({ selection: TORTA })
    document.body.dispatchEvent(tecla('keydown', 'Alt', 0, { altKey: true }))
    document.body.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 }))
    document.body.dispatchEvent(tecla('keyup', 'Alt', 100))
    nadaMudou()

    document.body.dispatchEvent(tecla('keydown', 'Alt', 200, { altKey: true }))
    document.body.dispatchEvent(tecla('keydown', 'ArrowLeft', 220, { altKey: true }))
    document.body.dispatchEvent(tecla('keyup', 'ArrowLeft', 240, { altKey: true }))
    document.body.dispatchEvent(tecla('keyup', 'Alt', 300))
    nadaMudou()
  })

  it('AltGr do ABNT2 (Alt com Ctrl): não endireita', () => {
    useMapStore.setState({ selection: TORTA })
    document.body.dispatchEvent(tecla('keydown', 'Alt', 0, { altKey: true, ctrlKey: true }))
    document.body.dispatchEvent(tecla('keyup', 'Alt', 100))
    nadaMudou()
  })

  it('a janela perde o foco no meio (Alt+Tab) ou a aba some: nada', () => {
    useMapStore.setState({ selection: TORTA })
    document.body.dispatchEvent(tecla('keydown', 'Alt', 0, { altKey: true }))
    window.dispatchEvent(new FocusEvent('blur'))
    document.body.dispatchEvent(tecla('keyup', 'Alt', 100))
    nadaMudou()

    document.body.dispatchEvent(tecla('keydown', 'Alt', 200, { altKey: true }))
    document.dispatchEvent(new Event('visibilitychange'))
    document.body.dispatchEvent(tecla('keyup', 'Alt', 300))
    nadaMudou()
  })

  it('foco num campo de texto: o Alt é do campo', () => {
    useMapStore.setState({ selection: TORTA })
    const campo = document.createElement('input')
    const area = document.createElement('textarea')
    document.body.append(campo, area)
    expect(tocarAlt(campo).defaultPrevented).toBe(false)
    expect(tocarAlt(area, 200, 300).defaultPrevented).toBe(false)
    nadaMudou()
  })

  it('interruptor com o foco não é campo de texto: o toque endireita', () => {
    useMapStore.setState({ selection: TORTA })
    const interruptor = document.createElement('input')
    interruptor.type = 'checkbox'
    document.body.append(interruptor)
    tocarAlt(interruptor)
    expect(linhaTorta().x1).toBe(linhaTorta().x2)
  })

  it('janela modal aberta por cima: nada', () => {
    useMapStore.setState({ selection: TORTA })
    const modal = document.createElement('div')
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    document.body.append(modal)
    expect(tocarAlt().defaultPrevented).toBe(false)
    nadaMudou()
  })

  it('fora da ferramenta Selecionar (traço em andamento, outra ferramenta): nada', () => {
    useMapStore.setState({ selection: TORTA, activeTool: 'path' })
    expect(tocarAlt().defaultPrevented).toBe(false)
    nadaMudou()
  })

  it('desligar remove todos os ouvintes que ligou, e um toque depois não faz nada', () => {
    desligar()
    const ligouNaJanela = vi.spyOn(window, 'addEventListener')
    const desligouNaJanela = vi.spyOn(window, 'removeEventListener')
    const ligouNoDocumento = vi.spyOn(document, 'addEventListener')
    const desligouNoDocumento = vi.spyOn(document, 'removeEventListener')
    try {
      const desligarEste = instalarEndireitarComAlt(window)
      desligarEste()
      expect(ligouNaJanela.mock.calls.length + ligouNoDocumento.mock.calls.length).toBeGreaterThan(0)
      expect(desligouNaJanela.mock.calls).toEqual(ligouNaJanela.mock.calls)
      expect(desligouNoDocumento.mock.calls).toEqual(ligouNoDocumento.mock.calls)
    } finally {
      vi.restoreAllMocks()
    }

    useMapStore.setState({ selection: TORTA })
    tocarAlt()
    nadaMudou()
  })
})
