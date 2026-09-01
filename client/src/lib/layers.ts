/**
 * Sistema de 9 camadas (LayerId, em types/map.ts). Camada é DERIVADA do tipo
 * da entidade — cada tipo tem exatamente uma função `*Layer` abaixo, que é a
 * ÚNICA fonte de verdade sobre "que camada é essa entidade". Render
 * (pixi/PixiCanvas.tsx, território do integrador) e hit-test
 * (lib/selectionHitTest.ts) usam as mesmas funções de filtro daqui — nunca
 * reimplementar a derivação em outro lugar.
 *
 * 'grid' não é camada: MapData.showGrid já é o toggle da grade — ver o
 * comentário em types/map.ts junto de LayerId.
 */
import type { Drawing, Light, MapData, Prop, Region, Stair, Token, Wall } from '../types/map'
import type { LayerId } from '../types/map'
import { canInteract, type Lockable } from './itemTransform'

/** Rótulos em PT-BR pro painel de camadas, uma entrada por LayerId. */
export const LAYER_LABELS: Record<LayerId, string> = {
  paredes: 'Paredes',
  portas: 'Portas',
  salas: 'Salas',
  escadas: 'Escadas',
  objetos: 'Objetos',
  decoracao: 'Decoração',
  iluminacao: 'Iluminação',
  tokens: 'Tokens',
  anotacoes: 'Anotações',
}

/** Parede com porta vai para 'portas'; sem porta, para 'paredes'. */
export function wallLayer(wall: Wall): LayerId {
  return wall.door ? 'portas' : 'paredes'
}

/**
 * Toda Region é 'salas', com ou sem `room` (a ferramenta "Região" comum e a
 * "Sala" com identidade compartilham a mesma camada — o schema não separa as
 * duas, só `room` marca a segunda como tendo nome/resize).
 */
export function regionLayer(_region: Region): LayerId {
  return 'salas'
}

export function stairLayer(_stair: Stair): LayerId {
  return 'escadas'
}

export function lightLayer(_light: Light): LayerId {
  return 'iluminacao'
}

export function tokenLayer(_token: Token): LayerId {
  return 'tokens'
}

export function drawingLayer(_drawing: Drawing): LayerId {
  return 'anotacoes'
}

/** ÚNICO tipo com override: Prop.layer ausente é 'objetos' (ver types/map.ts). */
export function propLayer(prop: Prop): LayerId {
  return prop.layer ?? 'objetos'
}

/** Os dois valores que Prop.layer pode assumir EXPLICITAMENTE (o que o
 *  seletor da UI oferece). `undefined` não entra aqui — é o default
 *  ('objetos'), não uma escolha; ver propLayer() acima. */
export const PROP_LAYER_OPTIONS: readonly NonNullable<Prop['layer']>[] = ['objetos', 'decoracao']

export function isLayerVisible(hiddenLayers: readonly LayerId[], layer: LayerId): boolean {
  return !hiddenLayers.includes(layer)
}

/**
 * Onda 4, Frente D — "travar camada inteira": item de camada travada
 * continua VISÍVEL (isLayerVisible acima é independente disto) mas não pode
 * ser selecionado nem movido. Mesma forma de hiddenLayers por pedido
 * explícito do integrador — reduz código novo e reduz surpresa de quem já
 * conhece isLayerVisible/toggleLayerVisibility.
 */
export function isLayerLocked(lockedLayers: readonly LayerId[], layer: LayerId): boolean {
  return lockedLayers.includes(layer)
}

/**
 * "Pode selecionar/mover este item?" — compõe a checagem por ITEM
 * (Lockable.locked, lib/itemTransform.ts, já usada por hit-test/drag hoje)
 * com a checagem por CAMADA (isLayerLocked, acima). Item destravado numa
 * camada travada continua não-interativo, e vice-versa: um único mecanismo,
 * não dois paralelos — é a composição que o CONTRATO da Onda 4 pediu, em vez
 * de o integrador reimplementar "trava de camada" do zero em
 * PixiCanvas.tsx/selectionHitTest.ts.
 */
