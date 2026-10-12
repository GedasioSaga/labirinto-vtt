import { DIF, type SubdivisaoDanca } from './regras'
import { eventosDaDemo, PASSO_DEMO, type Instrumento } from './som'
import type { DificuldadeDanca, MusicaDaDanca, NotaDaDanca, TrilhaDanca } from './tipos'

/**
 * COREOGRAFIA: onde caem as setas. Primeiro a grade (cada ponto da música que
 * pode virar seta, com a força do ataque), depois `gerarChart` sorteia as
 * trilhas com semente = id do pino + dificuldade. Mesma semente, mesmas setas
 * em qualquer aparelho: a coreografia nunca depende de relógio nem de rede.
 */

// ------------------------------------------------------------------ sorteio determinístico

/** FNV-1a de 32 bits: transforma a semente em texto num inteiro. */
export function hashTexto(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

/** mulberry32: mesma semente, mesma sequência, em qualquer aparelho. */
export function rngDe(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Sorteia um item com chance proporcional ao peso; peso 0 nunca sai. */
export function sortearPeso<T>(rng: () => number, itens: readonly T[], pesos: readonly number[]): T {
  let tot = 0
  for (const p of pesos) tot += p
  let r = rng() * tot
  for (let i = 0; i < itens.length; i += 1) {
    r -= pesos[i]
    if (r < 0 && pesos[i] > 0) return itens[i]
  }
  for (let i = itens.length - 1; i >= 0; i -= 1) if (pesos[i] > 0) return itens[i]
  return itens[itens.length - 1]
}

// ------------------------------------------------------------------ grade

/** Um ponto da música que pode virar seta. */
export interface PontoDaGrade {
  t: number
  sub: SubdivisaoDanca
  /** Força do ataque, 0-1: decide se o ponto passa no limiar da dificuldade. */
  forca: number
  /** Quanto a nota que começa aqui dura, em s; ≥ 1,5 batida vira segurada no Expert. */
  sustain: number
  /** Começo de seção (prato): onde o Expert põe salto. */
  destaque: boolean
  /** Duração de uma batida, em s. */
  beatS: number
  compasso: number
}

/** Quanto cada instrumento da demo pesa como "lugar de seta". */
const PESO_INST: Readonly<Record<Instrumento, number>> = {
  bumbo: 1,
  caixa: 0.9,
  palma: 0.85,
  prato: 0.2,
  baixo: 0.55,
  melodia: 0.62,
  batida: 0.3,
  chimbal: 0.15,
  tapete: 0,
  baqueta: 0,
}
/** A caixa mais forte da demo toca a 0,9: ela é a referência da força 1. */
const CAIXA_CHEIA = 0.9
/** Compasso que abre a pausa da demo com o tapete: vale como começo de seção. */
const COMPASSO_DO_TAPETE_DESTAQUE = 13

const subDoPasso = (p: number): SubdivisaoDanca => (p % 4 === 0 ? 4 : p % 2 === 0 ? 8 : 16)

/** Faixa demo: cada semicolcheia onde a música toca algo vira posição, com a força do instrumento mais forte. */
export function gradeDemo(): PontoDaGrade[] {
  const beatS = PASSO_DEMO * 4
  const porPasso = new Map<number, PontoDaGrade>()
  for (const e of eventosDaDemo()) {
    if (e.c === 0) continue
    const k = e.c * 16 + e.p
    let g = porPasso.get(k)
    if (g === undefined) {
      g = { t: e.t, sub: subDoPasso(e.p), forca: 0, sustain: 0, destaque: false, beatS, compasso: e.c }
      porPasso.set(k, g)
    }
    const w = PESO_INST[e.inst] * (e.inst === 'caixa' ? Math.min(1, e.v / CAIXA_CHEIA) : 1)
    g.forca = Math.min(1, Math.max(g.forca, w))
    if (e.inst === 'prato' || (e.inst === 'tapete' && e.c === COMPASSO_DO_TAPETE_DESTAQUE)) g.destaque = true
    if (e.inst === 'baixo' && e.dur) g.sustain = Math.max(g.sustain, e.dur)
  }
  return Array.from(porPasso.values()).sort((a, b) => a.t - b.t)
}

/** O que a grade da música importada precisa da análise (`analise.ts`). */
export interface RitmoAnalisado {
  /** Duração de uma batida, em s. */
  periodo: number
  primeiraBatida: number
  /** Qual batida (0-3) abre o compasso. */
  fase4: number
  duracao: number
  /** Fluxo de ataques por quadro de `hopS` segundos. */
  env: Float32Array
  /** Energia por quadro, para saber se a nota segue soando. */
  rms: Float32Array
  hopS: number
}

/** O fim da música importada não ganha seta: a última fica 0,8 s antes do fim. */
const FOLGA_DO_FIM_S = 0.8
/** Raio em volta do ponto onde se procura o pico do ataque. */
const RAIO_DO_PICO_S = 0.035
/** A força 1 é o percentil 95 dos picos: um estouro isolado não achata o resto. */
const PERCENTIL_DA_REFERENCIA = 0.95
const FORCA_DO_DESTAQUE = 0.95
/** Um destaque a cada 4 compassos, no máximo. */
const BATIDAS_ENTRE_DESTAQUES = 16
const FORCA_DA_NOTA_LONGA = 0.5
const FORCA_QUE_CORTA_A_NOTA = 0.4
/** A nota "segue soando" se a energia depois do ataque fica em pelo menos 45% da do ataque. */
const ENERGIA_QUE_SEGUE = 0.45
const BEIRA_DO_ATAQUE_S = 0.06

interface PontoBruto extends PontoDaGrade {
  bruto: number
  /** Posição da batida no compasso (0 = cabeça); -1 fora da cabeça da batida. */
  noCompasso: number
}

/** Música importada: a grade da batida detectada, puxada pela força do ataque em cada ponto. */
export function gradeImportada(an: RitmoAnalisado): PontoDaGrade[] {
  const P = an.periodo
  const fim = an.duracao - FOLGA_DO_FIM_S
  const pts: PontoBruto[] = []
  const pico = (t: number): number => {
    const a = Math.max(0, Math.floor((t - RAIO_DO_PICO_S) / an.hopS))
    const b = Math.min(an.env.length - 1, Math.ceil((t + RAIO_DO_PICO_S) / an.hopS))
    let m = 0
    for (let i = a; i <= b; i += 1) if (an.env[i] > m) m = an.env[i]
    return m
  }
  const rmsEm = (t0: number, t1: number): number => {
    const a = Math.max(0, Math.floor(t0 / an.hopS))
    const b = Math.min(an.rms.length - 1, Math.ceil(t1 / an.hopS))
    let s = 0
    let c = 0
    for (let i = a; i <= b; i += 1) {
      s += an.rms[i]
      c += 1
    }
    return c ? s / c : 0
  }
  for (let k = 0; ; k += 1) {
    const tb = an.primeiraBatida + k * P
    if (tb > fim) break
    const noCompasso = (((k - an.fase4) % 4) + 4) % 4
    for (let s = 0; s < 4; s += 1) {
      const t = tb + (s * P) / 4
      if (t > fim) break
      pts.push({
        t,
        sub: s === 0 ? 4 : s === 2 ? 8 : 16,
        bruto: pico(t),
        forca: 0,
        sustain: 0,
        destaque: false,
        beatS: P,
        // +4000 batidas: o compasso nunca fica negativo antes da fase.
        compasso: Math.floor((k - an.fase4 + 4000) / 4),
        noCompasso: s === 0 ? noCompasso : -1,
      })
    }
  }
  const ord = pts.map((p) => p.bruto).sort((a, b) => a - b)
  const ref = ord[Math.floor(ord.length * PERCENTIL_DA_REFERENCIA)] || 1
  for (const p of pts) p.forca = Math.min(1, p.bruto / ref)
  let ultimoDest = -1e9
  for (const p of pts) {
    if (p.noCompasso === 0 && p.forca >= FORCA_DO_DESTAQUE && p.t - ultimoDest >= BATIDAS_ENTRE_DESTAQUES * P - 0.01) {
      p.destaque = true
      ultimoDest = p.t
    }
  }
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]
    if (p.forca < FORCA_DA_NOTA_LONGA) continue
    let j = i + 1
    while (j < pts.length && pts[j].forca < FORCA_QUE_CORTA_A_NOTA) j += 1
    const prox = j < pts.length ? pts[j].t : fim
    const calma = prox - p.t
    const segue = rmsEm(p.t + BEIRA_DO_ATAQUE_S, prox - BEIRA_DO_ATAQUE_S) >= ENERGIA_QUE_SEGUE * rmsEm(p.t, p.t + BEIRA_DO_ATAQUE_S)
    if (calma >= 1.5 * P && segue) p.sustain = calma
  }
  return pts.map(({ t, sub, forca, sustain, destaque, beatS, compasso }) => ({ t, sub, forca, sustain, destaque, beatS, compasso }))
}

