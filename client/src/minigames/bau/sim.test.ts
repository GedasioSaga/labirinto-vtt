// @vitest-environment node
/**
 * GRÁFICO DO MOVIMENTO DO BAÚ (METAS.md, seção 2): o estado amostrado a cada
 * 0,1 s pelo simular(), sem desenhar, e as propriedades da mecânica viram
 * teste. Onde a propriedade vale por passo e a amostra de 0,1 s não enxerga,
 * o teste anda passo a passo e diz por quê.
 */
import { describe, expect, it } from 'vitest'
import { simular } from '../abrir/simular'
import { DIFICULDADES, DT, LIMITE_S, SEM_ENTRADA } from '../abrir/tipos'
import { JOGO_BAU } from './jogo'
import { roboHumano, roboRuim } from './robo'
import { ABRIR_S, DIF, MAX_FECHOS, RANGE_A_CADA, abertura, amostra, criar, passo, todosAbertos } from './sim'
import type { Partida } from '../abrir/simular'
import type { Dificuldade, Politica } from '../abrir/tipos'
import type { Estado } from './sim'

/** Folga de ponto flutuante ao comparar instantes (os tempos somam DT 2.400 vezes). */
const EPS = 1e-6
/** Eventos de toque aceito: os únicos que levantam um fecho. */
const TOQUE_ACEITO = new Set(['fecho', 'segurou'])
const SEMENTES = Array.from({ length: 24 }, (_, i) => `grafico|${i}`)
/** Teto de passos de uma tentativa (20 s mais folga). */
const MAX_PASSOS = Math.ceil((LIMITE_S + 1) / DT)

const partidasDoHumano = new Map<Dificuldade, Partida[]>()
function partidas(dif: Dificuldade): Partida[] {
  let ps = partidasDoHumano.get(dif)
  if (ps === undefined) {
    ps = SEMENTES.map((s) => simular(JOGO_BAU, s, dif, roboHumano(s, dif)))
    partidasDoHumano.set(dif, ps)
  }
  return ps
}

/** Política roteirizada: no passo k toca o fecho `roteiro.get(k)`; nos outros, nada. */
function roteiro(toques: ReadonlyMap<number, number>): Politica<Estado> {
  let k = 0
  return () => {
    // Sem entrada no roteiro é o caso comum (o passo sem toque), não um buraco.
    const toque = toques.get(k) ?? -1
    k++
    return { segurando: false, toque }
  }
}

/** Instantes dos eventos `nome` no fecho `i`. */
const instantes = (p: Partida, nome: string, i: number): number[] =>
  p.eventos.filter(([, n, v]) => n === nome && v === i).map(([t]) => t)

describe('tabela DIF', () => {
  it('aviso nunca abaixo de 0,3 s, fechos que cabem e zonas em ordem', () => {
    for (const dif of DIFICULDADES) {
      const d = DIF[dif]
      expect(d.aviso).toBeGreaterThanOrEqual(0.3)
      expect(d.fechos).toBeLessThanOrEqual(MAX_FECHOS)
      expect(0 < d.limiar && d.limiar < d.cedo && d.cedo < 1).toBe(true)
    }
    expect([DIF.normal.fechos, DIF.dificil.fechos]).toEqual([3, 4])
  })

  it('um fecho teimoso por partida, caindo 1,4x mais rápido', () => {
    for (const dif of DIFICULDADES) {
      for (const s of SEMENTES) {
        const e = criar(s, dif)
        const d = DIF[dif]
        e.fechos.forEach((f, i) => {
          const fator = i === e.teimoso ? d.teimoso : 1
          expect(f.q).toBeGreaterThanOrEqual(d.queda[0] * fator - EPS)
          expect(f.q).toBeLessThan(d.queda[1] * fator + EPS)
          expect(f.a).toBe(0)
        })
      }
    }
  })
})

