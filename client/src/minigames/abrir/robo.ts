/**
 * ROBÔ QUE JOGA COMO GENTE (regra de teste de jogos do usuário, 18/10/2026;
 * números iguais aos do robô da pesca do app): o olho vê a tela com atraso de
 * 250 ± 60 ms, nunca abaixo de 120 ms, relê a cada 0,15 s e erra a leitura em
 * ± 0,03; a mão age a 60 Hz e erra o tempo. Nunca reação zero.
 *
 * O robô só pode ler o jogo pelo `Olho` (a amostra atrasada). Ele sabe, sem
 * atraso, só o que a própria mão fez (quando tocou, se está segurando).
 */
import { gauss, type Rng } from './rng'
import { DT } from './tipos'

export const REACAO_MEDIA = 0.25
export const REACAO_DESVIO = 0.06
export const REACAO_MIN = 0.12
/** O olho relê a tela a cada 0,15 s; entre leituras, age sobre a última. */
export const RELEITURA = 0.15
/** Erro de leitura, em fração da escala (0..1) do que está sendo lido. */
export const ERRO_DE_LEITURA = 0.03
/** Desvio padrão do erro de tempo da mão, em s (cada jogo pode declarar de 0,04 a 0,07). */
export const ERRO_DA_MAO = 0.05
/** A mão age a 60 Hz: 1 decisão a cada 2 passos de 1/120 s. */
export const PASSOS_POR_DECISAO = 2

/** Um tempo de reação, em s: 250 ± 60 ms, nunca abaixo de 120 ms. */
export const reacao = (r: Rng): number => Math.max(REACAO_MIN, REACAO_MEDIA + REACAO_DESVIO * gauss(r))

/** Erro de leitura de um valor na escala 0..1. */
export const lerComErro = (r: Rng, v: number): number => v + ERRO_DE_LEITURA * gauss(r)

/** Erro de tempo da mão, em s, com o desvio dado. */
export const erroDaMao = (r: Rng, desvio = ERRO_DA_MAO): number => desvio * gauss(r)

/** O que o olho viu: a amostra e o instante (do jogo) em que ela estava na tela. */
export interface Visto<A> {
  a: A
  t: number
}

/**
 * Olho com atraso. A cada passo, `olhar(t, amostra)` guarda a tela daquele
 * instante e devolve o que o robô enxerga agora: a tela de `atraso` segundos
 * atrás, com o atraso sorteado de novo a cada releitura. Antes de ver
 * qualquer coisa (começo da partida) devolve null.
 */
export class Olho<A> {
  private readonly telas: Visto<A>[] = []
  private visto: Visto<A> | null = null
  private proxima = 0

  constructor(private readonly r: Rng) {}

  olhar(t: number, a: A): Visto<A> | null {
    this.telas.push({ a, t })
    // Guarda só os últimos ~2 s: o atraso nunca passa de 0,6 s na prática.
    if (this.telas.length > 360) this.telas.splice(0, 120)
    if (t + 1e-9 >= this.proxima) {
      this.proxima = t + RELEITURA
      // Arredonda para cima: o atraso real nunca fica abaixo do piso de 120 ms.
      const k = this.telas.length - 1 - Math.ceil(reacao(this.r) / DT - 1e-9)
      this.visto = k >= 0 ? this.telas[k] : null
    }
    return this.visto
  }
}
