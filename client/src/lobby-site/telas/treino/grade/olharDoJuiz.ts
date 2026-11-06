import { cartaDaVez, type TurnosDaCena } from '../../../../lib/batalha/turnos'

/**
 * PARA QUEM O JUDGE OLHA na grade do site (pedido de 06/11/2026: "lembre-se
 * de colocar o juiz, o modelo 3d"). A regra do app (`components/arena/
 * TelaDaArena.tsx`: o boneco vira para a ficha da vez, e na vez dele fica como
 * está) com o golpe na frente: enquanto um golpe que o envolve espera a
 * reação, ele olha para quem ele mira, ou para quem o ataca. `null` = fica
 * olhando para onde estava (a vez é dele e ninguém está no golpe).
 *
 * Puro: sem React, sem DOM. A direção em si (o ângulo, a virada passo a
 * passo) é de `lib/batalha/judge.ts`.
 */
export function quemOJuizOlha(turnos: TurnosDaCena, juizTokenId: string): string | null {
  const golpes = turnos.golpes ?? []
  // O golpe mais novo manda: é o que está na tela agora.
  for (let i = golpes.length - 1; i >= 0; i -= 1) {
    const golpe = golpes[i]
    if (golpe === undefined) continue
    if (golpe.atacanteTokenId === juizTokenId) {
      const mirado = golpe.alvos.find((alvo) => alvo.tokenId !== juizTokenId)
      if (mirado !== undefined) return mirado.tokenId
    } else if (golpe.alvos.some((alvo) => alvo.tokenId === juizTokenId)) {
      return golpe.atacanteTokenId
    }
  }
  const vez = cartaDaVez(turnos)?.tokenId ?? null
  return vez === juizTokenId ? null : vez
}
