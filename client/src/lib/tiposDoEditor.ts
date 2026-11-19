/**
 * A TABELA DOS TIPOS DO EDITOR (análise de 18/11/2026, seção 3, causa 1).
 *
 * O editor tem 14 tipos de objeto selecionável (`SelectionKind`), e cada
 * operação de conjunto tinha a própria lista deles escrita à mão: caixa,
 * mover, alinhar, levar ao piso, nascer no piso. Todo tipo novo das Fases 2 e
 * 4 (carimbo, pino, zona, água, risco do Barranco, abismo) escapou de alguma.
 *
 * Aqui mora UMA linha por tipo, com o que as operações de conjunto precisam
 * saber: em que lista do mapa ele mora, como devolver a lista ao mapa e por
 * qual campo da seleção por área (`AreaSelection`) a caixa e o mover o
 * alcançam. A tabela é `{ [K in SelectionKind]: … }`: tipo novo em
 * `SelectionKind` sem linha aqui NÃO COMPILA, e com a linha ele já entra em
 * todas as operações que andam por `comCadaTipo`.
 *
 * As operações que precisam de regra própria por tipo continuam onde estavam,
 * cada uma exaustiva pelo compilador: clonar (`cloneEntity`, lib/entityClone.ts),
 * achar e inserir a cópia e apagar (stores/mapStore.ts) e a camada do item
 * (`TIPO_DA_SELECAO`, lib/camadas/mover.ts).
 *
 * SÓ TIPOS nos imports, de propósito: `lib/pisos.ts` lê esta tabela e é lido
 * por quase todo o resto (carimbos, água, barranco, abismo). Um import de
 * valor daqui para qualquer um deles fecharia um ciclo.
 */
import type { Abismo, Agua, Carimbo, ConcealZone, Drawing, FloorPiece, Light, MapData, NoPiso, Pin, Prop, Region, RiscoDeBarranco, Stair, Token, Wall } from '../types/map'
import type { SelectionKind } from '../types/tools'
import type { AreaSelection } from './areaSelection'

/** A entidade do mapa de cada tipo selecionável. */
export interface EntidadePorTipo {
  wall: Wall
  region: Region
  light: Light
  token: Token
  prop: Prop
  stair: Stair
  drawing: Drawing
  carimbo: Carimbo
  pin: Pin
  zone: ConcealZone
  agua: Agua
  barranco: RiscoDeBarranco
  abismo: Abismo
  floor: FloorPiece
}

/** O que todo item do editor tem: identidade e piso (ausente = térreo). */
export type ItemDoEditor = NoPiso & { id: string }

/** Um campo de `AreaSelection`: a lista de ids de um tipo na seleção por área. */
export type CampoDaArea = keyof AreaSelection

export interface TipoDoEditor<K extends SelectionKind> {
  /** A lista do mapa em que o tipo mora. Campo opcional ausente: lista vazia. */
  readonly lista: (map: MapData) => EntidadePorTipo[K][]
  /**
   * O mapa com os itens da lista TROCADOS (mesma quantidade: mover, mudar de
   * piso, religar). Campo opcional ausente continua ausente. Inserir e apagar
   * não passam por aqui: cada tipo tem a regra dele (teto de carimbos, último
   * risco que tira o barranco, paredes da sala).
   */
  readonly comLista: (map: MapData, lista: EntidadePorTipo[K][]) => MapData
  /** O campo de `AreaSelection` do tipo: por ele a caixa, o mover, o alinhar e o distribuir alcançam o item. */
  readonly naArea: CampoDaArea
}

