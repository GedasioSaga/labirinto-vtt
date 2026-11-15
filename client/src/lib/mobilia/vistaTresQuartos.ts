import type { MapData, Prop } from '../../types/map'
import { meioTermoLigado } from '../estiloDoMapa'
import { ehMovelDeCimaDaMesa, ehMovelDoChao, emOrdemDeDesenho } from '../mobilia'
import { desenhaEmLinhas } from './desenhoDoMovel'
import { rotationTrig } from '../roomRotation'
import { BRASEIRO, FORNALHA, fogoDaTochaDePe, fogoDaTochaDeParede } from './fogoDeCasa'

/**
 * VISTA 3/4 DOS MÓVEIS (Meio-Termo, fatia MT11): o que a tela precisa saber
 * dela sem carregar o motor dos móveis (o chunk `rasterDosMoveis`). O desenho
 * em si mora em `texturas/meioTermo/moveis/tresQuartos.ts`.
 *
 * A vista é POR MÓVEL (pedido de 15/11/2026): a escolha dele
 * (`Prop.mobiliaTresQuartos`) ou, sem escolha, a do mapa (`MapData.vistaDosMoveis`).
 * Vale só com a chave de obra LIGADA; sem ela, ou sem nenhum móvel em 3/4, a
 * tela é a de antes: a mesma ordem, a mesma imagem, a mesma chama.
 */

/** A vista do mapa, como quem desenha a recebe (`MapData.vistaDosMoveis`). */
type VistaDoMapa = MapData['vistaDosMoveis'] | undefined

/**
 * A VISTA EFETIVA deste móvel, a única conta dela: a escolha do móvel ou, sem
 * escolha, a do mapa. Só o dado, sem a chave de obra. Escolha que não é
 * booleano (colado, acervo, arquivo torto que não passou pela leitura) vale
 * como ausente.
 */
export function movelEmTresQuartos(prop: Pick<Prop, 'mobiliaTresQuartos'>, vistaDoMapa: VistaDoMapa): boolean {
  return typeof prop.mobiliaTresQuartos === 'boolean' ? prop.mobiliaTresQuartos : vistaDoMapa === 'tres-quartos'
}

/** A vista 3/4 está valendo NESTE móvel nesta tela: chave de obra ligada e o móvel em 3/4. */
export function tresQuartosAtivo(prop: Pick<Prop, 'mobiliaTresQuartos'>, vistaDoMapa: VistaDoMapa): boolean {
  return meioTermoLigado() && movelEmTresQuartos(prop, vistaDoMapa)
}

/**
 * A chave "Vista 3/4" muda o desenho deste móvel? No chão (tapete, tapete
 * longo) e no desenho EM LINHAS não muda nada: a ficha e o menu escondem o
 * controle, e a ação em lote não grava escolha neles.
 */
