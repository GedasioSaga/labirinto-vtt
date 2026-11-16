/**
 * CONTRATO DOS JOGOS DE ABRIR (baú, caixa, barril): o que a vitrine, as
 * provas e o porte para o app usam sem conhecer o jogo por dentro. Arquivo só
 * de tipos e constantes; não importa nada.
 *
 * Cada jogo mora na sua pasta com sim.ts (lógica pura, determinística por
 * semente), arte.ts (canvas 240x135), som.ts (WebAudio procedural) e jogo.ts,
 * que junta os três num `JogoDeAbrir`.
 */

export type Dificuldade = 'normal' | 'dificil'
export const DIFICULDADES: readonly Dificuldade[] = ['normal', 'dificil']
export const NOME_DA_DIFICULDADE: Readonly<Record<Dificuldade, string>> = { normal: 'Normal', dificil: 'Difícil' }

/** Passo fixo da simulação, em s (como a pesca: passo variável daria outra partida em outro aparelho). */
export const DT = 1 / 120

/** Passos entre duas amostras do gráfico do movimento (0,1 s). */
export const PASSOS_POR_AMOSTRA = 12

/** Teto da tentativa, em s. Passou disso sem abrir: "não abriu", tenta de novo, sem consequência. */
export const LIMITE_S = 20

export type IdDoJogo = 'bau' | 'caixa' | 'barril'

/** Como a tentativa acabou. */
export type Fim = 'abriu' | 'tempo'

/**
 * Entrada de um passo, já traduzida pelo motor (teclado, ponteiro ou robô).
 * `segurando`: o botão principal está pressionado agora (pé de cabra).
 * `toque`: um toque começou NESTE passo; -1 = nenhum; senão o alvo (índice do
 * fecho no baú; 0 nos jogos de alvo único).
 */
export interface Entrada {
  segurando: boolean
  toque: number
}

export const SEM_ENTRADA: Readonly<Entrada> = { segurando: false, toque: -1 }

/** Um acontecimento do passo, para o som e para o efeito na tela. */
export interface Evento {
  /** Nome do som no vocabulário do jogo ('fecho', 'racha', 'golpe'...). */
  nome: string
  /** Intensidade 0..1 ou índice, quando o som precisa. */
  v?: number
}

export interface OpcoesDeDesenho {
  /** Movimento reduzido: sem tremor, sem flash, sem balanço. */
  reduzido: boolean
}

/** Quem joga: recebe o estado a cada passo e devolve a entrada do passo. */
export type Politica<E> = (e: Readonly<E>) => Entrada

/** Uma linha do gráfico do movimento. */
export interface CampoDoGrafico {
  /** Chave em `amostra()`. */
  chave: string
  rotulo: string
  min: number
  max: number
  cor: string
}

/** Um som da sequência de prova: [instante em s, evento]. */
export type PassoDaSequencia = readonly [number, Evento]

/** Retângulo na tela lógica de 240x135: [x, y, largura, altura]. */
export type Retangulo = readonly [number, number, number, number]

/** Teto da dica de objetivo, em caracteres (METAS.md, ajuste 2): cabe em 2 linhas no celular. */
export const MAX_CARACTERES_DA_DICA = 110

export interface JogoDeAbrir<E> {
  readonly id: IdDoJogo
  /** Nome curto na vitrine ("Baú"). */
  readonly nome: string
  /** Uma linha de instrução, para o DOM (o canvas não tem texto). */
  readonly instrucao: string
  /**
   * Dica de objetivo: como ganhar, em até 2 frases e `MAX_CARACTERES_DA_DICA`.
   * Aparece sobre a tela quando a tentativa começa e some no primeiro toque.
   */
  readonly objetivo: string
  /** Parede livre da cena onde a dica fica sem tapar o jogo (nada do jogo é pintado ali antes do primeiro toque). */
  readonly areaDaDica: Retangulo
  /** `event.code` -> alvo do toque (ex.: Space -> 0; Digit1 -> fecho 0). */
  readonly teclas: Readonly<Record<string, number>>
  /** Linhas do gráfico do movimento, na ordem de desenho. */
  readonly grafico: readonly CampoDoGrafico[]
  /** Ganho do barramento de efeitos deste jogo. */
  readonly ganho: number
  /** Ponto (x, y) da tela lógica por onde algo sai do recipiente aberto (a armadilha nasce aqui). */
  readonly boca: readonly [number, number]
  /** Sequência de prova com todos os sons do jogo (render offline e .wav). */
  readonly sequencia: readonly PassoDaSequencia[]
  readonly duracaoSequencia: number

  criar(semente: string, dif: Dificuldade): E
  /**
   * Avança um passo de DT. Muta `e`. Devolve o fim quando a tentativa acaba.
   * Depois do fim continua aceitando passos (sem ler a entrada) só para a
   * animação de abrir andar, e devolve sempre o mesmo fim.
   */
  passo(e: E, entrada: Readonly<Entrada>): Fim | null
  /** Eventos do último passo (a lista é refeita a cada passo). */
  eventos(e: Readonly<E>): readonly Evento[]
  /** Tempo da tentativa, em s. */
  tempo(e: Readonly<E>): number
  fim(e: Readonly<E>): Fim | null
  /** 0..1 até abrir (HUD e leitor de tela). */
  progresso(e: Readonly<E>): number
  /** 0..1 da animação de abrir depois da vitória; 1 = aberto, hora da armadilha. */
  abertura(e: Readonly<E>): number
  /** O que o gráfico do movimento e o robô leem (números, sem desenhar). */
  amostra(e: Readonly<E>): Readonly<Record<string, number>>
  /** Desenha a cena inteira na tela lógica de 240x135. */
  desenhar(g: CanvasRenderingContext2D, e: Readonly<E>, op: OpcoesDeDesenho): void
  /** Alvo no ponto (x, y) da tela lógica; -1 = nada. */
  alvoEm(x: number, y: number, e: Readonly<E>): number
  /** Toca o som de um evento em `t` (s do relógio do contexto). */
  tocar(ctx: BaseAudioContext, out: AudioNode, ev: Evento, t: number): void
  /** Robô que joga como gente (METAS.md, seção 1). */
  roboHumano(semente: string, dif: Dificuldade): Politica<E>
  /** Robô ruim do pedido: martela, solta ou toca ao acaso, sem olhar. */
  roboRuim(semente: string, dif: Dificuldade): Politica<E>
}
