import type { MapData, Prop, Token } from '../../types/map'
import { rotationTrig } from '../roomRotation'
import { ehConstrucao } from './construcoes'
import { baseDoMovel, tresQuartosAtivo } from './vistaTresQuartos'

/**
 * CONSTRUÇÃO COM FICHA ATRÁS (construções, F4; decisão do mestre de 12/11/2026): na vista 3/4 a construção
 * sobe na tela, e a ficha encostada ATRÁS dela (ao norte) era pintada no meio da parede, como se estivesse
 * na frente (a ficha não entra na ordem pela base dos móveis). Enquanto houver ficha atrás, a construção
 * fica meio transparente: a ficha continua à vista e se entende que ela está atrás. De cima nada muda
 * (a ficha só encosta na beirada da caixa).
 */

/** Quanto o desenho da construção passa acima da caixa na 3/4, em casas (a torre de pedra passa ~2). */
const SUBIDA_NA_TELA_EM_CASAS = 2
/** Opacidade da construção com ficha atrás: "meio transparente, ~45%" (PROPOSTA R4). */
export const ALFA_DA_CONSTRUCAO_COM_FICHA_ATRAS = 0.55

type FichaNaTela = Pick<Token, 'x' | 'y' | 'size'>

/**
 * Os ids das construções que têm ficha atrás: a base da ficha (o y mais ao sul do círculo) fica ao norte da
 * base da construção, e o círculo encosta no retângulo que a construção ocupa na tela (a caixa girada mais a
 * subida da 3/4). Fora da 3/4, ou sem construção, nenhuma. Número estragado (NaN) não conta.
 */
export function construcoesComFichaAtras(
  props: readonly Prop[],
  fichas: readonly FichaNaTela[],
  grade: number,
  vista: MapData['vistaDosMoveis'] | undefined,
): ReadonlySet<string> {
  const ids = new Set<string>()
  if (!tresQuartosAtivo(vista) || fichas.length === 0 || !(grade > 0)) return ids
  for (const prop of props) {
    if (!ehConstrucao(prop.mobilia)) continue
    if (fichas.some((ficha) => fichaAtras(prop, ficha, grade))) ids.add(prop.id)
  }
  return ids
}

function fichaAtras(prop: Prop, ficha: FichaNaTela, grade: number): boolean {
  const { sin, cos } = rotationTrig(prop.rotation ?? 0)
  const meiaLargura = (Math.abs(cos) * prop.width + Math.abs(sin) * prop.height) / 2
  const base = baseDoMovel(prop)
  const topo = 2 * prop.y - base - SUBIDA_NA_TELA_EM_CASAS * grade
  const raio = (grade / 2) * ficha.size
  const baseDaFicha = ficha.y + raio
  if (![meiaLargura, base, topo, raio, ficha.x, baseDaFicha].every(Number.isFinite)) return false
  if (baseDaFicha >= base) return false
  return ficha.x + raio > prop.x - meiaLargura && ficha.x - raio < prop.x + meiaLargura && baseDaFicha > topo && ficha.y - raio < base
}
