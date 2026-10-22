import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarAudioFalso, type NoFalso } from '../lib/sons/audioFalso.fixture'
import { criarMotorDeSom, type SaidaDeSom } from '../lib/sons/contexto'
import type { PreferenciaDeSom } from '../stores/somStore'
import { FRACAO_EM_QUE_ASSENTA, GANHO_DA_PORTA, INTERVALO_MINIMO_DA_PORTA_MS, agendarSomDePorta, criarTocadorDePorta, tocarSomDePorta, type EventoDeSomDaPorta } from './somDePorta'

/**
 * SOM DA PORTA: mudo no movimento reduzido, mudo antes do primeiro gesto (sem
 * criar AudioContext), respeita o "Som da mesa" e agenda cada som no ponto do
 * caminho. Como ele SOA está medido nas provas (`docs/design/porta-som/`).
 */

const ABRIR: EventoDeSomDaPorta = { tipo: 'abrir', som: 'rangido', duracaoMs: 300 }
const FECHAR: EventoDeSomDaPorta = { tipo: 'fechar', som: 'rangido', duracaoMs: 260 }

function tocador(opcoes: { saida?: SaidaDeSom<NoFalso> | null; preferencia?: PreferenciaDeSom; reduzido?: boolean; agora?: () => number } = {}) {
  const obterSaida = vi.fn(() => (opcoes.saida === undefined ? criarAudioFalso().saida : opcoes.saida))
  const tocar = criarTocadorDePorta({
    obterSaida,
    lerPreferencia: () => opcoes.preferencia ?? { volume: 0.5, mudo: false },
    reduzido: () => opcoes.reduzido ?? false,
    agora: opcoes.agora ?? (() => 0),
  })
  return { tocar, obterSaida }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('somDePorta — quando toca', () => {
  it('toca com a saída do gesto: volume da mesa ao quadrado num ganho do toque, ligado ao mestre', () => {
    const audio = criarAudioFalso()
    const { tocar } = tocador({ saida: audio.saida })
    expect(tocar(ABRIR)).toBe(true)
    const volumeDoToque = audio.ganhos.find((g) => g.destino === audio.mestre)
    expect(volumeDoToque?.gain.setValueAtTime).toHaveBeenCalledWith(0.25, expect.any(Number))
    expect(audio.osciladores.length + audio.fontes.length).toBeGreaterThan(0)
  })

  it('movimento reduzido: mudo, e nem procura a saída', () => {
    const { tocar, obterSaida } = tocador({ reduzido: true })
    expect(tocar(ABRIR)).toBe(false)
    expect(tocar({ tipo: 'trancar' })).toBe(false)
    expect(obterSaida).not.toHaveBeenCalled()
  })

  it.each<[string, PreferenciaDeSom]>([
    ['mudo', { volume: 0.8, mudo: true }],
    ['volume no 0%', { volume: 0, mudo: false }],
  ])('"Som da mesa" %s: não toca', (_caso, preferencia) => {
    const { tocar, obterSaida } = tocador({ preferencia })
    expect(tocar(ABRIR)).toBe(false)
    expect(obterSaida).not.toHaveBeenCalled()
  })

  it('antes do primeiro gesto não há saída: não toca', () => {
    expect(tocador({ saida: null }).tocar(ABRIR)).toBe(false)
  })

  it('contexto suspenso (o navegador ainda não destravou): não toca', () => {
    const audio = criarAudioFalso({ estado: 'suspended' })
    expect(tocador({ saida: audio.saida }).tocar(ABRIR)).toBe(false)
    expect(audio.osciladores).toHaveLength(0)
  })

  it('uma alavanca abrindo cinco portas no mesmo quadro é um rangido só; fechar logo depois toca', () => {
    let agora = 1000
    const { tocar } = tocador({ agora: () => agora })
    expect(tocar(ABRIR)).toBe(true)
    for (let i = 0; i < 4; i += 1) expect(tocar(ABRIR)).toBe(false)
    expect(tocar(FECHAR)).toBe(true)
    agora += INTERVALO_MINIMO_DA_PORTA_MS
    expect(tocar(ABRIR)).toBe(true)
  })

  it('contexto que recusa nó: devolve false, nunca lança', () => {
    const audio = criarAudioFalso()
    audio.ctx.createGain = () => {
      throw new Error('fechado')
    }
    expect(tocador({ saida: audio.saida }).tocar(ABRIR)).toBe(false)
  })
})

describe('somDePorta — sem AudioContext antes do gesto', () => {
  it('pelo motor do app: tocar antes do gesto não cria contexto; o gesto cria um, e aí toca', () => {
    const audio = criarAudioFalso()
    const fabrica = vi.fn(() => audio.ctx)
    const motor = criarMotorDeSom(fabrica)
    const alvo = new EventTarget()
    const parar = motor.destravarNoPrimeiroGesto(alvo)
    const tocar = criarTocadorDePorta({ obterSaida: motor.obterSaida, lerPreferencia: () => ({ volume: 1, mudo: false }), reduzido: () => false, agora: () => 0 })
    expect(tocar(ABRIR)).toBe(false)
    expect(fabrica).not.toHaveBeenCalled()
    alvo.dispatchEvent(new Event('pointerup'))
    expect(fabrica).toHaveBeenCalledTimes(1)
    expect(tocar(ABRIR)).toBe(true)
    parar()
  })

  it('o tocador do app (`tocarSomDePorta`) não constrói AudioContext sozinho', () => {
    const Construtor = vi.fn()
    vi.stubGlobal('AudioContext', Construtor)
    expect(tocarSomDePorta(ABRIR)).toBe(false)
    expect(tocarSomDePorta({ tipo: 'trancar' })).toBe(false)
    expect(Construtor).not.toHaveBeenCalled()
  })
})

describe('somDePorta — o que soa em cada evento', () => {
  /** Instantes de começo de cada fonte (oscilador ou ruído), em s desde `t0`. */
  function comecos(evento: EventoDeSomDaPorta, t0 = 5) {
    const audio = criarAudioFalso()
    const fim = agendarSomDePorta(audio.ctx, audio.mestre, t0, evento)
    const inicios = [...audio.osciladores, ...audio.fontes].map((no) => no.start.mock.calls[0][0] - t0)
    const paradas = [...audio.osciladores, ...audio.fontes].map((no) => no.stop.mock.calls[0][0] - t0)
    return { audio, fim: fim - t0, inicios, paradas }
  }

  it('todo nó que começa também para, e nada passa do fim devolvido', () => {
    for (const evento of [ABRIR, FECHAR, { ...ABRIR, som: 'trinco' as const }, { tipo: 'trancar' as const }, { tipo: 'destrancar' as const }]) {
      const { inicios, paradas, fim } = comecos(evento)
      expect(inicios.length).toBeGreaterThan(0)
      expect(paradas).toHaveLength(inicios.length)
      for (const parada of paradas) expect(parada).toBeLessThanOrEqual(fim + 1e-9)
      for (const inicio of inicios) expect(inicio).toBeGreaterThanOrEqual(0)
    }
  })

  it('abrir com rangido: o trinco solta no começo e o rangido acompanha o caminho, terminando com ele', () => {
    const { inicios, fim } = comecos(ABRIR)
    expect(Math.min(...inicios)).toBe(0)
    expect(fim).toBeGreaterThan(0.25)
    expect(fim).toBeLessThanOrEqual(0.3 + 0.05)
  })

  it('fechar: o trinco cai quando a folha assenta, não no fim do relógio', () => {
    const { inicios } = comecos(FECHAR)
    const assenta = 0.26 * FRACAO_EM_QUE_ASSENTA
    expect(inicios.some((t) => Math.abs(t - assenta) < 1e-9)).toBe(true)
  })

  it('porta de correr ("trinco"): sem rangido, só a lingueta', () => {
    const { audio } = comecos({ ...ABRIR, som: 'trinco' })
    expect(audio.osciladores.every((o) => o.type !== 'sawtooth')).toBe(true)
    expect(comecos(ABRIR).audio.osciladores.some((o) => o.type === 'sawtooth')).toBe(true)
  })

  it('caminho curtinho (inverteu quase no fim): sem rangido, o trinco ainda soa', () => {
    const { audio } = comecos({ tipo: 'abrir', som: 'rangido', duracaoMs: 20 })
    expect(audio.osciladores.every((o) => o.type !== 'sawtooth')).toBe(true)
    expect(audio.fontes.length).toBeGreaterThan(0)
  })

  it('trancar raspa e depois bate; destrancar bate primeiro', () => {
    const trancar = comecos({ tipo: 'trancar' })
    const destrancar = comecos({ tipo: 'destrancar' })
    // A batida grave (o seno) vem depois do raspar ao trancar, e logo no começo ao destrancar.
    const seno = (r: ReturnType<typeof comecos>) => r.audio.osciladores.findIndex((o) => o.type === 'sine')
    const inicioDoSeno = (r: ReturnType<typeof comecos>) => r.audio.osciladores[seno(r)].start.mock.calls[0][0] - 5
    expect(inicioDoSeno(trancar)).toBeGreaterThan(0.05)
    expect(inicioDoSeno(destrancar)).toBe(0)
  })

  it('o ganho final da porta é o calibrado nas provas', () => {
    const audio = criarAudioFalso()
    agendarSomDePorta(audio.ctx, audio.mestre, 1, ABRIR)
    const saidaDaPorta = audio.ganhos.find((g) => g.destino === audio.mestre)
    expect(saidaDaPorta?.gain.setValueAtTime).toHaveBeenCalledWith(GANHO_DA_PORTA, expect.any(Number))
  })

  it('toda envoltória começa e termina em zero: sem degrau, sem clique', () => {
    const audio = criarAudioFalso()
    agendarSomDePorta(audio.ctx, audio.mestre, 1, ABRIR)
    agendarSomDePorta(audio.ctx, audio.mestre, 2, FECHAR)
    agendarSomDePorta(audio.ctx, audio.mestre, 3, { tipo: 'trancar' })
    const curvas = audio.ganhos.flatMap((g) => g.gain.setValueCurveAtTime.mock.calls.map(([valores]) => valores))
    expect(curvas.length).toBeGreaterThan(5)
    for (const curva of curvas) {
      expect(curva[0]).toBe(0)
      expect(curva[curva.length - 1]).toBe(0)
    }
  })
})
