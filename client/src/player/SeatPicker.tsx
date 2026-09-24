import type { SeatOption } from '../net/protocol'
import type { SeatClaimNotice } from './playerConnection'

/** O que a tela de espera diz do pedido de ficha, em cada fase. */
export function seatClaimText(claim: SeatClaimNotice): string {
  switch (claim.phase) {
    case 'sent':
    case 'pending':
      return `Pedido enviado: ${claim.name}. Aguardando o mestre confirmar.`
    case 'denied':
      return `O mestre não confirmou ${claim.name}. Escolha outra ficha ou aguarde.`
    case 'unavailable':
      return `${claim.name} não está mais livre. Escolha outra ficha.`
    case 'too_soon':
      return 'Espere um instante antes de pedir de novo.'
  }
}

interface SeatPickerProps {
  options: readonly SeatOption[]
  claim: SeatClaimNotice | undefined
  onClaim: (tokenId: string) => void
}

/**
 * QUEM CHEGA ESCOLHE A FICHA, na tela de espera: as fichas que o mestre
 * oferece viram botões nativos (foco, teclado e leitor de tela de graça), e o
 * pedido mostra em que pé está. Enquanto o mestre decide, a lista sai: um
 * pedido por vez. Sem lista e sem pedido, nada — a espera de sempre.
 */
export function SeatPicker({ options, claim, onClaim }: SeatPickerProps) {
  const waitingMaster = claim?.phase === 'sent' || claim?.phase === 'pending'
  if (options.length === 0 && claim === undefined) return null
  return (
    <section className="pe-seats" aria-labelledby="pe-seats-title">
      <h2 id="pe-seats-title" className="pe-seats__title">
        Escolha sua ficha
      </h2>
      {claim !== undefined && (
        <p role="status" className="pe-seat-status">
          {seatClaimText(claim)}
        </p>
      )}
      {!waitingMaster && options.length > 0 && (
        <>
          <p className="pe-hint">Toque na sua. O mestre confirma antes de o mapa abrir.</p>
          <ul className="pe-seats__list" aria-label="Fichas livres">
            {options.map((option) => (
              <li key={option.tokenId}>
                <button type="button" className="pe-btn pe-seats__option" onClick={() => onClaim(option.tokenId)}>
                  {option.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
