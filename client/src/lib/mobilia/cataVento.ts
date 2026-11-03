/**
 * OS OBJETOS DE VENTO (pedido do mestre de 02/11/2026): o cata-vento de
 * fazenda (a torre que puxa água, com a roda de muitas pás e o leme), o
 * moinho de vento (a construção com as 4 velas em cruz) e o cata-vento de
 * brinquedo (o de papel no palito). Os três com as pás GIRANDO devagar, no
 * relógio da chama e da água (`pixi/pasDoVento.ts`), e o "Vento" no painel:
 * "Girando | Parado", como a água do chafariz.
 *
 * O mapa grava só o Parado (`Prop.mobiliaForma: 'parado'`); ausente = girando.
 * O moinho tem também a FORMA (Clássico | Torre, 03/11/2026), no mesmo campo:
 * `'torre'` ou `'torre-parado'`. O moinho que já estava no mapa é o Clássico.
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

/**
 * As FORMAS do moinho (pedido de 03/11/2026, "uma variação do cata vento"): o
 * Clássico (a torre redonda de pedra, o telhado em cone e as 4 velas de lona,
 * o moinho de sempre) e a Torre (o moinho de torre do Mediterrâneo: a torre
 * branca que afina para cima, a cúpula azul, a varanda de madeira em anel e as
 * 6 velas azuis de borda clara). Só o moinho tem forma.
 */
export type FormaDoMoinho = 'classico' | 'torre'

/** O que o mapa grava num objeto de vento: o Parado e, só no moinho, a Torre (parada ou não). */
export type FormaGravadaDoVento = 'parado' | 'torre' | 'torre-parado'

/** O desenho das pás: o tipo, ou as 6 velas do moinho de torre. */
export type DesenhoDoVento = TipoDeVento | 'moinhoTorre'

export const FORMAS_DO_MOINHO: readonly FormaDoMoinho[] = ['classico', 'torre']

export const ROTULO_DA_FORMA_DO_MOINHO: Readonly<Record<FormaDoMoinho, string>> = {
  classico: 'Clássico',
  torre: 'Torre',
}

/** A ordem do painel: a primeira é a de partida. */
export const VENTOS_DO_MOVEL: readonly VentoDoMovel[] = ['girando', 'parado']

export const ROTULO_DO_VENTO: Readonly<Record<VentoDoMovel, string>> = {
  girando: 'Girando',
  parado: 'Parado',
}

export function ehMovelDeVento(tipo: string | undefined): tipo is TipoDeVento {
  return tipo === 'cataVento' || tipo === 'moinho' || tipo === 'cataVentoBrinquedo'
}

/**
 * O que o móvel de vento grava (`'parado'`; no moinho também `'torre'` e
 * `'torre-parado'`); o resto (o padrão, texto torto, a Torre fora do moinho,
 * outro tipo) vira `undefined`. A mesma porta da leitura, da edição e da travessia.
 */
export function normalizarFormaDoVento(tipo: string | undefined, valor: unknown): FormaGravadaDoVento | undefined {
  if (!ehMovelDeVento(tipo)) return undefined
  if (valor === 'parado') return 'parado'
  return tipo === 'moinho' && (valor === 'torre' || valor === 'torre-parado') ? valor : undefined
}

/** O vento que vale (o gravado ou o de partida). */
export function ventoDoMovel(valor: unknown): VentoDoMovel {
  return valor === 'parado' || valor === 'torre-parado' ? 'parado' : 'girando'
}

/** A forma do moinho que vale (a gravada ou o Clássico). */
export function formaDoMoinho(valor: unknown): FormaDoMoinho {
  return valor === 'torre' || valor === 'torre-parado' ? 'torre' : 'classico'
}

/** O que gravar para esta forma e este vento (`undefined` = o Clássico girando, sem campo). */
export function gravarFormaDoVento(forma: FormaDoMoinho, vento: VentoDoMovel): FormaGravadaDoVento | undefined {
  if (forma === 'torre') return vento === 'parado' ? 'torre-parado' : 'torre'
  return vento === 'parado' ? 'parado' : undefined
}

/** O desenho das pás deste objeto: o do tipo, ou as 6 velas se for o moinho de torre. */
export function desenhoDoVento(tipo: TipoDeVento, valor: unknown): DesenhoDoVento {
  return tipo === 'moinho' && formaDoMoinho(valor) === 'torre' ? 'moinhoTorre' : tipo
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

export const RODAS_DO_VENTO: Readonly<Record<DesenhoDoVento, RodaDoVento>> = {
  // Base 1 x 1, a roda com ~2 casas de diâmetro: 1 volta a cada 3,6 s.
  cataVento: { raio: 0.92, altura: 0.42, voltaMs: 3600, sentido: 1 },
  // Base 2 x 2, as velas com ~4 casas de envergadura: 1 volta a cada 7,2 s.
  moinho: { raio: 0.96, altura: 0.2, voltaMs: 7200, sentido: -1 },
  // Base 0,5 x 0,5, o papel com ~0,8 casa (menor some no mapa): 1 volta a cada 2,4 s (o ciclo da chama).
  cataVentoBrinquedo: { raio: 0.8, altura: 0.6, voltaMs: 2400, sentido: 1 },
  // O moinho de torre, na mesma pegada do Clássico (2 x 2) e com a mesma envergadura (~4 casas): o cubo um
  // pouco mais alto (a torre é mais alta), 6 velas, 1 volta a cada 9,6 s (uma vela passa a cada 1,6 s).
  moinhoTorre: { raio: 0.96, altura: 0.26, voltaMs: 9600, sentido: -1 },
}

/** O meio da roda e o raio dela, em px de mundo, para esta pegada (`null` = tamanho que não desenha). */
export function rodaNaPegada(tipo: DesenhoDoVento, largura: number, altura: number): { sobe: number; raio: number } | null {
  if (!Number.isFinite(largura) || !Number.isFinite(altura) || largura <= 0 || altura <= 0) return null
  const lado = Math.min(largura, altura)
  const roda = RODAS_DO_VENTO[tipo]
  return { sobe: lado * roda.altura, raio: lado * roda.raio }
}
