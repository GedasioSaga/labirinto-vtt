// @vitest-environment node
/**
 * Som das armadilhas com um AudioContext falso (como o som.test.ts da pesca):
 * todo ganho de saída nasce em 0 e a primeira automação parte de quase zero,
 * para não estalar; a sequência de prova cobre os dois sons.
 */
import { describe, expect, it } from 'vitest'
import { QUASE_ZERO } from '../abrir/som'
import { DURACAO_SEQUENCIA_SUSTO, SEQUENCIA_SUSTO, SONS_DO_SUSTO, tocarSusto, type NomeDoSomDoSusto } from './som'

interface ParamFalso { value: number; valorAntes: number | null; eventos: [string, number, number][] }

function paramFalso(v: number): ParamFalso & Record<string, unknown> {
  const p: ParamFalso & Record<string, unknown> = { value: v, valorAntes: null, eventos: [] }
  const marcar = (tipo: string) => (valor: number, t: number) => {
    if (p.valorAntes === null) p.valorAntes = p.value
    p.eventos.push([tipo, valor, t])
  }
  p.setValueAtTime = marcar('set')
  p.exponentialRampToValueAtTime = marcar('exp')
  p.linearRampToValueAtTime = marcar('lin')
  return p
}

interface NoFalso { tipo: string; saidas: unknown[]; gain?: ParamFalso }

function contextoFalso() {
  const ganhos: NoFalso[] = []
  const no = (tipo: string, extra: Record<string, unknown> = {}): NoFalso & Record<string, unknown> => {
    const n: NoFalso & Record<string, unknown> = { tipo, saidas: [], ...extra }
    n.connect = (dest: unknown) => { n.saidas.push(dest); return dest }
    n.start = () => undefined
    n.stop = () => undefined
    return n
  }
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => no('fonte', { buffer: null, loop: false }),
    createBiquadFilter: () => no('filtro', { type: 'lowpass', frequency: paramFalso(350), Q: paramFalso(1) }),
    createOscillator: () => no('osc', { type: 'sine', frequency: paramFalso(440) }),
    createGain: () => {
      const g = no('ganho', { gain: paramFalso(1) })
      ganhos.push(g)
      return g
    },
  }
  return { ctx: ctx as unknown as BaseAudioContext, ganhos, saida: no('saida') as unknown as AudioNode } // falsos de teste: o contexto tem só o que os sustos usam; a saída só recebe connect
}

/** Os sons dos sustos, listados à mão; o primeiro teste confere que a lista bate com SONS_DO_SUSTO. */
const NOMES_DOS_SUSTOS: readonly NomeDoSomDoSusto[] = ['bote', 'aranha']

/** Um ganho é de saída quando liga em um nó (não em um AudioParam de modulação). */
const ehSaida = (g: NoFalso): boolean => g.saidas.some((d) => typeof d === 'object' && d !== null && 'saidas' in d)

describe('sons das armadilhas', () => {
  it('a lista do teste cobre todos os sons dos sustos', () => {
    expect(Object.keys(SONS_DO_SUSTO).sort()).toEqual([...NOMES_DOS_SUSTOS].sort())
  })
  for (const nome of NOMES_DOS_SUSTOS) {
    it(`${nome}: todo ganho de saída nasce em 0 e parte de quase zero`, () => {
      const { ctx, ganhos, saida } = contextoFalso()
      tocarSusto(ctx, saida, { nome }, 1)
      const saidas = ganhos.filter(ehSaida)
      expect(saidas.length).toBeGreaterThan(0)
      for (const g of saidas) {
        expect(g.gain?.valorAntes).toBe(0)
        expect(g.gain?.eventos[0]).toEqual(['set', QUASE_ZERO, expect.any(Number)])
      }
    })
  }
  it('nome desconhecido não toca nada', () => {
    const { ctx, ganhos, saida } = contextoFalso()
    tocarSusto(ctx, saida, { nome: 'dragao' }, 1)
    expect(ganhos.length).toBe(0)
  })
  it('a sequência de prova tem a cobra e a aranha e cabe na duração', () => {
    const nomes = new Set(SEQUENCIA_SUSTO.map(([, ev]) => ev.nome))
    expect([...nomes].sort()).toEqual(['aranha', 'bote'])
    for (const [t] of SEQUENCIA_SUSTO) expect(t + 1.3).toBeLessThanOrEqual(DURACAO_SEQUENCIA_SUSTO)
  })
})
