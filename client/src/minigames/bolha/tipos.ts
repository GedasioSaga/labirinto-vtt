/**
 * CONTRATO DO MINIGAME BOLHA D'ÁGUA — o que o pino de minigame grava quando o
 * jogo é a bolha. Arquivo só de tipos e constantes: não importa nada do app
 * (só os tetos de texto da dança), para que `types/map.ts`, a rede e a tela
 * dependam daqui sem ciclo.
 *
 * O jogo é um export web do Godot 4.7.2 (projeto `bolha-d-agua`, fora deste
 * repositório): acertar o fogo com bolhas d'água. Roda num iframe e conversa
 * por `postMessage` (`tela/ponteDaBolha.ts`, contrato em
 * `docs/ponte-app-labirinto.md` do projeto do jogo). Diferente do fogo, CADA UM
 * JOGA A PRÓPRIA CÓPIA (sem lockstep): em equipe todos recebem a mesma
 * semente, o mesmo cenário e a mesma dificuldade, e o app junta os placares.
 */

export type DificuldadeBolha = 'facil' | 'normal' | 'dificil'
export const DIFICULDADES_BOLHA: readonly DificuldadeBolha[] = ['facil', 'normal', 'dificil']

/** Onde o fogo está: a clareira da floresta ou a casa. O mestre escolhe no pino. */
export type CenarioBolha = 'clareira' | 'casa'
export const CENARIOS_BOLHA: readonly CenarioBolha[] = ['clareira', 'casa']

/** `solo`: cada um no seu; `equipe`: todos começam a mesma partida (cada um na sua cópia). */
export type ModoBolha = 'solo' | 'equipe'
export const MODOS_BOLHA: readonly ModoBolha[] = ['solo', 'equipe']

/** Como começa: só o mestre chama, ou o jogador também começa sozinho no cartão do pino. */
export type EntradaBolha = 'mestre' | 'pino'

/**
 * O que fica gravado no pino de minigame (`Pin.minigame`) quando o jogo é a
 * bolha. Nunca vai no snapshot do jogador: dele sai só `{ jogo, entrada }`
 * e, com o pino legível, quem pede e a fala (`MinigameVisivel`); o resto
 * chega no convite.
 *
 * Prêmio e consequência são SÓ TEXTO, como no fogo: aparecem no convite e no
 * resultado; a bolha não abre porta nem entrega item.
 */
export interface MinigameBolha {
  jogo: 'bolha'
  /** Quem pede ajuda (nome do NPC). */
  npc: string
  /** A fala do pedido no convite. */
  fala: string
  cenario: CenarioBolha
  /** `mestre` = só o mestre chama; `pino` = o jogador também começa sozinho no cartão. */
  entrada: EntradaBolha
  /** 'escolha' = quem começa escolhe (o mestre, ou o jogador sozinho); senão, só a dificuldade dada. */
  permitida: 'escolha' | DificuldadeBolha
  premio: { texto: string }
  consequencia: { texto: string }
}

/** Quem pede e a fala têm os tetos da dança: é o mesmo campo do painel do mestre. */
export { FALA_MAX_LENGTH, NPC_MAX_LENGTH } from '../danca/tipos'
/** Teto do texto do prêmio e da consequência (frase do convite e do resultado). */
export const BOLHA_TEXTO_MAX_LENGTH = 140

export const NOME_DO_CENARIO_BOLHA: Record<CenarioBolha, string> = {
  clareira: 'Clareira',
  casa: 'Casa',
}

export const NOME_DA_DIFICULDADE_BOLHA: Record<DificuldadeBolha, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  dificil: 'Difícil',
}

/** O que o mestre ganha ao escolher a bolha. */
export const MINIGAME_BOLHA_PADRAO: MinigameBolha = {
  jogo: 'bolha',
  npc: 'Dona Aurélia',
  fala: 'Uma faísca pegou no capim da clareira! Minha bolha não dá conta sozinha. Me ajuda a apagar antes que chegue nas árvores?',
  cenario: 'clareira',
  entrada: 'pino',
  permitida: 'escolha',
  premio: { texto: 'Dona Aurélia agradece com um frasco de água benta.' },
  consequencia: { texto: 'A fumaça arde nos olhos: -1 em Percepção até o próximo descanso.' },
}
