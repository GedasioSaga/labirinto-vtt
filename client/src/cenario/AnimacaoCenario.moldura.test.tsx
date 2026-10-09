import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnimacaoCenario } from './AnimacaoCenario'
import { instalarAudioContextFalso, type AudioContextFalso } from './audioContextFalso.fixture'
import { CENARIO_DURACAO_NATURAL_S, CENARIO_PADRAO, duracaoDoCenarioS, type CenarioDoPino } from './catalogo'
import { faixaDoAmbiente } from './revelacao/tempo'

/**
 * A PANORÂMICA DENTRO DA MOLDURA (revelação do local): sem cortina preta no
 * começo nem no fim, "Pular" salta para o último quadro, e o vento acaba
 * junto com o ambiente (ou na hora, no "Pular") em vez de soprar sobre a
 * imagem parada até o jogador fechar.
 */

let container: HTMLDivElement
let root: Root
let contextos: AudioContextFalso[]
let quadros: Map<number, FrameRequestCallback>
let proximoId = 0
let agora = 0
const IMAGEM = 'data:image/png;base64,AAAA'
// Sem partículas: o jsdom não tem canvas 2D (só avisaria no console).
const CENARIO: CenarioDoPino = { ...CENARIO_PADRAO, particulas: false, som: true }
const DURACAO_MS = duracaoDoCenarioS(CENARIO) * 1000

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  quadros = new Map()
  agora = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    quadros.set(++proximoId, cb)
    return proximoId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    quadros.delete(id)
  })
  vi.spyOn(performance, 'now').mockImplementation(() => agora)
  contextos = instalarAudioContextFalso()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function quadro(ms: number) {
  agora = ms
  const pendentes = [...quadros.values()]
  quadros.clear()
  act(() => {
    for (const f of pendentes) f(ms)
  })
}

function montar(pularParaOFim = false) {
  act(() => root.render(<AnimacaoCenario imagem={IMAGEM} cenario={CENARIO} volume={1} emMoldura pularParaOFim={pularParaOFim} />))
}

/** jsdom não carrega imagem nem mede: a área tem 800x600 e a foto 400x300. */
function carregarFoto(): HTMLImageElement {
  const area = container.querySelector<HTMLElement>('.lb-cenario')
  const foto = container.querySelector<HTMLImageElement>('.lb-cenario__foto')
  if (!area || !foto) throw new Error('sem a área ou a foto da panorâmica')
  Object.defineProperty(area, 'clientWidth', { value: 800 })
  Object.defineProperty(area, 'clientHeight', { value: 600 })
  Object.defineProperty(foto, 'naturalWidth', { value: 400 })
  Object.defineProperty(foto, 'naturalHeight', { value: 300 })
  act(() => {
    foto.dispatchEvent(new Event('load'))
  })
  return foto
}

const cortina = () => container.querySelector<HTMLElement>('.lb-cenario__cortina')?.style.opacity

/** O contexto do vento e a fonte em laço (o ruído que sopra). */
function vento() {
  expect(contextos).toHaveLength(1)
  const ctx = contextos[0]
  const ruido = ctx.fontes.find((f) => f.tipo === 'buffer' && f.loop)
  if (!ruido) throw new Error('sem o ruído do vento')
  return { ctx, ruido }
}

const quedasAZero = (ctx: AudioContextFalso) => ctx.ganhos.flatMap((g) => g.gain.setTargetAtTime.mock.calls.filter(([alvo]) => alvo === 0))

describe('AnimacaoCenario dentro da moldura', () => {
  it('o padrão sem duração escolhida é 5 s', () => {
    expect(CENARIO_DURACAO_NATURAL_S).toBe(5)
    expect(duracaoDoCenarioS({ ...CENARIO_PADRAO })).toBe(5)
  })

  it('sem cortina: a imagem aparece no primeiro quadro e continua visível no último', () => {
    montar()
    carregarFoto()
    quadro(0)
    expect(cortina()).toBe('0')
    quadro(DURACAO_MS + 100)
    expect(cortina()).toBe('0')
    // Acabou: nada mais pede quadro, o último fica parado.
    expect(quadros.size).toBe(0)
  })

  it('"Pular" salta para o mesmo enquadramento do fim natural', () => {
    montar()
    const foto = carregarFoto()
    quadro(0)
    quadro(1000)
    const noMeio = foto.style.transform
    montar(true)
    quadro(1100)
    const pulado = foto.style.transform
    expect(pulado).not.toBe(noMeio)

    act(() => root.unmount())
    root = createRoot(container)
    agora = 0
    montar()
    const outra = carregarFoto()
    quadro(0)
    quadro(DURACAO_MS + 100)
    expect(pulado).toBe(outra.style.transform)
  })

  it('o vento cai a zero quando o ambiente assenta e as fontes param', () => {
    montar()
    carregarFoto()
    const { ctx, ruido } = vento()
    const [assenta, fim] = faixaDoAmbiente(duracaoDoCenarioS(CENARIO))
    quadro(0)
    quadro(assenta * 1000 - 100)
    expect(quedasAZero(ctx)).toHaveLength(0)
    expect(ruido.stop).not.toHaveBeenCalled()
    quadro(assenta * 1000 + 16)
    const quedas = quedasAZero(ctx)
    expect(quedas).toHaveLength(1)
    // ~1% do volume quando o ambiente termina de assentar.
    const tau = quedas[0][2]
    expect(Math.exp(-(fim - assenta) / tau)).toBeLessThan(0.02)
    expect(ruido.stop).toHaveBeenCalledTimes(1)
    // Mais quadros não pedem outra queda.
    quadro(DURACAO_MS + 100)
    expect(quedasAZero(ctx)).toHaveLength(1)
  })

  it('"Pular" corta o vento na hora, mesmo antes da foto carregar', () => {
    montar()
    const { ctx, ruido } = vento()
    montar(true)
    const quedas = quedasAZero(ctx)
    expect(quedas).toHaveLength(1)
    expect(quedas[0][2]).toBeLessThan(0.1)
    expect(ruido.stop).toHaveBeenCalledTimes(1)
  })

  it('desmontar fecha o contexto do vento', () => {
    montar()
    const { ctx } = vento()
    act(() => root.render(<></>))
    expect(ctx.fechado).toBe(true)
  })
})
