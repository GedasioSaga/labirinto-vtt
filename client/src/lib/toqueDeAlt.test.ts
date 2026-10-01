import { describe, expect, it } from 'vitest'
import {
  ALT_TOQUE_JANELA_MS,
  ALT_TOQUE_MOVIMENTO_MAX_PX,
  classificarSolturaDoAlt,
  criarDetectorDeToqueDeAlt,
  type TeclaDoAlt,
} from './toqueDeAlt'

/**
 * O contrato do Alt entre o pedido 5 (endireitar, Alt TOCADO) e o pedido 3
 * (guias de medição estilo Figma, Alt SEGURADO). Os gestos que já usam Alt
 * (Alt+arrastar duplica, Alt no gesto inverte a grade, Alt+setas move 1 px,
 * AltGr digita símbolo, Alt+Tab troca de janela) nunca podem virar toque.
 */

function tecla(key: string, timeStamp: number, extra: Partial<TeclaDoAlt> = {}): TeclaDoAlt {
  return { key, timeStamp, repeat: false, ctrlKey: false, metaKey: false, shiftKey: false, ...extra }
}

const alt = (timeStamp: number, extra: Partial<TeclaDoAlt> = {}): TeclaDoAlt => tecla('Alt', timeStamp, extra)

describe('classificarSolturaDoAlt', () => {
  const base = { apertouEm: 1000, movimentoPx: 0, outraEntrada: false }

  it('soltar em menos de 600 ms sem outra entrada é toque', () => {
    expect(ALT_TOQUE_JANELA_MS).toBe(600)
    expect(classificarSolturaDoAlt({ ...base, soltouEm: 1100 })).toBe('toque')
    expect(classificarSolturaDoAlt({ ...base, soltouEm: 1599 })).toBe('toque')
  })

  it('a partir de 600 ms é Alt segurado, reservado para medir', () => {
    expect(classificarSolturaDoAlt({ ...base, soltouEm: 1600 })).toBe('segurado')
    expect(classificarSolturaDoAlt({ ...base, soltouEm: 1700 })).toBe('segurado')
  })

  it('mexer o mouse mais de 3 px com o Alt apertado também é segurado: quem mexe está medindo ou mirando', () => {
    expect(ALT_TOQUE_MOVIMENTO_MAX_PX).toBe(3)
    expect(classificarSolturaDoAlt({ ...base, soltouEm: 1100, movimentoPx: 3 })).toBe('toque')
    expect(classificarSolturaDoAlt({ ...base, soltouEm: 1100, movimentoPx: 10 })).toBe('segurado')
  })

  it('outra entrada no meio faz do Alt um modificador: combinado, mesmo rápido', () => {
    expect(classificarSolturaDoAlt({ ...base, soltouEm: 1100, outraEntrada: true })).toBe('combinado')
  })

  it('instante inválido não vira toque por acidente', () => {
    expect(classificarSolturaDoAlt({ ...base, soltouEm: Number.NaN })).toBe('segurado')
    expect(classificarSolturaDoAlt({ ...base, soltouEm: 900 })).toBe('segurado')
  })
})

