import { distanceToWall, tokenReachesDoor } from '../lib/doorReach'
import type { MapData } from '../types/map'

/**
 * A porta FECHADA que o jogador pode espiar agora: encostada numa ficha dele
 * (a mesma conta de alcance do host, `tokenReachesDoor`). Trancada vale —
 * espiar pela fechadura é o caso. Com mais de uma, a mais perto de alguma
 * ficha. `null` = nenhuma.
 */
export function peekableDoorId(map: MapData, ownTokens: readonly string[]): string | null {
  const own = new Set(ownTokens)
  const tokens = map.tokens.filter((t) => own.has(t.id))
  let best: string | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const wall of map.walls) {
    if (wall.door === null || (wall.door.open && !wall.door.locked)) continue
    for (const token of tokens) {
      if (!tokenReachesDoor(token, wall, map.grid)) continue
      const distance = distanceToWall(token, wall)
      if (distance < bestDistance) {
        best = wall.id
        bestDistance = distance
      }
    }
  }
  return best
}

interface PeekDoorButtonProps {
  map: MapData
  ownTokens: readonly string[]
  onPeek: (wallId: string) => void
}

/**
 * "Espiar pela porta": aparece só com a ficha encostada numa porta fechada.
 * Botão de verdade (foco e teclado do navegador); o host decide se vale e
 * manda o cone por alguns segundos — a porta não abre para ninguém.
 */
export function PeekDoorButton({ map, ownTokens, onPeek }: PeekDoorButtonProps) {
  const wallId = peekableDoorId(map, ownTokens)
  if (wallId === null) return null
  return (
    <button type="button" className="pp-peek" onClick={() => onPeek(wallId)}>
      Espiar pela porta
    </button>
  )
}
