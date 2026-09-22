import type { MapData, Pin, PinDestination } from '../types/map'
import { PIN_HEAD_RADIUS, PIN_HEIGHT, pinSummary } from './pins'
import { seatTokenCenter } from './tokenSize'
import { snapPointForTarget } from '../pixi/tokenInteraction'

/**
 * PINO DE VIAGEM — as regras da ligação, puras: sem store, sem DOM, sem Pixi.
 *
 * Um pino de viagem leva a outra cena da aventura e chega num pino PAR de lá,
 * que é o ponto de chegada. A ligação mora nos DOIS pinos (mão dupla):
 * A → (cena B, pino B) e B → (cena A, pino A), para o par sempre trazer de
 * volta. Só conta como ligado o par que se aponta de volta: meia ligação
 * (sobra de um desfazer, arquivo editado à mão) é "sem destino" na tela e no
 * clique — o mestre nunca atravessa para um lugar de onde o pino não o traz.
 */

/** Forma de destino que o resto do app pode usar sem conferir de novo. */
export function isPinDestination(value: unknown): value is PinDestination {
  if (value === null || typeof value !== 'object') return false
  const { sceneId, pinId } = value as Record<string, unknown>
  return typeof sceneId === 'string' && sceneId.length > 0 && typeof pinId === 'string' && pinId.length > 0
}

/**
 * Leitura do disco: a forma certa vira destino (só os dois campos, sem o que
 * mais o arquivo trouxer); qualquer outra coisa é "sem destino".
 */
export function readPinDestination(value: unknown): PinDestination | null {
  return isPinDestination(value) ? { sceneId: value.sceneId, pinId: value.pinId } : null
}

/** Mesmo destino. Ausente e `null` são o mesmo "sem destino". */
export function sameDestination(a: PinDestination | null | undefined, b: PinDestination | null | undefined): boolean {
  if (!a || !b) return !a && !b
  return a.sceneId === b.sceneId && a.pinId === b.pinId
}

/** O destino que vale: só pino de VIAGEM leva a algum lugar. */
export function travelDestinationOf(pin: Pin): PinDestination | null {
  return pin.kind === 'viagem' && isPinDestination(pin.destino) ? pin.destino : null
}

/** Uma cena como a ligação a enxerga: o nome e o mapa (`null` = a cena não abriu). */
export interface TravelScene {
  name: string
  map: MapData | null
}

/** Para onde um pino de viagem leva, do ponto de vista da cena onde ele está. */
export type PinTravel =
  | { status: 'sem-destino' }
  /** A cena de destino está na aventura, mas o arquivo dela não abriu. */
  | { status: 'indisponivel'; sceneId: string; sceneName: string }
  | { status: 'ligado'; sceneId: string; sceneName: string; partner: Pin }

const SEM_DESTINO: PinTravel = { status: 'sem-destino' }

/**
 * Resolve a ligação de `pin`, que mora na cena `hereSceneId`. `sceneById`
 * entrega as cenas da aventura (a aberta e as de fundo). Ligação para a
 * própria cena não existe: o painel só oferece as OUTRAS cenas.
 */
export function resolvePinTravel(pin: Pin, hereSceneId: string | null, sceneById: (sceneId: string) => TravelScene | null): PinTravel {
  const destino = travelDestinationOf(pin)
  if (destino === null || hereSceneId === null || destino.sceneId === hereSceneId) return SEM_DESTINO
  const scene = sceneById(destino.sceneId)
  if (scene === null) return SEM_DESTINO
  if (scene.map === null) return { status: 'indisponivel', sceneId: destino.sceneId, sceneName: scene.name }
  const partner = scene.map.pins.find((p) => p.id === destino.pinId)
  if (partner === undefined) return SEM_DESTINO
  if (!sameDestination(travelDestinationOf(partner), { sceneId: hereSceneId, pinId: pin.id })) return SEM_DESTINO
  return { status: 'ligado', sceneId: destino.sceneId, sceneName: scene.name, partner }
}

/** Um pino da cena aberta cuja ligação mudou entre dois estados do mapa. */
export interface TravelLinkChange {
  pinId: string
  before: PinDestination | null
  after: PinDestination | null
}

function linksOf(pins: readonly Pin[]): Map<string, PinDestination> {
  const links = new Map<string, PinDestination>()
  for (const pin of pins) {
    const destino = travelDestinationOf(pin)
    if (destino !== null) links.set(pin.id, destino)
  }
  return links
}

/**
 * O que mudou nas ligações entre `before` e `after` da MESMA cena: pino
 * ligado, desligado, religado a outro par, apagado (sai com `after: null`),
 * devolvido pelo desfazer (entra com `before: null`) ou que deixou de ser de
 * viagem. É a entrada de quem mantém o par do outro lado em dia.
 */
export function travelLinkChanges(before: readonly Pin[], after: readonly Pin[]): TravelLinkChange[] {
  if (before === after) return []
  const antes = linksOf(before)
  const depois = linksOf(after)
  const changes: TravelLinkChange[] = []
  for (const [pinId, destino] of depois) {
    const anterior = antes.get(pinId) ?? null
    if (!sameDestination(anterior, destino)) changes.push({ pinId, before: anterior, after: destino })
  }
  for (const [pinId, anterior] of antes) {
    if (!depois.has(pinId)) changes.push({ pinId, before: anterior, after: null })
  }
  return changes
}

function withDestination(map: MapData, pinId: string, destino: PinDestination | null): MapData {
  return { ...map, pins: map.pins.map((p) => (p.id === pinId ? { ...p, destino } : p)) }
}

