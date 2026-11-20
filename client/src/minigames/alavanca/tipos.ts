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

/**
 * A CENA: o mesmo jogo e os mesmos números, só muda o que se vê e se ouve.
 * A ponte levadiça desce sobre o fosso; no canhão do chão, o alçapão do
 * baluarte abre e a plataforma sobe com o canhão (protótipo aprovado em
 * 20/11/2026, `?cena=canhao`; provas em `docs/design/minigames/provas-canhao/`).
 */
export type CenaAlavanca = 'ponte' | 'canhao'
export const CENAS_ALAVANCA: readonly CenaAlavanca[] = ['ponte', 'canhao']

export const NOME_DA_CENA_ALAVANCA: Readonly<Record<CenaAlavanca, string>> = {
  ponte: 'Ponte levadiça',
  canhao: 'Canhão do chão',
}

/** A cena lida de fora (disco, rede): o que não é o canhão é a ponte, a de antes das cenas. */
export function cenaDaAlavanca(valor: unknown): CenaAlavanca {
  return valor === 'canhao' ? 'canhao' : 'ponte'
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
  /** O que se vê e se ouve; o jogo é o mesmo. Mapa de antes das cenas lê 'ponte'. */
  cena: CenaAlavanca
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
  cena: 'ponte',
  npc: '',
  lugar: 'Portão de Valverde, fosso norte',
  fala: 'A ponte levadiça está erguida e a corrente é pesada. Girem a alavanca sem parar: quem descansa a mão deixa a catraca soltar, e a corrente puxa a ponte de volta.',
  entrada: 'mestre',
  dificuldade: 'normal',
  tempo: null,
}

/** O lugar e a fala do convite de cada cena, os do protótipo. */
export const CONVITE_DA_CENA_ALAVANCA: Readonly<Record<CenaAlavanca, { lugar: string; fala: string }>> = {
  ponte: { lugar: MINIGAME_ALAVANCA_PADRAO.lugar, fala: MINIGAME_ALAVANCA_PADRAO.fala },
  canhao: {
    lugar: 'Baluarte de Valverde, muralha norte',
    fala: 'Debaixo das lajes do baluarte espera um canhão de bronze. Girem a alavanca sem parar: o alçapão abre e a plataforma sobe. Quem descansa a mão deixa a catraca soltar, e o peso do canhão leva tudo de volta ao fundo.',
  },
}

/** O nome que o desafio ganha em cada cena (a lista da aba Ação). */
export const NOME_DO_DESAFIO_DA_CENA_ALAVANCA: Readonly<Record<CenaAlavanca, string>> = {
  ponte: 'Alavanca da ponte',
  canhao: 'Alavanca do canhão',
}

/**
 * O desafio na outra cena. O lugar e a fala que ainda são os da cena de
 * antes viram os da nova; o que o mestre escreveu fica.
 */
export function alavancaNaCena(minigame: MinigameAlavanca, cena: CenaAlavanca): MinigameAlavanca {
  const antes = CONVITE_DA_CENA_ALAVANCA[minigame.cena]
  const depois = CONVITE_DA_CENA_ALAVANCA[cena]
  return {
    ...minigame,
    cena,
    lugar: minigame.lugar === antes.lugar ? depois.lugar : minigame.lugar,
    fala: minigame.fala === antes.fala ? depois.fala : minigame.fala,
  }
}

/** O tempo gravado, dentro do que o controle deslizante deixa; `null` fica `null`. */
export function tempoDaAlavanca(tempo: unknown): number | null {
  if (typeof tempo !== 'number' || !Number.isFinite(tempo)) return null
  return Math.min(ALAVANCA_TEMPO_MAX_S, Math.max(ALAVANCA_TEMPO_MIN_S, Math.round(tempo)))
}
