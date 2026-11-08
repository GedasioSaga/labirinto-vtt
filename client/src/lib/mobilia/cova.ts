/**
 * A COVA (pedido do mestre de 07/11/2026: "coloca 3 versões eu gostei e bota
 * para eu mudar"): três VERSÕES do estúdio no painel ("Versão": Fresca |
 * Antiga | Com pedras), como a forma da ponte:
 *
 * - Fresca: o monte recém-cavado, a terra solta com os torrões caídos ao pé;
 * - Antiga: o monte baixo e afundado no miolo, com três tufos de mato;
 * - Com pedras: a terra rasa e a roda de pedras marcando a borda.
 *
 * As três têm a mesma pegada (1 x 2 casas); trocar a versão não mexe no
 * tamanho (o mestre pode ter esticado). As versões são do estilo Atual (o
 * Meio-Termo): no Desenhado a cova é a arte do estúdio, uma só.
 *
 * O mapa grava só o que difere do padrão (`Prop.mobiliaForma`): `'antiga'` ou
 * `'pedras'`; ausente = fresca (a cova nova e a já salva). A imagem com
 * textura lê a versão como a `variante` (0 fresca, 1 antiga, 2 com pedras).
 *
 * Sem import de Pixi nem de `types/map.ts`: função pura, sem ciclo.
 */

export type FormaDaCova = 'fresca' | 'antiga' | 'pedras'

/** O que o mapa grava: só o que difere da fresca. */
export type FormaGravadaDaCova = Exclude<FormaDaCova, 'fresca'>

/** A ordem do painel: a primeira é a de partida. */
export const FORMAS_DA_COVA: readonly FormaDaCova[] = ['fresca', 'antiga', 'pedras']

export const ROTULO_DA_FORMA_DA_COVA: Readonly<Record<FormaDaCova, string>> = {
  fresca: 'Fresca',
  antiga: 'Antiga',
  pedras: 'Com pedras',
}

export function ehCova(tipo: string | undefined): tipo is 'cova' {
  return tipo === 'cova'
}

/** A versão gravada que a cova aceita (`'antiga'`, `'pedras'`); o resto (a fresca, texto torto, outro tipo) vira `undefined`. */
export function normalizarFormaDaCova(tipo: string | undefined, valor: unknown): FormaGravadaDaCova | undefined {
  if (!ehCova(tipo)) return undefined
  return valor === 'antiga' || valor === 'pedras' ? valor : undefined
}

/** A versão que vale (a gravada ou a fresca). */
export function formaDaCova(valor: unknown): FormaDaCova {
  return normalizarFormaDaCova('cova', valor) ?? 'fresca'
}

/** O que gravar para esta versão (`undefined` = fresca, sem campo). */
export function gravarFormaDaCova(forma: FormaDaCova): FormaGravadaDaCova | undefined {
  return forma === 'fresca' ? undefined : forma
}

/** A versão como a imagem a lê: 0 fresca, 1 antiga, 2 com pedras. */
export function varianteDaCova(valor: unknown): number {
  return FORMAS_DA_COVA.indexOf(formaDaCova(valor))
}

/** A versão da `variante` da imagem (a conta inversa de `varianteDaCova`); fora da faixa = a fresca. */
export function lerVarianteDaCova(variante: number): FormaDaCova {
  return FORMAS_DA_COVA[Number.isInteger(variante) && variante >= 0 && variante < FORMAS_DA_COVA.length ? variante : 0]
}
