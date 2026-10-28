import { clamp01, easeInOutSine, easeOutCubic, span } from '../../transicoes/curvas'

/*
 * TRILHA DO PINHEIRAL: roteiro (segundos da cena), o mesmo no dia e nas chamas.
 *
 * Terceira pessoa: a câmera segue de costas, um pouco à direita e acima, uma
 * pessoa que anda por uma trilha de terra rumo à boca escura de um pinheiral.
 * A câmera recua devagar enquanto fecha o campo de visão (um "Vertigo"
 * contido): a pessoa fica quase do mesmo tamanho e a mata cresce até tomar o
 * quadro; então o escuro da mata fecha a tela (o `fade` devolvido ao motor,
 * que sempre fecha em preto).
 */

export type VarianteDaTrilha = 'dia' | 'chamas'

export const DURACAO = 7
export const FADE_ENTRADA = 0.5
export const INICIO_DO_ESCURO = 5.8
export const FIM_DO_ESCURO = 6.85
/** Metros por segundo; com a passada de ~0,71 m e 1,8 passo/s o pé não escorrega. */
export const VELOCIDADE = 1.3
export const CADENCIA = 1.8
/** z da primeira fileira do pinheiral (a pessoa sai de z = 0 andando para -z). */
export const BORDA_DA_MATA = -22

/** Centro da trilha em x para cada z: uma curva mansa que entra na mata. */
export function trilhaX(z: number): number {
  return 0.9 * Math.sin(z * 0.11 + 0.4) - 0.35
}

/** dx/dz da trilha, para a pessoa virar junto com a curva. */
export function inclinacaoDaTrilha(z: number): number {
  return 0.099 * Math.cos(z * 0.11 + 0.4)
}

export function andadoEm(t: number): number {
  return VELOCIDADE * t
}

/** Fase do ciclo de passos em radianos: pé esquerdo à frente em π/2, o direito em 3π/2. */
export function faseEm(t: number): number {
  return Math.PI * CADENCIA * t
}

/** Quantos pés já tocaram o chão: sobe 1 a cada contato (t × cadência = n + 0,5). */
export function passoEm(t: number): number {
  return Math.floor(CADENCIA * t + 0.5)
}

export function fadeEm(t: number): number {
  if (t < FADE_ENTRADA) return 1 - easeOutCubic(clamp01(t / FADE_ENTRADA))
  return easeInOutSine(span(t, INICIO_DO_ESCURO, FIM_DO_ESCURO))
}

/** Avanço da câmera, de 0 a 1 ao longo da cena. */
export function avancoEm(t: number): number {
  return easeInOutSine(span(t, 0, FIM_DO_ESCURO))
}

/** Força do fogo: cresce um pouco até perto do fim. */
export function fogoEm(t: number): number {
  return 0.8 + 0.2 * easeInOutSine(span(t, 0, 5.5))
}

/** Tremor de uma luz de fogo (0,44 a 1); com movimento reduzido só respira devagar, sem pisca. */
export function tremorEm(t: number, s: number, reduzir: boolean): number {
  if (reduzir) return 0.9 + 0.1 * Math.sin(t * 1.7 + s)
  const v = 0.5 * Math.sin(t * 7.1 + s) + 0.3 * Math.sin(t * 12.7 + s * 2.3) + 0.2 * Math.sin(t * 21.3 + s * 4.1)
  return 0.72 + 0.28 * v
}

/** Rajada de vento (0 a 1), a mesma na neblina e no som. */
export function rajadaEm(t: number): number {
  return clamp01(0.45 + 0.35 * Math.sin(t * 1.1 - 0.6) + 0.2 * Math.sin(t * 2.7 + 1.3))
}
