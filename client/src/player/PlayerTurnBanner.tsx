/** Texto que o dono da ficha da vez lê. */
export const YOUR_TURN_TEXT = 'Sua vez'

interface PlayerTurnBannerProps {
  /** Id da ficha da vez, como o mestre mandou (só vem o que este jogador vê). */
  turn: string | undefined
  ownTokens: readonly string[]
}

/**
 * INICIATIVA na tela do jogador: "Sua vez" para o dono da ficha da vez, e
 * nada para os outros. A região de anúncio fica montada vazia de propósito:
 * leitor de tela só anuncia o que MUDA dentro de uma região que já existia.
 * Por cima do mapa e fora do fluxo (`position: fixed`): aparecer não
 * redimensiona o canvas nem mexe na câmera.
 */
export function PlayerTurnBanner({ turn, ownTokens }: PlayerTurnBannerProps) {
  const mine = turn !== undefined && ownTokens.includes(turn)
  return (
    <p className="pp-turn" role="status" aria-live="polite">
      {mine ? YOUR_TURN_TEXT : ''}
    </p>
  )
}
