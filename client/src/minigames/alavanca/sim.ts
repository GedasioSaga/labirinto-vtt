/**
 * O MOTOR DA ALAVANCA DA PONTE: a simulação pura do protótipo aprovado
 * (`docs/design/minigames/alavanca-da-ponte.html`, bloco SIM), passo a passo
 * e com os MESMOS números. Sem DOM, sem áudio, passo fixo: o host roda a
 * partida com ele (`net/alavancaNoHost.ts`), o painel do mestre estima a
 * chance com o robô que joga como gente, e as provas rodam o mesmo código.
 *
 * Calibrado com o robô humano (400 partidas, 20/11/2026): Fácil 94%,
 * Normal 72%, Difícil 35%; Normal com 3 jogadores, 100%.
 */
import type { DificuldadeAlavanca } from './tipos'

export const DT = 1 / 120
/** 1/s: cada giro empurra a ponte por ~60 ms, não de uma vez. */
export const AMORT = 16
/** Voltas da manivela da ponte erguida até baixada. */
export const VOLTAS = 6
/** Dentes da catraca por volta. */
export const DENTES = 12
/** s da lingueta começar a soltar até soltar de todo. */
export const RAMPA_SOLTA = 0.35
/** Em equipe cada aperto vale passo / n^0,6: n jogadores giram n^0,4 vezes mais rápido que um. */
export const EXPOENTE_EQUIPE = 0.6
/** Gente para de vez em quando (ajeitar a mão, olhar). */
const PAUSAS_POR_S = 0.12

/**
 * passo: quanto da ponte desce por giro (1 jogador); puxaBase e puxaFundo: a
 * corrente puxa de volta (por segundo), mais forte perto do chão; folga: s
 * sem giro até a catraca soltar; solta: puxada a mais com a catraca solta.
 */
export interface NumerosDaDificuldade {
  nome: string
  tempo: number
  passo: number
  puxaBase: number
  puxaFundo: number
  folga: number
  solta: number
}

export const DIF: Readonly<Record<DificuldadeAlavanca, NumerosDaDificuldade>> = {
  facil: { nome: 'Fácil', tempo: 20, passo: 0.03, puxaBase: 0.04, puxaFundo: 0.078, folga: 0.6, solta: 0.2 },
  normal: { nome: 'Normal', tempo: 16, passo: 0.03, puxaBase: 0.04, puxaFundo: 0.09, folga: 0.45, solta: 0.3 },
  dificil: { nome: 'Difícil', tempo: 15, passo: 0.028, puxaBase: 0.05, puxaFundo: 0.085, folga: 0.38, solta: 0.4 },
}

export interface ConfigDaRodada {
  dif: DificuldadeAlavanca
  jogadores: number
  /** `null` = o tempo da dificuldade. */
  tempo: number | null
}

export interface Regras extends NumerosDaDificuldade {
  dif: DificuldadeAlavanca
  n: number
  /** O passo de CADA aperto com `n` girando juntos. */
  passoJ: number
}

export type NomeDoEvento = 'giro' | 'pegou' | 'soltou' | 'dente' | 'volta' | 'baixou' | 'subiu'

export interface EventoDaRodada {
  t: number
  nome: NomeDoEvento
  /** Só no `giro`: quem girou. */
  j?: number
}

export type FaseDaPartida = 'rodada' | 'baixou' | 'subiu' | 'encerrado'

export interface Partida {
  R: Regras
  t: number
  k: number
  /** Quanto a ponte desceu, de 0 (erguida) a 1 (assentada). */
  p: number
  v: number
  vel: number
  semGiro: number
  /** A catraca soltando: 0 presa, 1 solta de todo. */
  solta: number
  forca: number
  fase: FaseDaPartida
  giros: number[]
  dente: number
  ev: EventoDaRodada[]
  tFim: number | null
  soltou: number
  maiorPausa: number
  pMax: number
}

function xmur3(s: string): () => number {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}

function mulberry32(semente: number): () => number {
  let a = semente
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Gerador determinístico: mesma semente, mesma sequência (a mesma do protótipo). */
export function criarRng(semente: string | number): () => number {
  return mulberry32(xmur3(String(semente))())
}

function gauss(rng: () => number): number {
  let u = 0
  while (u === 0) u = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

const limitar = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))

export function regras(cfg: ConfigDaRodada): Regras {
  const D = DIF[cfg.dif]
  const n = limitar(Math.round(cfg.jogadores), 1, 4)
  const tempo = cfg.tempo !== null && cfg.tempo > 0 ? cfg.tempo : D.tempo
  return { ...D, dif: cfg.dif, n, tempo, passoJ: D.passo / Math.pow(n, EXPOENTE_EQUIPE) }
}

export const puxada = (R: Regras, p: number, solta: number): number => R.puxaBase + R.puxaFundo * p + R.solta * solta
export const forcaMax = (R: Regras): number => R.puxaBase + R.puxaFundo + R.solta

export function criarPartida(cfg: ConfigDaRodada): Partida {
  const R = regras(cfg)
  return {
    R,
    t: 0,
    k: 0,
    p: 0,
    v: 0,
    vel: 0,
    semGiro: 0,
    solta: 0,
    forca: puxada(R, 0, 0),
    fase: 'rodada',
    giros: Array.from({ length: R.n }, () => 0),
    dente: 0,
    ev: [],
    tFim: null,
    soltou: 0,
    maiorPausa: 0,
    pMax: 0,
  }
}

