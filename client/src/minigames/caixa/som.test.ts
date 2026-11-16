// @vitest-environment node
/**
 * Som da caixa sem WebAudio: um contexto falso mínimo que registra cada ganho
 * criado, o valor dele ANTES de qualquer automação, cada valor automatizado e
 * o instante em que cada fonte para. Medir de verdade (pico, LUFS, cliques) é
 * a renderização offline das provas; aqui só a forma.
 */
import { describe, expect, it } from 'vitest'
import { simular } from '../abrir/simular'
import { QUASE_ZERO } from '../abrir/som'
import { DIFICULDADES } from '../abrir/tipos'
import type { Politica } from '../abrir/tipos'
import { JOGO_CAIXA } from './jogo'
import { roboHumano, roboRuim } from './robo'
import { NOMES_DOS_EVENTOS } from './sim'
import type { Estado } from './sim'
import { DURACAO_SEQUENCIA, SEQUENCIA, SONS, tocar } from './som'

interface ParamFalso {
  value: number
  eventos: [string, number, number][]
  setValueAtTime: (v: number, t: number) => void
  exponentialRampToValueAtTime: (v: number, t: number) => void
  linearRampToValueAtTime: (v: number, t: number) => void
}

interface GanhoFalso {
  gain: ParamFalso
  /** Valor do ganho no instante da primeira automação (null se não houve). */
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
    linearRampToValueAtTime: (v, t) => {
      aoAutomatizar?.()
      p.eventos.push(['lin', v, t])
    },
  }
  return p
}

interface Falso {
  ctx: BaseAudioContext
  ganhos: GanhoFalso[]
  params: ParamFalso[]
  paradas: number[]
  saida: AudioNode
}

function contextoFalso(): Falso {
  const ganhos: GanhoFalso[] = []
  const params: ParamFalso[] = []
  const paradas: number[] = []
  const deParam = new Set<unknown>()
  const no = (extra: Record<string, unknown>): Record<string, unknown> => ({
    ...extra,
    connect: (destino: unknown) => destino,
    start: () => undefined,
    stop: (t: number) => void paradas.push(t),
  })
  const param = (v: number): ParamFalso => {
    const p = paramFalso(v)
    params.push(p)
    deParam.add(p)
    return p
  }
  const fake = {
    sampleRate: 8000,
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => no({ buffer: null, loop: false }),
    createBiquadFilter: () => no({ type: 'lowpass', frequency: param(350), Q: param(1) }),
    createOscillator: () => no({ type: 'sine', frequency: param(440) }),
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
      params.push(registro.gain)
      return {
        gain: registro.gain,
        connect: (destino: unknown) => {
          registro.ligaEmNo = !deParam.has(destino)
          return destino
        },
      }
    },
  }
  const ctx = fake as unknown as BaseAudioContext // falso com só o que o som da caixa usa; o resto da interface nunca é chamado
  const saida = no({}) as unknown as AudioNode // destino opaco: só recebe connect
  return { ctx, ganhos, params, paradas, saida }
}

/** Todo ganho de saída nasce em 0 e o envelope parte de quase zero; nenhum valor automatizado é NaN ou infinito. */
function conferirSaidas(f: Falso): void {
  const deSaida = f.ganhos.filter((g) => g.ligaEmNo)
  expect(deSaida.length).toBeGreaterThan(0)
  for (const g of deSaida) {
    expect(g.valorAntes).toBe(0)
    expect(g.gain.value).toBe(0)
    expect(g.gain.eventos[0]).toEqual(['set', QUASE_ZERO, expect.any(Number)])
  }
  for (const p of f.params) for (const [, v, t] of p.eventos) expect(Number.isFinite(v) && Number.isFinite(t)).toBe(true)
}

describe('som da caixa', () => {
  for (const nome of NOMES_DOS_EVENTOS) {
    it(`${nome}: todo ganho de saída nasce em 0, com v e sem v (campo opcional ausente)`, () => {
      for (const v of [undefined, 0, 0.5, 1, 3]) {
        const f = contextoFalso()
        tocar(f.ctx, f.saida, v === undefined ? { nome } : { nome, v }, 1)
        conferirSaidas(f)
      }
    })
  }

  it('todos os nomes de evento têm som, e não sobra som sem evento', () => {
    expect(Object.keys(SONS).sort()).toEqual([...NOMES_DOS_EVENTOS].sort())
  })

  it('nome que a caixa não conhece não toca nada', () => {
    const f = contextoFalso()
    tocar(f.ctx, f.saida, { nome: 'golpe', v: 1 }, 0)
    expect(f.ganhos).toHaveLength(0)
  })

  it('todo nome de evento que a simulação emite tem som', () => {
    const segura: Politica<Estado> = () => ({ segurando: true, toque: -1 })
    const emitidos = new Set<string>()
    for (const dif of DIFICULDADES) {
      for (let i = 0; i < 10; i++) {
        const s = `som|caixa|${dif}|${i}`
        for (const p of [roboHumano(s, dif), roboRuim(s, dif), segura]) {
          for (const [, nome] of simular(JOGO_CAIXA, s, dif, p).eventos) emitidos.add(nome)
        }
      }
    }
    expect([...emitidos].sort()).toEqual([...NOMES_DOS_EVENTOS].sort())
    for (const nome of emitidos) {
      const f = contextoFalso()
      tocar(f.ctx, f.saida, { nome }, 0)
      expect(f.ganhos.length, nome).toBeGreaterThan(0)
    }
  })

  it('a SEQUENCIA cobre todos os nomes, começa depois de 0 e cada som acaba dentro de DURACAO_SEQUENCIA', () => {
    expect(new Set(SEQUENCIA.map(([, ev]) => ev.nome))).toEqual(new Set(NOMES_DOS_EVENTOS))
    const f = contextoFalso()
    for (const [t, ev] of SEQUENCIA) {
      expect(t).toBeGreaterThanOrEqual(0)
      tocar(f.ctx, f.saida, ev, t)
    }
    conferirSaidas(f)
    expect(Math.max(...f.paradas)).toBeLessThanOrEqual(DURACAO_SEQUENCIA)
    expect(DURACAO_SEQUENCIA).toBe(JOGO_CAIXA.duracaoSequencia)
  })
})