// ------------------------------------------------------------------ coreografia

/** Pares de trilhas do salto; ←+→ é o mais comum. */
export const SALTOS: readonly (readonly [TrilhaDanca, TrilhaDanca])[] = [[0, 3], [1, 2], [0, 2], [1, 3], [0, 1], [2, 3]]
const PESOS_SALTO: readonly number[] = [5, 3, 1, 1, 1, 1]
const TRILHAS: readonly TrilhaDanca[] = [0, 1, 2, 3]
/** Pé esquerdo usa ← ↓ ↑; o direito, → ↓ ↑: a coreografia alterna os pés. */
const TRILHAS_DO_PE: readonly (readonly TrilhaDanca[])[] = [[0, 1, 2], [3, 1, 2]]
/** A trilha de fora (← ou →) sai mais que as do meio. */
const PESO_BASE: readonly number[] = [3, 2, 2]
/** Abaixo disto entre setas, a mesma trilha não se repete (seria tremedeira no dedo). */
const RAPIDO_S = 0.2
const PESO_TERCEIRA_IGUAL_DIVERSAO = 0.15
const PESO_REPETIDA = 0.4
/** A trilha da segurada fica ocupada até um pouco depois do fim dela. */
const FOLGA_DA_SEGURADA_S = 0.08
const FOLGA_DE_LIVRE_S = 0.02
const SEGURADA_MAX_BATIDAS = 8