/** Um passo de `DT`. `quem`: índices dos jogadores que giraram neste passo (pode repetir). */
export function passo(P: Partida, quem: readonly number[]): void {
  if (P.fase !== 'rodada') return
  const R = P.R
  if (quem.length > 0) {
    for (const j of quem) {
      P.v += R.passoJ * AMORT
      P.giros[j] = (P.giros[j] ?? 0) + 1
      P.ev.push({ t: P.t, nome: 'giro', j })
    }
    if (P.solta > 0) P.ev.push({ t: P.t, nome: 'pegou' })
    P.maiorPausa = Math.max(P.maiorPausa, P.semGiro)
    P.semGiro = 0
    P.solta = 0
  } else {
    P.semGiro += DT
    if (P.semGiro > R.folga) {
      if (P.solta === 0) {
        P.soltou++
        P.ev.push({ t: P.t, nome: 'soltou' })
      }
      P.solta = Math.min(1, (P.semGiro - R.folga) / RAMPA_SOLTA)
    }
  }
  P.forca = puxada(R, P.p, P.solta)
  const antes = P.p
  P.p += (P.v - P.forca) * DT
  P.v *= Math.exp(-AMORT * DT)
  if (P.p < 0) P.p = 0
  P.vel = (P.p - antes) / DT
  P.t = (P.k + 1) * DT
  P.k++
  const d = Math.floor(Math.min(1, P.p) * VOLTAS * DENTES + 1e-9)
  if (d > P.dente) for (let i = P.dente; i < d; i++) P.ev.push({ t: P.t, nome: 'dente' })
  else if (d < P.dente && P.solta > 0.25) for (let i = d; i < P.dente; i++) P.ev.push({ t: P.t, nome: 'volta' })
  P.dente = d
  if (P.p >= 1) {
    P.p = 1
    P.vel = 0
    P.fase = 'baixou'
    P.tFim = P.t
    P.ev.push({ t: P.t, nome: 'baixou' })
  } else if (P.k >= Math.round(R.tempo / DT)) {
    P.fase = 'subiu'
    P.tFim = P.t
    P.ev.push({ t: P.t, nome: 'subiu' })
  }
  P.pMax = Math.max(P.pMax, P.p)
}

/** Quem aperta: o robô decide, a cada passo, se gira agora. */
export interface Robo {
  tipo: 'humano' | 'metronomo'
  ritmo: number
  reacoes: number[]
  decidir(t: number): boolean
}

/** Robô que joga como gente: reação ~250 ms (desvio ~60 ms, mínimo 130 ms), ritmo próprio, cansaço, pausas. */
export function criarHumano(semente: string): Robo {
  const rng = criarRng(semente)
  const reacao = () => Math.max(0.13, 0.25 + 0.06 * gauss(rng))
  const ritmo = limitar(6.4 + 0.8 * gauss(rng), 4.6, 8.6)
  const fadiga = 0.06 + 0.14 * rng()
  const r0 = reacao()
  const reacoes = [r0]
  let prox = r0
  return {
    tipo: 'humano',
    ritmo,
    reacoes,
    decidir(t) {
      if (t + 1e-9 < prox) return false
      const agora = ritmo * (1 - fadiga * Math.min(1, t / 15))
      let intervalo = Math.exp(0.16 * gauss(rng) - 0.0128) / agora
      if (rng() < PAUSAS_POR_S / agora) {
        const re = reacao()
        reacoes.push(re)
        intervalo += 0.15 + 0.3 * rng() + re
      }
      prox += intervalo
      return true
    },
  }
}

/** Robô metrônomo: gira exatamente `hz` vezes por segundo depois de `atraso`. */
export function criarMetronomo(hz: number, atraso = 0.25): Robo {
  let prox = atraso
  return {
    tipo: 'metronomo',
    ritmo: hz,
    reacoes: [],
    decidir(t) {
      if (t + 1e-9 < prox) return false
      prox += 1 / hz
      return true
    },
  }
}

export interface ResultadoDaSimulacao {
  venceu: boolean
  fase: FaseDaPartida
  tFim: number | null
  pMax: number
  pFim: number
  giros: number[]
  soltou: number
  maiorPausa: number
  reacoes: number[]
  ritmos: number[]
}

/** Uma partida inteira com robôs (os humanos da semente, se nenhum for dado). */
export function simular(cfg: ConfigDaRodada, semente: string, robos?: readonly Robo[]): ResultadoDaSimulacao {
  const P = criarPartida(cfg)
  const quemJoga = robos ?? Array.from({ length: P.R.n }, (_, j) => criarHumano(`${semente}|j${j}`))
  const quem: number[] = []
  while (P.fase === 'rodada') {
    quem.length = 0
    for (let j = 0; j < quemJoga.length; j++) if (quemJoga[j].decidir(P.t)) quem.push(j)
    passo(P, quem)
    // Só o resultado importa aqui: os eventos não se acumulam numa estimativa de 200 partidas.
    P.ev.length = 0
  }
  return {
    venceu: P.fase === 'baixou',
    fase: P.fase,
    tFim: P.tFim,
    pMax: P.pMax,
    pFim: P.p,
    giros: P.giros.slice(),
    soltou: P.soltou,
    maiorPausa: P.maiorPausa,
    reacoes: quemJoga.flatMap((r) => r.reacoes),
    ritmos: quemJoga.map((r) => r.ritmo),
  }
}

/** A chance de vitória que o mestre vê: `n` partidas do robô que joga como gente (a mesma conta do protótipo). */
export function estimar(cfg: ConfigDaRodada, n = 200, prefixo = 'estimativa'): number {
  let v = 0
  for (let i = 0; i < n; i++) if (simular(cfg, `${prefixo}|${cfg.dif}|${cfg.jogadores}|${cfg.tempo ?? ''}|${i}`).venceu) v++
  return v / n
}
