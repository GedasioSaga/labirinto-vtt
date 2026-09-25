import type { MapData, Region, RegionPoint } from '../types/map'
import { ancestorsOf, findContainingRoom } from '../lib/roomNesting'

/**
 * FAIXA "ONDE ESTOU" — o caminho da Sala onde está a ficha do jogador
 * (prédio › piso › cômodo), subindo por `Region.parentId`.
 *
 * Lê SÓ o mapa que o jogador já recebe (`lib/fogFilter.ts`): nada novo passa
 * pela rede. Por isso o recorte decide sozinho o que a faixa pode dizer — sala
 * secreta, oculta ou filha delas nem chega; nome oculto, sob teto fechado ou
 * em zona oculta chega vazio. O nome da cena nunca chega (`name: ''`) e não
 * entra aqui.
 */

/** Cômodo onde a ficha está, mas cujo nome o mestre esconde (chega `''`). */
export const UNNAMED_ROOM_LABEL = 'Lugar sem nome'
/** A ficha não está dentro de nenhuma Sala que o jogador recebeu. */
export const OUTSIDE_ROOMS_LABEL = 'Fora das salas'
const TRAIL_SEPARATOR = ' › '

export interface WhereAmI {
  /** A ficha que a faixa acompanha (e que o toque na faixa centraliza). */
  tokenId: string
  tokenName: string
  /** De fora para dentro; vazio = fora de toda Sala. */
  trail: string[]
}

/**
 * Sala que pode entrar no caminho. A silhueta de teto fechado (`roof: true`
 * no recorte) fica fora: o interior dela não é do jogador, e ele nem está lá
 * dentro (o teto abre para quem entra).
 */
function isTrailRoom(region: Region): boolean {
  return region.room !== undefined && region.room.roof !== true
}

/**
 * Nomes das Salas que contêm `point`, de fora para dentro. O cômodo (a Sala
 * mais funda) sempre aparece — sem nome, como "Lugar sem nome"; as de fora
 * sem nome saem do caminho, que só ficaria mais comprido sem dizer nada.
 */
export function roomTrailAt(regions: readonly Region[], point: RegionPoint): string[] {
  const rooms = regions.filter(isTrailRoom)
  const here = findContainingRoom(rooms, [point])
  if (here === null) return []
  const outer = ancestorsOf(rooms, here.id)
    .reverse()
    .flatMap((r) => {
      const name = roomName(r)
      return name === '' ? [] : [name]
    })
  const hereName = roomName(here)
  return [...outer, hereName === '' ? UNNAMED_ROOM_LABEL : hereName]
}

/** Nome que chegou ao jogador; `''` quando o recorte o apagou. */
function roomName(region: Region): string {
  return region.room === undefined ? '' : region.room.name.trim()
}

/**
 * A faixa acompanha a ficha em foco (a do "Minha ficha", a que acabou de
 * chegar por viagem) quando ela é do jogador e está no mapa; senão, a primeira
 * ficha dele que está no mapa. Sem ficha no mapa, nada a mostrar.
 */
export function whereAmI(map: MapData, ownTokens: readonly string[], focusTokenId: string | null): WhereAmI | null {
  const onMap = new Map(map.tokens.map((t) => [t.id, t]))
  const focused = focusTokenId !== null && ownTokens.includes(focusTokenId) ? onMap.get(focusTokenId) : undefined
  const token = focused ?? ownTokens.map((id) => onMap.get(id)).find((t) => t !== undefined)
  if (token === undefined) return null
  return { tokenId: token.id, tokenName: token.name, trail: roomTrailAt(map.regions, { x: token.x, y: token.y }) }
}

/** O caminho como uma frase: "Farol, piso 5 › Sala do Faroleiro". */
export function whereAmIText(trail: readonly string[]): string {
  return trail.length === 0 ? OUTSIDE_ROOMS_LABEL : trail.join(TRAIL_SEPARATOR)
}
