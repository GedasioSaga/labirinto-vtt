import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { LabyrinthMark } from '../components/icons'

interface PlayerErrorBoundaryProps {
  children: ReactNode
  onReconnect: () => void
}

interface PlayerErrorBoundaryState {
  failed: boolean
}

/**
 * Exceção no Pixi desmontaria o React inteiro (página branca): aqui vira uma
 * tela do produto, com saída.
 *
 * A casca (`.pe-page`, `.pe-card`, `.pe-brand`) é a MESMA das outras telas de
 * texto do jogador e vem toda do CSS de `player.css` — inclusive o fundo de
 * pedra com o halo do lampião, que é desenhado por `.pe-page` sem markup
 * nenhum. O markup se repete aqui, e não vem de um `Screen` importado, porque
 * `main.tsx` é quem importa esta classe: importar de volta fecharia um ciclo.
 *
 * Até 17/09/2026 esta tela era `system-ui` sem fundo e dois botões cinza de
 * fábrica — medidos em rgb(107,107,107) por jornada. Quem caía aqui via a cara
 * de um erro do navegador, não do jogo em que estava.
 */
export class PlayerErrorBoundary extends Component<PlayerErrorBoundaryProps, PlayerErrorBoundaryState> {
  state: PlayerErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): PlayerErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Falha ao desenhar o mapa do jogador', error, info.componentStack)
  }

  private reconnect = (): void => {
    this.setState({ failed: false })
    this.props.onReconnect()
  }

  private reload = (): void => {
    location.reload()
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <main className="pe-page">
        <div className="pe-card">
          <header className="pe-brand">
            <span className="pe-brand__mark" aria-hidden="true">
              <LabyrinthMark size={20} />
            </span>
            <h1 className="pe-title">Labirinto</h1>
          </header>
          {/* `alert` só na parte que mudou: o leitor de tela anuncia o que houve
              e o que fazer, sem repetir a marca a cada falha. */}
          <div role="alert" className="pe-explain">
            <p className="pe-notice pe-notice--error">O mapa parou de ser desenhado.</p>
            <p className="pe-hint">
              O desenho do mapa falhou neste navegador — costuma ser falta de memória no aparelho. A página parou nesta
              tela em vez de apagar, e você continua na sala.
            </p>
          </div>
          <div className="pe-actions">
            <button type="button" className="pe-btn pe-btn--primary" onClick={this.reload}>
              Recarregar
            </button>
            <button type="button" className="pe-btn" onClick={this.reconnect}>
              Reconectar
            </button>
          </div>
          <p className="pe-hint">Recarregar abre a página do zero; reconectar só pede o mapa ao mestre outra vez.</p>
        </div>
      </main>
    )
  }
}
