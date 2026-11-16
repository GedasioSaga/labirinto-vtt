// @vitest-environment node
/**
 * Testes da base comum: sorte determinística, olho do robô com atraso (nunca
 * reação zero), simulação que amostra a cada 0,1 s e contorno do Meio-Termo.
 */
import { describe, expect, it } from 'vitest'
import { contorno, luminancia, CONTORNO_MIN } from './desenho'
import { gauss, rngDe } from './rng'
import { Olho, REACAO_MIN } from './robo'
import { mediana, simular } from './simular'
import { DT, LIMITE_S, SEM_ENTRADA, type Entrada, type JogoDeAbrir } from './tipos'

/** Jogo de mentira: abre no 30º toque; um toque por passo no máximo. */
interface Contador { t: number; n: number; fim: 'abriu' | 'tempo' | null; ev: { nome: string }[] }
const CONTADOR: JogoDeAbrir<Contador> = {
  id: 'barril', nome: 'teste', instrucao: '', objetivo: '', areaDaDica: [0, 0, 1, 1], teclas: {}, grafico: [], ganho: 1, boca: [120, 60], sequencia: [], duracaoSequencia: 0,
  criar: () => ({ t: 0, n: 0, fim: null, ev: [] }),
  passo(e, entrada: Readonly<Entrada>) {
    e.ev = []
    e.t += DT
    if (e.fim) return e.fim
    if (entrada.toque >= 0) { e.n++; e.ev.push({ nome: 'toque' }) }
    if (e.n >= 30) e.fim = 'abriu'
    else if (e.t >= LIMITE_S) e.fim = 'tempo'
    return e.fim
  },
  eventos: (e) => e.ev,
  tempo: (e) => e.t,
  fim: (e) => e.fim,
  progresso: (e) => e.n / 30,
  abertura: () => 0,
  amostra: (e) => ({ n: e.n }),
  desenhar: () => undefined,
  alvoEm: () => 0,
  tocar: () => undefined,
  roboHumano: () => () => ({ segurando: false, toque: 0 }),
  roboRuim: () => () => SEM_ENTRADA,
}

describe('sorte determinística', () => {
  it('mesma semente dá a mesma sequência; outra semente dá outra', () => {
    const a = rngDe('x|1'), b = rngDe('x|1'), c = rngDe('x|2')
    const sa = Array.from({ length: 5 }, a), sb = Array.from({ length: 5 }, b), sc = Array.from({ length: 5 }, c)
    expect(sa).toEqual(sb)
    expect(sa).not.toEqual(sc)
  })
  it('gauss tem média perto de 0 e desvio perto de 1', () => {
    const r = rngDe('gauss')
    const xs = Array.from({ length: 20000 }, () => gauss(r))
    const m = xs.reduce((s, x) => s + x, 0) / xs.length
    const dp = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length)
    expect(Math.abs(m)).toBeLessThan(0.03)
    expect(Math.abs(dp - 1)).toBeLessThan(0.03)
  })
})

describe('olho do robô', () => {
  it('nunca vê a tela com menos de 120 ms de atraso e vê, em média, uns 250 ms atrás', () => {
    const olho = new Olho<number>(rngDe('olho'))
    const atrasos: number[] = []
    for (let i = 0; i < 12000; i++) {
      const t = i * DT
      const v = olho.olhar(t, t)
      if (v !== null) atrasos.push(t - v.a)
    }
    expect(Math.min(...atrasos)).toBeGreaterThanOrEqual(REACAO_MIN - 1e-9)
    // Atraso médio = reação (~0,25 s) + metade da releitura (~0,075 s).
    const media = atrasos.reduce((s, x) => s + x, 0) / atrasos.length
    expect(media).toBeGreaterThan(0.26)
    expect(media).toBeLessThan(0.38)
  })
  it('não vê nada antes da primeira reação', () => {
    const olho = new Olho<number>(rngDe('olho2'))
    expect(olho.olhar(0, 0)).toBeNull()
  })
})

describe('simulação sem tela', () => {
  it('amostra a cada 0,1 s e acaba no fim do jogo', () => {
    const p = simular(CONTADOR, 's', 'normal', CONTADOR.roboHumano('s', 'normal'))
    expect(p.fim).toBe('abriu')
    expect(p.t).toBeCloseTo(30 * DT, 9)
    const ts = p.amostras.slice(0, -1).map((a) => a.t)
    for (let i = 1; i < ts.length; i++) expect(ts[i] - ts[i - 1]).toBeCloseTo(0.1, 9)
    expect(p.eventos.length).toBe(30)
  })
  it('sem ninguém jogando, acaba por tempo em 20 s', () => {
    const p = simular(CONTADOR, 's', 'normal', CONTADOR.roboRuim('s', 'normal'))
    expect(p.fim).toBe('tempo')
    expect(p.t).toBeGreaterThanOrEqual(LIMITE_S - DT)
    expect(p.t).toBeLessThanOrEqual(LIMITE_S + DT)
  })
  it('mediana', () => {
    expect(mediana([3, 1, 2])).toBe(2)
    expect(mediana([4, 1, 2, 3])).toBe(2.5)
    expect(mediana([])).toBeNaN()
  })
})

describe('contorno do Meio-Termo', () => {
  it('nunca é preto puro e nunca fica abaixo de luminância 0,06', () => {
    for (const cor of ['#000000', '#1f1915', '#775739', '#5d6164', '#f3efe2']) {
      const c = contorno(cor)
      expect(c).not.toBe('#000000')
      expect(luminancia(c)).toBeGreaterThanOrEqual(CONTORNO_MIN - 1e-9)
    }
  })
})
