// @vitest-environment node
/**
 * Som do barril sem WebAudio: um contexto falso mínimo registra cada ganho
 * criado (o valor dele antes de qualquer automação e se ele liga num nó ou
 * num parâmetro) e cada `stop`. Todo ganho de saída nasce em 0; todo evento
 * que a simulação emite tem som; a sequência de prova cobre todos os nomes e
 * cabe na duração declarada.
 */
import { describe, expect, it } from 'vitest'
import { simular } from '../abrir/simular'
import { QUASE_ZERO } from '../abrir/som'
import { DIFICULDADES, SEM_ENTRADA } from '../abrir/tipos'
import { JOGO_BARRIL } from './jogo'
import { DURACAO_SEQUENCIA, NOMES_DOS_SONS, SEQUENCIA, tocar } from './som'
import type { Evento } from '../abrir/tipos'
import type { EventoDoBarril } from './sim'

interface ParamFalso {
  value: number
  eventos: [string, number, number][]
  setValueAtTime: (v: number, t: number) => void
  exponentialRampToValueAtTime: (v: number, t: number) => void
}

interface GanhoFalso {
  gain: ParamFalso
  /** Valor do ganho no instante da primeira automação (null se não houve). */
  valorAntes: number | null
  /** true = liga num nó (é volume de saída); false = liga num parâmetro (modulação). */
  ligaEmNo: boolean
}

function paramFalso(inicial: number, aoAutomatizar?: () => void): ParamFalso {
  const p: ParamFalso = {
    value: inicial,
    eventos: [],
    setValueAtTime: (v, t) => {
      aoAutomatizar?.()
      p.eventos.push(['set', v, t])
    },
    exponentialRampToValueAtTime: (v, t) => {
      aoAutomatizar?.()
      p.eventos.push(['exp', v, t])
    },
  }
  return p
}

interface Falso {
  ctx: BaseAudioContext
  saida: AudioNode
  ganhos: GanhoFalso[]
  /** Instantes de cada `stop` (fim de cada fonte). */
  paradas: number[]
}

function contextoFalso(): Falso {
  const ganhos: GanhoFalso[] = []
  const paradas: number[] = []
  const params = new Set<unknown>()
  const no = (extra: Record<string, unknown>): Record<string, unknown> => ({
    ...extra,
    connect: (destino: unknown) => destino,
    start: () => undefined,
    stop: (t: number) => void paradas.push(t),
  })
  const fake = {
    sampleRate: 8000,
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => no({ buffer: null, loop: false }),
    createBiquadFilter: () => {
      const f = no({ type: 'lowpass', frequency: paramFalso(350), Q: paramFalso(1) })
      params.add(f.frequency)
      return f
    },
    createOscillator: () => {
      const o = no({ type: 'sine', frequency: paramFalso(440) })
      params.add(o.frequency)
      return o
    },
    createGain: () => {
      // O GainNode real nasce em 1: o falso também, para o teste pegar quem esquece de zerar.
      const registro: GanhoFalso = {
        gain: paramFalso(1, () => {
          if (registro.valorAntes === null) registro.valorAntes = registro.gain.value
        }),
        valorAntes: null,
        ligaEmNo: false,
      }
      ganhos.push(registro)
      return {
        gain: registro.gain,
        connect: (destino: unknown) => {
          registro.ligaEmNo = !params.has(destino)
          return destino
        },
      }
    },
  }
  // Contexto falso com só o que o som do barril usa; o resto da interface nunca é chamado.
  const ctx = fake as unknown as BaseAudioContext // falso de teste: só o que o som do barril usa (comentário acima)
  const saida = no({}) as unknown as AudioNode // destino opaco: só recebe connect
  return { ctx, saida, ganhos, paradas }
}

/** Um evento de exemplo de cada nome, com v e força quando o som usa. */
function exemplo(nome: string): EventoDoBarril {
  if (nome === 'golpe') return { nome, v: 1, forca: 0.5 }
  if (nome === 'batida' || nome === 'aro') return { nome, v: 2 }
  return { nome }
}

/** Nomes de todos os eventos que a simulação emite com os dois robôs, nas duas dificuldades. */
function nomesEmitidos(): Set<string> {
  const nomes = new Set<string>()
  for (const dif of DIFICULDADES) {
    for (let i = 0; i < 6; i++) {
      const s = `som|${i}`
      for (const pol of [JOGO_BARRIL.roboHumano(s, dif), JOGO_BARRIL.roboRuim(s, dif), () => SEM_ENTRADA]) {
        for (const [, nome] of simular(JOGO_BARRIL, s, dif, pol).eventos) nomes.add(nome)
      }
    }
  }
  return nomes
}

describe('som do barril', () => {
  for (const nome of NOMES_DOS_SONS) {
    it(`${nome}: todo ganho de saída nasce em 0 e o envelope parte de quase zero`, () => {
      const { ctx, saida, ganhos } = contextoFalso()
      tocar(ctx, saida, exemplo(nome), 1)
      const deSaida = ganhos.filter((g) => g.ligaEmNo)
      expect(deSaida.length).toBeGreaterThan(0)
      expect(deSaida).toHaveLength(ganhos.length)
      for (const g of deSaida) {
        expect(g.valorAntes).toBe(0)
        expect(g.gain.value).toBe(0)
        expect(g.gain.eventos[0]).toEqual(['set', QUASE_ZERO, expect.any(Number)])
      }
    })
  }

  it('todo evento que a simulação emite tem som, e todo som é emitido pela simulação', () => {
    const emitidos = nomesEmitidos()
    expect(emitidos).toEqual(new Set(NOMES_DOS_SONS))
    for (const nome of emitidos) {
      const { ctx, saida, ganhos } = contextoFalso()
      tocar(ctx, saida, exemplo(nome), 0)
      expect(ganhos.length, nome).toBeGreaterThan(0)
    }
  })

  it('o golpe fica mais forte com o progresso', () => {
    const pico = (forca: number): number => {
      const { ctx, saida, ganhos } = contextoFalso()
      const ev: EventoDoBarril = { nome: 'golpe', v: 0, forca }
      tocar(ctx, saida, ev, 0)
      return Math.max(...ganhos.flatMap((g) => g.gain.eventos.map(([, v]) => v)))
    }
    expect(pico(1)).toBeGreaterThan(pico(0) * 1.3)
  })

  it('nome desconhecido não toca nada', () => {
    const { ctx, saida, ganhos } = contextoFalso()
    const ev: Evento = { nome: 'nada' }
    tocar(ctx, saida, ev, 0)
    expect(ganhos).toHaveLength(0)
  })

  it('a sequência de prova cobre todos os nomes e cabe na duração, com a cauda do último som', () => {
    expect(new Set(SEQUENCIA.map(([, ev]) => ev.nome))).toEqual(new Set(NOMES_DOS_SONS))
    for (const [t] of SEQUENCIA) expect(t).toBeGreaterThanOrEqual(0)
    const { ctx, saida, ganhos, paradas } = contextoFalso()
    for (const [t, ev] of SEQUENCIA) tocar(ctx, saida, ev, t)
    expect(Math.max(...paradas)).toBeLessThanOrEqual(DURACAO_SEQUENCIA)
    expect(DURACAO_SEQUENCIA).toBeLessThanOrEqual(8.5)
    expect(ganhos.every((g) => g.valorAntes === 0)).toBe(true)
  })
})
