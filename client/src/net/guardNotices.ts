import { guardSightings } from '../lib/npcWatch'
import type { HostWorld, PlayerInfo } from './hostSession'

/**
 * OLHOS DO GUARDA, o aviso do MESTRE: "Guarda viu Ana". Puro — quem mostra o
 * aviso é `hostBridge.ts`, a cada snapshot.
 *
 * Avisa na ENTRADA, não a cada snapshot: `previous` é o conjunto de pares
 * (cena, guarda, ficha) que já estavam no olhar no snapshot anterior. Par que
 * some e volta avisa de novo — o jogador saiu da vista e foi pego outra vez.
 */
export interface GuardNotices {
  /** Frases novas, na ordem das cenas (a aberta primeiro) e dos guardas no mapa. */
  lines: string[]
  /** Pares no olhar agora: o `previous` do próximo snapshot. */
  seen: Set<string>
}

/** Nome que o aviso usa para o guarda sem nome. */
const UNNAMED_GUARD = 'Guarda'

function sightingKey(mapId: string, guardId: string, tokenId: string): string {
  return JSON.stringify([mapId, guardId, tokenId])
}

export function guardSightingNotices(world: HostWorld, players: readonly PlayerInfo[], previous: ReadonlySet<string>): GuardNotices {
  const ownersByToken = new Map<string, string[]>()
  for (const player of players) {
    for (const tokenId of player.tokenIds) ownersByToken.set(tokenId, [...(ownersByToken.get(tokenId) ?? []), player.name])
  }
  const lines: string[] = []
  const seen = new Set<string>()
  if (ownersByToken.size === 0) return { lines, seen }
  const targetIds = new Set(ownersByToken.keys())
  for (const scene of [world.open, ...world.background]) {
    // A cena ABERTA não leva nome: é a que o mestre está olhando. A de fundo
    // leva, como o pedido de item e o de porta (`hostBridge.ts`).
    const where = scene === world.open ? '' : ` em ${scene.name}`
    for (const s of guardSightings(scene.map, targetIds)) {
      const key = sightingKey(scene.map.id, s.guardId, s.tokenId)
      seen.add(key)
      if (previous.has(key)) continue
      // Nome vazio (ou guarda que sumiu entre a medida e aqui) cai no nome genérico.
      const guardName = scene.map.tokens.find((t) => t.id === s.guardId)?.name.trim() || UNNAMED_GUARD
      const who = (ownersByToken.get(s.tokenId) ?? []).join(' e ')
      lines.push(`${guardName} viu ${who}${where}`)
    }
  }
  return { lines, seen }
}
