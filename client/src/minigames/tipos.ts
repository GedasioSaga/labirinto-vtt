/**
 * O DESAFIO DO PINO DE MINIGAME, de qualquer jogo. Arquivo só de tipos: não
 * importa nada do app, só os contratos de cada jogo, para que `types/map.ts`,
 * a rede e o painel dependam daqui sem ciclo.
 */
import type { MinigameDanca } from './danca/tipos'
import type { MinigameFogo } from './fogo/tipos'
import type { EntradaPesca, MinigamePesca } from './pesca/tipos'
import type { EntradaTiro, MinigameTiro } from './tiro/tipos'

/** O que fica gravado no pino (`Pin.minigame`): o desafio inteiro do jogo escolhido. */
export type MinigameDoPino = MinigameDanca | MinigamePesca | MinigameTiro | MinigameFogo

export type JogoDoMinigame = MinigameDoPino['jogo']
export const JOGOS_DO_MINIGAME: readonly JogoDoMinigame[] = ['danca', 'pesca', 'tiro', 'fogo']

/**
 * O pouco do desafio que vai no recorte do JOGADOR (`Pin.minigameVisivel`):
 * o jogo e como ele começa, para o cartão saber se oferece "Pescar" ou
 * "Atirar", ou avisa que o mestre chama. Prêmio, consequência e música nunca
 * vão. A dança sempre começa pelo mestre.
 *
 * O FOGO é a exceção da fala: o pedido de ajuda do NPC é o que o jogador lê no
 * cartão (pedido do usuário, 09/11/2026), e "Apagar o fogo" começa sozinho
 * (`entrada: 'pino'`); a equipe continua vindo do mestre, pelo painel.
 */
export interface MinigameVisivel {
  jogo: JogoDoMinigame
  entrada: EntradaPesca | EntradaTiro
  /** Só do fogo, e só com o pino legível: quem pede ajuda. */
  npc?: string
  /** Só do fogo, e só com o pino legível: o pedido de ajuda, como fala no cartão. */
  fala?: string
}
