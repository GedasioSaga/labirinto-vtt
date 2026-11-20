/**
 * CONTRATO DO MINIGAME ALAVANCA DA PONTE — o que o desafio grava e o que a
 * rede leva. Arquivo só de tipos e constantes: não importa nada do app, para
 * que `types/map.ts`, a rede e o jogo dependam daqui sem ciclo.
 *
 * Protótipo aprovado em 20/11/2026: `docs/design/minigames/alavanca-da-ponte.html`
 * (provas em `docs/design/minigames/provas-alavanca/`). De 1 a 4 jogadores
 * giram a mesma alavanca; o HOST roda a partida (`net/alavancaNoHost.ts`).
 */

export type DificuldadeAlavanca = 'facil' | 'normal' | 'dificil'
export const DIFICULDADES_ALAVANCA: readonly DificuldadeAlavanca[] = ['facil', 'normal', 'dificil']

export const NOME_DA_DIFICULDADE_ALAVANCA: Readonly<Record<DificuldadeAlavanca, string>> = {
  facil: 'Fácil',
  normal: 'Normal',
  dificil: 'Difícil',
}

/** Como começa: o mestre chama (pelo painel), ou quem encosta no selo começa sozinho. */
export type EntradaAlavanca = 'mestre' | 'pino'
export const ENTRADAS_ALAVANCA: readonly EntradaAlavanca[] = ['mestre', 'pino']

/** O tempo limite que o mestre escolhe (o controle deslizante do protótipo: 8 a 40 s). */
export const ALAVANCA_TEMPO_MIN_S = 8
export const ALAVANCA_TEMPO_MAX_S = 40

/** Quantos giram juntos a mesma alavanca. */
export const ALAVANCA_JOGADORES_MAX = 4

export const ALAVANCA_LUGAR_MAX_LENGTH = 60
export const ALAVANCA_FALA_MAX_LENGTH = 220

/**
 * O que o desafio grava (`Desafio.minigame`) quando o jogo é a alavanca —
 * um dos lados de `MinigameDoPino`. A porta que abre é a `portaLigada` do
 * desafio, como na dança e no puzzle: nunca vai ao jogador.
 */
export interface MinigameAlavanca {
  jogo: 'alavanca'
  /**
   * Com quem é o desafio, como nos outros jogos (o nome padrão do desafio é
   * "Alavanca da ponte com <npc>"). A alavanca não tem ninguém: vazio, e o
   * painel do protótipo não mostra o campo.
   */
  npc: string
  /** Onde fica a alavanca, debaixo do título do convite ("Portão de Valverde, fosso norte"). */
  lugar: string
  /** A fala do convite. */
  fala: string
  entrada: EntradaAlavanca
  dificuldade: DificuldadeAlavanca
  /** O tempo limite em segundos; `null` = o padrão da dificuldade. */
  tempo: number | null
}

/** O que o mestre ganha ao escolher a alavanca: o desafio do protótipo. */
export const MINIGAME_ALAVANCA_PADRAO: MinigameAlavanca = {
  jogo: 'alavanca',
  npc: '',
  lugar: 'Portão de Valverde, fosso norte',
  fala: 'A ponte levadiça está erguida e a corrente é pesada. Girem a alavanca sem parar: quem descansa a mão deixa a catraca soltar, e a corrente puxa a ponte de volta.',
  entrada: 'mestre',
  dificuldade: 'normal',
  tempo: null,
}

/** O tempo gravado, dentro do que o controle deslizante deixa; `null` fica `null`. */
export function tempoDaAlavanca(tempo: unknown): number | null {
  if (typeof tempo !== 'number' || !Number.isFinite(tempo)) return null
  return Math.min(ALAVANCA_TEMPO_MAX_S, Math.max(ALAVANCA_TEMPO_MIN_S, Math.round(tempo)))
}
