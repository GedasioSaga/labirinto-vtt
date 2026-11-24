/**
 * O NICHO FUNERÁRIO (lote L05 de 24/11/2026, item 45, o lóculo de parede da cripta do mapa 8): duas FORMAS no
 * painel ("Forma": Fechado | Aberto), como as versões da cova (`cova.ts`):
 *
 * - Fechado: a laje inteira tapando o lóculo, com o epitáfio e as quatro rosetas de bronze;
 * - Aberto: a laje partida e caída na frente, o lóculo escuro com o crânio e os ossos à vista.
 *
 * As duas têm a mesma pegada; trocar a forma não mexe no tamanho (o mestre pode ter esticado).
 *
 * O mapa grava só o que difere do padrão (`Prop.mobiliaForma`): `'aberto'`; ausente = fechado (o nicho novo e o
 * já salvo). A imagem com textura lê a forma como a `variante` (0 fechado, 1 aberto).
 *
 * Sem import de Pixi nem de `types/map.ts`: função pura, sem ciclo.
 */

export type FormaDoNichoFunerario = 'fechado' | 'aberto'

/** O que o mapa grava: só o que difere do fechado. */
export type FormaGravadaDoNichoFunerario = Exclude<FormaDoNichoFunerario, 'fechado'>

/** A ordem do painel: a primeira é a de partida. */
export const FORMAS_DO_NICHO_FUNERARIO: readonly FormaDoNichoFunerario[] = ['fechado', 'aberto']

export const ROTULO_DA_FORMA_DO_NICHO_FUNERARIO: Readonly<Record<FormaDoNichoFunerario, string>> = {
  fechado: 'Fechado',
  aberto: 'Aberto',
}

export function ehNichoFunerario(tipo: string | undefined): tipo is 'nichoFunerario' {
  return tipo === 'nichoFunerario'
}

/** A forma gravada que o nicho aceita (`'aberto'`); o resto (o fechado, texto torto, outro tipo) vira `undefined`. */
export function normalizarFormaDoNichoFunerario(tipo: string | undefined, valor: unknown): FormaGravadaDoNichoFunerario | undefined {
  if (!ehNichoFunerario(tipo)) return undefined
  return valor === 'aberto' ? valor : undefined
}

/** A forma que vale (a gravada ou o fechado). */
export function formaDoNichoFunerario(valor: unknown): FormaDoNichoFunerario {
  return normalizarFormaDoNichoFunerario('nichoFunerario', valor) ?? 'fechado'
}

/** O que gravar para esta forma (`undefined` = fechado, sem campo). */
export function gravarFormaDoNichoFunerario(forma: FormaDoNichoFunerario): FormaGravadaDoNichoFunerario | undefined {
  return forma === 'fechado' ? undefined : forma
}

/** A forma como a imagem a lê: 0 fechado, 1 aberto. */
export function varianteDoNichoFunerario(valor: unknown): number {
  return FORMAS_DO_NICHO_FUNERARIO.indexOf(formaDoNichoFunerario(valor))
}

/** A forma da `variante` da imagem (a conta inversa de `varianteDoNichoFunerario`); fora da faixa = o fechado. */
export function lerVarianteDoNichoFunerario(variante: number): FormaDoNichoFunerario {
  return FORMAS_DO_NICHO_FUNERARIO[Number.isInteger(variante) && variante >= 0 && variante < FORMAS_DO_NICHO_FUNERARIO.length ? variante : 0]
}
