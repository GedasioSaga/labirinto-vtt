import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnimacaoCenario } from './AnimacaoCenario'
import { CenarioOverlay } from './CenarioOverlay'
import { CENARIO_PADRAO, type CenarioDoPino } from './catalogo'
import { esquecerEstilosDeCenarioDeFora, registrarEstiloDeCenario } from './estilosDeCenario'

/** ESTILO DE CENÁRIO do pacote tocando no lugar da panorâmica — e caindo nela quando falta ou quebra. */

let container: HTMLDivElement
let root: Root
let frames: FrameRequestCallback[]
const IMAGEM = 'data:image/png;base64,AAAA'
const COM_ESTILO: CenarioDoPino = { ...CENARIO_PADRAO, som: false, estilo: 'neve' }

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.spyOn(performance, 'now').mockReturnValue(0)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  esquecerEstilosDeCenarioDeFora()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Roda os quadros pendentes no instante `ms` (o relógio do rAF). */
function quadro(ms: number) {
  const pendentes = frames
  frames = []
  act(() => {
    for (const f of pendentes) f(ms)
  })
}

/** jsdom não carrega imagem: a foto escondida do estilo "carrega" com 400x300. */
function carregarFoto(): HTMLImageElement {
  const foto = document.querySelector<HTMLImageElement>('img[hidden]')
  if (!foto) throw new Error('sem a foto do estilo')
  Object.defineProperty(foto, 'naturalWidth', { value: 400 })
  Object.defineProperty(foto, 'naturalHeight', { value: 300 })
  act(() => {
    foto.dispatchEvent(new Event('load'))
  })
  return foto
}

function moduloFalso(extra: Record<string, unknown> = {}) {
  const instancia = { atualizar: vi.fn(), descartar: vi.fn() }
  const criar = vi.fn(() => instancia)
  expect(registrarEstiloDeCenario({ id: 'neve', nome: 'Neve caindo', duracaoNaturalS: 5, criar, ...extra })).toBe(true)
  return { instancia, criar }
}

const tocaPanoramica = () => document.querySelector('.lb-cenario__foto') !== null && document.querySelector('.lb-cenario__tela') === null
const tocaEstilo = () => document.querySelector('.lb-cenario__tela') !== null

function tocar(cenario: CenarioDoPino, extra: { repetir?: boolean; onFim?: () => void; volume?: number } = {}) {
  act(() => root.render(<AnimacaoCenario imagem={IMAGEM} cenario={cenario} volume={extra.volume ?? 0.4} repetir={extra.repetir} onFim={extra.onFim} />))
}

