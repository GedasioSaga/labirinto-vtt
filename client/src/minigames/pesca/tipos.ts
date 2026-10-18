/**
 * CONTRATO DO MINIGAME DE PESCA — o que o pino de minigame grava quando o jogo
 * é a pesca. Arquivo só de tipos e constantes: não importa nada do app (só
 * os tetos de texto do contrato da dança), para que `types/map.ts`, a rede e
 * o jogo dependam daqui sem ciclo.
 *
 * Protótipo aprovado em 18/10/2026: `docs/design/minigame-pesca/`.
 */

export type DificuldadePesca = 'normal' | 'extremo'
export const DIFICULDADES_PESCA: readonly DificuldadePesca[] = ['normal', 'extremo']

/**
 * Como a pesca começa neste pino: `mestre` = o mestre chama (como a dança);
 * `pino` = o jogador toca no pino e começa sozinho.
 */
export type EntradaPesca = 'mestre' | 'pino'
export const ENTRADAS_PESCA: readonly EntradaPesca[] = ['mestre', 'pino']

/**
 * O que fica gravado no pino de minigame (`Pin.minigame`) quando o jogo é a
 * pesca. Nunca vai no snapshot do jogador: dele sai só `{ jogo, entrada }`
 * (`MinigameVisivel`); o resto chega no convite.
 *
 * Prêmio e consequência são SÓ TEXTO ILUSTRATIVO (decisão do usuário,
 * 18/10/2026): aparecem no convite e no resultado, e a pesca não abre porta
 * nem entrega item ou efeito. O peixe fica no cesto e no placar.
 */
export interface MinigamePesca {
  jogo: 'pesca'
  /** Quem desafia (nome do NPC). */
  npc: string
  /** A fala do desafio no convite. */
  fala: string
  /** Nome do lago, que o jogador lê no convite. */
  lago: string
  entrada: EntradaPesca
  /** Lances por chamada, de `LANCES_MIN` a `LANCES_MAX`. */
  lances: number
  /** 'escolha' = cada jogador escolhe; senão, só a dificuldade dada. */
  permitida: 'escolha' | DificuldadePesca
  premio: { texto: string }
  consequencia: { texto: string }
}

/** Quem desafia e a fala têm os tetos da dança: é o mesmo campo do painel do mestre. */
export { FALA_MAX_LENGTH, NPC_MAX_LENGTH } from '../danca/tipos'
export const LAGO_MAX_LENGTH = 40
export const LANCES_MIN = 1
export const LANCES_MAX = 5
/** Teto do texto do prêmio e da consequência (frase do convite e do resultado). */
export const PESCA_TEXTO_MAX_LENGTH = 140

/** O que o mestre ganha ao escolher a pesca: o desafio do protótipo. */
export const MINIGAME_PESCA_PADRAO: MinigamePesca = {
  jogo: 'pesca',
  npc: 'Bento, o barqueiro',
  fala: 'Faz vinte anos que ninguém tira nada que preste deste poço. Joga a linha. Se o que morder for grande, segura firme.',
  lago: 'Poço Afogado',
  entrada: 'mestre',
  lances: 3,
  permitida: 'escolha',
  premio: { texto: 'Quem trouxer o maior peixe leva a chave da comporta.' },
  consequencia: { texto: 'Linha vazia: a vez passa e o barqueiro conta para a mesa inteira.' },
}
