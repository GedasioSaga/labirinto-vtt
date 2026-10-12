/**
 * CONTRATO DO MINIGAME DE DANÇA — o que o pino de minigame grava e o que a
 * rede leva. Arquivo só de tipos e constantes: não importa nada do app, para
 * que `types/map.ts`, a rede e o jogo dependam daqui sem ciclo.
 *
 * Protótipo aprovado em 12/10/2026: `docs/design/minigame-danca/`.
 */

export type DificuldadeDanca = 'diversao' | 'expert'
export const DIFICULDADES_DANCA: readonly DificuldadeDanca[] = ['diversao', 'expert']

/** Nota final da dança, da melhor para a pior. */
export type LetraDanca = 'S' | 'A' | 'B' | 'C' | 'D'
export const LETRAS_DANCA: readonly LetraDanca[] = ['S', 'A', 'B', 'C', 'D']

/** Trilha da seta: 0 ←, 1 ↓, 2 ↑, 3 →. */
export type TrilhaDanca = 0 | 1 | 2 | 3

/**
 * Uma seta da coreografia. `t` e `len` em segundos de música; `len > 0` é seta
 * segurada; `sub` é a divisão do tempo (4 semínima, 8 colcheia, 16 semicolcheia),
 * que dá a cor da seta.
 */
export interface NotaDaDanca {
  t: number
  lane: TrilhaDanca
  len: number
  sub: 4 | 8 | 16
}

/**
 * A música do desafio. A demo é sintetizada em cada aparelho (determinística).
 * A importada fica na mídia da mesa (`midia:<sha256>.<ext>`) e leva as DUAS
 * coreografias prontas, calculadas uma vez no mestre ao importar: decodificar
 * o mesmo mp3 em navegadores diferentes daria setas diferentes.
 */
export type MusicaDaDanca =
  | { tipo: 'demo' }
  | {
      tipo: 'arquivo'
      midia: string
      nome: string
      bpm: number
      primeiraBatida: number
      /** Qual batida (0-3) abre o compasso: as linhas fortes da pista. */
      fase4: number
      duracaoS: number
      coreografias: Record<DificuldadeDanca, NotaDaDanca[]>
    }

export type PremioDanca = 'item' | 'pista' | 'bonus' | 'nada'
export type ConsequenciaDanca = 'teste' | 'barulho' | 'espera' | 'nada'

/**
 * O que fica gravado no pino de minigame (`Pin.minigame`). Nunca vai no
 * snapshot do jogador: chega só no convite, aos jogadores chamados.
 */
export interface MinigameDoPino {
  jogo: 'danca'
  /** Quem desafia (nome do NPC). */
  npc: string
  /** A fala do desafio no convite. */
  fala: string
  musica: MusicaDaDanca
  /** 'escolha' = cada jogador escolhe; senão, só a dificuldade dada. */
  permitida: 'escolha' | DificuldadeDanca
  /** Nota mínima para passar. A porta ligada só abre se TODOS passarem. */
  notaMin: LetraDanca
  premio: { tipo: PremioDanca; texto: string }
  consequencia: { tipo: ConsequenciaDanca; texto: string }
}

export const NPC_MAX_LENGTH = 40
export const FALA_MAX_LENGTH = 220
export const PREMIO_TEXTO_MAX_LENGTH = 60

/** O que o mestre ganha ao escolher o tipo minigame: o desafio do protótipo. */
export const MINIGAME_PADRAO: MinigameDoPino = {
  jogo: 'danca',
  npc: 'Dona Ziza',
  fala: 'Esta porta é surda para chave e cega para força. Só abre para quem tem ginga. Acompanha o meu tempo?',
  musica: { tipo: 'demo' },
  permitida: 'escolha',
  notaMin: 'B',
  premio: { tipo: 'item', texto: 'Chave de latão' },
  consequencia: { tipo: 'teste', texto: '−2 no próximo teste de Agilidade' },
}
