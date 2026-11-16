/**
 * ROBÔS DO BAÚ: o humano, que joga como gente (METAS.md, seção 1), e o ruim,
 * que toca fechos ao acaso sem olhar.
 *
 * O humano só enxerga o jogo pelo `Olho` (a amostra atrasada 250 ± 60 ms,
 * relida a cada 0,15 s, com erro de leitura ± 0,03) e sabe sem atraso só o que
 * a própria mão fez. Decide a 60 Hz. O relógio dele é a contagem dos próprios
 * passos, não o tempo do jogo.
 */
import { Olho, PASSOS_POR_DECISAO, erroDaMao, lerComErro } from '../abrir/robo'
import { entre, inteiro, rngDe } from '../abrir/rng'
import { DT, SEM_ENTRADA } from '../abrir/tipos'
import { DIF, amostra } from './sim'
import type { Rng } from '../abrir/rng'
import type { Visto } from '../abrir/robo'
import type { Dificuldade, Entrada, Politica } from '../abrir/tipos'
import type { Estado } from './sim'

/** Intervalo mínimo entre dois toques, em s: o dedo de gente não bate mais rápido que isso. */
export const INTERVALO_MIN = 0.16
/** O robô toca um fecho quando o vê abaixo disto (antes do "cedo demais", 0,85 no Normal e 0,8 no Difícil, com folga). */
export const TOCA_ABAIXO = 0.72
/** Não toca de novo um fecho que a própria mão tocou há menos que isto, em s. */
export const MEMORIA_DA_MAO = 0.5
/** Chance de errar o fecho e tocar o vizinho. */
export const ERRO_DE_FECHO = 0.05
/** Faixa do intervalo entre toques do robô ruim, em s. */
export const RUIM_INTERVALO: readonly [number, number] = [0.12, 0.45]

type Tela = Readonly<Record<string, number>>

/** O que o robô leu de uma tela (com o erro de leitura sorteado uma vez por releitura). */
interface Leitura {
  a: number[]
  preso: boolean[]
  /** Fecho que ele viu em aviso (-1 = nenhum). */
  alvo: number
  /** Instante (do jogo) daquela tela. */
  t: number
}

function ler(r: Rng, v: Visto<Tela>, n: number): Leitura {
  const a: number[] = []
  const preso: boolean[] = []
  for (let i = 0; i < n; i++) {
    a.push(lerComErro(r, v.a['a' + i]))
    preso.push(v.a['p' + i] === 1)
  }
  return { a, preso, alvo: v.a.alvo, t: v.t }
}

/** O fecho do lado (a mão escorregou): nas pontas só há um vizinho. */
function vizinho(r: Rng, i: number, n: number): number {
  if (i === 0) return 1
  if (i === n - 1) return n - 2
  return r() < 0.5 ? i - 1 : i + 1
}

/**
 * Prioridade do humano: (1) o fecho em aviso que ele viu, se a mão ainda não
 * mexeu nele depois daquela tela; (2) senão o mais baixo entre os vistos
 * abaixo de `TOCA_ABAIXO`, soltos e fora da memória da mão. O mais baixo já é
 * o que está abaixo do limiar, quando há um. -1 = nada a fazer.
 */
function escolher(l: Leitura, tocouEm: readonly number[], agora: number): number {
  if (l.alvo >= 0 && tocouEm[l.alvo] < l.t) return l.alvo
  let melhor = -1
  for (let i = 0; i < l.a.length; i++) {
    if (l.preso[i] || l.a[i] >= TOCA_ABAIXO || agora - tocouEm[i] < MEMORIA_DA_MAO) continue
    if (melhor < 0 || l.a[i] < l.a[melhor]) melhor = i
  }
  return melhor
}

/** Robô que joga como gente (METAS.md, seção 1). Sorte própria: `semente + '|robo'`. */
export function roboHumano(semente: string, dif: Dificuldade): Politica<Estado> {
  const r = rngDe(semente + '|robo')
  const n = DIF[dif].fechos
  const olho = new Olho<Tela>(r)
  const tocouEm: number[] = Array.from({ length: n }, () => -Infinity)
  let passos = 0
  let ultimoToque = -Infinity
  let visto: Visto<Tela> | null = null
  let leitura: Leitura | null = null
  let pendente = -1
  let pendenteEm = 0
  return (e: Readonly<Estado>): Entrada => {
    const agora = passos * DT
    const decide = passos % PASSOS_POR_DECISAO === 0
    passos++
    const v = olho.olhar(agora, amostra(e))
    // Erro de leitura sorteado uma vez por tela relida: entre releituras ele age sobre a mesma impressão.
    if (v !== null && v !== visto) {
      visto = v
      leitura = ler(r, v, n)
    }
    if (pendente >= 0) {
      if (agora + 1e-9 < pendenteEm) return SEM_ENTRADA
      const i = pendente
      pendente = -1
      ultimoToque = agora
      tocouEm[i] = agora
      return { segurando: false, toque: i }
    }
    if (!decide || leitura === null || agora - ultimoToque < INTERVALO_MIN) return SEM_ENTRADA
    const alvo = escolher(leitura, tocouEm, agora)
    if (alvo < 0) return SEM_ENTRADA
    pendente = r() < ERRO_DE_FECHO ? vizinho(r, alvo, n) : alvo
    // Erro da mão de 50 ms (o padrão): o toque não tem ritmo a antecipar, só a pressa de um dedo.
    // Rebatido para o lado do atraso: a mão nunca toca antes de decidir.
    pendenteEm = agora + Math.abs(erroDaMao(r))
    return SEM_ENTRADA
  }
}

/** Robô ruim: toca um fecho ao acaso a cada 0,12 a 0,45 s, sem olhar a tela. */
export function roboRuim(semente: string, dif: Dificuldade): Politica<Estado> {
  const r = rngDe(semente + '|robo')
  const n = DIF[dif].fechos
  let passos = 0
  let prox = entre(r, RUIM_INTERVALO[0], RUIM_INTERVALO[1])
  return (): Entrada => {
    const agora = passos * DT
    passos++
    if (agora + 1e-9 < prox) return SEM_ENTRADA
    prox = agora + entre(r, RUIM_INTERVALO[0], RUIM_INTERVALO[1])
    return { segurando: false, toque: inteiro(r, n) }
  }
}
