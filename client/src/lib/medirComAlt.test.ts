import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarMedidorDoAlt, type MedidorDoAlt } from './altMeasure'
import { ouvirAltDeMedir } from './medirComAlt'
import { ALT_TOQUE_JANELA_MS } from './toqueDeAlt'

/**
 * Pedido 3, fatia 5: os eventos da janela chegam ao medidor do Alt, e o canvas
 * é avisado para mostrar ou esconder a medida. O keydown do Alt com o canvas
 * parado leva `preventDefault` (o Alt solto não pode levar o foco ao menu do
 * navegador ou do WebView2); o keyup nunca, porque ele é do endireitar.
 */

function tecla(tipo: 'keydown' | 'keyup', key: string, timeStamp: number, extra: KeyboardEventInit = {}): KeyboardEvent {
  const evento = new KeyboardEvent(tipo, { key, bubbles: true, cancelable: true, ...extra })
  // O medidor mede a janela pelo `timeStamp` do próprio evento: o teste fixa o relógio.
  Object.defineProperty(evento, 'timeStamp', { value: timeStamp })
  return evento
}

function ponteiro(tipo: string, timeStamp: number, x = 0, y = 0, buttons = 0): PointerEvent {
  const evento = new PointerEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, buttons, pointerId: 1, isPrimary: true })
  Object.defineProperty(evento, 'timeStamp', { value: timeStamp })
  return evento
}

let medidor: MedidorDoAlt
let avisos: number[]
let ocioso: boolean
let desligar: () => void = () => {}

beforeEach(() => {
  vi.useFakeTimers()
  medidor = criarMedidorDoAlt()
  avisos = []
  ocioso = true
  desligar = ouvirAltDeMedir(window, medidor, { ocioso: () => ocioso, aoMudar: (agora) => avisos.push(agora) })
})

afterEach(() => {
  desligar()
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('ouvirAltDeMedir — o Alt da janela chega ao medidor', () => {
  it('Alt desce com o canvas parado: preventDefault, aviso na hora e outro quando a janela do toque acaba', () => {
    const desceu = tecla('keydown', 'Alt', 1000, { altKey: true })
    document.body.dispatchEvent(desceu)
    expect(desceu.defaultPrevented).toBe(true)
    expect(avisos).toEqual([1000])
    expect(medidor.medindo(1000)).toBe(false)

    vi.advanceTimersByTime(ALT_TOQUE_JANELA_MS - 1)
    expect(avisos).toEqual([1000])
    vi.advanceTimersByTime(1)
    // O aviso do prazo leva o instante em que o Alt passa a medir: o mouse parado em cima da peça também mede.
    expect(avisos).toEqual([1000, 1000 + ALT_TOQUE_JANELA_MS])
    expect(medidor.medindo(1000 + ALT_TOQUE_JANELA_MS)).toBe(true)
  })

  it('soltar o Alt: avisa (para a medida sumir), sem preventDefault (o keyup é do endireitar) e sem prazo pendurado', () => {
    document.body.dispatchEvent(tecla('keydown', 'Alt', 0, { altKey: true }))
    const subiu = tecla('keyup', 'Alt', 100)
    document.body.dispatchEvent(subiu)
    expect(subiu.defaultPrevented).toBe(false)
    expect(avisos).toEqual([0, 100])
    vi.advanceTimersByTime(ALT_TOQUE_JANELA_MS * 2)
    expect(avisos).toEqual([0, 100])
    expect(medidor.medindo(5000)).toBe(false)
  })

  it('a repetição do Alt segurado não arma outro prazo', () => {
    document.body.dispatchEvent(tecla('keydown', 'Alt', 0, { altKey: true }))
    document.body.dispatchEvent(tecla('keydown', 'Alt', 500, { altKey: true, repeat: true }))
    vi.advanceTimersByTime(ALT_TOQUE_JANELA_MS * 3)
    expect(avisos.filter((t) => t === ALT_TOQUE_JANELA_MS)).toHaveLength(1)
  })

  it('no meio de um gesto, com o foco num campo de texto, ou com Ctrl (AltGr): o keydown do Alt segue sem preventDefault', () => {
    ocioso = false
    const noGesto = tecla('keydown', 'Alt', 0, { altKey: true })
    document.body.dispatchEvent(noGesto)
    expect(noGesto.defaultPrevented).toBe(false)
    document.body.dispatchEvent(tecla('keyup', 'Alt', 10))

    ocioso = true
    const campo = document.createElement('input')
    document.body.append(campo)
    const noCampo = tecla('keydown', 'Alt', 20, { altKey: true })
    campo.dispatchEvent(noCampo)
    expect(noCampo.defaultPrevented).toBe(false)
    campo.dispatchEvent(tecla('keyup', 'Alt', 30))

    const altGr = tecla('keydown', 'Alt', 40, { altKey: true, ctrlKey: true })
    document.body.dispatchEvent(altGr)
    expect(altGr.defaultPrevented).toBe(false)
  })

  it('clique com o Alt apertado: o medidor cancela e avisa, e o prazo não reacende a medida', () => {
    document.body.dispatchEvent(tecla('keydown', 'Alt', 0, { altKey: true }))
    document.body.dispatchEvent(ponteiro('pointerdown', 50, 10, 10, 1))
    expect(avisos).toEqual([0, 50])
    vi.advanceTimersByTime(ALT_TOQUE_JANELA_MS)
    expect(medidor.medindo(ALT_TOQUE_JANELA_MS)).toBe(false)
  })

  it('mexer o mouse com o Alt apertado chega ao medidor (mede sem esperar a janela)', () => {
    document.body.dispatchEvent(ponteiro('pointermove', 0, 100, 100))
    document.body.dispatchEvent(tecla('keydown', 'Alt', 10, { altKey: true }))
    document.body.dispatchEvent(ponteiro('pointermove', 40, 120, 100))
    expect(medidor.medindo(40)).toBe(true)
  })

  it('rolagem com o Alt apertado cancela e avisa', () => {
    document.body.dispatchEvent(tecla('keydown', 'Alt', 0, { altKey: true }))
    const rolagem = new WheelEvent('wheel', { bubbles: true, deltaY: 100 })
    Object.defineProperty(rolagem, 'timeStamp', { value: 30 })
    document.body.dispatchEvent(rolagem)
    expect(avisos).toEqual([0, 30])
    expect(medidor.medindo(5000)).toBe(false)
  })

  it('a janela perde o foco (Alt+Tab): o medidor esquece o Alt e avisa, nada fica preso na tela', () => {
    document.body.dispatchEvent(tecla('keydown', 'Alt', 0, { altKey: true }))
    window.dispatchEvent(new FocusEvent('blur'))
    expect(avisos).toHaveLength(2)
    expect(medidor.medindo(5000)).toBe(false)
    expect(medidor.medePeloTempoEm()).toBeNull()
  })

  it('desligar tira os ouvintes e o prazo: depois disso nada chega ao medidor', () => {
    document.body.dispatchEvent(tecla('keydown', 'Alt', 0, { altKey: true }))
    desligar()
    vi.advanceTimersByTime(ALT_TOQUE_JANELA_MS)
    document.body.dispatchEvent(tecla('keyup', 'Alt', 700))
    expect(avisos).toEqual([0])
    // O keyup não chegou: para o medidor o Alt continua apertado desde 0.
    expect(medidor.medindo(ALT_TOQUE_JANELA_MS)).toBe(true)
  })
})
