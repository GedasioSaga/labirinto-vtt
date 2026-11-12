import type { MapData, Prop, RegionPoint } from '../types/map'
import { pointInRing } from '../lib/floorContour'
import { objetoBarraPassagem } from '../lib/obstaculosDeObjeto'

/**
 * OBJETOS LEMBRADOS (caça de 12/11/2026, J5): a tela do jogador LEMBRA a
 * pegada dos objetos que barram e que o host já lhe entregou, só para PLANEJAR
 * caminho (clique para andar, "Andar até aqui", preparo da malha). Nunca para
 * desenhar: o desenho continua sendo só o recorte de agora.
 *
 * Sem isto, o moinho já visto que sai da visão (à noite, 5,5 casas) some do
 * recorte, o plano vira uma reta por dentro dele e o host recusa o trecho
 * inteiro com "Parede no caminho" (o objeto fora da tela dele recusa como
 * parede, de propósito): a ficha não sai do lugar em campo aberto.
 *
 * POR QUE NADA ESCONDIDO PASSA A APARECER: só entra aqui o que veio no
 * recorte, ou seja, o que o host JÁ entregou a este jogador. Objeto oculto, de
 * camada escondida, de sala secreta ou sob teto fechado nunca vem no recorte,
 * então nunca entra na memória. Nada novo sai do host e nada é desenhado. O
 * host continua sendo a autoridade de cada passo.
 *
 * Puro: sem store, sem DOM, sem Pixi.
 */

/** A memória de uma cena. */
export interface ObjetosLembrados {
  /** A cena da memória: outra cena zera tudo. */
  readonly mapaId: string
  /** Todo objeto que barra e que o recorte já trouxe, pelo id (a última versão recebida). */
  readonly porId: ReadonlyMap<string, Prop>
  /** Os lembrados que o último recorte NÃO trouxe: só estes se somam ao mapa do plano. */
  readonly foraDoRecorte: readonly Prop[]
}

const NENHUM_LEMBRADO: ReadonlyMap<string, Prop> = new Map()
const NENHUM_FORA: readonly Prop[] = []

/** O centro do objeto está na visão de agora? (O jogador olha o lugar.) */
function centroNaVisao(prop: Pick<Prop, 'x' | 'y'>, vistoAgora: readonly RegionPoint[][]): boolean {
  const centro = { x: prop.x, y: prop.y }
  return vistoAgora.some((anel) => anel.length >= 3 && pointInRing(centro, anel))
}

function mesmasEntradas(a: ReadonlyMap<string, Prop>, b: ReadonlyMap<string, Prop>): boolean {
  if (a.size !== b.size) return false
  for (const [id, prop] of a) if (b.get(id) !== prop) return false
  return true
}

function mesmaLista(a: readonly Prop[], b: readonly Prop[]): boolean {
  return a.length === b.length && a.every((prop, k) => b[k] === prop)
}

/**
 * A memória depois do recorte `mapa` com a visão `vistoAgora`:
 * - entra (ou se atualiza) todo objeto do recorte que barra (`objetoBarraPassagem`);
 * - o objeto do recorte que deixou de barrar sai;
 * - o lembrado que o recorte não trouxe e cujo centro está na visão de agora
 *   sai: o jogador olha o lugar e o objeto não está mais lá;
 * - outra cena (`mapa.id`) zera tudo.
 * Nada mudou: a MESMA memória (os caches do caminho guardam pela referência).
 */
export function lembrar(antes: ObjetosLembrados | undefined, mapa: Pick<MapData, 'id' | 'props'>, vistoAgora: readonly RegionPoint[][]): ObjetosLembrados {
  const mesmaCena = antes !== undefined && antes.mapaId === mapa.id
  const anteriores = mesmaCena ? antes.porId : NENHUM_LEMBRADO
  const noRecorte = new Set<string>()
  const porId = new Map<string, Prop>()
  for (const prop of mapa.props) {
    noRecorte.add(prop.id)
    if (objetoBarraPassagem(prop)) porId.set(prop.id, prop)
  }
  const foraDoRecorte: Prop[] = []
  for (const [id, prop] of anteriores) {
    if (noRecorte.has(id) || centroNaVisao(prop, vistoAgora)) continue
    porId.set(id, prop)
    foraDoRecorte.push(prop)
  }
  if (mesmaCena && mesmasEntradas(antes.porId, porId) && mesmaLista(antes.foraDoRecorte, foraDoRecorte)) return antes
  return { mapaId: mapa.id, porId, foraDoRecorte: foraDoRecorte.length === 0 ? NENHUM_FORA : foraDoRecorte }
}

const cacheDasListas = new WeakMap<readonly Prop[], WeakMap<readonly Prop[], Prop[]>>()
const cacheDosMapas = new WeakMap<MapData, WeakMap<Prop[], MapData>>()

/** Os objetos do recorte mais os lembrados que ele não tem: a mesma lista para as mesmas duas listas. */
function objetosDoPlano(doRecorte: Prop[], lembrados: readonly Prop[]): Prop[] {
  let porLembrados = cacheDasListas.get(doRecorte)
  if (porLembrados === undefined) {
    porLembrados = new WeakMap()
    cacheDasListas.set(doRecorte, porLembrados)
  }
  const guardada = porLembrados.get(lembrados)
  if (guardada !== undefined) return guardada
  // O mapa da tela pode ter mudado depois do recorte (o mesmo objeto voltou): o do recorte vence.
  const presentes = new Set(doRecorte.map((prop) => prop.id))
  const extras = lembrados.filter((prop) => !presentes.has(prop.id))
  const lista = extras.length === 0 ? doRecorte : [...doRecorte, ...extras]
  porLembrados.set(lembrados, lista)
  return lista
}

/**
 * O mapa com que a tela PLANEJA caminho: o recorte `map` com os objetos
 * lembrados que ele não trouxe. Sem memória desta cena, ou sem nada fora do
 * recorte, o próprio `map`. As mesmas entradas devolvem o MESMO mapa: o
 * clique para andar, o "Andar até aqui" e o preparo da malha têm de ver as
 * MESMAS paredes (`mapaParaAndarDoJogador` guarda pela referência), senão a
 * malha adiantada não serve. NUNCA vai para o desenho.
 */
export function mapaParaPlanejar(map: MapData, lembrados: ObjetosLembrados | undefined): MapData {
  if (lembrados === undefined || lembrados.mapaId !== map.id || lembrados.foraDoRecorte.length === 0) return map
  const props = objetosDoPlano(map.props, lembrados.foraDoRecorte)
  if (props === map.props) return map
  let porObjetos = cacheDosMapas.get(map)
  if (porObjetos === undefined) {
    porObjetos = new WeakMap()
    cacheDosMapas.set(map, porObjetos)
  }
  const guardado = porObjetos.get(props)
  if (guardado !== undefined) return guardado
  const novo = { ...map, props }
  porObjetos.set(props, novo)
  return novo
}