export function aceitaTresQuartos(prop: Pick<Prop, 'mobilia' | 'mobiliaDesenho'>): boolean {
  return prop.mobilia !== undefined && !ehMovelDoChao(prop.mobilia) && !desenhaEmLinhas(prop)
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
 * a altura dela, uma fração do lado menor, como o desenho (`FORNALHA.alturaDaBancada`). O FORNO DE PÃO
 * (11/11/2026) é como a lareira: o lar fica no chão, fora de qualquer estrutura, e a chama não sobe. O
 * BRASEIRO (11/11/2026) é como a fornalha: o carvão queima rente à borda da bacia, no alto do tripé, e a chama
 * sobe a altura da borda (`BRASEIRO.alturaDaBorda`, 0,72 casa no braseiro de 0,8). As duas TOCHAS (12/11/2026)
 * também: a chama sobe até o alto da cabeça (`fogoDaTochaDePe` e `fogoDaTochaDeParede`); na de pé a altura muda
 * um pouco com a pegada, porque o cesto tem altura fixa em casas.
 */
export function deslocamentoDaChama(
  prop: Pick<Prop, 'mobilia' | 'mobiliaVista' | 'mobiliaDesenho' | 'mobiliaTresQuartos'> & Partial<Pick<Prop, 'width' | 'height'>>,
  vistaDoMapa: VistaDoMapa,
): number {
  if (!tresQuartosAtivo(prop, vistaDoMapa) || desenhaEmLinhas(prop)) return 0
  if (prop.mobilia === 'lareira' || prop.mobilia === 'fornoDePao') return 0
  if (prop.mobilia === 'fornalha' || prop.mobilia === 'braseiro' || prop.mobilia === 'tochaDeParede' || prop.mobilia === 'tochaDePe') {
    const menor = Math.min(prop.width ?? 0, prop.height ?? 0)
    if (!(Number.isFinite(menor) && menor > 0)) return 0
    return -alturaDaChamaNoMovel(prop.mobilia, prop.width ?? 0, prop.height ?? 0) * menor
  }
  return prop.mobiliaVista === 'lado' ? 0 : DESLOCAMENTO_DA_CHAMA_EM_TRES_QUARTOS
}

/** Até onde a chama sobe na 3/4, em fração do menor lado; a pegada em px de mundo (a das tochas vai em casas da imagem). */
function alturaDaChamaNoMovel(tipo: 'fornalha' | 'braseiro' | 'tochaDeParede' | 'tochaDePe', largura: number, altura: number): number {
  if (tipo === 'fornalha') return FORNALHA.alturaDaBancada
  if (tipo === 'braseiro') return BRASEIRO.alturaDaBorda
  const [casasW, casasH] = [largura / PX_DE_MUNDO_POR_CASA, altura / PX_DE_MUNDO_POR_CASA]
  return (tipo === 'tochaDePe' ? fogoDaTochaDePe(casasW, casasH) : fogoDaTochaDeParede(casasW, casasH)).alturaDaBorda
}

/**
 * A BASE do móvel na tela: o y mais ao sul da pegada girada. Na 3/4 o móvel
 * cuja base está mais ao sul fica por cima (está mais perto de quem olha).
 */
export function baseDoMovel(prop: Pick<Prop, 'y' | 'width' | 'height' | 'rotation'>): number {
  const { sin, cos } = rotationTrig(prop.rotation ?? 0)
  return prop.y + (Math.abs(cos) * prop.height + Math.abs(sin) * prop.width) / 2
}

/** O que a ordem de desenho lê do objeto: o tipo, a escolha da vista e a pegada. */
type PropNaOrdem = Pick<Prop, 'mobilia' | 'mobiliaTresQuartos' | 'y' | 'width' | 'height' | 'rotation'>

/**
 * A ORDEM DE DESENHO COM A VISTA POR OBJETO. O chão (tapete, tapete longo)
 * primeiro, na ordem da lista, como sempre. No resto, o objeto visto de cima
 * fica onde a lista manda, e os que estão em 3/4 trocam de lugar só ENTRE SI,
 * pela base (do norte para o sul; empate: a ordem da lista), nas posições que
 * já ocupavam. A mesa posta (os Pratos) fica por cima de tudo, com a mesma
 * regra entre ela: a base dela cai dentro da mesa.
 *
 * Nenhum em 3/4: a ordem de sempre (`emOrdemDeDesenho`, a mesma lista). Todos
 * em 3/4: a ordem pela base inteira, como era com o mapa em 3/4. Objeto sem
 * escolha segue o mapa (`movelEmTresQuartos`). Sem a chave de obra: quem
 * desenha não chama esta função.
 */
export function emOrdemDasVistas<T extends PropNaOrdem>(props: readonly T[], vistaDoMapa: VistaDoMapa): readonly T[] {
  const emTresQuartos = (prop: T): boolean => movelEmTresQuartos(prop, vistaDoMapa)
  if (!props.some(emTresQuartos)) return emOrdemDeDesenho(props)
  const chao = props.filter((p) => ehMovelDoChao(p.mobilia))
  const doMeio = props.filter((p) => !ehMovelDoChao(p.mobilia) && !ehMovelDeCimaDaMesa(p.mobilia))
  const deCimaDaMesa = props.filter((p) => ehMovelDeCimaDaMesa(p.mobilia))
  return [...chao, ...comOsTresQuartosPelaBase(doMeio, emTresQuartos), ...comOsTresQuartosPelaBase(deCimaDaMesa, emTresQuartos)]
}

/** Os da faixa que estão em 3/4 trocam de lugar entre si, pela base, nas posições que já ocupavam; o resto não sai do lugar. */
function comOsTresQuartosPelaBase<T extends PropNaOrdem>(faixa: readonly T[], emTresQuartos: (prop: T) => boolean): T[] {
  const ordenados = pelaBase(faixa.filter(emTresQuartos))
  let proximo = 0
  return faixa.map((prop) => (emTresQuartos(prop) ? ordenados[proximo++] : prop))
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
