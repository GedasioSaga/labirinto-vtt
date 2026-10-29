import type { MapData, Prop } from '../../types/map'
import { meioTermoLigado } from '../estiloDoMapa'
import { ehMovelDeCimaDaMesa, ehMovelDoChao } from '../mobilia'
import { desenhaEmLinhas } from './desenhoDoMovel'
import { rotationTrig } from '../roomRotation'
import { FORNALHA } from './fogoDeCasa'

/**
 * VISTA 3/4 DOS MÓVEIS (Meio-Termo, fatia MT11): o que a tela precisa saber
 * dela sem carregar o motor dos móveis (o chunk `rasterDosMoveis`). O desenho
 * em si mora em `texturas/meioTermo/moveis/tresQuartos.ts`.
 *
 * Vale só com a chave de obra LIGADA e o mapa em 3/4 (`MapData.vistaDosMoveis`);
 * sem um dos dois, a tela é a de antes: a mesma ordem, a mesma imagem, a mesma chama.
 */

/** A vista 3/4 está valendo nesta tela: chave de obra ligada e o mapa em 3/4. */
export function tresQuartosAtivo(vista: MapData['vistaDosMoveis'] | undefined): boolean {
  return vista === 'tres-quartos' && meioTermoLigado()
}

/**
 * Quanto a LENHA da fogueira sobe na 3/4, em px do protótipo (casa de 56): a
 * peça solta, fora das pedras, sobe isto (`PERFIS` em `tresQuartos.ts`, como o
 * `dyLenha` do protótipo aprovado). A chama sobe junto.
 */
export const ALTURA_DA_LENHA_EM_TRES_QUARTOS = 4
/** Px do protótipo por casa e px de mundo por casa da imagem (`contexto.ts` G e `moveis/index.ts` GRADE_DE_REFERENCIA; o teste confere). */
const PX_DO_PROTOTIPO_POR_CASA = 56
const PX_DE_MUNDO_POR_CASA = 50

/** Deslocamento da chama da fogueira na 3/4, em px de mundo (negativo = para cima na tela, em qualquer giro). */
export const DESLOCAMENTO_DA_CHAMA_EM_TRES_QUARTOS = -(ALTURA_DA_LENHA_EM_TRES_QUARTOS * PX_DE_MUNDO_POR_CASA) / PX_DO_PROTOTIPO_POR_CASA

/**
 * O deslocamento da chama deste móvel (px de mundo, em y da tela): 0 fora da 3/4, na fogueira de lado
 * (já em pé) e na fogueira EM LINHAS (MT12: o desenho de antes não sobe a lenha). A LAREIRA (29/10/2026)
 * queima no lar, rente ao chão, entre as ombreiras: não sobe. A FORNALHA queima na bancada: a chama sobe
 * a altura dela, uma fração do lado menor, como o desenho (`FORNALHA.alturaDaBancada`).
 */
export function deslocamentoDaChama(
  prop: Pick<Prop, 'mobilia' | 'mobiliaVista' | 'mobiliaDesenho'> & Partial<Pick<Prop, 'width' | 'height'>>,
  vista: MapData['vistaDosMoveis'] | undefined,
): number {
  if (!tresQuartosAtivo(vista) || desenhaEmLinhas(prop)) return 0
  if (prop.mobilia === 'lareira') return 0
  if (prop.mobilia === 'fornalha') {
    const menor = Math.min(prop.width ?? 0, prop.height ?? 0)
    return Number.isFinite(menor) && menor > 0 ? -FORNALHA.alturaDaBancada * menor : 0
  }
  return prop.mobiliaVista === 'lado' ? 0 : DESLOCAMENTO_DA_CHAMA_EM_TRES_QUARTOS
}

/**
 * A BASE do móvel na tela: o y mais ao sul da pegada girada. Na 3/4 o móvel
 * cuja base está mais ao sul fica por cima (está mais perto de quem olha).
 */
export function baseDoMovel(prop: Pick<Prop, 'y' | 'width' | 'height' | 'rotation'>): number {
  const { sin, cos } = rotationTrig(prop.rotation ?? 0)
  return prop.y + (Math.abs(cos) * prop.height + Math.abs(sin) * prop.width) / 2
}

/**
 * A ordem de desenho na 3/4: o chão (tapete, tapete longo) primeiro, na ordem
 * da lista, como sempre; o resto pela base, do norte para o sul (empate: a
 * ordem da lista). Base que não é número (arquivo estragado) vai para o fim.
 */
export function emOrdemDoTresQuartos<T extends Pick<Prop, 'mobilia' | 'y' | 'width' | 'height' | 'rotation'>>(props: readonly T[]): T[] {
  const chao = props.filter((p) => ehMovelDoChao(p.mobilia))
  // A mesa posta (os Pratos) fica por cima de tudo, pela base entre ela: a base dela cai dentro da mesa.
  const deCima = props.filter((p) => ehMovelDeCimaDaMesa(p.mobilia))
  return [...chao, ...pelaBase(props.filter((p) => !ehMovelDoChao(p.mobilia) && !ehMovelDeCimaDaMesa(p.mobilia))), ...pelaBase(deCima)]
}

/** Do norte para o sul pela base (empate: a ordem da lista); base que não é número vai para o fim. */
function pelaBase<T extends Pick<Prop, 'y' | 'width' | 'height' | 'rotation'>>(props: readonly T[]): T[] {
  return props
    .map((prop, i) => ({ prop, i, base: baseDoMovel(prop) }))
    .sort((a, b) => {
      const ba = Number.isFinite(a.base) ? a.base : Infinity
      const bb = Number.isFinite(b.base) ? b.base : Infinity
      return ba === bb ? a.i - b.i : ba - bb
    })
    .map((item) => item.prop)
}
