import { describe, expect, it } from 'vitest'
import { gerarChart, gradeDemo, gradeImportada, hashTexto, notasDaMusica, ritmoDaMusica, rngDe, sortearPeso, type RitmoAnalisado } from './coreografia'
import { COMPASSO_DEMO, eventosDaDemo, PASSO_DEMO } from './som'
import type { MusicaDaDanca, NotaDaDanca } from './tipos'

/** O id do pino da porta que dança no protótipo: os números do README saíram desta semente. */
const PINO = 'pino-porta-que-danca'

/** O mesmo resumo do protótipo (provas/gerar-provas.cjs). */
function resumo(ns: readonly NotaDaDanca[]) {
  const tempos = ns.map((n) => n.t)
  const unicos = [...new Set(tempos)]
  let saltos = 0
  for (const t of unicos) if (tempos.filter((x) => x === t).length > 1) saltos += 1
  let gapMin = Infinity
  for (let i = 1; i < unicos.length; i += 1) gapMin = Math.min(gapMin, unicos[i] - unicos[i - 1])
  let seguidas = 1
  let maxSeguidas = 1
  for (let i = 1; i < ns.length; i += 1) {
    seguidas = ns[i].lane === ns[i - 1].lane && ns[i].t !== ns[i - 1].t ? seguidas + 1 : 1
    maxSeguidas = Math.max(maxSeguidas, seguidas)
  }
  const porComp = new Map<number, number>()
  for (const n of ns) {
    const c = Math.floor(n.t / COMPASSO_DEMO + 1e-6)
    porComp.set(c, (porComp.get(c) ?? 0) + 1)
  }
  return {
    setas: ns.length,
    saltos,
    seguradas: ns.filter((n) => n.len > 0).length,
    gapMinMs: Math.round(gapMin * 1000),
    maxMesmaSeguida: maxSeguidas,
    maxPorCompasso: Math.max(...porComp.values()),
    quadros: { 4: ns.filter((n) => n.sub === 4).length, 8: ns.filter((n) => n.sub === 8).length, 16: ns.filter((n) => n.sub === 16).length },
  }
}

