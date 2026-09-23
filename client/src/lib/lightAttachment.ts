import type { Light, MapData } from '../types/map'

/**
 * Tocha presa na ficha. Regra única usada pelo editor do mestre
 * (`mapFactory.setTokenPosition`) e pelo movimento otimista da tela do
 * jogador (`player/playerConnection.ts`): a luz presa anda o mesmo
 * deslocamento que a ficha, então mantém o afastamento que tinha.
 * Arquivo sem dependência além dos tipos para caber no bundle do jogador.
 */

/** Luz sem o vínculo — sem deixar a chave com `undefined` no JSON salvo/enviado. */
export function withoutAttachment(light: Light): Light {
  if (light.attachedTokenId === undefined) return light
  const solta: Light = { ...light }
  delete solta.attachedTokenId
  return solta
}

/**
 * Move as luzes presas em `tokenIds` por (dx, dy), exceto as de `skip` (já
 * movidas por outro caminho). Sem luz presa, devolve a MESMA lista: o editor
 * redesenha formas quando `map.lights` muda de referência.
 */
export function carryAttachedLights(lights: Light[], tokenIds: ReadonlySet<string>, dx: number, dy: number, skip?: ReadonlySet<string>): Light[] {
  if (dx === 0 && dy === 0) return lights
  const carried = (l: Light): boolean => l.attachedTokenId !== undefined && tokenIds.has(l.attachedTokenId) && !(skip?.has(l.id) ?? false)
  if (!lights.some(carried)) return lights
  return lights.map((l) => (carried(l) ? { ...l, x: l.x + dx, y: l.y + dy } : l))
}

/** Põe a ficha em (x, y) e leva junto as luzes presas nela. Ficha inexistente: mapa intocado. */
export function moveTokenCarryingLights(map: MapData, tokenId: string, x: number, y: number): MapData {
  const token = map.tokens.find((t) => t.id === tokenId)
  if (!token) return map
  return {
    ...map,
    tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)),
    lights: carryAttachedLights(map.lights, new Set([tokenId]), x - token.x, y - token.y),
  }
}