describe('AnimacaoCenario com estilo do pacote', () => {
  it('estilo registrado: o módulo recebe canvas, foto e opções; atualiza em segundos; no fim chama onFim e só descarta ao fechar', () => {
    vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta.includes('reduce') }))
    const { instancia, criar } = moduloFalso()
    const onFim = vi.fn()
    tocar(COM_ESTILO, { onFim })
    expect(tocaEstilo()).toBe(true)
    const foto = carregarFoto()
    expect(criar).toHaveBeenCalledTimes(1)
    expect(criar).toHaveBeenCalledWith(document.querySelector('canvas.lb-cenario__tela'), foto, { reduzirMovimento: true, volume: 0.4 })
    quadro(1500)
    expect(instancia.atualizar).toHaveBeenLastCalledWith(1.5)
    quadro(5000)
    expect(onFim).toHaveBeenCalledTimes(1)
    expect(frames).toHaveLength(0)
    expect(instancia.descartar).not.toHaveBeenCalled()
    act(() => root.render(<></>))
    expect(instancia.descartar).toHaveBeenCalledTimes(1)
  })

  it('a duração do mestre vale no lugar da natural do estilo', () => {
    moduloFalso()
    const onFim = vi.fn()
    tocar({ ...COM_ESTILO, duracaoS: 8 }, { onFim })
    carregarFoto()
    quadro(5000)
    expect(onFim).not.toHaveBeenCalled()
    quadro(8000)
    expect(onFim).toHaveBeenCalledTimes(1)
  })

  it('repetir (prévia): cada passada é uma instância nova, e o tempo recomeça do zero', () => {
    const { instancia, criar } = moduloFalso()
    tocar(COM_ESTILO, { repetir: true })
    carregarFoto()
    quadro(5000)
    expect(instancia.descartar).toHaveBeenCalledTimes(1)
    expect(criar).toHaveBeenCalledTimes(2)
    expect(instancia.atualizar).toHaveBeenLastCalledWith(0)
    expect(frames).toHaveLength(1)
  })

  it('sem estilo, a panorâmica de sempre — mesmo com estilo registrado', () => {
    const { criar } = moduloFalso()
    tocar({ ...CENARIO_PADRAO, som: false })
    expect(tocaPanoramica()).toBe(true)
    expect(criar).not.toHaveBeenCalled()
  })

  it('estilo ainda não baixado: a panorâmica; quando o pacote registra, passa a tocar o estilo', () => {
    tocar(COM_ESTILO)
    expect(tocaPanoramica()).toBe(true)
    const criar = vi.fn(() => ({ atualizar: () => {}, descartar: () => {} }))
    act(() => {
      registrarEstiloDeCenario({ id: 'neve', nome: 'Neve caindo', duracaoNaturalS: 5, criar })
    })
    expect(tocaEstilo()).toBe(true)
  })

  it('criar que lança: cai para a panorâmica sem quebrar a tela', () => {
    moduloFalso({
      criar: () => {
        throw new Error('pacote quebrado')
      },
    })
    tocar(COM_ESTILO)
    carregarFoto()
    expect(tocaPanoramica()).toBe(true)
    expect(console.warn).toHaveBeenCalled()
  })

  it('criar que devolve forma errada: a panorâmica', () => {
    moduloFalso({ criar: () => ({ atualizar: 'não' }) })
    tocar(COM_ESTILO)
    carregarFoto()
    expect(tocaPanoramica()).toBe(true)
  })

  it('quadro que lança: o módulo é descartado uma vez e a panorâmica assume', () => {
    const { instancia } = moduloFalso()
    instancia.atualizar.mockImplementation(() => {
      throw new Error('quadro torto')
    })
    tocar(COM_ESTILO)
    carregarFoto()
    quadro(100)
    expect(instancia.descartar).toHaveBeenCalledTimes(1)
    expect(tocaPanoramica()).toBe(true)
  })

  it('descartar que lança não derruba nada', () => {
    const { instancia } = moduloFalso()
    instancia.descartar.mockImplementation(() => {
      throw new Error('descarte torto')
    })
    tocar(COM_ESTILO)
    carregarFoto()
    expect(() => act(() => root.render(<></>))).not.toThrow()
    expect(instancia.descartar).toHaveBeenCalledTimes(1)
  })
})

describe('CenarioOverlay com estilo do pacote', () => {
  it('o estilo roda dentro da moldura e fica no último quadro; só o "Fechar" devolve a vez ao cartão', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { instancia } = moduloFalso()
    const onFim = vi.fn()
    act(() => root.render(<CenarioOverlay imagem={{ src: IMAGEM, cenario: COM_ESTILO }} nome="Forte" descricao="Muralhas brancas." onFim={onFim} />))
    const botao = () => Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Pular' || b.textContent === 'Fechar')
    expect(botao()?.textContent).toBe('Pular')
    // jsdom não carrega imagem: a moldura espera um pouco e segue com o formato padrão.
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    carregarFoto()
    quadro(0)
    quadro(1000)
    expect(instancia.atualizar).toHaveBeenCalled()
    // "Pular" leva o estilo direto ao último instante (5 s, a duração natural dele).
    act(() => botao()?.click())
    quadro(1016)
    expect(instancia.atualizar).toHaveBeenLastCalledWith(5)
    expect(onFim).not.toHaveBeenCalled()
    expect(botao()?.textContent).toBe('Fechar')
    act(() => botao()?.click())
    act(() => vi.advanceTimersByTime(400))
    expect(onFim).toHaveBeenCalledTimes(1)
  })
})
