/**
 * CONTRATO DO MINIGAME FOGO NA FLORESTA — o que o pino de minigame grava
 * quando o jogo é o incêndio. Arquivo só de tipos e constantes: não importa
 * nada do app (só os tetos de texto da dança), para que `types/map.ts`, a
 * rede e a tela dependam daqui sem ciclo.
 *
 * O jogo em si é um export web do Godot 4.7.2 (projeto `fogo-na-floresta`,
 * fora deste repositório) que roda num iframe e conversa por `postMessage`
 * (`tela/ponteDoJogo.ts`). Decisões do usuário (08/11/2026): cooperativo ao
 * vivo (todos no mesmo incêndio) e solo; 3 dificuldades; Bombeiro, Lenhador e
 * Socorrista escolhidos ao entrar; o mestre sempre chama (jogo de equipe).
 */

export type DificuldadeFogo = 'facil' | 'normal' | 'extremo'
export const DIFICULDADES_FOGO: readonly DificuldadeFogo[] = ['facil', 'normal', 'extremo']

export type FuncaoFogo = 'bombeiro' | 'lenhador' | 'socorrista'
export const FUNCOES_FOGO: readonly FuncaoFogo[] = ['bombeiro', 'lenhador', 'socorrista']

/** `equipe`: todos no mesmo incêndio; `solo`: cada um apaga o seu. */
export type ModoFogo = 'equipe' | 'solo'
export const MODOS_FOGO: readonly ModoFogo[] = ['equipe', 'solo']

/**
 * O que fica gravado no pino de minigame (`Pin.minigame`) quando o jogo é o
 * fogo. Nunca vai no snapshot do jogador: dele sai só `{ jogo, entrada }`
 * (`MinigameVisivel`); o resto chega no convite.
 *
 * Prêmio e consequência são SÓ TEXTO, como no tiro e na pesca: aparecem no
 * convite e no resultado; o fogo não abre porta nem entrega item.
 */
export interface MinigameFogo {
  jogo: 'fogo'
  /** Quem pede ajuda (nome do NPC). */
  npc: string
  /** A fala do pedido no convite. */
  fala: string
  /** Nome da floresta, que o jogador lê no convite. */
  floresta: string
  /** Sempre o mestre chama: é jogo de equipe, todos começam juntos. */
  entrada: 'mestre'
  /** 'escolha' = o mestre escolhe na hora de começar; senão, só a dificuldade dada. */
  permitida: 'escolha' | DificuldadeFogo
  premio: { texto: string }
  consequencia: { texto: string }
}

/** Quem pede e a fala têm os tetos da dança: é o mesmo campo do painel do mestre. */
export { FALA_MAX_LENGTH, NPC_MAX_LENGTH } from '../danca/tipos'
export const FLORESTA_MAX_LENGTH = 40
/** Teto do texto do prêmio e da consequência (frase do convite e do resultado). */
export const FOGO_TEXTO_MAX_LENGTH = 140

/** O que o mestre ganha ao escolher o fogo. */
export const MINIGAME_FOGO_PADRAO: MinigameFogo = {
  jogo: 'fogo',
  npc: 'Guarda Florêncio',
  fala: 'O vento virou e o fogo está descendo o morro! Preciso de gente na mangueira, no machado e no resgate. Vocês ajudam a salvar a vila?',
  floresta: 'Mata do Pinheiral',
  entrada: 'mestre',
  permitida: 'escolha',
  premio: { texto: 'A vila agradece: cada um ganha uma refeição quente e um lugar para dormir.' },
  consequencia: { texto: 'A fumaça cobre a estrada: a viagem atrasa meio dia.' },
}
