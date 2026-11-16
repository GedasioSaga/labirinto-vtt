// @vitest-environment node
/**
 * SOM DO BAÚ SEM WEBAUDIO: um contexto falso mínimo registra cada ganho
 * criado, o valor dele antes de qualquer automação e se ele liga num nó
 * (volume de saída) ou num parâmetro (modulação). Todo ganho de saída nasce
 * em 0; todo evento que a simulação emite tem som; a sequência das provas
 * cobre todos os sons e cabe na duração declarada.
 */
import { describe, expect, it } from 'vitest'
import { simular } from '../abrir/simular'
import { DIFICULDADES } from '../abrir/tipos'
import { JOGO_BAU } from './jogo'
import { roboHumano, roboRuim } from './robo'
import { DURACAO_SEQUENCIA, SEQUENCIA, SONS, ehSom, tocar } from './som'
import type { NomeDoSom } from './som'

interface ParamFalso {
  value: number
  eventos: [string, number, number][]
  setValueAtTime: (v: number, t: number) => void
  exponentialRampToValueAtTime: (v: number, t: number) => void
}

interface GanhoFalso {
  gain: ParamFalso
  /** Valor do ganho no instante da primeira automação (null = nunca automatizado). */
  valorAntes: number | null
  /** true = liga num nó (volume de saída); false = liga num parâmetro (modulação). */
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

function noFalso(extra: Record<string, unknown>): Record<string, unknown> {
  return { ...extra, connect: (destino: unknown) => destino, start: () => undefined, stop: () => undefined }
}

function contextoFalso(): { ctx: BaseAudioContext; ganhos: GanhoFalso[]; saida: AudioNode } {
  const ganhos: GanhoFalso[] = []
  const params = new Set<unknown>()
  const fake = {
    sampleRate: 8000,
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => noFalso({ buffer: null, loop: false }),
    createBiquadFilter: () => {
      const f = noFalso({ type: 'lowpass', frequency: paramFalso(350), Q: paramFalso(1) })
      params.add(f.frequency)
      return f
    },
    createOscillator: () => {
      const o = noFalso({ type: 'sine', frequency: paramFalso(440) })
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
  const ctx = fake as unknown as BaseAudioContext // falso só com o que o som do baú usa; o resto nunca é chamado
  const saida = noFalso({}) as unknown as AudioNode // destino opaco: só recebe connect
  return { ctx, ganhos, saida }
}

const NOMES = Object.keys(SONS).filter(ehSom)

/** Nomes de evento que a simulação emite: robô humano, robô ruim e ninguém jogando, nas duas dificuldades. */
function nomesEmitidos(): Set<string> {
  const nomes = new Set<string>()
  for (const dif of DIFICULDADES) {
    for (let i = 0; i < 12; i++) {
      const s = `som|${dif}|${i}`
      for (const p of [simular(JOGO_BAU, s, dif, roboHumano(s, dif)), simular(JOGO_BAU, s, dif, roboRuim(s, dif))]) {
        for (const [, nome] of p.eventos) nomes.add(nome)
      }
    }
  }
  return nomes
}

describe('som do baú', () => {
  for (const nome of NOMES) {
    it(`${nome}: todo ganho de saída começa em 0 e o envelope parte de quase zero`, () => {
      const { ctx, ganhos, saida } = contextoFalso()
      tocar(ctx, saida, { nome, v: 1 }, 1)
      const deSaida = ganhos.filter((g) => g.ligaEmNo)
      expect(deSaida.length).toBeGreaterThan(0)
      expect(ganhos.every((g) => g.ligaEmNo)).toBe(true)
      for (const g of deSaida) {
        expect(g.valorAntes).toBe(0)
        expect(g.gain.value).toBe(0)
        expect(g.gain.eventos[0]).toEqual(['set', 0.0001, expect.any(Number)])
      }
    })
  }

  it('evento sem v (o campo opcional ausente) também toca', () => {
    for (const nome of NOMES) {
      const { ctx, ganhos, saida } = contextoFalso()
      tocar(ctx, saida, { nome }, 0)
      expect(ganhos.length).toBeGreaterThan(0)
    }
  })

  it('evento que não é do baú não toca nada', () => {
    const { ctx, ganhos, saida } = contextoFalso()
    tocar(ctx, saida, { nome: 'racha' }, 0)
    tocar(ctx, saida, { nome: 'toString' }, 0)
    expect(ganhos).toEqual([])
  })

  it('todo evento que a simulação emite tem som, e todo som sai de algum evento', () => {
    const emitidos = nomesEmitidos()
    for (const nome of emitidos) expect(ehSom(nome), nome).toBe(true)
    const esperados: NomeDoSom[] = ['fecho', 'emperrou', 'travado', 'aviso', 'segurou', 'solavanco', 'range', 'abriu', 'tempo']
    expect(new Set(NOMES)).toEqual(new Set(esperados))
    expect(emitidos).toEqual(new Set(esperados))
  })

  it('a sequência das provas cobre todos os sons, em ordem, dentro da duração', () => {
    expect(new Set(SEQUENCIA.map(([, ev]) => ev.nome))).toEqual(new Set(NOMES))
    for (let k = 1; k < SEQUENCIA.length; k++) expect(SEQUENCIA[k][0]).toBeGreaterThan(SEQUENCIA[k - 1][0])
    for (const [t] of SEQUENCIA) expect(t).toBeLessThan(DURACAO_SEQUENCIA - 0.8)
    expect(DURACAO_SEQUENCIA).toBeLessThanOrEqual(8.5)
    expect(JOGO_BAU.sequencia).toBe(SEQUENCIA)
    expect(JOGO_BAU.duracaoSequencia).toBe(DURACAO_SEQUENCIA)
    const { ctx, ganhos, saida } = contextoFalso()
    for (const [t, ev] of SEQUENCIA) tocar(ctx, saida, ev, t)
    expect(ganhos.filter((g) => g.ligaEmNo).every((g) => g.valorAntes === 0)).toBe(true)
  })
})