describe('gráfico do movimento, a cada 0,1 s', () => {
  it('entre dois toques, a abertura de um fecho só desce (até parar em 0)', () => {
    const erros: string[] = []
    for (const dif of DIFICULDADES) {
      for (const p of partidas(dif)) {
        const am = p.amostras.slice(0, -1)
        for (let k = 1; k < am.length; k++) {
          const t0 = am[k - 1].t
          const t1 = am[k].t
          for (let i = 0; i < DIF[dif].fechos; i++) {
            const tocou = p.eventos.some(([te, nome, v]) => v === i && TOQUE_ACEITO.has(nome) && te > t0 + EPS && te <= t1 + EPS)
            if (tocou) continue
            const a0 = am[k - 1].v['a' + i]
            const a1 = am[k].v['a' + i]
            if (a0 > 0 ? !(a1 < a0) : a1 !== 0) erros.push(`${dif} fecho ${i}: ${a0} -> ${a1} em ${t0}-${t1} s`)
          }
        }
      }
    }
    expect(erros).toEqual([])
  })

  it('a tampa só sobe com todos os fechos no limiar ou acima (passo a passo: a 0,1 s ela sobe e desce dentro do mesmo intervalo)', () => {
    const erros: string[] = []
    let subidas = 0
    let descidas = 0
    for (const dif of DIFICULDADES) {
      for (const s of SEMENTES.slice(0, 8)) {
        const e = criar(s, dif)
        const robo = roboHumano(s, dif)
        for (let k = 0; k < MAX_PASSOS && e.fim === null; k++) {
          const antes = e.tampa
          passo(e, robo(e))
          if (e.tampa > antes) {
            subidas++
            if (!todosAbertos(e)) erros.push(`${dif} ${s}: subiu em ${e.t.toFixed(3)} s com fecho abaixo do limiar`)
          } else if (e.tampa < antes) descidas++
          else if (todosAbertos(e) && e.tampa < 1) erros.push(`${dif} ${s}: parada em ${e.t.toFixed(3)} s com todos abertos`)
        }
      }
    }
    expect(erros).toEqual([])
    expect(subidas).toBeGreaterThan(0)
    expect(descidas).toBeGreaterThan(0)
  })

  it('toque cedo emperra: o fecho não volta a 1 enquanto preso, continua caindo e ignora toque', () => {
    // Fecho 0: abre em 0,1 s, toque cedo em 0,2 s (ainda acima do "cedo", 0,85 ou 0,8), toques a cada 0,1 s até 2 s.
    const toques = new Map<number, number>([[12, 0], [24, 0]])
    for (let k = 36; k <= 240; k += 12) toques.set(k, 0)
    for (const dif of DIFICULDADES) {
      const p = simular(JOGO_BAU, 'emperra', dif, roteiro(toques))
      const [tEmperrou] = instantes(p, 'emperrou', 0)
      expect(tEmperrou).toBeCloseTo(25 * DT, 9)
      const fimDaTrava = tEmperrou + DIF[dif].trava
      expect(instantes(p, 'fecho', 0).filter((t) => t > tEmperrou && t < fimDaTrava - DT)).toEqual([])
      expect(instantes(p, 'travado', 0).length).toBeGreaterThanOrEqual(10)
      // Solto de novo, o toque volta a valer.
      expect(instantes(p, 'fecho', 0).some((t) => t >= fimDaTrava - EPS)).toBe(true)
      // Compara só amostras vizinhas: o roteiro reabre o fecho depois e ele pode emperrar de novo.
      const am = p.amostras
      let presas = 0
      for (let k = 0; k < am.length; k++) {
        if (am[k].v.p0 !== 1) continue
        presas++
        expect(am[k].v.a0).toBeLessThan(1)
        if (k > 0 && am[k - 1].v.p0 === 1 && am[k - 1].v.a0 > 0) expect(am[k].v.a0).toBeLessThan(am[k - 1].v.a0)
      }
      expect(presas).toBeGreaterThanOrEqual(10)
    }
  })

  it('nas partidas do robô, fecho preso nunca está em 1 e nunca aceita toque', () => {
    const erros: string[] = []
    for (const dif of DIFICULDADES) {
      for (const p of partidas(dif)) {
        for (const a of p.amostras) {
          for (let i = 0; i < DIF[dif].fechos; i++) if (a.v['p' + i] === 1 && a.v['a' + i] >= 1) erros.push(`${dif} ${a.t}`)
        }
        for (let i = 0; i < DIF[dif].fechos; i++) {
          for (const te of instantes(p, 'emperrou', i)) {
            const aceitos = p.eventos.filter(([t, n, v]) => v === i && TOQUE_ACEITO.has(n) && t > te + EPS && t < te + DIF[dif].trava - DT)
            if (aceitos.length > 0) erros.push(`${dif} fecho ${i} aceitou toque preso em ${te}`)
          }
        }
      }
    }
    expect(erros).toEqual([])
  })

  it('todo solavanco tem aviso no mesmo fecho pelo menos 0,3 s antes, visível em toda amostra desse trecho', () => {
    const erros: string[] = []
    let solavancos = 0
    for (const dif of DIFICULDADES) {
      for (const p of partidas(dif)) {
        for (const [ts, nome, v] of p.eventos) {
          if (nome !== 'solavanco' || v === undefined) continue
          solavancos++
          const avisos = instantes(p, 'aviso', v).filter((t) => t < ts)
          const ta = avisos[avisos.length - 1]
          if (ta === undefined || ts - ta < 0.3 - EPS) erros.push(`${dif}: solavanco em ${ts} sem aviso de 0,3 s`)
          for (const a of p.amostras) {
            if (a.t >= ts - 0.3 + EPS && a.t < ts - EPS && (a.v.aviso !== 1 || a.v.alvo !== v)) erros.push(`${dif}: amostra ${a.t} sem aviso antes do solavanco de ${ts}`)
          }
        }
      }
    }
    expect(erros).toEqual([])
    expect(solavancos).toBeGreaterThan(10)
  })

  it('segurar o fecho em aviso cancela o solavanco e não emperra, mesmo com o fecho alto', () => {
    const e = criar('segura', 'normal')
    for (const f of e.fechos) f.a = 0.95
    e.proxAviso = 0
    passo(e, SEM_ENTRADA)
    expect(e.avisoEm).toBeGreaterThanOrEqual(0)
    const alvo = e.avisoEm
    passo(e, { segurando: false, toque: alvo })
    expect(e.ev.map((ev) => ev.nome)).toContain('segurou')
    expect(e.fechos[alvo].preso).toBe(0)
    expect(e.avisoEm).toBe(-1)
    for (let k = 0; k < 120; k++) passo(e, SEM_ENTRADA)
    expect(e.fechos[alvo].a).toBeGreaterThan(0)
  })

  it('a tampa range no máximo a cada 0,3 s, e o rangido leva a altura da tampa', () => {
    for (const dif of DIFICULDADES) {
      for (const p of partidas(dif)) {
        const ranges = p.eventos.filter(([, n]) => n === 'range')
        expect(ranges.length).toBeGreaterThan(0)
        for (let k = 1; k < ranges.length; k++) expect(ranges[k][0] - ranges[k - 1][0]).toBeGreaterThanOrEqual(RANGE_A_CADA - DT - EPS)
        for (const [, , v] of ranges) {
          expect(v).toBeGreaterThan(0)
          expect(v).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('a partida acaba em até 20 s, com qualquer jogador, e índice de fecho que não existe é ignorado', () => {
    for (const dif of DIFICULDADES) {
      for (const s of SEMENTES.slice(0, 6)) {
        const parado = simular(JOGO_BAU, s, dif, () => SEM_ENTRADA)
        expect(parado.fim).toBe('tempo')
        expect(parado.t).toBeLessThanOrEqual(LIMITE_S + DT)
        expect(parado.amostras.every((a) => a.v.tampa === 0)).toBe(true)
        for (const p of [simular(JOGO_BAU, s, dif, roboRuim(s, dif)), simular(JOGO_BAU, s, dif, () => ({ segurando: false, toque: 7 }))]) {
          expect(p.fim).not.toBeNull()
          expect(p.t).toBeLessThanOrEqual(LIMITE_S + DT)
        }
      }
      for (const p of partidas(dif)) {
        expect(p.fim).not.toBeNull()
        expect(p.t).toBeLessThanOrEqual(LIMITE_S + DT)
      }
    }
    const fora = simular(JOGO_BAU, 'fora', 'normal', () => ({ segurando: false, toque: 3 }))
    expect(fora.eventos.filter(([, n]) => n !== 'tempo')).toEqual([])
  })
})

describe('fim e animação de abrir', () => {
  it('abre com a tampa em 1; depois só o relógio anda, sem ler entrada, e a abertura vai de 0 a 1 em 0,5 s', () => {
    const e = criar('abre', 'normal')
    for (const f of e.fechos) f.a = 1
    e.tampa = 1 - 1e-6
    expect(passo(e, SEM_ENTRADA)).toBe('abriu')
    expect(e.ev[e.ev.length - 1]).toEqual({ nome: 'abriu' })
    expect(abertura(e)).toBe(0)
    const congelado = JSON.stringify(e.fechos)
    const metade = Math.round(ABRIR_S / 2 / DT)
    for (let k = 0; k < metade; k++) expect(passo(e, { segurando: false, toque: 0 })).toBe('abriu')
    expect(abertura(e)).toBeCloseTo(0.5, 6)
    for (let k = 0; k < metade + 10; k++) passo(e, { segurando: false, toque: 1 })
    expect(abertura(e)).toBe(1)
    expect(e.ev).toEqual([])
    expect(JSON.stringify(e.fechos)).toBe(congelado)
  })

  it('tempo esgotado não abre', () => {
    const e = criar('tempo', 'dificil')
    let fim = passo(e, SEM_ENTRADA)
    while (fim === null) fim = passo(e, SEM_ENTRADA)
    expect(fim).toBe('tempo')
    expect(e.t).toBeCloseTo(LIMITE_S, 6)
    for (let k = 0; k < 60; k++) passo(e, SEM_ENTRADA)
    expect(abertura(e)).toBe(0)
  })
})

describe('semente', () => {
  it('mesma semente = mesmas amostras e eventos; outra semente = outras amostras', () => {
    for (const dif of DIFICULDADES) {
      const a = simular(JOGO_BAU, 'sem|a', dif, roboHumano('sem|a', dif))
      const b = simular(JOGO_BAU, 'sem|a', dif, roboHumano('sem|a', dif))
      const c = simular(JOGO_BAU, 'sem|c', dif, roboHumano('sem|c', dif))
      expect(b.amostras).toEqual(a.amostras)
      expect(b.eventos).toEqual(a.eventos)
      expect(c.amostras).not.toEqual(a.amostras)
    }
  })

  it('a amostra tem as chaves do gráfico (a3 só no Difícil) e é um objeto novo a cada chamada', () => {
    const n = amostra(criar('x', 'normal'))
    const d = amostra(criar('x', 'dificil'))
    for (const campo of JOGO_BAU.grafico) {
      expect(campo.chave in d).toBe(true)
      expect(campo.chave in n).toBe(campo.chave !== 'a3')
    }
    const e = criar('x', 'normal')
    expect(amostra(e)).not.toBe(amostra(e))
    expect(JOGO_BAU.grafico.length).toBeGreaterThanOrEqual(3)
    expect(JOGO_BAU.grafico.length).toBeLessThanOrEqual(6)
  })
})
