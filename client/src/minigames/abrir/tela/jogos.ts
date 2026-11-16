import { JOGO_BARRIL } from '../../barril/jogo'
import { JOGO_BAU } from '../../bau/jogo'
import { JOGO_CAIXA } from '../../caixa/jogo'
import type { JogoDoObjeto } from '../objeto'
import type { Dificuldade, Entrada, Evento, Fim, IdDoJogo, JogoDeAbrir, OpcoesDeDesenho, Retangulo } from '../tipos'

/**
 * OS JOGOS DE ABRIR NA TELA DO JOGADOR. Cada jogo tem o próprio tipo de estado
 * (`JogoDeAbrir<E>`); aqui ele fica preso dentro de uma `Tentativa`, e o motor
 * e a tela usam todos os jogos pelo mesmo contrato, sem saber o tipo de dentro.
 */

/** Uma tentativa em andamento, com o estado do jogo guardado aqui dentro. */
export interface Tentativa {
  /** Um passo de DT. Com o robô jogando, a entrada recebida é ignorada. */
  passo(entrada: Readonly<Entrada>): Fim | null
  eventos(): readonly Evento[]
  tempo(): number
  progresso(): number
  abertura(): number
  desenhar(g: CanvasRenderingContext2D, op: OpcoesDeDesenho): void
  alvoEm(x: number, y: number): number
}

export interface JogoNaTela {
  readonly id: IdDoJogo
  readonly nome: string
  /** Uma linha de como jogar (o canvas não tem texto). */
  readonly instrucao: string
  /** Dica de objetivo (como ganhar): aparece quando a tentativa começa e some no primeiro toque. */
  readonly objetivo: string
  /** Parede livre da cena onde a dica fica sem tapar o jogo, na tela lógica de 240x135. */
  readonly areaDaDica: Retangulo
  /** `event.code` -> alvo do toque. */
  readonly teclas: Readonly<Record<string, number>>
  /** Ganho do barramento de efeitos do jogo. */
  readonly ganho: number
  /** De onde a armadilha sai, na tela lógica de 240x135. */
  readonly boca: readonly [number, number]
  tocar(ctx: BaseAudioContext, out: AudioNode, ev: Evento, t: number): void
  /** Nova tentativa. `robo` = o robô humano joga no lugar da pessoa (só vitrine e provas). */
  nova(semente: string, dif: Dificuldade, robo?: boolean): Tentativa
}

export function naTela<E>(jogo: JogoDeAbrir<E>): JogoNaTela {
  return {
    id: jogo.id,
    nome: jogo.nome,
    instrucao: jogo.instrucao,
    objetivo: jogo.objetivo,
    areaDaDica: jogo.areaDaDica,
    teclas: jogo.teclas,
    ganho: jogo.ganho,
    boca: jogo.boca,
    tocar: (ctx, out, ev, t) => jogo.tocar(ctx, out, ev, t),
    nova(semente, dif, robo = false) {
      const e = jogo.criar(semente, dif)
      const politica = robo ? jogo.roboHumano(semente, dif) : null
      return {
        passo: (entrada) => jogo.passo(e, politica === null ? entrada : politica(e)),
        eventos: () => jogo.eventos(e),
        tempo: () => jogo.tempo(e),
        progresso: () => jogo.progresso(e),
        abertura: () => jogo.abertura(e),
        desenhar: (g, op) => jogo.desenhar(g, e, op),
        alvoEm: (x, y) => jogo.alvoEm(x, y, e),
      }
    },
  }
}

/** Um por jogo de `JOGOS_PORTADOS` (o tsc cobra o que faltar). */
export const JOGOS_NA_TELA: Readonly<Record<JogoDoObjeto, JogoNaTela>> = {
  bau: naTela(JOGO_BAU),
  caixa: naTela(JOGO_CAIXA),
  barril: naTela(JOGO_BARRIL),
}
