/**
 * O CHAFARIZ (pedido do mestre de 02/11/2026): a fonte de praça de vila, de
 * pedra, com a bacia, a coluna e o prato no meio. Duas FORMAS no painel
 * ("Forma": Redondo | Quadrado), como os troncos e o feno, e a ÁGUA ligada ou
 * desligada ("Água": Ligada | Desligada), como o fogo da lareira.
 *
 * - Redondo: a bacia redonda de praça, em anel de pedras;
 * - Quadrado: a bacia oitavada (o quadrado de cantos cortados), em lajes, com
 *   o plinto quadrado debaixo do prato.
 *
 * As duas formas têm a mesma pegada de partida (2 x 2 casas); trocar a forma
 * não mexe no tamanho (o mestre pode ter esticado). A água ligada é a parte
 * animada (`pixi/aguaDosChafarizes.ts`: o jato no meio, as gotas caindo do
 * prato e os anéis na bacia, no mesmo relógio da chama da fogueira); desligada,
 * a camada animada sai e a imagem troca para a água parada.
 *
 * O mapa grava só o que difere do padrão, num campo só (`Prop.mobiliaForma`):
 * `'quadrado'`, `'desligada'` ou `'quadrado-desligada'`; ausente = redondo com
 * a água ligada. Aqui também mora a disposição (frações da pegada, centro na
 * origem, sem giro) que a imagem parada e a camada animada leem juntas, para o
 * jato nascer no bico pintado e os anéis caberem na água pintada.
 *
 * Sem import de Pixi nem de `types/map.ts`: função pura, sem ciclo.
 */

export type FormaDoChafariz = 'redondo' | 'quadrado'
export type AguaDoChafariz = 'ligada' | 'desligada'

/** O que o mapa grava: só o que difere do padrão (redondo, água ligada). */
export type FormaGravadaDoChafariz = 'quadrado' | 'desligada' | 'quadrado-desligada'

/** A ordem do painel: a primeira é a de partida. */
export const FORMAS_DO_CHAFARIZ: readonly FormaDoChafariz[] = ['redondo', 'quadrado']
export const AGUAS_DO_CHAFARIZ: readonly AguaDoChafariz[] = ['ligada', 'desligada']

export const ROTULO_DA_FORMA_DO_CHAFARIZ: Readonly<Record<FormaDoChafariz, string>> = {
  redondo: 'Redondo',
  quadrado: 'Quadrado',
}

export const ROTULO_DA_AGUA_DO_CHAFARIZ: Readonly<Record<AguaDoChafariz, string>> = {
  ligada: 'Ligada',
  desligada: 'Desligada',
}

export function ehChafariz(tipo: string | undefined): tipo is 'chafariz' {
  return tipo === 'chafariz'
}

/**
 * A forma gravada que o chafariz aceita (`'quadrado'`, `'desligada'`,
 * `'quadrado-desligada'`); o resto (o padrão, texto torto, outro tipo) vira
 * `undefined`. A mesma porta da leitura, da edição e da travessia.
 */
export function normalizarFormaDoChafariz(tipo: string | undefined, valor: unknown): FormaGravadaDoChafariz | undefined {
  if (!ehChafariz(tipo)) return undefined
  return valor === 'quadrado' || valor === 'desligada' || valor === 'quadrado-desligada' ? valor : undefined
}

/** A forma que vale (a gravada ou a de partida). */
export function formaDoChafariz(valor: unknown): FormaDoChafariz {
  const gravada = normalizarFormaDoChafariz('chafariz', valor)
  return gravada === 'quadrado' || gravada === 'quadrado-desligada' ? 'quadrado' : 'redondo'
}

/** A água que vale (a gravada ou a ligada). */
export function aguaDoChafariz(valor: unknown): AguaDoChafariz {
  const gravada = normalizarFormaDoChafariz('chafariz', valor)
  return gravada === 'desligada' || gravada === 'quadrado-desligada' ? 'desligada' : 'ligada'
}

/** O que gravar para esta forma e esta água (`undefined` = o padrão, sem campo). */
export function gravarFormaDoChafariz(forma: FormaDoChafariz, agua: AguaDoChafariz): FormaGravadaDoChafariz | undefined {
  if (forma === 'quadrado') return agua === 'desligada' ? 'quadrado-desligada' : 'quadrado'
  return agua === 'desligada' ? 'desligada' : undefined
}

