// @vitest-environment node
/**
 * Gráfico do movimento do Barril (METAS.md, seção 2), sem desenhar nada:
 * picos de brilho no andamento, progresso só com golpe na janela, brilho
 * subindo pelo menos 0,3 s antes do pico, partida em até 20 s e a mesma
 * semente dando as mesmas amostras. As propriedades de tempo fino (picos no
 * andamento ± 1 passo, começo da subida) são conferidas passo a passo
 * (1/120 s): a amostra de 0,1 s não tem resolução para "± 1 passo".
 */
import { describe, expect, it } from 'vitest'
import { simular } from '../abrir/simular'
import { DT, LIMITE_S, SEM_ENTRADA } from '../abrir/tipos'
import { JOGO_BARRIL } from './jogo'
import { AROS, DIF, DUR_ABRIR, abertura, brilhoDoPulso, brilhoEm, criar, passo } from './sim'
import type { Dificuldade, Entrada, Politica } from '../abrir/tipos'
import type { Estado, Pulso } from './sim'

const DIFS: readonly Dificuldade[] = ['normal', 'dificil']
const SEMENTES = Array.from({ length: 12 }, (_, i) => `grafico|${i}`)
const TOQUE: Readonly<Entrada> = { segurando: false, toque: 0 }

/** Uma linha por passo: tempo, brilho de cada aro, golpes e eventos daquele passo. */
interface Linha {
  t: number
  b: number[]
  golpesAntes: number
  golpes: number
  ev: string[]
}

/** Joga passo a passo (resolução de 1/120 s) até o fim, guardando cada passo. */
function porPasso(semente: string, dif: Dificuldade, politica: Politica<Estado>): { e: Estado; linhas: Linha[] } {
  const e = criar(semente, dif)
  const linhas: Linha[] = []
  for (let i = 0; i < (LIMITE_S + 1) / DT && e.fim === null; i++) {
    const golpesAntes = e.golpes
    passo(e, politica(e))
    linhas.push({ t: e.t, b: Array.from({ length: AROS }, (_, a) => brilhoEm(e, a, e.t)), golpesAntes, golpes: e.golpes, ev: e.ev.map((v) => v.nome) })
  }
  return { e, linhas }
}

/** Instantes dos picos de brilho (máximos locais acima de 0,9), de todos os aros, em ordem. */
function picos(linhas: readonly Linha[]): number[] {
  const ts: number[] = []
  for (let a = 0; a < AROS; a++) {
    for (let k = 1; k < linhas.length - 1; k++) {
      const b = linhas[k].b[a]
      if (b > 0.9 && b >= linhas[k - 1].b[a] && b > linhas[k + 1].b[a]) ts.push(linhas[k].t)
    }
  }
  return ts.sort((x, y) => x - y)
}

/** Avança sem tocar até o passo que chega em `t` e toca nele. */
function tocarEm(e: Estado, t: number): void {
  while (e.t + DT < t - 1e-9) passo(e, SEM_ENTRADA)
  passo(e, TOQUE)
}

/** Avança sem tocar até `t`. */
function esperarAte(e: Estado, t: number): void {
  while (e.t < t - 1e-9) passo(e, SEM_ENTRADA)
}

const pulsoMaisPerto = (pulsos: readonly Pulso[], t: number): Pulso =>
  pulsos.reduce((m, p) => (Math.abs(p.pico - t) < Math.abs(m.pico - t) ? p : m))

