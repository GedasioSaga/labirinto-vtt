import { describe, expect, it } from 'vitest'
import { criarAudioFalso } from '../lib/sons/audioFalso.fixture'
import { agendarSomDePorta, type EventoDeSomDaPorta } from './somDePorta'
import { SONS_DO_PACOTE, type SomDoPacote } from './somDasPortasDoPacote'
import { SONS_DA_ANIMACAO_DE_PORTA } from './animacoesDePorta'

/**
 * SOM DAS CINCO PORTAS DO PACOTE (22/10/2026): sintetizado, um para cada, e
 * agendado nos pontos do desenho. Aqui, o agendamento (todo nó começa depois
 * de t0, para antes do fim devolvido, e o caminho parcial pula o que já
 * passou). Como SOA (LUFS, pico, cliques, cortes) está medido offline nas
 * provas de docs/design/porta-animacoes/app — medir não é ouvir.
 */
const DURACOES: Record<SomDoPacote, { abrir: number; fechar: number }> = {
  dupla: { abrir: 320, fechar: 280 },
  grade: { abrir: 600, fechar: 420 },
  arrombada: { abrir: 560, fechar: 320 },
  sanfona: { abrir: 440, fechar: 380 },
  cortina: { abrir: 480, fechar: 420 },
}

function agendar(evento: EventoDeSomDaPorta, t0 = 5) {
  const audio = criarAudioFalso()
  const fim = agendarSomDePorta(audio.ctx, audio.mestre, t0, evento)
  const nos = [...audio.osciladores, ...audio.fontes]
  return {
    fim: fim - t0,
    inicios: nos.map((no) => no.start.mock.calls[0][0] - t0),
    paradas: nos.map((no) => no.stop.mock.calls[0]?.[0] - t0),
  }
}

/** Um nó que soa: oscilador pela forma da onda, rajada pelo tipo do filtro; `t` = início, relativo a t0. */
interface NoQueSoa {
  tipo: OscillatorType | BiquadFilterType
  freq: number
  t: number
}

/** O começo do abrir, na hora em que a folha parte (p = 0), em nós que só ele tem no abrir. */
const PARTIDAS: [SomDoPacote, Omit<NoQueSoa, 't'>[]][] = [
  // O golpe: tom grave e o baque abafado.
  ['arrombada', [{ tipo: 'sine', freq: 74 }, { tipo: 'lowpass', freq: 340 }]],
  // O tranco da corrente antes de a grade subir.
  ['grade', [{ tipo: 'triangle', freq: 96 }, { tipo: 'lowpass', freq: 420 }]],
  // O estalo do trinco.
  ['dupla', [{ tipo: 'highpass', freq: 2600 }]],
]

function partidaDoAbrir(som: SomDoPacote, de: number, t0 = 5): NoQueSoa[] {
  const audio = criarAudioFalso()
  agendarSomDePorta(audio.ctx, audio.mestre, t0, { tipo: 'abrir', som, duracaoMs: DURACOES[som].abrir * (1 - de), de })
  return [
    ...audio.osciladores.map((no) => ({ tipo: no.type, freq: no.frequency.setValueAtTime.mock.calls[0][0], t: no.start.mock.calls[0][0] - t0 })),
    ...audio.filtros.map((no) => ({ tipo: no.type, freq: no.frequency.setValueAtTime.mock.calls[0][0], t: no.frequency.setValueAtTime.mock.calls[0][1] - t0 })),
  ]
}

const mesmaMarca = (no: NoQueSoa, marca: Omit<NoQueSoa, 't'>): boolean => no.tipo === marca.tipo && no.freq === marca.freq

describe('som das portas do pacote', () => {
  it('são os cinco do app, depois dos dois das embutidas', () => {
    expect([...SONS_DO_PACOTE]).toEqual(SONS_DA_ANIMACAO_DE_PORTA.slice(2))
  })

  it.each(SONS_DO_PACOTE)('%s: abrir e fechar agendam nós que começam depois de t0 e param antes do fim, e o fim fica até 250 ms depois da animação', (som) => {
    for (const tipo of ['abrir', 'fechar'] as const) {
      const duracaoMs = DURACOES[som][tipo]
      const { fim, inicios, paradas } = agendar({ tipo, som, duracaoMs, de: tipo === 'abrir' ? 0 : 1 })
      expect(inicios.length).toBeGreaterThan(0)
      expect(paradas).toHaveLength(inicios.length)
      for (const inicio of inicios) expect(inicio).toBeGreaterThanOrEqual(0)
      for (const parada of paradas) expect(parada).toBeLessThanOrEqual(fim + 1e-9)
      expect(fim).toBeLessThanOrEqual(duracaoMs / 1000 + 0.25)
    }
  })

  it.each(SONS_DO_PACOTE)('%s: caminho que já começa no meio (inverteu) não toca o que já passou', (som) => {
    const inteiro = agendar({ tipo: 'abrir', som, duracaoMs: DURACOES[som].abrir, de: 0 })
    const pedaco = agendar({ tipo: 'abrir', som, duracaoMs: DURACOES[som].abrir * 0.3, de: 0.7 })
    // Nada novo aparece, e nada começa antes do relógio (o que já passou não toca atrasado).
    expect(pedaco.inicios.length).toBeLessThanOrEqual(inteiro.inicios.length)
    for (const inicio of pedaco.inicios) expect(inicio).toBeGreaterThanOrEqual(0)
    expect(pedaco.fim).toBeLessThanOrEqual(inteiro.fim)
  })

  it('o golpe da arrombada e o baque da grade ficam no começo do abrir: a 70% do caminho já passaram', () => {
    for (const som of ['arrombada', 'grade'] as const) {
      const inteiro = agendar({ tipo: 'abrir', som, duracaoMs: DURACOES[som].abrir, de: 0 })
      const pedaco = agendar({ tipo: 'abrir', som, duracaoMs: DURACOES[som].abrir * 0.3, de: 0.7 })
      expect(pedaco.inicios.length, som).toBeLessThan(inteiro.inicios.length)
    }
  })

  it.each(PARTIDAS)('%s: o som da partida toca em t0 no abrir inteiro e não toca quando o abrir começa no meio (inverteu)', (som, marcas) => {
    const inteiro = partidaDoAbrir(som, 0)
    const pedaco = partidaDoAbrir(som, 0.5)
    for (const marca of marcas) {
      const noInteiro = inteiro.filter((no) => mesmaMarca(no, marca))
      expect(noInteiro.length, `${som}: ${marca.tipo} ${marca.freq} Hz no abrir inteiro`).toBe(1)
      expect(noInteiro[0].t, `${som}: ${marca.tipo} ${marca.freq} Hz cai na partida`).toBeCloseTo(0, 6)
      expect(pedaco.filter((no) => mesmaMarca(no, marca)), `${som}: ${marca.tipo} ${marca.freq} Hz já passou em p = 0,5`).toEqual([])
    }
  })

  it('mesmo evento, mesmo agendamento: o ruído tem semente fixa', () => {
    const a = agendar({ tipo: 'abrir', som: 'arrombada', duracaoMs: 560, de: 0 })
    const b = agendar({ tipo: 'abrir', som: 'arrombada', duracaoMs: 560, de: 0 })
    expect(a).toEqual(b)
  })
})
