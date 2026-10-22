/**
 * AS 13 CAMADAS PADRÃO e a camada de cada tipo de objeto
 * (`docs/planos/camadas-fase3-2026-10-22.md`). Fonte ÚNICA de "em que camada
 * padrão mora este item": `lib/layers.ts` (fachada antiga) e
 * `lib/camadas/consulta.ts` (o contexto novo) derivam daqui.
 */
import type {
  CamadaId,
  CamadaPadraoId,
  Carimbo,
  Drawing,
  FloorPiece,
  Light,
  MapLine,
  MapMarker,
  ModeloDeCamadas,
  Pin,
  Prop,
  Region,
  Stair,
  Token,
  Wall,
} from '../../types/map'

/** De BAIXO para CIMA, na ordem em que a tela já desenha hoje. */
export const CAMADAS_PADRAO: readonly CamadaPadraoId[] = [
  'chao', 'salas', 'desenhos', 'terreno', 'paredes', 'portas', 'escadas',
  'objetos', 'decoracao', 'iluminacao', 'tokens', 'anotacoes', 'telhados',
]

export const ROTULOS_DAS_CAMADAS: Record<CamadaPadraoId, string> = {
  chao: 'Chão',
  salas: 'Salas',
  desenhos: 'Desenhos',
  terreno: 'Terreno',
  paredes: 'Paredes',
  portas: 'Portas',
  escadas: 'Escadas',
  objetos: 'Objetos',
  decoracao: 'Decoração',
  iluminacao: 'Iluminação',
  tokens: 'Tokens',
  anotacoes: 'Anotações',
  telhados: 'Telhados',
}

/** O modelo de toda aventura que não gravou o dela. Não mexer: é compartilhado. */
export const MODELO_PADRAO: ModeloDeCamadas = { ordem: CAMADAS_PADRAO.map((id) => ({ id })) }

const IDS_PADRAO: ReadonlySet<string> = new Set(CAMADAS_PADRAO)

/** `livre_` + id curto, sem espaço (o id é aleatório, nunca o nome). */
const ID_LIVRE = /^livre_[A-Za-z0-9_-]{1,64}$/

export function ehCamadaPadrao(id: string): id is CamadaPadraoId {
  return IDS_PADRAO.has(id)
}

/** Valor do arquivo que serve como id de camada: uma das 13 ou uma livre bem formada. */
export function ehCamadaId(valor: unknown): valor is CamadaId {
  return typeof valor === 'string' && (IDS_PADRAO.has(valor) || ID_LIVRE.test(valor))
}

/** Posição na lista padrão (0 = Chão); -1 para camada livre. */
export function indicePadrao(id: CamadaId): number {
  return ehCamadaPadrao(id) ? CAMADAS_PADRAO.indexOf(id) : -1
}

/** Os tipos de objeto que moram numa camada. `telhado` é o teto da Sala (RoomMeta.roof). */
export type TipoDeObjeto =
  | 'parede'
  | 'escada'
  | 'regiao'
  | 'peca'
  | 'objeto'
  | 'ficha'
  | 'pino'
  | 'luz'
  | 'desenho'
  | 'linha'
  | 'marcador'
  | 'carimbo'
  | 'telhado'

export interface ItemPorTipo {
  parede: Wall
  escada: Stair
  regiao: Region
  peca: FloorPiece
  objeto: Prop
  ficha: Token
  pino: Pin
  luz: Light
  desenho: Drawing
  linha: MapLine
  marcador: MapMarker
  carimbo: Carimbo
  telhado: Region
}

type RegraPorTipo<R> = { [K in TipoDeObjeto]: (item: ItemPorTipo[K]) => R }

/** A tabela do plano: a camada de cada tipo quando o item não escolheu outra. */
const PADRAO_POR_TIPO: RegraPorTipo<CamadaPadraoId> = {
  parede: (parede) => (parede.door ? 'portas' : 'paredes'),
  escada: () => 'escadas',
  regiao: () => 'salas',
  peca: () => 'chao',
  // Prop.layer é a escolha antiga (Objetos ou Decoração) e continua sendo o padrão dele.
  objeto: (prop) => prop.layer ?? 'objetos',
  ficha: () => 'tokens',
  pino: () => 'anotacoes',
  luz: () => 'iluminacao',
  // Texto e Caminho são Anotações (hoje acima das fichas); o resto do botão Desenho é Desenhos.
  desenho: (desenho) => (desenho.kind === 'text' || desenho.kind === 'path' ? 'anotacoes' : 'desenhos'),
  linha: () => 'paredes',
  marcador: () => 'portas',
  carimbo: () => 'terreno',
  telhado: () => 'telhados',
}

/** Onde cada tipo guarda a camada que o mestre escolheu. O telhado guarda na Sala, não na Região. */
const ESCOLHIDA_POR_TIPO: RegraPorTipo<CamadaId | undefined> = {
  parede: (item) => item.camada,
  escada: (item) => item.camada,
  regiao: (item) => item.camada,
  peca: (item) => item.camada,
  objeto: (item) => item.camada,
  ficha: (item) => item.camada,
  pino: (item) => item.camada,
  luz: (item) => item.camada,
  desenho: (item) => item.camada,
  linha: (item) => item.camada,
  marcador: (item) => item.camada,
  carimbo: (item) => item.camada,
  telhado: (regiao) => regiao.room?.camadaDoTelhado,
}

export function camadaPadraoDe<K extends TipoDeObjeto>(tipo: K, item: ItemPorTipo[K]): CamadaPadraoId {
  const regra: (item: ItemPorTipo[K]) => CamadaPadraoId = PADRAO_POR_TIPO[tipo]
  return regra(item)
}

/** A camada que o mestre escolheu para o item, sem conferir se ela existe (isso é de `consulta.ts`). */
export function camadaEscolhidaDe<K extends TipoDeObjeto>(tipo: K, item: ItemPorTipo[K]): CamadaId | undefined {
  const regra: (item: ItemPorTipo[K]) => CamadaId | undefined = ESCOLHIDA_POR_TIPO[tipo]
  return regra(item)
}