describe('gráfico do movimento do Barril', () => {
  it('no Normal os picos de brilho caem no andamento: intervalo entre picos = batida ± 1 passo', () => {
    for (const politica of [(): Entrada => SEM_ENTRADA, JOGO_BARRIL.roboHumano('ritmo', 'normal')]) {
      const { linhas } = porPasso('ritmo', 'normal', politica)
      const ts = picos(linhas)
      expect(ts.length).toBeGreaterThan(10)
      for (let k = 1; k < ts.length; k++) {
        expect(Math.abs(ts[k] - ts[k - 1] - DIF.normal.batida)).toBeLessThanOrEqual(DT + 1e-9)
      }
    }
  })

  it('o brilho começa a subir pelo menos 0,3 s antes do pico (Normal e Difícil, com síncope)', () => {
    let subidas = 0
    for (const dif of DIFS) {
      for (const semente of SEMENTES) {
        const { linhas } = porPasso(semente, dif, () => SEM_ENTRADA)
        for (let a = 0; a < AROS; a++) {
          let comeco = -1
          for (let k = 1; k < linhas.length - 1; k++) {
            const b = linhas[k].b[a]
            if (linhas[k - 1].b[a] === 0 && b > 0) comeco = linhas[k].t
            if (comeco >= 0 && b > 0.9 && b >= linhas[k - 1].b[a] && b > linhas[k + 1].b[a]) {
              // O primeiro passo aceso fica até 1 passo depois do começo real da subida.
              expect(linhas[k].t - comeco).toBeGreaterThanOrEqual(0.3 - DT - 1e-9)
              comeco = -1
              subidas++
            }
          }
        }
      }
    }
    expect(subidas).toBeGreaterThan(500)
  })

  it('o progresso só sobe com golpe dentro da janela do brilho; golpe fora nunca soma', () => {
    for (const dif of DIFS) {
      for (const semente of SEMENTES.slice(0, 6)) {
        for (const politica of [JOGO_BARRIL.roboHumano(semente, dif), JOGO_BARRIL.roboRuim(semente, dif)]) {
          const { e, linhas } = porPasso(semente, dif, politica)
          for (const l of linhas) {
            if (l.golpes > l.golpesAntes) {
              expect(l.ev).toContain('golpe')
              const p = pulsoMaisPerto(e.pulsos, l.t)
              expect(Math.abs(l.t - p.pico)).toBeLessThanOrEqual(DIF[dif].janela + 1e-9)
              // O aro daquela batida estava aceso no instante do golpe (o estado final já apagou os aros).
              expect(brilhoDoPulso(p, DIF[dif].queda, l.t)).toBeGreaterThan(0)
            }
            if (l.ev.includes('escorrega')) expect(l.golpes).toBeLessThanOrEqual(l.golpesAntes)
          }
        }
      }
    }
  })

  it('no gráfico de 0,1 s, toda subida do progresso vem com a marca de golpe certo na mesma amostra', () => {
    for (const dif of DIFS) {
      for (const semente of SEMENTES) {
        const p = simular(JOGO_BARRIL, semente, dif, JOGO_BARRIL.roboHumano(semente, dif))
        let marcas = 0
        for (let k = 1; k < p.amostras.length; k++) {
          const [antes, agora] = [p.amostras[k - 1].v, p.amostras[k].v]
          if (agora.progresso > antes.progresso) expect(agora.golpe).toBe(1)
          marcas += agora.golpe
        }
        // Uma marca por golpe certo: cada golpe aparece em exatamente uma amostra.
        expect(marcas).toBe(p.eventos.filter(([, n]) => n === 'golpe').length)
      }
    }
  })

  it('a partida acaba em até 20 s, com ou sem gente jogando', () => {
    for (const dif of DIFS) {
      for (const semente of SEMENTES) {
        for (const politica of [JOGO_BARRIL.roboHumano(semente, dif), JOGO_BARRIL.roboRuim(semente, dif), (): Entrada => SEM_ENTRADA]) {
          const p = simular(JOGO_BARRIL, semente, dif, politica)
          expect(p.fim).not.toBeNull()
          expect(p.t).toBeLessThanOrEqual(LIMITE_S + 1e-9)
        }
        const parado = simular(JOGO_BARRIL, semente, dif, () => SEM_ENTRADA)
        expect(parado.fim).toBe('tempo')
        expect(parado.t).toBeCloseTo(LIMITE_S, 9)
      }
    }
  })

  it('mesma semente dá as mesmas amostras; outra semente dá outras', () => {
    for (const dif of DIFS) {
      const a1 = simular(JOGO_BARRIL, 'sem-a', dif, JOGO_BARRIL.roboHumano('sem-a', dif))
      const a2 = simular(JOGO_BARRIL, 'sem-a', dif, JOGO_BARRIL.roboHumano('sem-a', dif))
      const b = simular(JOGO_BARRIL, 'sem-b', dif, JOGO_BARRIL.roboHumano('sem-b', dif))
      expect(a2).toEqual(a1)
      expect(b.amostras).not.toEqual(a1.amostras)
    }
  })
})

