import type { CarryRef } from '../lib/carry'

export interface TokenCarryControlsProps {
  /** A ficha selecionada. */
  tokenId: string
  /** Quem leva a ficha selecionada; `null` = ela está solta. */
  carrier: CarryRef | null
  /** Quem a ficha selecionada leva (vazio = ninguém). */
  carried: CarryRef[]
  /** A quem ela pode ser presa, na ordem de mostrar (a mais perto primeiro, `carryCandidates`). */
  candidates: CarryRef[]
  /** Prender a ficha selecionada a `carrierId`. */
  onCarry: (carrierId: string) => void
  /** Soltar `carriedId` de quem o leva. */
  onRelease: (carriedId: string) => void
}

/**
 * LEVAR FICHA JUNTO — o mestre prende o ferido (ou o NPC escoltado) à ficha de
 * um jogador: a lista nativa "Vai junto de" escolhe quem leva (setas, inicial
 * e Esc já vêm do `<select>`), e o botão "Soltar" desfaz. Cada escolha passa
 * pelo histórico, então Ctrl+Z desfaz também.
 *
 * Três estados, nunca dois juntos (quem leva não é levado, `lib/carry.ts`):
 * - a ficha é levada: diz por quem, e "Soltar";
 * - a ficha leva outras: lista cada uma, com o próprio "Soltar";
 * - solta: a lista para escolher — ou, sem outra ficha na cena, o motivo.
 */
export function TokenCarryControls({ tokenId, carrier, carried, candidates, onCarry, onRelease }: TokenCarryControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Levar junto</h2>
      {carrier !== null ? (
        <>
          <p className="lb-field__hint">Vai junto de {carrier.name}: anda no arrasto dela e atravessa os pinos de viagem junto.</p>
          <button type="button" className="lb-btn lb-btn--block" onClick={() => onRelease(tokenId)}>
            Soltar
          </button>
        </>
      ) : carried.length > 0 ? (
        <>
          <p className="lb-field__hint">Leva junto no arrasto e nos pinos de viagem:</p>
          {carried.map((token) => (
            <button key={token.id} type="button" className="lb-btn lb-btn--block" onClick={() => onRelease(token.id)}>
              Soltar {token.name}
            </button>
          ))}
        </>
      ) : candidates.length === 0 ? (
        <p className="lb-field__hint">Não há outra ficha nesta cena para levar esta.</p>
      ) : (
        <div className="lb-field">
          <label className="lb-label" htmlFor="lb-token-carry">
            Vai junto de
          </label>
          <select
            id="lb-token-carry"
            className="lb-input"
            value=""
            aria-describedby="lb-token-carry-hint"
            onChange={(event) => {
              if (event.target.value !== '') onCarry(event.target.value)
            }}
          >
            <option value="">Ninguém</option>
            {candidates.map((token) => (
              <option key={token.id} value={token.id}>
                {token.name}
              </option>
            ))}
          </select>
          <p id="lb-token-carry-hint" className="lb-field__hint">
            Para carregar um ferido ou escoltar alguém: esta ficha anda junto no arrasto e atravessa os pinos de viagem junto.
          </p>
        </div>
      )}
    </section>
  )
}
