/**
 * OS OBJETOS DE VENTO (pedido do mestre de 02/11/2026): o cata-vento de
 * fazenda (a torre que puxa água, com a roda de muitas pás e o leme), o
 * moinho de vento (a construção com as 4 velas em cruz) e o cata-vento de
 * brinquedo (o de papel no palito). Os três com as pás GIRANDO devagar, no
 * relógio da chama e da água (`pixi/pasDoVento.ts`), e o "Vento" no painel:
 * "Girando | Parado", como a água do chafariz.
 *
 * O mapa grava só o Parado (`Prop.mobiliaForma: 'parado'`); ausente = girando.
 * A imagem do móvel (a base vista de cima) é a mesma nos dois: o giro mora só
 * na camada animada, e o Parado deixa as pás num ângulo fixo.
 *
 * As pás ficam EM PÉ na tela, como a chama (o mapa é visto de cima, e uma roda
 * de lado viraria um risco): a roda gira no plano da tela, com o meio um pouco
 * acima do meio da pegada (a altura da torre), e passa da pegada para os
 * lados, como a copa da árvore sai do tronco.
 *
 * Sem import de Pixi nem de `types/map.ts`: função pura, sem ciclo.
 */

export type TipoDeVento = 'cataVento' | 'moinho' | 'cataVentoBrinquedo'
export type VentoDoMovel = 'girando' | 'parado'

/** A ordem do painel: a primeira é a de partida. */
export const VENTOS_DO_MOVEL: readonly VentoDoMovel[] = ['girando', 'parado']

export const ROTULO_DO_VENTO: Readonly<Record<VentoDoMovel, string>> = {
  girando: 'Girando',
  parado: 'Parado',
}

export function ehMovelDeVento(tipo: string | undefined): tipo is TipoDeVento {
  return tipo === 'cataVento' || tipo === 'moinho' || tipo === 'cataVentoBrinquedo'
}

/** O que o móvel de vento grava (`'parado'`); o resto (o padrão, texto torto, outro tipo) vira `undefined`. */
export function normalizarFormaDoVento(tipo: string | undefined, valor: unknown): 'parado' | undefined {
  return ehMovelDeVento(tipo) && valor === 'parado' ? 'parado' : undefined
}

/** O vento que vale (o gravado ou o de partida). */
export function ventoDoMovel(valor: unknown): VentoDoMovel {
  return valor === 'parado' ? 'parado' : 'girando'
}

/** O que gravar para este vento (`undefined` = girando, sem campo). */
export function gravarVento(vento: VentoDoMovel): 'parado' | undefined {
  return vento === 'parado' ? 'parado' : undefined
}

/** A régua de cada objeto de vento, em fração do MENOR lado da pegada. */
export interface RodaDoVento {
  /** Raio da roda (a ponta da pá). 1 = a roda tem o dobro do lado (2 casas no de 1 x 1). */
  readonly raio: number
  /** Quanto o meio da roda sobe do meio da pegada (a altura da torre, na tela). */
  readonly altura: number
  /** Uma volta inteira, em ms: a roda de fazenda calma, o moinho mais lento, o brinquedo um pouco mais rápido. */
  readonly voltaMs: number
  /** Sentido do giro (1 = horário na tela). */
  readonly sentido: 1 | -1
}

export const RODAS_DO_VENTO: Readonly<Record<TipoDeVento, RodaDoVento>> = {
  // Base 1 x 1, a roda com ~2 casas de diâmetro: 1 volta a cada 3,6 s.
  cataVento: { raio: 0.92, altura: 0.42, voltaMs: 3600, sentido: 1 },
  // Base 2 x 2, as velas com ~4 casas de envergadura: 1 volta a cada 7,2 s.
  moinho: { raio: 0.96, altura: 0.2, voltaMs: 7200, sentido: -1 },
  // Base 0,5 x 0,5, o papel com ~0,8 casa (menor some no mapa): 1 volta a cada 2,4 s (o ciclo da chama).
  cataVentoBrinquedo: { raio: 0.8, altura: 0.6, voltaMs: 2400, sentido: 1 },
}

/** O meio da roda e o raio dela, em px de mundo, para esta pegada (`null` = tamanho que não desenha). */
export function rodaNaPegada(tipo: TipoDeVento, largura: number, altura: number): { sobe: number; raio: number } | null {
  if (!Number.isFinite(largura) || !Number.isFinite(altura) || largura <= 0 || altura <= 0) return null
  const lado = Math.min(largura, altura)
  const roda = RODAS_DO_VENTO[tipo]
  return { sobe: lado * roda.altura, raio: lado * roda.raio }
}
