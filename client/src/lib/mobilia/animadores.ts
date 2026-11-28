/**
 * OS CINCO ANIMADORES (I0-e do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`, Decisão 7): toda
 * peça que mexe usa um destes, ou a chama que já existe. Nenhum lote inventa motor de animação.
 *
 * Este arquivo é o CONTRATO com o desenhista: a peça que mexe exporta `montar<Tipo>` (a parte parada),
 * `montar<Tipo>QueMexe` (só a peça que gira ou balança, desenhada no próprio quadro, em repouso) e
 * `ANIMACAO_DO_<TIPO>: AnimacaoDoMovel`. O integrador liga isso ao animador na tela (`pixi/`), no molde das pás do
 * vento (`pixi/pasDoVento.ts`), da água do chafariz (`pixi/aguaDosChafarizes.ts`) e dos fios de fumaça
 * (`lib/mobilia/fogo.ts`). Todos respeitam "menos movimento" e os efeitos desligados; sem peça na tela, não pedem
 * quadro.
 *
 * Sem import nenhum: tipo e conta pura, sem ciclo.
 */

/**
 * - `girar`: a peça gira em volta do pivô, uma volta por período (engrenagem, ponteiros, planetário, portal);
 * - `oscilar`: a peça balança em volta do pivô, ida e volta por período (pêndulo, lâmina);
 * - `vapor`: fios que sobem do pivô e somem (caldeira, respiradouro, bolhas);
 * - `fioDeAgua`: a água que cai do pivô (saída de esgoto, fonte de parede);
 * - `piscar`: a peça acende e apaga, um ciclo por período (semáforo).
 */
export type Animador = 'girar' | 'oscilar' | 'vapor' | 'fioDeAgua' | 'piscar'

export const ANIMADORES: readonly Animador[] = ['girar', 'oscilar', 'vapor', 'fioDeAgua', 'piscar']

export interface AnimacaoDoMovel {
  readonly animador: Animador
  /** O ponto em volta do qual a peça mexe (ou de onde o vapor e a água saem), em fração da pegada: 0..1, de cima à esquerda. */
  readonly pivo: { readonly x: number; readonly y: number }
  /** Um ciclo inteiro, em ms (uma volta, uma ida e volta, um acender e apagar). */
  readonly periodoMs: number
  /** Só no `oscilar`: a abertura de cada lado, em graus (ausente = 25). */
  readonly amplitudeGraus?: number
}

/** O período mais curto aceito: abaixo disso a peça treme em vez de mexer, e o quadro paga. */
export const PERIODO_MINIMO_MS = 400
const AMPLITUDE_PADRAO_GRAUS = 25

/** A animação é usável? O pivô dentro da pegada, o período finito e não curto demais. */
export function animacaoValida(a: AnimacaoDoMovel): boolean {
  const dentro = (v: number): boolean => Number.isFinite(v) && v >= 0 && v <= 1
  return ANIMADORES.includes(a.animador) && dentro(a.pivo.x) && dentro(a.pivo.y) && Number.isFinite(a.periodoMs) && a.periodoMs >= PERIODO_MINIMO_MS
}

/** A fase do ciclo no instante `ms`, de 0 (início) a 1 (exclusivo). */
export function faseDaAnimacao(a: AnimacaoDoMovel, ms: number): number {
  const fase = (ms % a.periodoMs) / a.periodoMs
  return fase < 0 ? fase + 1 : fase
}

/**
 * O ângulo da peça no instante `ms`, em graus: `girar` dá a volta (0 a 360), `oscilar` vai e volta suave entre
 * `-amplitude` e `+amplitude`; os outros não giram (0). Com "menos movimento", quem chama passa `ms = 0`: a peça fica
 * no repouso, desenhada como no quadro.
 */
export function anguloDaAnimacao(a: AnimacaoDoMovel, ms: number): number {
  const fase = faseDaAnimacao(a, ms)
  if (a.animador === 'girar') return fase * 360
  if (a.animador === 'oscilar') return Math.sin(fase * 2 * Math.PI) * (a.amplitudeGraus ?? AMPLITUDE_PADRAO_GRAUS)
  return 0
}

/** `piscar`: aceso na primeira metade do ciclo. Os outros animadores ficam sempre acesos. */
export function acesoNaAnimacao(a: AnimacaoDoMovel, ms: number): boolean {
  return a.animador !== 'piscar' || faseDaAnimacao(a, ms) < 0.5
}