/**
 * Coreografia determinística: mesma semente (pino + dificuldade), mesmas setas
 * para todo mundo. `semente` é o id do pino; a dificuldade entra no hash aqui.
 */
export function gerarChart(grade: readonly PontoDaGrade[], dif: DificuldadeDanca, semente: string): NotaDaDanca[] {
  const rng = rngDe(hashTexto(semente + '|' + dif))
  const cands = dif === 'diversao' ? candidatosDaDiversao(grade, rng) : candidatosDoExpert(grade)
  const notas: NotaDaDanca[] = []
  const ocupada = [-1, -1, -1, -1]
  /** Trilhas já usadas, em ordem; -1 marca um salto. */
  const hist: number[] = []
  let pe = rng() < 0.5 ? 0 : 1
  let ultT = -1e9
  for (const g of cands) {
    const livre = (l: TrilhaDanca): boolean => ocupada[l] < g.t - FOLGA_DE_LIVRE_S
    if (dif === 'expert' && g.destaque) {
      const pesos = SALTOS.map((s, i) => (livre(s[0]) && livre(s[1]) ? PESOS_SALTO[i] : 0))
      if (pesos.some((p) => p > 0)) {
        for (const l of sortearPeso(rng, SALTOS, pesos)) notas.push({ t: g.t, lane: l, len: 0, sub: g.sub })
        hist.push(-1)
        ultT = g.t
        continue
      }
    }
    pe = 1 - pe
    let cand: readonly TrilhaDanca[] = TRILHAS_DO_PE[pe]
    const rapido = g.t - ultT < RAPIDO_S
    const n = hist.length
    const quartaIgual = (l: TrilhaDanca): boolean => n >= 3 && hist[n - 1] === l && hist[n - 2] === l && hist[n - 3] === l
    let pesos = cand.map((l, i) => {
      if (!livre(l)) return 0
      if (quartaIgual(l)) return 0
      if (rapido && hist[n - 1] === l) return 0
      if (dif === 'diversao' && n >= 2 && hist[n - 1] === l && hist[n - 2] === l) return PESO_BASE[i] * PESO_TERCEIRA_IGUAL_DIVERSAO
      if (n && hist[n - 1] === l) return PESO_BASE[i] * PESO_REPETIDA
      return PESO_BASE[i]
    })
    if (pesos.every((p) => p === 0)) {
      cand = TRILHAS.filter((l) => livre(l) && !quartaIgual(l))
      if (!cand.length) continue
      pesos = cand.map(() => 1)
    }
    const lane = sortearPeso(rng, cand, pesos)
    let len = 0
    if (dif === 'expert' && g.sustain >= 1.5 * g.beatS) len = Math.min(g.sustain, SEGURADA_MAX_BATIDAS * g.beatS) - g.beatS / 2
    if (len > 0) ocupada[lane] = g.t + len + FOLGA_DA_SEGURADA_S
    notas.push({ t: g.t, lane, len, sub: g.sub })
    hist.push(lane)
    ultT = g.t
  }
  return notas
}

