import { useCallback } from 'react'
import type { Pin } from '../types/map'
import type { PlayerConnection } from './playerConnection'
import { PlayerPinCard } from './PlayerPinCard'

/** Só o que o cartão usa da conexão: marcar a pista lida e pedir a passagem. */
export type OpenPinCardConnection = Pick<PlayerConnection, 'markPinRead' | 'requestTravel'>

export interface OpenPinCardProps {
  pin: Pin
  connection: OpenPinCardConnection
  /** Já há um pedido de viagem esperando o mestre. */
  travelWaiting: boolean
  /** Fecha o cartão. Estável: o cartão religa o Escape e o foco quando muda. */
  onClose(): void
}

/**
 * O cartão do pino aberto, já ligado à conexão. Mora fora de `main.tsx` para
 * que a ligação seja testada: abrir o cartão com o texto é o que acende "leu"
 * no painel Pistas do mestre, e sem ela a bolinha nunca enche.
 */
export function OpenPinCard({ pin, connection, travelWaiting, onClose }: OpenPinCardProps) {
  // Estável pela conexão: o cartão lê uma vez por pino, e um callback novo a cada snapshot não muda isso.
  const readPin = useCallback(
    (pinId: string) => {
      connection.markPinRead(pinId)
    },
    [connection],
  )
  return (
    <PlayerPinCard
      pin={pin}
      onClose={onClose}
      onRead={readPin}
      travelWaiting={travelWaiting}
      onRequestTravel={(exitId) => {
        // Pedido enviado, o cartão sai: a espera fica no aviso de baixo,
        // e o mapa volta inteiro à vista enquanto o mestre decide.
        if (connection.requestTravel(pin.id, exitId)) onClose()
      }}
    />
  )
}