describe('sorteio determinístico', () => {
  it('FNV-1a e mulberry32 dão a mesma sequência para a mesma semente', () => {
    expect(hashTexto('')).toBe(2166136261)
    expect(hashTexto('a')).toBe(hashTexto('a'))
    expect(hashTexto('a')).not.toBe(hashTexto('b'))
    const a = rngDe(42)
    const b = rngDe(42)
    const seqA = Array.from({ length: 5 }, () => a())
    expect(Array.from({ length: 5 }, () => b())).toEqual(seqA)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('peso 0 nunca sai', () => {
    const rng = rngDe(7)
    for (let i = 0; i < 200; i += 1) expect(sortearPeso(rng, ['a', 'b', 'c'], [0, 1, 0])).toBe('b')
  })
})

describe('coreografia da faixa demo', () => {
  const grade = gradeDemo()
  const div = gerarChart(grade, 'diversao', PINO)
  const exp = gerarChart(grade, 'expert', PINO)

  it('é determinística (mesma semente, mesmas setas) e muda com outra semente', () => {
    expect(gerarChart(gradeDemo(), 'diversao', PINO)).toEqual(div)
    expect(gerarChart(gradeDemo(), 'expert', PINO)).toEqual(exp)
    expect(gerarChart(grade, 'diversao', 'outro-pino')).not.toEqual(div)
    expect(gerarChart(grade, 'expert', 'outro-pino')).not.toEqual(exp)
  })

  it('Diversão: sem saltos, sem seguradas, só tempos fortes, intervalo ≥ 450 ms, ≤ 3 por compasso, nunca 4 iguais seguidas', () => {
    const r = resumo(div)
    expect(r.saltos).toBe(0)
    expect(r.seguradas).toBe(0)
    expect(r.quadros[8]).toBe(0)
    expect(r.quadros[16]).toBe(0)
    expect(r.gapMinMs).toBeGreaterThanOrEqual(450)
    expect(r.maxPorCompasso).toBeLessThanOrEqual(3)
    expect(r.maxMesmaSeguida).toBeLessThanOrEqual(3)
  })

  it('Expert: tem saltos, seguradas e colcheias/semicolcheias, e nunca 4 iguais seguidas', () => {
    const r = resumo(exp)
    expect(r.saltos).toBeGreaterThan(0)
    expect(r.seguradas).toBeGreaterThan(0)
    expect(r.quadros[8]).toBeGreaterThan(0)
    expect(r.quadros[16]).toBeGreaterThan(0)
    expect(r.maxMesmaSeguida).toBeLessThanOrEqual(3)
    expect(r.gapMinMs).toBeGreaterThanOrEqual(100)
  })

  it('bate com os números do protótipo (README): 61 setas na Diversão; 158, 5 saltos e 5 seguradas no Expert', () => {
    expect(resumo(div).setas).toBe(61)
    const r = resumo(exp)
    expect(r.setas).toBe(158)
    expect(r.saltos).toBe(5)
    expect(r.seguradas).toBe(5)
  })

  it('toda seta cai num ataque que a música toca', () => {
    const ataques = new Set(eventosDaDemo().filter((e) => e.inst !== 'chimbal' && e.inst !== 'baqueta').map((e) => e.t.toFixed(6)))
    for (const n of [...div, ...exp]) expect(ataques.has(n.t.toFixed(6)), `seta em ${n.t}`).toBe(true)
  })

  it('não põe seta na contagem e respeita a trilha ocupada pela segurada', () => {
    for (const n of exp) expect(n.t).toBeGreaterThanOrEqual(COMPASSO_DEMO)
    for (const s of exp.filter((n) => n.len > 0)) {
      const dentro = exp.filter((n) => n !== s && n.lane === s.lane && n.t >= s.t && n.t <= s.t + s.len)
      expect(dentro).toEqual([])
    }
  })
})

describe('música do pino', () => {
  it('demo: setas geradas aqui, batida da faixa demo', () => {
    const demo: MusicaDaDanca = { tipo: 'demo' }
    expect(notasDaMusica(demo, 'expert', PINO)).toEqual(gerarChart(gradeDemo(), 'expert', PINO))
    expect(ritmoDaMusica(demo)).toEqual({ batidaS: PASSO_DEMO * 4, grade0: 0, fase4: 0 })
  })

  it('importada: setas prontas do pino, nunca recalculadas', () => {
    const pronta: NotaDaDanca[] = [{ t: 1, lane: 2, len: 0, sub: 4 }]
    const musica: MusicaDaDanca = {
      tipo: 'arquivo',
      midia: 'midia:abc.mp3',
      nome: 'Teste',
      bpm: 120,
      primeiraBatida: 0.5,
      fase4: 1,
      duracaoS: 30,
      coreografias: { diversao: pronta, expert: [] },
    }
    expect(notasDaMusica(musica, 'diversao', PINO)).toBe(pronta)
    expect(ritmoDaMusica(musica)).toEqual({ batidaS: 0.5, grade0: 0.5, fase4: 1 })
  })
})

describe('grade da música importada', () => {
  /** Análise de mentira: batida a 120 BPM a partir de 0,5 s, ataque forte em cada batida e mais forte no começo do compasso. */
  function analiseFalsa(): RitmoAnalisado {
    const hopS = 0.01
    const duracao = 20
    const quadros = Math.round(duracao / hopS)
    const env = new Float32Array(quadros)
    const rms = new Float32Array(quadros).fill(0.2)
    for (let k = 0; 0.5 + k * 0.5 < duracao; k += 1) env[Math.round((0.5 + k * 0.5) / hopS)] = k % 4 === 0 ? 1 : 0.6
    return { periodo: 0.5, primeiraBatida: 0.5, fase4: 0, duracao, env, rms, hopS }
  }

  it('põe 4 pontos por batida (semínima, semicolcheia, colcheia, semicolcheia) até 0,8 s antes do fim', () => {
    const pts = gradeImportada(analiseFalsa())
    expect(pts[0].t).toBe(0.5)
    expect(pts.slice(0, 4).map((p) => p.sub)).toEqual([4, 16, 8, 16])
    expect(pts[pts.length - 1].t).toBeLessThanOrEqual(20 - 0.8)
    for (let i = 1; i < pts.length; i += 1) expect(pts[i].t - pts[i - 1].t).toBeCloseTo(0.125, 9)
  })

  it('força 0-1 puxada pelo ataque; destaque só em cabeça de compasso, no máximo um a cada 4 compassos', () => {
    const pts = gradeImportada(analiseFalsa())
    for (const p of pts) {
      expect(p.forca).toBeGreaterThanOrEqual(0)
      expect(p.forca).toBeLessThanOrEqual(1)
    }
    const destaques = pts.filter((p) => p.destaque)
    expect(destaques.length).toBeGreaterThan(0)
    for (const d of destaques) expect(d.sub).toBe(4)
    for (let i = 1; i < destaques.length; i += 1) expect(destaques[i].t - destaques[i - 1].t).toBeGreaterThanOrEqual(16 * 0.5 - 0.01)
  })

  it('gera coreografia nas duas dificuldades com a grade importada', () => {
    const pts = gradeImportada(analiseFalsa())
    const div = gerarChart(pts, 'diversao', PINO)
    const exp = gerarChart(pts, 'expert', PINO)
    expect(div.length).toBeGreaterThan(10)
    expect(exp.length).toBeGreaterThanOrEqual(div.length)
    for (const n of div) expect(n.sub).toBe(4)
  })
})