/** Diversão: só tempos fortes acima do limiar, as N mais fortes por compasso, com intervalo mínimo. */
function candidatosDaDiversao(grade: readonly PontoDaGrade[], rng: () => number): PontoDaGrade[] {
  const d = DIF.diversao
  const porComp = new Map<number, { g: PontoDaGrade; r: number }[]>()
  for (const g of grade) {
    if (g.sub !== 4 || g.forca < d.limiar[4]) continue
    const l = porComp.get(g.compasso) ?? []
    l.push({ g, r: rng() })
    porComp.set(g.compasso, l)
  }
  const cands: PontoDaGrade[] = []
  for (const l of porComp.values()) {
    // Empate de força desempata pelo sorteio: a escolha muda com a semente, nunca com a ordem da grade.
    l.sort((a, b) => b.g.forca - a.g.forca || a.r - b.r)
    for (const x of l.slice(0, d.porCompasso)) cands.push(x.g)
  }
  cands.sort((a, b) => a.t - b.t)
  const fil: PontoDaGrade[] = []
  let ult = -1e9
  for (const g of cands) {
    if (g.t - ult < Math.max(d.gapMin, g.beatS * 0.98)) continue
    fil.push(g)
    ult = g.t
  }
  return fil
}

/** Expert: cada divisão com o próprio limiar, intervalo mínimo e no máximo 8 semicolcheias seguidas. */
function candidatosDoExpert(grade: readonly PontoDaGrade[]): PontoDaGrade[] {
  const d = DIF.expert
  const cands: PontoDaGrade[] = []
  let ult = -1e9
  let corrida = 0
  for (const g of grade) {
    if (g.forca < d.limiar[g.sub]) continue
    const gap = g.t - ult
    if (gap < Math.max(d.gapMin, (g.beatS / 4) * 0.98)) continue
    if (gap < g.beatS * 0.3) {
      corrida += 1
      if (corrida >= d.corrida) continue
    } else corrida = 0
    cands.push(g)
    ult = g.t
  }
  return cands
}

// ------------------------------------------------------------------ da música do pino para o jogo

/** O tempo da pista: duração da batida, onde cai a primeira e qual abre o compasso (linhas fortes). */
export interface RitmoDaPista {
  batidaS: number
  grade0: number
  fase4: number
}

export function ritmoDaMusica(musica: MusicaDaDanca): RitmoDaPista {
  if (musica.tipo === 'demo') return { batidaS: PASSO_DEMO * 4, grade0: 0, fase4: 0 }
  return { batidaS: 60 / musica.bpm, grade0: musica.primeiraBatida, fase4: musica.fase4 }
}

/**
 * As setas que este aparelho vai dançar. A demo é gerada aqui (determinística);
 * a importada vem pronta do pino, calculada uma vez no mestre.
 */
export function notasDaMusica(musica: MusicaDaDanca, dif: DificuldadeDanca, semente: string): NotaDaDanca[] {
  if (musica.tipo === 'demo') return gerarChart(gradeDemo(), dif, semente)
  return musica.coreografias[dif]
}