describe('batidas', () => {
  it('Normal: aros em ciclo de cima para baixo, andamento fixo, sem síncope', () => {
    const e = criar('ciclo', 'normal')
    e.pulsos.forEach((p, k) => {
      expect(p.aro).toBe(k % AROS)
      expect(p.sincope).toBe(false)
      expect(p.pico).toBeCloseTo(DIF.normal.primeiroPico + k * DIF.normal.batida, 9)
    })
  })

  it('Difícil: aro nunca repete em seguida, síncope perto de 1 em 5, nunca nas duas primeiras nem duas seguidas', () => {
    let sincopes = 0
    let total = 0
    for (let i = 0; i < 100; i++) {
      const { pulsos } = criar(`sinc|${i}`, 'dificil')
      expect(pulsos[0].sincope || pulsos[1].sincope).toBe(false)
      for (let k = 1; k < pulsos.length; k++) {
        expect(pulsos[k].aro).not.toBe(pulsos[k - 1].aro)
        expect(pulsos[k].sincope && pulsos[k - 1].sincope).toBe(false)
        expect(pulsos[k].pico).toBeGreaterThan(pulsos[k - 1].pico)
        if (pulsos[k].sincope) expect(pulsos[k].subida).toBeGreaterThanOrEqual(0.3)
      }
      sincopes += pulsos.filter((p) => p.sincope).length
      total += pulsos.length
    }
    expect(sincopes / total).toBeGreaterThan(0.1)
    expect(sincopes / total).toBeLessThan(0.25)
  })
})

describe('golpes, escorregões e aros', () => {
  it('golpe no pico soma 1; o segundo golpe na mesma batida escorrega, tira 1 e trava o martelo', () => {
    const e = criar('regras', 'normal')
    const d = DIF.normal
    tocarEm(e, d.primeiroPico)
    expect(e.golpes).toBe(1)
    expect(e.ev).toEqual([{ nome: 'batida', v: 0 }, { nome: 'golpe', v: 0, forca: 1 / d.meta }])
    tocarEm(e, d.primeiroPico + 0.05)
    expect(e.golpes).toBe(0)
    expect(e.ev).toEqual([{ nome: 'escorrega' }])
    // Travado: o golpe é ignorado, sem evento e sem mexer no progresso.
    tocarEm(e, d.primeiroPico + 0.05 + d.trava / 2)
    expect(e.ev).toEqual([])
    expect(e.golpes).toBe(0)
    tocarEm(e, d.primeiroPico + d.batida)
    expect(e.golpes).toBe(1)
  })

  it('golpe fora da janela escorrega; a 1/3 e a 2/3 da meta um aro solta, e o escorregão não desce abaixo dele', () => {
    const e = criar('aros', 'normal')
    const d = DIF.normal
    tocarEm(e, d.primeiroPico - d.janela - 0.02)
    expect(e.ev).toEqual([{ nome: 'escorrega' }])
    let k = 0
    const nomes: string[] = []
    while (e.soltos < 1) {
      tocarEm(e, d.primeiroPico + k++ * d.batida)
      nomes.push(...e.ev.map((v) => v.nome))
    }
    expect(nomes.filter((n) => n === 'aro')).toHaveLength(1)
    expect(e.golpes).toBe(e.limiares[0])
    tocarEm(e, d.primeiroPico + k * d.batida - 0.3)
    expect(e.ev).toEqual([{ nome: 'escorrega' }])
    expect(e.golpes).toBe(e.limiares[0])
    expect(e.limiares).toEqual([Math.round(d.meta / 3), Math.round((2 * d.meta) / 3)])
  })

  it('abre na meta; depois do fim o relógio anda, a abertura vai de 0 a 1 em 0,5 s, sem eventos e com o mesmo fim', () => {
    const e = criar('abre', 'normal')
    const d = DIF.normal
    for (let k = 0; e.fim === null; k++) tocarEm(e, d.primeiroPico + k * d.batida)
    expect(e.fim).toBe('abriu')
    expect(e.ev.map((v) => v.nome)).toContain('abriu')
    const tFim = e.t
    expect(abertura(e)).toBe(0)
    esperarAte(e, tFim + DUR_ABRIR / 2)
    expect(abertura(e)).toBeCloseTo(0.5, 1)
    expect(passo(e, TOQUE)).toBe('abriu')
    expect(e.ev).toEqual([])
    esperarAte(e, tFim + DUR_ABRIR + 0.2)
    expect(abertura(e)).toBe(1)
    expect(e.golpes).toBe(d.meta)
    for (let a = 0; a < AROS; a++) expect(brilhoEm(e, a, e.t)).toBe(0)
  })
})
