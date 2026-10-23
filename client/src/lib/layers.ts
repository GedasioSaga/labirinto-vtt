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
 *
 * FASE 3 (13 camadas, `docs/planos/camadas-fase3-2026-10-22.md`): este
 * arquivo virou FACHADA, com os mesmos nomes e o mesmo comportamento. Os
 * `visible*` aceitam, no lugar da lista `hiddenLayers`, o mapa inteiro — aí
 * quem responde é `lib/camadas/consulta.ts` (camada escolhida do item, Chão
 * seguindo Salas no mapa de antes etc.). Com a lista, a derivação é a de
 * sempre, pelas `*Layer` abaixo; o teste em matriz de `consulta.test.ts`
 * confere que as duas concordam em todo mapa de antes.
 */
import type { CamadaId, Drawing, Light, MapData, Pin, Prop, Region, Stair, Token, Wall } from '../types/map'
import type { LayerId } from '../types/map'
import { contextoDeCamadas } from './camadas/consulta'
import type { ItemPorTipo, TipoDeObjeto } from './camadas/padrao'
import { canInteract, type Lockable } from './itemTransform'
import { isStairPin } from './stairTravel'

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

/** Pino de ponto de interesse é anotação do mestre por cima da planta. */
export function pinLayer(_pin: Pin): LayerId {
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

export function isLayerVisible(hiddenLayers: readonly CamadaId[], layer: LayerId): boolean {
  return !hiddenLayers.includes(layer)
}

/**
 * Onda 4, Frente D — "travar camada inteira": item de camada travada
 * continua VISÍVEL (isLayerVisible acima é independente disto) mas não pode
 * ser selecionado nem movido. Mesma forma de hiddenLayers por pedido
 * explícito do integrador — reduz código novo e reduz surpresa de quem já
 * conhece isLayerVisible/toggleLayerVisibility.
 */
export function isLayerLocked(lockedLayers: readonly CamadaId[], layer: LayerId): boolean {
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
  lockedLayers: readonly CamadaId[],
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
function filterByLayer<K extends TipoDeObjeto>(
  items: ItemPorTipo[K][],
  tipo: K,
  layerOf: (item: ItemPorTipo[K]) => LayerId,
  fonte: FonteDeCamadas,
): ItemPorTipo[K][] {
  // `hiddenLayers` vazio: nada oculto para o mestre, com mapa de antes ou não (só guarda LayerId).
  if (ehMapa(fonte)) {
    if (fonte.hiddenLayers.length === 0) return items
    const camadas = contextoDeCamadas(fonte)
    return items.filter((item) => camadas.mestreVe(camadas.camadaDe(tipo, item)))
  }
  if (fonte.length === 0) return items
  return items.filter((item) => !fonte.includes(layerOf(item)))
}

/**
 * O 2º parâmetro dos `visible*`: a lista `hiddenLayers` de sempre ou o mapa
 * inteiro. A lista (desde a fatia 6, `CamadaId[]`) só responde pelas 9 de
 * antes, pela derivação de sempre; o mapa responde pelas 13 (Chão, Desenhos,
 * Terreno e Telhados do mapa v2 inclusive).
 */
export type FonteDeCamadas = readonly CamadaId[] | MapData

function ehMapa(fonte: FonteDeCamadas): fonte is MapData {
  return !Array.isArray(fonte)
}

export function visibleWalls(walls: Wall[], hiddenLayers: FonteDeCamadas): Wall[] {
  return filterByLayer(walls, 'parede', wallLayer, hiddenLayers)
}

export function visibleRegions(regions: Region[], hiddenLayers: FonteDeCamadas): Region[] {
  return filterByLayer(regions, 'regiao', regionLayer, hiddenLayers)
}

export function visibleStairs(stairs: Stair[], hiddenLayers: FonteDeCamadas): Stair[] {
  return filterByLayer(stairs, 'escada', stairLayer, hiddenLayers)
}

export function visibleLights(lights: Light[], hiddenLayers: FonteDeCamadas): Light[] {
  return filterByLayer(lights, 'luz', lightLayer, hiddenLayers)
}

export function visibleTokens(tokens: Token[], hiddenLayers: FonteDeCamadas): Token[] {
  return filterByLayer(tokens, 'ficha', tokenLayer, hiddenLayers)
}

export function visibleDrawings(drawings: Drawing[], hiddenLayers: FonteDeCamadas): Drawing[] {
  return filterByLayer(drawings, 'desenho', drawingLayer, hiddenLayers)
}

export function visibleProps(props: Prop[], hiddenLayers: FonteDeCamadas): Prop[] {
  return filterByLayer(props, 'objeto', propLayer, hiddenLayers)
}

/**
 * Os pinos que se DESENHAM (e se tocam) como pino. O pino de uma escada que
 * leva a outro andar (`lib/stairTravel.ts`) nunca: quem aparece é a escada.
 * Sem pino de escada, a lista volta a mesma — quem compara por referência não
 * redesenha à toa.
 */
export function visiblePins(pins: Pin[], hiddenLayers: FonteDeCamadas): Pin[] {
  const drawable = pins.some(isStairPin) ? pins.filter((pin) => !isStairPin(pin)) : pins
  return filterByLayer(drawable, 'pino', pinLayer, hiddenLayers)
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
  // O pino da escada não é item que o mestre vê: a escada já conta em "escadas".
  for (const pin of map.pins) if (!isStairPin(pin)) counts[pinLayer(pin)] += 1
  return counts
}
