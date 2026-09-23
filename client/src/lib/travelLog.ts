import type { AppliedTransfer, HostWorld } from '../net/hostSession'

/**
 * DIÁRIO DE VIAGENS (G15): uma linha por viagem de ficha entre cenas, só do
 * MESTRE — nada disto vai ao jogador (nomes de cena são do mestre). Guarda a
 * casa de onde a ficha saiu: é para lá que o "Desfazer" a devolve.
 */
export interface TravelLogEntry {
  id: string
  /** Quando a ficha trocou de cena (ms, relógio do mestre). */
  at: number
  playerId: string
  tokenId: string
  /** Nome da ficha no momento da viagem: é o que o mestre procura no mapa. */
  tokenName: string
  fromSceneId: string
  fromSceneName: string
  /** A casa de partida, na cena de origem. */
  fromX: number
  fromY: number
  toSceneId: string
  toSceneName: string
}

/**
 * Quantas viagens o diário guarda. Uma sessão longa com grupo grande passa
 * de cem viagens raramente, e o painel não precisa de rolagem infinita.
 */
export const TRAVEL_LOG_MAX = 100

/**
 * A linha da transferência, lida do mundo ANTES de a ficha sair (depois, a
 * casa de partida já não existe). `null` quando a cena de origem ou a ficha
 * não estão no mundo: a transferência também não daria.
 */
export function travelLogEntry(transfer: AppliedTransfer, world: HostWorld, at: number, id: string): TravelLogEntry | null {
  const from = [world.open, ...world.background].find((scene) => scene.sceneId === transfer.fromSceneId)
  const token = from?.map.tokens.find((t) => t.id === transfer.tokenId)
  if (from === undefined || token === undefined) return null
  return {
    id,
    at,
    playerId: transfer.playerId,
    tokenId: transfer.tokenId,
    tokenName: token.name,
    fromSceneId: transfer.fromSceneId,
    fromSceneName: from.name,
    fromX: token.x,
    fromY: token.y,
    toSceneId: transfer.toSceneId,
    toSceneName: transfer.toSceneName,
  }
}

/** A viagem nova entra em cima; passou do teto, a mais velha sai. */
export function addTravel(log: TravelLogEntry[], entry: TravelLogEntry): TravelLogEntry[] {
  return [entry, ...log].slice(0, TRAVEL_LOG_MAX)
}

export function withoutTravel(log: TravelLogEntry[], id: string): TravelLogEntry[] {
  return log.filter((entry) => entry.id !== id)
}

/** A última viagem de cada jogador: a primeira dele no diário (a mais nova em cima). */
export function undoableTravelIds(log: TravelLogEntry[]): Set<string> {
  const seen = new Set<string>()
  const ids = new Set<string>()
  for (const entry of log) {
    if (seen.has(entry.playerId)) continue
    seen.add(entry.playerId)
    ids.add(entry.id)
  }
  return ids
}

/** "HH:MM" na hora local do mestre. */
export function travelClock(at: number): string {
  const date = new Date(at)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** "Ana: Salão → Cripta" (a hora vai à parte, no `<time>`). */
export function travelLine(entry: TravelLogEntry): string {
  return `${entry.tokenName}: ${entry.fromSceneName} → ${entry.toSceneName}`
}
