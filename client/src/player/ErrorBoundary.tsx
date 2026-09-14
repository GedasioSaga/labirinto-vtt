import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface PlayerErrorBoundaryProps {
  children: ReactNode
  onReconnect: () => void
}

interface PlayerErrorBoundaryState {
  failed: boolean
}

const boxStyle = { fontFamily: 'system-ui, sans-serif', maxWidth: 360, margin: '0 auto', padding: '32px 16px' }
const buttonStyle = { fontSize: 18, padding: 10, marginRight: 8 }

/** Exceção no Pixi desmontaria o React inteiro (página branca): aqui vira mensagem com saída. */
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

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <main role="alert" style={boxStyle}>
        <p>Algo deu errado ao desenhar o mapa</p>
        <button type="button" onClick={() => location.reload()} style={buttonStyle}>
          Recarregar
        </button>
        <button type="button" onClick={this.reconnect} style={buttonStyle}>
          Reconectar
        </button>
      </main>
    )
  }
}
