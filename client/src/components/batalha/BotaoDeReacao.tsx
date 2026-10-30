import './batalha.css'
import './combate.css'

/**
 * O botão REAÇÃO do JOGADOR: sempre à vista na batalha. Com golpe esperando a
 * reação dele, mostra quantos e abre a caixa REAÇÃO; sem golpe, abre a reação
 * livre (1d20 + modificador, vai ao registro).
 */

export interface BotaoDeReacaoProps {
  /** Golpes esperando a reação dele. */
  esperando: number
  /** A caixa está aberta. */
  aberta: boolean
  onAbrir: () => void
}

export function BotaoDeReacao({ esperando, aberta, onAbrir }: BotaoDeReacaoProps) {
  return (
    <button
      type="button"
      className="bt-botao-reacao"
      data-esperando={esperando > 0 ? 'sim' : 'nao'}
      aria-expanded={aberta}
      aria-label={esperando > 0 ? `Reagir: ${esperando} ${esperando === 1 ? 'golpe esperando' : 'golpes esperando'}` : 'Reação livre: rolar 1d20 + modificador'}
      onClick={onAbrir}
    >
      Reação
      {esperando > 0 && <span className="bt-botao-reacao__n">{esperando}</span>}
    </button>
  )
}
