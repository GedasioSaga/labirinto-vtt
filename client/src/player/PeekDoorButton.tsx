import { distanceToWall, tokenReachesDoor } from '../lib/doorReach'
import type { MapData } from '../types/map'

/**
 * A porta FECHADA que o jogador pode espiar agora: encostada numa ficha dele
 * (a mesma conta de alcance do host, `tokenReachesDoor`). Trancada vale —
 * espiar pela fechadura é o caso. Porta que o mestre marcou sem espiar
 * (`DoorState.semEspiar`) fica de fora; quem recusa de fato é o host. Com mais
 * de uma, a mais perto de alguma ficha. `null` = nenhuma.
 */
export function peekableDoorId(map: MapData, ownTokens: readonly string[]): string | null {
  const own = new Set(ownTokens)
  const tokens = map.tokens.filter((t) => own.has(t.id))
  let best: string | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const wall of map.walls) {
    if (wall.door === null || (wall.door.open && !wall.door.locked) || wall.door.semEspiar === true) continue
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

const ROTULO = 'Espiar pela porta'

/**
 * "Espiar pela porta": aparece só com a ficha encostada numa porta fechada.
 * Botão de verdade (foco e teclado do navegador); o host decide se vale e
 * manda o cone por alguns segundos — a porta não abre para ninguém.
 *
 * Em tela estreita (player.css, `.pp-rotulo-resto`) a pílula diz só "Espiar":
 * a coluna das ações do lugar divide a largura com o "Chamar o mestre". O
 * nome que o leitor de tela lê é sempre o inteiro.
 */
export function PeekDoorButton({ map, ownTokens, onPeek }: PeekDoorButtonProps) {
  const wallId = peekableDoorId(map, ownTokens)
  if (wallId === null) return null
  return (
    <button type="button" className="pp-espiar" aria-label={ROTULO} onClick={() => onPeek(wallId)}>
      Espiar<span className="pp-rotulo-resto"> pela porta</span>
    </button>
  )
}
