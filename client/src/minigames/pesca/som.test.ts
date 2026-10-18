import { describe, expect, it } from 'vitest'
import { DURACAO_SEQ, SEQ, sequencia, SONS, vca } from './som'
import type { NomeDoSom } from './som'

/**
 * jsdom não tem WebAudio: um contexto falso mínimo que registra cada ganho
 * criado, o valor dele ANTES de qualquer automação e para onde ele liga.
 */

interface ParamFalso {
  value: number
  eventos: [string, number, number][]
  setValueAtTime: (v: number, t: number) => void
  exponentialRampToValueAtTime: (v: number, t: number) => void
}

interface GanhoFalso {
  gain: ParamFalso
  /** Valor do ganho no instante da primeira automação (ou no fim, se não houve). */
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

function noFalso(extra: Record<string, unknown>): Record<string, unknown> {
  const no: Record<string, unknown> = {
    ...extra,
    connect: (destino: unknown) => destino,
    start: () => undefined,
    stop: () => undefined,
  }
  return no
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
  // Contexto falso com só o que o som da pesca usa; o resto da interface não é chamado.
  const ctx = fake as unknown as BaseAudioContext
  const saida = noFalso({}) as unknown as AudioNode // destino opaco: só recebe connect
  return { ctx, ganhos, saida }
}

const NOMES: NomeDoSom[] = ['lance', 'splash', 'beliscada', 'fisgada', 'catraca', 'pegou', 'escapou', 'bau']

describe('som da pesca', () => {
  it('vca nasce em 0', () => {
    const { ctx } = contextoFalso()
    expect(vca(ctx).gain.value).toBe(0)
  })

  for (const nome of NOMES) {
    it(`${nome}: todo ganho de saída começa em 0 e o envelope parte de quase zero`, () => {
      const { ctx, ganhos, saida } = contextoFalso()
      SONS[nome](ctx, saida, 1)
      const deSaida = ganhos.filter((g) => g.ligaEmNo)
      expect(deSaida.length).toBeGreaterThan(0)
      for (const g of deSaida) {
        expect(g.valorAntes).toBe(0)
        expect(g.gain.value).toBe(0)
        expect(g.gain.eventos[0]).toEqual(['set', 0.0001, expect.any(Number)])
      }
    })
  }

  it('o único ganho que não nasce em 0 é a profundidade do vibrato do escapou, e ela liga num parâmetro', () => {
    const { ctx, ganhos, saida } = contextoFalso()
    SONS.escapou(ctx, saida, 0)
    const modulacao = ganhos.filter((g) => !g.ligaEmNo)
    expect(modulacao).toHaveLength(1)
    expect(modulacao[0].gain.value).toBe(18)
  })

  it('sequência das provas: 25 eventos, todos os sons, dentro de 6,4 s', () => {
    expect(SEQ).toHaveLength(25)
    expect(new Set(SEQ.map(([n]) => n))).toEqual(new Set(NOMES))
    for (const [, t] of SEQ) expect(t).toBeLessThan(DURACAO_SEQ)
    const { ctx, ganhos, saida } = contextoFalso()
    sequencia(ctx, saida, 0)
    expect(ganhos.filter((g) => g.ligaEmNo).every((g) => g.valorAntes === 0)).toBe(true)
  })
})
