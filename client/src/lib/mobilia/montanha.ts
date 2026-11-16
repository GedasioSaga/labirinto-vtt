/**
 * A MONTANHA (pedido do mestre de 16/11/2026, leva E2 item 11: "montanha em 3 tamanhos, vista de cima, com
 * cumes, encostas e sombreado de rocha, neve opcional"). Três TIPOS, um por tamanho (como os três blocos de
 * inscrições): a pequena (4 x 4 casas), a média (6 x 6) e a grande (10 x 8). Cada tamanho tem o próprio desenho
 * (um pico; um pico e um ombro; um maciço de três picos), não o mesmo esticado.
 *
 * A NEVE é a chave do painel ("Neve": Sem | Com), como o fogo da lareira: o mapa grava só `'nevada'` em
 * `Prop.mobiliaForma`; ausente = sem neve (a montanha nova e a já salva). A imagem com textura lê a chave como a
 * `variante` (0 sem neve, 1 com). Trocar a neve não mexe na pegada.
 *
 * Sem import de Pixi nem de `types/map.ts`: função pura, sem ciclo.
 */

export type TipoDeMontanha = 'montanhaPequena' | 'montanhaMedia' | 'montanhaGrande'

export const TIPOS_DE_MONTANHA: readonly TipoDeMontanha[] = ['montanhaPequena', 'montanhaMedia', 'montanhaGrande']

export type NeveDaMontanha = 'semNeve' | 'nevada'

/** O que o mapa grava: só a montanha com neve. */
export type FormaGravadaDaMontanha = Exclude<NeveDaMontanha, 'semNeve'>

/** A ordem do painel: a primeira é a de partida. */
export const NEVES_DA_MONTANHA: readonly NeveDaMontanha[] = ['semNeve', 'nevada']

export const ROTULO_DA_NEVE_DA_MONTANHA: Readonly<Record<NeveDaMontanha, string>> = {
  semNeve: 'Sem',
  nevada: 'Com',
}

export function ehMontanha(tipo: string | undefined): tipo is TipoDeMontanha {
  return tipo === 'montanhaPequena' || tipo === 'montanhaMedia' || tipo === 'montanhaGrande'
}

/** A neve gravada que a montanha aceita (`'nevada'`); o resto (sem neve, texto torto, outro tipo) vira `undefined`. */
export function normalizarNeveDaMontanha(tipo: string | undefined, valor: unknown): FormaGravadaDaMontanha | undefined {
  return ehMontanha(tipo) && valor === 'nevada' ? 'nevada' : undefined
}

/** A neve que vale (a gravada ou sem neve). */
export function neveDaMontanha(valor: unknown): NeveDaMontanha {
  return valor === 'nevada' ? 'nevada' : 'semNeve'
}

/** O que gravar para esta escolha (`undefined` = sem neve, sem campo). */
export function gravarNeveDaMontanha(neve: NeveDaMontanha): FormaGravadaDaMontanha | undefined {
  return neve === 'nevada' ? 'nevada' : undefined
}

/** A neve como a imagem a lê: 0 sem neve, 1 com neve. */
export function varianteDaMontanha(valor: unknown): number {
  return neveDaMontanha(valor) === 'nevada' ? 1 : 0
}

/** A montanha da `variante` da imagem tem neve? (a conta inversa de `varianteDaMontanha`; fora da faixa = sem). */
export function montanhaComNeve(variante: number): boolean {
  return variante === 1
}
