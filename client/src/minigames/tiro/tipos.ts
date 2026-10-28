/**
 * CONTRATO DO MINIGAME DE TIRO AO ALVO — o que o pino de minigame grava quando
 * o jogo é a barraca de tiro. Arquivo só de tipos e constantes: não importa
 * nada do app (só os tetos de texto do contrato da dança), para que
 * `types/map.ts`, a rede e o jogo dependam daqui sem ciclo.
 *
 * Protótipo aprovado: `docs/design/minigame-tiro/` (tambor de 12 balas e as
 * medalhas de 18/10/2026 estão em `sim.ts`).
 */

export type DificuldadeTiro = 'normal' | 'extremo'
export const DIFICULDADES_TIRO: readonly DificuldadeTiro[] = ['normal', 'extremo']

/**
 * Como a barraca abre neste pino: `pino` = quem pisa no pino vê o convite e
 * começa quando quiser; `mestre` = o convite fica fechado até o mestre chamar.
 */
export type EntradaTiro = 'mestre' | 'pino'
export const ENTRADAS_TIRO: readonly EntradaTiro[] = ['mestre', 'pino']

/** A medalha que o mestre pede para passar; quem faz uma acima também passa. */
export type MedalhaTiro = 'bronze' | 'prata' | 'ouro'
export const MEDALHAS_TIRO: readonly MedalhaTiro[] = ['bronze', 'prata', 'ouro']

/**
 * O que fica gravado no pino de minigame (`Pin.minigame`) quando o jogo é o
 * tiro. Nunca vai no snapshot do jogador: dele sai só `{ jogo, entrada }`
 * (`MinigameVisivel`); o resto chega no convite.
 *
 * Prêmio e consequência são SÓ TEXTO ILUSTRATIVO, como na pesca: aparecem no
 * convite e no resultado, e o tiro não abre porta nem entrega item ou efeito.
 */
export interface MinigameTiro {
  jogo: 'tiro'
  /** Quem desafia (nome do NPC). */
  npc: string
  /** A fala do desafio no convite. */
  fala: string
  /** Nome da barraca, que o jogador lê no convite e no selo do palco. */
  barraca: string
  entrada: EntradaTiro
  /** Rodadas que cada jogador tem, de `TENTATIVAS_MIN` a `TENTATIVAS_MAX`; vale a melhor. */
  tentativas: number
  /** 'escolha' = cada jogador escolhe; senão, só a dificuldade dada. */
  permitida: 'escolha' | DificuldadeTiro
  /** A medalha que passa (os pontos de cada medalha dependem da dificuldade). */
  meta: MedalhaTiro
  premio: { texto: string }
  consequencia: { texto: string }
}

/** Quem desafia e a fala têm os tetos da dança: é o mesmo campo do painel do mestre. */
export { FALA_MAX_LENGTH, NPC_MAX_LENGTH } from '../danca/tipos'
export const BARRACA_MAX_LENGTH = 40
export const TENTATIVAS_MIN = 1
export const TENTATIVAS_MAX = 5
/** Teto do texto do prêmio e da consequência (frase do convite e do resultado). */
export const TIRO_TEXTO_MAX_LENGTH = 140

/** O que o mestre ganha ao escolher o tiro: o desafio do protótipo. */
export const MINIGAME_TIRO_PADRAO: MinigameTiro = {
  jogo: 'tiro',
  npc: 'Tia Ferrolha',
  fala: 'Doze balas no tambor e a fileira não para. Derruba bastante coisa e o prêmio é seu. No Extremo, o aldeão e o gato de lata são da casa: esses não.',
  barraca: 'Barraca do Ferrolho',
  entrada: 'pino',
  tentativas: 3,
  permitida: 'escolha',
  meta: 'bronze',
  premio: { texto: 'Quem passar leva a lanterna de latão da barraca.' },
  consequencia: { texto: 'Não passou: paga a rodada de cerveja de cogumelo da mesa.' },
}