export const TIPOS_DO_EDITOR: { readonly [K in SelectionKind]: TipoDoEditor<K> } = {
  wall: { lista: (map) => map.walls, comLista: (map, walls) => ({ ...map, walls }), naArea: 'walls' },
  region: { lista: (map) => map.regions, comLista: (map, regions) => ({ ...map, regions }), naArea: 'regions' },
  light: { lista: (map) => map.lights, comLista: (map, lights) => ({ ...map, lights }), naArea: 'lights' },
  token: { lista: (map) => map.tokens, comLista: (map, tokens) => ({ ...map, tokens }), naArea: 'tokens' },
  prop: { lista: (map) => map.props, comLista: (map, props) => ({ ...map, props }), naArea: 'props' },
  stair: { lista: (map) => map.stairs, comLista: (map, stairs) => ({ ...map, stairs }), naArea: 'stairs' },
  drawing: { lista: (map) => map.drawings, comLista: (map, drawings) => ({ ...map, drawings }), naArea: 'drawings' },
  carimbo: {
    lista: (map) => map.carimbos ?? [],
    comLista: (map, carimbos) => (map.carimbos === undefined ? map : { ...map, carimbos }),
    naArea: 'carimbos',
  },
  pin: { lista: (map) => map.pins, comLista: (map, pins) => ({ ...map, pins }), naArea: 'pins' },
  zone: { lista: (map) => map.concealZones, comLista: (map, concealZones) => ({ ...map, concealZones }), naArea: 'zonas' },
  agua: {
    lista: (map) => map.aguas ?? [],
    comLista: (map, aguas) => (map.aguas === undefined ? map : { ...map, aguas }),
    naArea: 'aguas',
  },
  barranco: {
    lista: (map) => map.barranco?.riscos ?? [],
    comLista: (map, riscos) => (map.barranco === undefined ? map : { ...map, barranco: { ...map.barranco, riscos } }),
    naArea: 'riscosDoBarranco',
  },
  abismo: {
    lista: (map) => map.abismos ?? [],
    comLista: (map, abismos) => (map.abismos === undefined ? map : { ...map, abismos }),
    naArea: 'abismos',
  },
  floor: { lista: (map) => map.floor, comLista: (map, floor) => ({ ...map, floor }), naArea: 'pecasDeChao' },
}

/** `chave` é um dos tipos do editor? Para o que vem de fora (arquivo): `Object.hasOwn`, e não `in`, que aceitaria "toString". */
export function ehTipoDoEditor(chave: string): chave is SelectionKind {
  return Object.hasOwn(TIPOS_DO_EDITOR, chave)
}

/**
 * Os 14 tipos, na ordem das linhas da tabela — a mesma em que a seleção por
 * área sempre os listou, com a peça de chão (que entrou por último) no fim.
 * Sai das chaves da própria tabela: não há segunda lista para esquecer.
 */
export const TODOS_OS_TIPOS: readonly SelectionKind[] = Object.keys(TIPOS_DO_EDITOR).filter(ehTipoDoEditor)

/** O item `id` do tipo `tipo` ainda está no mapa? */
export function existeNoMapa<K extends SelectionKind>(map: MapData, tipo: K, id: string): boolean {
  const lista: readonly ItemDoEditor[] = TIPOS_DO_EDITOR[tipo].lista(map)
  return lista.some((item) => item.id === id)
}

/** O que `comCadaTipo` faz com a lista de um tipo: devolver a MESMA lista é "nada mudou". */
export type TrocaDeLista = <K extends SelectionKind>(lista: EntidadePorTipo[K][], tipo: K) => EntidadePorTipo[K][]

function comListaTrocada<K extends SelectionKind>(map: MapData, tipo: K, troca: TrocaDeLista): MapData {
  const linha: TipoDoEditor<K> = TIPOS_DO_EDITOR[tipo]
  const antes = linha.lista(map)
  const depois = troca(antes, tipo)
  return depois === antes ? map : linha.comLista(map, depois)
}

/**
 * Passa `troca` pela lista de CADA tipo do editor. Devolve o MESMO mapa quando
 * nenhuma lista mudou (a store não empilha passo vazio no desfazer).
 */
export function comCadaTipo(map: MapData, troca: TrocaDeLista): MapData {
  let next = map
  for (const tipo of TODOS_OS_TIPOS) next = comListaTrocada(next, tipo, troca)
  return next
}
