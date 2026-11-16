/**
 * SIMULAÇÃO SEM TELA: roda uma tentativa inteira com uma política (robô) e
 * amostra o estado a cada 0,1 s, sem renderizar. É o "gráfico do movimento"
 * dos testes e a base dos números do robô (METAS.md, seções 1 e 2).
 */
import { DT, LIMITE_S, PASSOS_POR_AMOSTRA, SEM_ENTRADA, type Dificuldade, type Fim, type JogoDeAbrir, type Politica } from './tipos'

export interface AmostraNoTempo {
  /** Instante da amostra, em s, arredondado a 0,1. */
  t: number
  v: Readonly<Record<string, number>>
}

export interface Partida {
  fim: Fim | null
  /** Tempo em que a tentativa acabou, em s. */
  t: number
  amostras: AmostraNoTempo[]
  /** [instante em s, nome do evento, v] de cada evento, em ordem. */
  eventos: [number, string, number | undefined][]
}

/** Folga depois do teto: a simulação sempre termina, mesmo com jogo quebrado. */
const FOLGA_S = 1

export function simular<E>(
  jogo: JogoDeAbrir<E>, semente: string, dif: Dificuldade, politica: Politica<E>,
  opcoes: { posFimS?: number } = {},
): Partida {
  const e = jogo.criar(semente, dif)
  const amostras: AmostraNoTempo[] = []
  const eventos: Partida['eventos'] = []
  let fim: Fim | null = null
  let i = 0
  const maxPassos = Math.ceil((LIMITE_S + FOLGA_S) / DT)
  for (; i < maxPassos && fim === null; i++) {
    if (i % PASSOS_POR_AMOSTRA === 0) amostras.push({ t: Math.round(jogo.tempo(e) * 10) / 10, v: jogo.amostra(e) })
    fim = jogo.passo(e, politica(e))
    for (const ev of jogo.eventos(e)) eventos.push([jogo.tempo(e), ev.nome, ev.v])
  }
  const tFim = jogo.tempo(e)
  // Depois do fim, a animação de abrir continua (para a folha de contato e o gráfico).
  const pos = Math.ceil((opcoes.posFimS ?? 0) / DT)
  for (let k = 0; k < pos; k++, i++) {
    if (i % PASSOS_POR_AMOSTRA === 0) amostras.push({ t: Math.round(jogo.tempo(e) * 10) / 10, v: jogo.amostra(e) })
    jogo.passo(e, SEM_ENTRADA)
    for (const ev of jogo.eventos(e)) eventos.push([jogo.tempo(e), ev.nome, ev.v])
  }
  amostras.push({ t: Math.round(jogo.tempo(e) * 1000) / 1000, v: jogo.amostra(e) })
  return { fim, t: tFim, amostras, eventos }
}

export interface Placar {
  partidas: number
  vitorias: number
  taxa: number
  /** Mediana do tempo das vitórias, em s (NaN sem vitória). */
  medianaVitoriaS: number
  temposDeVitoria: number[]
}

/** Mediana de uma lista de números (NaN se vazia). */
export function mediana(xs: readonly number[]): number {
  if (xs.length === 0) return NaN
  const o = [...xs].sort((a, b) => a - b)
  const m = o.length >> 1
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

/**
 * Placar do robô: `n` partidas com sementes fixas `robo|<jogo>|<dif>|<i>`
 * (METAS.md, seção 1). `qual` escolhe o robô humano ou o ruim.
 */
export function placar<E>(jogo: JogoDeAbrir<E>, dif: Dificuldade, qual: 'humano' | 'ruim', n = 400): Placar {
  const tempos: number[] = []
  for (let i = 0; i < n; i++) {
    const semente = `robo|${jogo.id}|${dif}|${i}`
    const politica = qual === 'humano' ? jogo.roboHumano(semente, dif) : jogo.roboRuim(semente, dif)
    const p = simular(jogo, semente, dif, politica)
    if (p.fim === 'abriu' && p.t <= LIMITE_S) tempos.push(p.t)
  }
  return { partidas: n, vitorias: tempos.length, taxa: tempos.length / n, medianaVitoriaS: mediana(tempos), temposDeVitoria: tempos }
}