/**
 * Grava no pino `partnerId` desta cena a volta para `back` (o outro lado da
 * mão dupla). Devolve o mapa — o MESMO objeto quando nada muda — e o destino
 * que o par tinha antes, que perdeu a volta e precisa ser desligado.
 * Pino que sumiu ou que não é de viagem não é ligado: a ida fica sem volta e
 * `resolvePinTravel` a trata como "sem destino".
 */
export function linkBack(map: MapData, partnerId: string, back: PinDestination): { map: MapData; displaced: PinDestination | null } {
  const partner = map.pins.find((p) => p.id === partnerId)
  if (partner === undefined || partner.kind !== 'viagem') return { map, displaced: null }
  const current = travelDestinationOf(partner)
  if (sameDestination(current, back)) return { map, displaced: null }
  return { map: withDestination(map, partnerId, { sceneId: back.sceneId, pinId: back.pinId }), displaced: current }
}

/**
 * Desliga o pino `partnerId` desta cena SE ele ainda leva a `back`. Quem já
 * foi religado a outro par fica como está: desligar A não pode desmanchar a
 * ligação nova de B com C.
 */
export function unlinkBack(map: MapData, partnerId: string, back: PinDestination): MapData {
  const partner = map.pins.find((p) => p.id === partnerId)
  if (partner === undefined || !sameDestination(partner.destino, back)) return map
  return withDestination(map, partnerId, null)
}

/** Direções em que o pino de chegada procura lugar quando o centro já tem pino. */
const DIRECOES: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
]
/** Quantas casas para fora do centro a procura vai antes de desistir e empilhar. */
const ANEIS_DE_PROCURA = 4

/**
 * Onde o pino de chegada nasce: no centro da cena, para o mestre achar e
 * arrastar. Se o centro já tem pino (a segunda ligação para a mesma cena), a
 * chegada nasce na casa livre mais perto — dois pinos na mesma ponta deixariam
 * o de baixo impossível de clicar.
 */
export function arrivalPoint(map: MapData): { x: number; y: number } {
  const largura = map.width * map.grid
  const altura = map.height * map.grid
  const centro = { x: largura / 2, y: altura / 2 }
  const livre = (x: number, y: number) => map.pins.every((p) => Math.hypot(p.x - x, p.y - y) >= PIN_HEAD_RADIUS * 2)
  if (livre(centro.x, centro.y)) return centro
  for (let anel = 1; anel <= ANEIS_DE_PROCURA; anel++) {
    for (const [dx, dy] of DIRECOES) {
      const x = centro.x + dx * anel * map.grid
      const y = centro.y + dy * anel * map.grid
      if (x < 0 || y < 0 || x > largura || y > altura) continue
      if (livre(x, y)) return { x, y }
    }
  }
  return centro
}

/**
 * Onde o token de quem ATRAVESSA assenta na cena de destino: na ponta do pino
 * par, grudado no centro da célula como o snap de token do editor
 * (`snapPointForTarget` + `seatTokenCenter`, o mesmo par de `applySnap`), e
 * puxado para dentro do mapa — pino arrastado até a borda não pode largar a
 * ficha fora do mundo, onde nenhum movimento a traria de volta.
 */
export function arrivalSpot(map: MapData, partner: Pin, tokenCells: number): { x: number; y: number } {
  const raw = { x: partner.x, y: partner.y }
  const snapped = snapPointForTarget('token', map.gridShape, raw.x, raw.y, map.grid)
  const seated = map.gridShape === 'square' ? seatTokenCenter(raw, snapped, map.grid, tokenCells) : snapped
  const largura = map.width * map.grid
  const altura = map.height * map.grid
  return { x: Math.min(largura, Math.max(0, seated.x)), y: Math.min(altura, Math.max(0, seated.y)) }
}

/** O ponto que a câmera centraliza ao chegar por um pino: o meio do desenho, não a ponta cravada. */
export function pinFocusPoint(pin: Pin): { x: number; y: number } {
  return { x: pin.x, y: pin.y - PIN_HEIGHT / 2 }
}

/** Uma cena na lista "Leva a…". */
export interface TravelSceneOption {
  id: string
  name: string
  /** `false` = o arquivo da cena não abriu: aparece, desabilitada, com o motivo. */
  available: boolean
}

/** Um pino de viagem da cena escolhida, para ligar a um que já existe. */
export interface TravelPinOption {
  id: string
  label: string
  /** Por que não dá para escolher (`null` = livre): ele já é o destino atual, ou já leva a outra cena. */
  note: string | null
}

/**
 * Os pinos de viagem de `sceneId` que podem receber a ligação de `pinId`
 * (da cena `hereSceneId`). Pino já ligado a outro aparece com o motivo em vez
 * de sumir: o mestre vê que ele existe e por que não dá para escolhê-lo.
 */
export function travelPinOptions(
  sceneId: string,
  hereSceneId: string | null,
  pinId: string,
  sceneById: (sceneId: string) => TravelScene | null,
): TravelPinOption[] {
  const map = sceneById(sceneId)?.map ?? null
  if (map === null) return []
  const doMestre: PinDestination | null = hereSceneId === null ? null : { sceneId: hereSceneId, pinId }
  return map.pins
    .filter((p) => p.kind === 'viagem')
    .map((p, index) => {
      const label = p.description.trim() === '' ? `${pinSummary(p)} ${index + 1}` : pinSummary(p)
      const travel = resolvePinTravel(p, sceneId, sceneById)
      if (travel.status !== 'ligado') return { id: p.id, label, note: null }
      if (sameDestination(travelDestinationOf(p), doMestre)) return { id: p.id, label, note: 'destino atual' }
      return { id: p.id, label, note: `já leva a ${travel.sceneName}` }
    })
}