export function canInteractInLayer(
  item: Lockable,
  layer: LayerId,
  lockedLayers: readonly LayerId[],
): boolean {
  return canInteract(item) && !isLayerLocked(lockedLayers, layer)
}

/**
 * Filtro genérico: mantém só os itens cuja camada (derivada por `layerOf`)
 * não está em `hiddenLayers`. Caminho rápido quando nada está oculto — devolve
 * a MESMA referência de array, sem alocar — importante porque o integrador
 * chama isto a cada redraw (PixiCanvas.tsx:168-190) e um array novo a cada
 * frame pressiona o GC à toa quando o usuário não escondeu nenhuma camada.
 */
function filterByLayer<T>(items: T[], layerOf: (item: T) => LayerId, hiddenLayers: readonly LayerId[]): T[] {
  if (hiddenLayers.length === 0) return items
  return items.filter((item) => !hiddenLayers.includes(layerOf(item)))
}

export function visibleWalls(walls: Wall[], hiddenLayers: readonly LayerId[]): Wall[] {
  return filterByLayer(walls, wallLayer, hiddenLayers)
}

export function visibleRegions(regions: Region[], hiddenLayers: readonly LayerId[]): Region[] {
  return filterByLayer(regions, regionLayer, hiddenLayers)
}

export function visibleStairs(stairs: Stair[], hiddenLayers: readonly LayerId[]): Stair[] {
  return filterByLayer(stairs, stairLayer, hiddenLayers)
}

export function visibleLights(lights: Light[], hiddenLayers: readonly LayerId[]): Light[] {
  return filterByLayer(lights, lightLayer, hiddenLayers)
}

export function visibleTokens(tokens: Token[], hiddenLayers: readonly LayerId[]): Token[] {
  return filterByLayer(tokens, tokenLayer, hiddenLayers)
}

export function visibleDrawings(drawings: Drawing[], hiddenLayers: readonly LayerId[]): Drawing[] {
  return filterByLayer(drawings, drawingLayer, hiddenLayers)
}

export function visibleProps(props: Prop[], hiddenLayers: readonly LayerId[]): Prop[] {
  return filterByLayer(props, propLayer, hiddenLayers)
}

/** Quantas entidades cada camada tem hoje — usado pelo LayersPanel pra mostrar
 *  a contagem ao lado do nome (ex.: "Paredes (3)"). Conta TODAS as entidades,
 *  visíveis ou não — a contagem não deve mudar quando o usuário oculta a
 *  própria camada. */
export function countEntitiesByLayer(map: MapData): Record<LayerId, number> {
  // Objeto literal, não Object.fromEntries(LAYER_IDS.map(...)) — este último
  // tipa como Record<string, number> (perde a união literal), o que exigiria
  // um `as` pra devolver Record<LayerId, number>. Escrito por extenso, o
  // compilador confere as 9 chaves sozinho — se LAYER_IDS ganhar/perder uma
  // camada um dia, o objeto abaixo desalinha e vira erro de tipo aqui, não
  // silêncio em runtime.
  const counts: Record<LayerId, number> = {
    paredes: 0,
    portas: 0,
    salas: 0,
    escadas: 0,
    objetos: 0,
    decoracao: 0,
    iluminacao: 0,
    tokens: 0,
    anotacoes: 0,
  }
  for (const wall of map.walls) counts[wallLayer(wall)] += 1
  for (const region of map.regions) counts[regionLayer(region)] += 1
  for (const stair of map.stairs) counts[stairLayer(stair)] += 1
  for (const light of map.lights) counts[lightLayer(light)] += 1
  for (const token of map.tokens) counts[tokenLayer(token)] += 1
  for (const drawing of map.drawings) counts[drawingLayer(drawing)] += 1
  for (const prop of map.props) counts[propLayer(prop)] += 1
  return counts
}
