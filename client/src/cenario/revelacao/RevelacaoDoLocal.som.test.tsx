import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instalarAudioContextFalso, type AudioContextFalso } from '../audioContextFalso.fixture'
import { CENARIO_PADRAO } from '../catalogo'
import { RevelacaoDoLocal, type RevelacaoDoLocalProps } from './RevelacaoDoLocal'
import { GANHO_TECLAS } from './som'

/**
 * O SOM DA REVELAÇÃO com um Web Audio de mentira: cada revelação abre um
 * contexto e o fecha ao sair ou recomeçar; movimento reduzido não abre
 * nenhum; o mudo zera o mestre; "Pular" corta as teclas e para de agendar;
 * o clique que completa o texto não toca as teclas que faltavam; sem painel
 * não há porta para bater. Nada de timer ou quadro vivo depois de desmontar.
 */

let container: HTMLDivElement
let root: Root
let contextos: AudioContextFalso[]
let quadros: Map<number, FrameRequestCallback>
let proximoId = 0
let agora = 0
const DESCRICAO = 'Muralhas brancas brotam da selva como um dente de pedra. O brasão azul da Marinha ainda vigia a trilha.'

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Avança o relógio até `ms` e roda os quadros pendentes. */
function quadro(ms: number) {
  agora = ms
  const pendentes = [...quadros.values()]
  quadros.clear()
  act(() => {
    for (const f of pendentes) f(ms)
  })
}

function abrir(extra: Partial<RevelacaoDoLocalProps> = {}) {
  act(() => root.render(<RevelacaoDoLocal imagem={null} nome="Base da Marinha" descricao={DESCRICAO} volume={0.8} {...extra} />))
}

/**
 * Abre e devolve quantos timers já existem: o `focus()` do botão faz o jsdom
 * agendar um timer próprio (seleção), que não é da revelação. "Nada vivo
 * depois de desmontar" = nenhum timer além desses.
 */
function abrirEContarTimers(): number {
  abrir()
  return vi.getTimerCount()
}

const unico = (): AudioContextFalso => {
  expect(contextos).toHaveLength(1)
  return contextos[0]
}
const pular = () => act(() => document.querySelector<HTMLButtonElement>('.lb-revelacao__pular')?.click())
/** Barramento das teclas que levou o corte (fade a 0). */
const teclasCortadas = (ctx: AudioContextFalso) => ctx.ganhos.filter((g) => g.gain.value === GANHO_TECLAS && g.gain.setTargetAtTime.mock.calls.some(([alvo]) => alvo === 0))

describe('RevelacaoDoLocal: som', () => {
  it('toca as teclas no volume da mesa e fecha o contexto ao desmontar, sem timer nem quadro vivo', () => {
    const base = abrirEContarTimers()
    const ctx = unico()
    // O primeiro ganho é o mestre: nasce no volume da mesa.
    expect(ctx.ganhos[0].gain.value).toBe(0.8)
    quadro(1500)
    expect(ctx.iniciadas).toBeGreaterThan(0)
    act(() => root.render(<></>))
    expect(ctx.fechado).toBe(true)
    expect(vi.getTimerCount()).toBe(base)
    expect(quadros.size).toBe(0)
  })

  it('mudo: o mestre nasce em 0 e segue o volume quando a mesa muda', () => {
    abrir({ volume: 0 })
    const ctx = unico()
    expect(ctx.ganhos[0].gain.value).toBe(0)
    abrir({ volume: 0.5 })
    expect(ctx.ganhos[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.5, expect.any(Number), expect.any(Number))
  })

  it('movimento reduzido: nenhum contexto de áudio', () => {
    vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta.includes('reduce'), addEventListener: () => undefined, removeEventListener: () => undefined }))
    abrir()
    quadro(1500)
    expect(contextos).toHaveLength(0)
  })

  it('"Pular" corta as teclas em fade e não agenda mais nenhuma', () => {
    abrir()
    const ctx = unico()
    quadro(1500)
    pular()
    expect(teclasCortadas(ctx)).toHaveLength(1)
    const tocadas = ctx.iniciadas
    quadro(2500)
    quadro(4000)
    expect(ctx.iniciadas).toBe(tocadas)
  })

  it('"Pular" e logo desmontar: o corte não deixa timer pendurado', () => {
    const base = abrirEContarTimers()
    const ctx = unico()
    quadro(1500)
    pular()
    act(() => root.render(<></>))
    expect(ctx.fechado).toBe(true)
    expect(vi.getTimerCount()).toBe(base)
    expect(quadros.size).toBe(0)
  })

  it('clique no painel completa o texto sem tocar as teclas que faltavam', () => {
    abrir()
    const ctx = unico()
    quadro(1500)
    act(() => document.querySelector<HTMLElement>('.lb-revelacao__painel')?.click())
    const tocadas = ctx.iniciadas
    quadro(1520)
    quadro(2500)
    quadro(4000)
    expect(ctx.iniciadas).toBe(tocadas)
  })

  it('"Repetir" (rodada nova) fecha o contexto antigo e abre outro', () => {
    abrir({ previa: true })
    const primeiro = unico()
    abrir({ previa: true, rodada: 1 })
    expect(primeiro.fechado).toBe(true)
    expect(contextos).toHaveLength(2)
    expect(contextos[1].fechado).toBe(false)
  })

  it('com imagem e sem nome nem descrição não há porta: nenhum "clunk", nenhum contexto', async () => {
    abrir({ imagem: { src: 'data:image/png;base64,AAAA', cenario: { ...CENARIO_PADRAO, som: false } }, nome: '', descricao: '' })
    // jsdom não carrega imagem: a moldura espera e segue com o formato padrão.
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    expect(document.querySelector('.lb-revelacao__dobradicas')).toBeNull()
    quadro(1000)
    quadro(1300)
    expect(contextos).toHaveLength(0)
  })
})
