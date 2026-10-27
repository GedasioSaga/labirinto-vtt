/** Aviso quando o mestre recusa o arrasto porque não é a vez desta ficha. */
export const WAIT_TURN_TEXT = 'Espere sua vez'

interface TurnWaitNoticeProps {
  /** `id` novo remonta o aviso: a mesma recusa repetida anima e anuncia de novo. */
  notice: { id: number } | undefined
}

/**
 * "Espere sua vez": o mestre recusou o arrasto fora da vez (`not_your_turn`);
 * some sozinho (`playerConnection`). Ficou quando a faixa "Sua vez" saiu
 * (modo batalha, fatia B3) porque a recusa ainda existe no host: sai junto com
 * o `not_your_turn` na B4.
 */
export function TurnWaitNotice({ notice }: TurnWaitNoticeProps) {
  if (notice === undefined) return null
  return (
    <p key={notice.id} className="pp-notice" role="status" aria-live="polite">
      {WAIT_TURN_TEXT}
    </p>
  )
}
