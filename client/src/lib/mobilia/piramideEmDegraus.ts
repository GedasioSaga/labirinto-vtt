/**
 * A PIRÂMIDE EM DEGRAUS (lote L08 de 24/11/2026, item 71, a peça principal do templo na selva do mapa 6): duas
 * FORMAS no painel ("Forma": Seca | Alagada), como as versões da cova (`cova.ts`) e do nicho funerário:
 *
 * - Seca: os quatro degraus de laje, com o musgo nas juntas, umas folhas secas e pouca planta;
 * - Alagada: cada degrau vira um tanque raso, a água parada presa pela mureta, com a folhagem cobrindo a borda e
 *   as plantas boiando.
 *
 * As duas têm a mesma pegada; trocar a forma não mexe no tamanho (o mestre pode ter esticado).
 *
 * O mapa grava só o que difere do padrão (`Prop.mobiliaForma`): `'alagada'`; ausente = seca (a pirâmide nova e a
 * já salva). A imagem com textura lê a forma como a `variante` (0 seca, 1 alagada).
 *
 * Sem import de Pixi nem de `types/map.ts`: função pura, sem ciclo.
 */

export type FormaDaPiramideEmDegraus = 'seca' | 'alagada'

/** O que o mapa grava: só o que difere da seca. */
export type FormaGravadaDaPiramideEmDegraus = Exclude<FormaDaPiramideEmDegraus, 'seca'>

/** A ordem do painel: a primeira é a de partida. */
export const FORMAS_DA_PIRAMIDE_EM_DEGRAUS: readonly FormaDaPiramideEmDegraus[] = ['seca', 'alagada']

export const ROTULO_DA_FORMA_DA_PIRAMIDE_EM_DEGRAUS: Readonly<Record<FormaDaPiramideEmDegraus, string>> = {
  seca: 'Seca',
  alagada: 'Alagada',
}

export function ehPiramideEmDegraus(tipo: string | undefined): tipo is 'piramideEmDegraus' {
  return tipo === 'piramideEmDegraus'
}

/** A forma gravada que a pirâmide aceita (`'alagada'`); o resto (a seca, texto torto, outro tipo) vira `undefined`. */
export function normalizarFormaDaPiramideEmDegraus(tipo: string | undefined, valor: unknown): FormaGravadaDaPiramideEmDegraus | undefined {
  if (!ehPiramideEmDegraus(tipo)) return undefined
  return valor === 'alagada' ? valor : undefined
}

/** A forma que vale (a gravada ou a seca). */
export function formaDaPiramideEmDegraus(valor: unknown): FormaDaPiramideEmDegraus {
  return normalizarFormaDaPiramideEmDegraus('piramideEmDegraus', valor) ?? 'seca'
}

/** O que gravar para esta forma (`undefined` = seca, sem campo). */
export function gravarFormaDaPiramideEmDegraus(forma: FormaDaPiramideEmDegraus): FormaGravadaDaPiramideEmDegraus | undefined {
  return forma === 'seca' ? undefined : forma
}

/** A forma como a imagem a lê: 0 seca, 1 alagada. */
export function varianteDaPiramideEmDegraus(valor: unknown): number {
  return FORMAS_DA_PIRAMIDE_EM_DEGRAUS.indexOf(formaDaPiramideEmDegraus(valor))
}

/** A forma da `variante` da imagem (a conta inversa de `varianteDaPiramideEmDegraus`); fora da faixa = a seca. */
export function lerVarianteDaPiramideEmDegraus(variante: number): FormaDaPiramideEmDegraus {
  return FORMAS_DA_PIRAMIDE_EM_DEGRAUS[Number.isInteger(variante) && variante >= 0 && variante < FORMAS_DA_PIRAMIDE_EM_DEGRAUS.length ? variante : 0]
}