describe('criarDetectorDeToqueDeAlt', () => {
  it('Alt desce e sobe em 100 ms: toque', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.teclaDesceu(alt(0))
    expect(d.teclaSubiu(alt(100))).toBe('toque')
  })

  it('Alt desce e sobe depois de 700 ms: segurado (é do medir, soltar não faz nada)', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.teclaDesceu(alt(0))
    expect(d.teclaSubiu(alt(700))).toBe('segurado')
  })

  it('a repetição do Alt segurado não rearma nem estende a janela', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.teclaDesceu(alt(0))
    d.teclaDesceu(alt(500, { repeat: true }))
    d.teclaDesceu(alt(530, { repeat: true }))
    expect(d.teclaSubiu(alt(700))).toBe('segurado')
  })

  it('Alt, seta, soltar Alt: combinado (é o Alt+setas que move 1 px)', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.teclaDesceu(alt(0))
    d.teclaDesceu(tecla('ArrowLeft', 40))
    d.teclaSubiu(tecla('ArrowLeft', 60))
    expect(d.teclaSubiu(alt(100))).toBe('combinado')
  })

  it('clique durante o Alt: combinado (é o Alt+clique que duplica ou inverte o pincel)', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.teclaDesceu(alt(0))
    d.ponteiroDesceu()
    d.ponteiroSubiu()
    expect(d.teclaSubiu(alt(100))).toBe('combinado')
  })

  it('botão do mouse já apertado quando o Alt desce (arrasto em andamento): combinado', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.ponteiroDesceu()
    d.teclaDesceu(alt(0))
    expect(d.teclaSubiu(alt(100))).toBe('combinado')
    // O arrasto continua: outro toque com o botão apertado também não vale.
    d.teclaDesceu(alt(200))
    expect(d.teclaSubiu(alt(300))).toBe('combinado')
  })

  it('arrastando com o botão apertado sem o pointerdown ter sido visto: o pointermove conta', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.teclaDesceu(alt(0))
    d.ponteiroMoveu(10, 10, 1)
    expect(d.teclaSubiu(alt(100))).toBe('combinado')
  })

  it('depois de soltar o botão, o toque volta a valer', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.ponteiroDesceu()
    d.ponteiroSubiu()
    d.teclaDesceu(alt(0))
    expect(d.teclaSubiu(alt(100))).toBe('toque')
  })

  it('pointerup perdido fora da janela: o pointermove sem botão destrava', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.ponteiroDesceu()
    d.ponteiroMoveu(50, 50, 0)
    d.teclaDesceu(alt(0))
    expect(d.teclaSubiu(alt(100))).toBe('toque')
  })

  it('mexer o mouse mais de 3 px com o Alt apertado: segurado; até 3 px continua toque', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.ponteiroMoveu(100, 100, 0)
    d.teclaDesceu(alt(0))
    d.ponteiroMoveu(102, 102, 0)
    expect(d.teclaSubiu(alt(100))).toBe('toque')

    d.teclaDesceu(alt(200))
    d.ponteiroMoveu(112, 102, 0)
    expect(d.teclaSubiu(alt(300))).toBe('segurado')
  })

  it('sem posição conhecida antes do Alt, o primeiro movimento vira a origem', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.teclaDesceu(alt(0))
    d.ponteiroMoveu(0, 0, 0)
    d.ponteiroMoveu(10, 0, 0)
    expect(d.teclaSubiu(alt(100))).toBe('segurado')
  })

  it('rolagem no meio: combinado', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.teclaDesceu(alt(0))
    d.interromper()
    expect(d.teclaSubiu(alt(100))).toBe('combinado')
  })

  it('Alt, perda de foco, soltar Alt: nada (é o Alt+Tab)', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.teclaDesceu(alt(0))
    d.zerar()
    expect(d.teclaSubiu(alt(100))).toBeNull()
  })

  it('AltGr do ABNT2 nunca vira toque: AltGraph, ou Alt com Ctrl', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.teclaDesceu(tecla('Control', 0, { ctrlKey: true }))
    d.teclaDesceu(tecla('AltGraph', 1, { ctrlKey: true }))
    expect(d.teclaSubiu(tecla('AltGraph', 80))).toBeNull()

    d.teclaDesceu(alt(200, { ctrlKey: true }))
    expect(d.teclaSubiu(alt(260))).toBe('combinado')
  })

  it('Alt com Shift (troca de idioma no Windows) ou com a tecla Windows: combinado', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.teclaDesceu(alt(0))
    d.teclaDesceu(tecla('Shift', 30, { shiftKey: true }))
    expect(d.teclaSubiu(alt(100))).toBe('combinado')

    d.teclaDesceu(alt(200, { metaKey: true }))
    expect(d.teclaSubiu(alt(260))).toBe('combinado')
  })

  it('soltura de outra tecla, ou de um Alt que desceu fora da janela, não é classificada', () => {
    const d = criarDetectorDeToqueDeAlt()
    expect(d.teclaSubiu(tecla('v', 10))).toBeNull()
    expect(d.teclaSubiu(alt(20))).toBeNull()
  })

  it('dois toques seguidos valem os dois: o estado zera a cada soltura', () => {
    const d = criarDetectorDeToqueDeAlt()
    d.teclaDesceu(alt(0))
    expect(d.teclaSubiu(alt(80))).toBe('toque')
    d.teclaDesceu(alt(300))
    expect(d.teclaSubiu(alt(380))).toBe('toque')
  })
})