/**
 * Como a imagem com textura lê o chafariz (a `variante`): a forma vezes 2 mais
 * a água (0 redondo ligado, 1 redondo desligado, 2 quadrado ligado, 3 quadrado
 * desligado). O desenho de linhas lê só a forma (`varianteDaFormaDoChafariz`).
 */
export function varianteDoChafariz(valor: unknown): number {
  return FORMAS_DO_CHAFARIZ.indexOf(formaDoChafariz(valor)) * 2 + AGUAS_DO_CHAFARIZ.indexOf(aguaDoChafariz(valor))
}

/** Só a forma, para o desenho de linhas (0 redondo, 1 quadrado). */
export function varianteDaFormaDoChafariz(valor: unknown): number {
  return FORMAS_DO_CHAFARIZ.indexOf(formaDoChafariz(valor))
}

/** A forma e a água da `variante` da imagem (a conta inversa de `varianteDoChafariz`). */
export function lerVarianteDoChafariz(variante: number): { forma: FormaDoChafariz; agua: AguaDoChafariz } {
  const v = Number.isInteger(variante) && variante >= 0 && variante <= 3 ? variante : 0
  return { forma: v >= 2 ? 'quadrado' : 'redondo', agua: v % 2 === 1 ? 'desligada' : 'ligada' }
}

/**
 * A DISPOSIÇÃO, em fração: a bacia em fração da meia pegada (x da meia
 * largura, y da meia altura: esticada, a bacia acompanha), o resto em fração
 * do MENOR meio lado (o prato e a coluna ficam redondos em qualquer esticada).
 */
export const CHAFARIZ = {
  /** A borda de fora da bacia (a 0,97 da meia pegada: a sombra e o contato cabem na imagem). */
  bordaDeFora: 0.97,
  /** Espessura da borda de pedra da bacia, em fração do menor meio lado. */
  espessuraDaBorda: 0.15,
  /** O canto cortado da bacia oitavada, em fração do menor meio lado. */
  cantoDoQuadrado: 0.36,
  /** O raio de fora do prato e a espessura da borda dele. */
  raioDoPrato: 0.4,
  bordaDoPrato: 0.07,
  /** O plinto quadrado (só no Quadrado): a meia largura, debaixo do prato (só os cantos passam dele). */
  plinto: 0.36,
  /** O bico no meio do prato, de onde o jato sai. */
  raioDoBico: 0.075,
  /** Altura do jato em repouso, em fração do menor LADO (não do meio lado): ~0,5 casa no de 2 x 2 (a coroa passa pouco do prato). */
  alturaDoJato: 0.26,
} as const

/** Uma medida do chafariz em px, para esta pegada (largura x altura, sem giro). */
export interface MedidasDoChafariz {
  /** Meia largura e meia altura da borda de fora da bacia. */
  readonly baciaX: number
  readonly baciaY: number
  /** Meia largura e meia altura da água da bacia (a borda de dentro). */
  readonly aguaX: number
  readonly aguaY: number
  /** O raio do prato (de fora) e o da água dele. */
  readonly prato: number
  readonly aguaDoPrato: number
  readonly bico: number
  /** Altura do jato em repouso. */
  readonly jato: number
}

/** As medidas para uma pegada em px (`null` = tamanho que não desenha). */
export function medidasDoChafariz(largura: number, altura: number): MedidasDoChafariz | null {
  if (!Number.isFinite(largura) || !Number.isFinite(altura) || largura <= 0 || altura <= 0) return null
  const hw = largura / 2
  const hh = altura / 2
  const menor = Math.min(hw, hh)
  const baciaX = hw * CHAFARIZ.bordaDeFora
  const baciaY = hh * CHAFARIZ.bordaDeFora
  const borda = menor * CHAFARIZ.espessuraDaBorda
  const prato = menor * CHAFARIZ.raioDoPrato
  return {
    baciaX,
    baciaY,
    aguaX: baciaX - borda,
    aguaY: baciaY - borda,
    prato,
    aguaDoPrato: prato - menor * CHAFARIZ.bordaDoPrato,
    bico: menor * CHAFARIZ.raioDoBico,
    jato: Math.min(largura, altura) * CHAFARIZ.alturaDoJato,
  }
}
