import type { CarryRef } from '../lib/carry'
import './TokenControls.css'

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

/** Para que serve a lista, lido pelo leitor de tela e mostrado no balão da linha (peça P3). */
export const LEVAR_JUNTO_HINT = 'Para carregar um ferido ou escoltar alguém: esta ficha anda junto no arrasto e atravessa os pinos de viagem junto.'

/** Por que a linha está apagada: não há quem leve esta ficha. */
export const LEVAR_JUNTO_SEM_FICHA = 'Sem outra ficha na cena'

/**
 * LEVAR FICHA JUNTO — o mestre prende o ferido (ou o NPC escoltado) à ficha de
 * um jogador: a lista nativa "Vai junto de" escolhe quem leva (setas, inicial
 * e Esc já vêm do `<select>`), e o botão "Soltar" desfaz. Cada escolha passa
 * pelo histórico, então Ctrl+Z desfaz também.
 *
 * Solta, é UMA linha, sem bloco nem título (peça P4 do laudo do painel, no
 * molde das linhas "Device" e "Background" do Figma UI3): "Vai junto de" à
 * esquerda e a lista à direita — ou, sem outra ficha na cena, a linha apagada
 * com o motivo escrito no lugar da lista.
 *
 * Três estados, nunca dois juntos (quem leva não é levado, `lib/carry.ts`):
 * - a ficha é levada: diz por quem, e "Soltar";
 * - a ficha leva outras: lista cada uma, com o próprio "Soltar";
 * - solta: a linha da lista — ou o motivo de não haver lista.
 */
export function TokenCarryControls({ tokenId, carrier, carried, candidates, onCarry, onRelease }: TokenCarryControlsProps) {
  if (carrier !== null) {
    return (
      <section className="lb-section">
        <p className="lb-field__hint">Vai junto de {carrier.name}: anda no arrasto dela e atravessa os pinos de viagem junto.</p>
        <button type="button" className="lb-btn lb-btn--block" onClick={() => onRelease(tokenId)}>
          Soltar
        </button>
      </section>
    )
  }
  if (carried.length > 0) {
    return (
      <section className="lb-section">
        <p className="lb-field__hint">Leva junto no arrasto e nos pinos de viagem:</p>
        {carried.map((token) => (
          <button key={token.id} type="button" className="lb-btn lb-btn--block" onClick={() => onRelease(token.id)}>
            Soltar {token.name}
          </button>
        ))}
      </section>
    )
  }
  if (candidates.length === 0) {
    // Nada de lista vazia clicável: a linha fica, apagada, com o motivo no
    // lugar do controle. Texto e não controle desabilitado — não há o que
    // escolher, então não há o que focar.
    return (
      <section className="lb-section lb-token-linha">
        <div className="lb-token-par lb-token-par--vazio">
          <span className="lb-label">Vai junto de</span>
          <span className="lb-token-par__motivo">{LEVAR_JUNTO_SEM_FICHA}</span>
        </div>
      </section>
    )
  }
  return (
    <section className="lb-section lb-token-linha lb-token-linha--campo">
      <div className="lb-field lb-token-par">
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
          {LEVAR_JUNTO_HINT}
        </p>
      </div>
    </section>
  )
}
