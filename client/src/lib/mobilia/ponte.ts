/**
 * A PONTE (pedido do mestre de 03/11/2026): o caminho por cima do rio, do
 * barranco ou do vão. Três FORMAS no painel ("Forma": Madeira | Pedra |
 * Corda), como o chafariz:
 *
 * - Madeira: as tábuas de través com o corrimão de madeira dos dois lados;
 * - Pedra: o arco de pedra, o calçamento no meio e a mureta dos lados;
 * - Corda: a ponte pênsil, as tábuas soltas com vão entre elas, as cordas dos
 *   lados e os postes nas pontas.
 *
 * A ponte corre ao longo do lado MAIOR da pegada (como o arco do portão):
 * nasce com 4 casas de comprimento e 1 de largura (deitada), estica nos dois
 * sentidos e gira como qualquer objeto. As três formas têm a mesma pegada;
 * trocar a forma não mexe no tamanho (o mestre pode ter esticado).
 *
 * O mapa grava só o que difere do padrão (`Prop.mobiliaForma`): `'pedra'` ou
 * `'corda'`; ausente = madeira. A imagem com textura lê a forma como a
 * `variante` (0 madeira, 1 pedra, 2 corda).
 *
 * Sem import de Pixi nem de `types/map.ts`: função pura, sem ciclo.
 */

export type FormaDaPonte = 'madeira' | 'pedra' | 'corda'

/** O que o mapa grava: só o que difere da madeira. */
export type FormaGravadaDaPonte = Exclude<FormaDaPonte, 'madeira'>

/** A ordem do painel: a primeira é a de partida. */
export const FORMAS_DA_PONTE: readonly FormaDaPonte[] = ['madeira', 'pedra', 'corda']

export const ROTULO_DA_FORMA_DA_PONTE: Readonly<Record<FormaDaPonte, string>> = {
  madeira: 'Madeira',
  pedra: 'Pedra',
  corda: 'Corda',
}

export function ehPonte(tipo: string | undefined): tipo is 'ponte' {
  return tipo === 'ponte'
}

/** A forma gravada que a ponte aceita (`'pedra'`, `'corda'`); o resto (a madeira, texto torto, outro tipo) vira `undefined`. */
export function normalizarFormaDaPonte(tipo: string | undefined, valor: unknown): FormaGravadaDaPonte | undefined {
  if (!ehPonte(tipo)) return undefined
  return valor === 'pedra' || valor === 'corda' ? valor : undefined
}

/** A forma que vale (a gravada ou a madeira). */
export function formaDaPonte(valor: unknown): FormaDaPonte {
  return normalizarFormaDaPonte('ponte', valor) ?? 'madeira'
}

/** O que gravar para esta forma (`undefined` = madeira, sem campo). */
export function gravarFormaDaPonte(forma: FormaDaPonte): FormaGravadaDaPonte | undefined {
  return forma === 'madeira' ? undefined : forma
}

/** A forma como a imagem e o desenho de linhas a leem: 0 madeira, 1 pedra, 2 corda. */
export function varianteDaPonte(valor: unknown): number {
  return FORMAS_DA_PONTE.indexOf(formaDaPonte(valor))
}

/** A forma da `variante` da imagem (a conta inversa de `varianteDaPonte`). */
export function lerVarianteDaPonte(variante: number): FormaDaPonte {
  return FORMAS_DA_PONTE[Number.isInteger(variante) && variante >= 0 && variante < FORMAS_DA_PONTE.length ? variante : 0]
}

/**
 * Os lugares de material que a forma usa (`texturas/meioTermo/materiais.ts`):
 * a madeira (as tábuas, o corrimão, os postes) e a pedra (o arco, a mureta).
 * A ponte de pedra não tem madeira, e a de madeira e a de corda não têm pedra:
 * o painel só mostra o lugar que muda o desenho.
 */
export function lugarDaPonteNaForma(forma: FormaDaPonte, lugar: string): boolean {
  if (lugar === 'pedra') return forma === 'pedra'
  if (lugar === 'madeira') return forma !== 'pedra'
  return true
}
