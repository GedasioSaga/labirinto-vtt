import { useCallback } from 'react'
import type { PlayerConnection, PlayerState } from './playerConnection'
import { PlayerPinCard } from './PlayerPinCard'
import { PlayerNoteCard } from './PlayerNoteCard'

export interface SessionCardsProps {
  state: Pick<PlayerState, 'map' | 'shownPin' | 'note' | 'travel'>
  /** Pino que o jogador tocou no mapa; `null` = nenhum. */
  openPinId: string | null
  onOpenPinIdChange(pinId: string | null): void
  connection: Pick<PlayerConnection, 'dismissShownPin' | 'dismissNote' | 'requestTravel'>
}

/**
 * Os cartões por cima do mapa do jogador: o do pino (o que ele tocou, ou o que
 * o mestre mostrou com "Mostrar agora a…") e o recado do mestre.
 *
 * O cartão mostrado pelo mestre fica NO LUGAR do que o jogador abriu: um
 * "Fechar" fecha os dois, para não revelar outro cartão atrás, e o Escape é
 * dele — o do recado só volta a fechar quando não há cartão de pino.
 */
export function SessionCards({ state, openPinId, onOpenPinIdChange, connection }: SessionCardsProps) {
  // O pino pode sumir do recorte enquanto o cartão está aberto (o token
  // andou, o mestre escondeu): sem pino no mapa novo, o cartão fecha sozinho
  // em vez de mostrar um texto que o jogador não pode mais ver.
  const openPin = openPinId === null ? null : (state.map?.pins ?? []).find((p) => p.id === openPinId) ?? null
  // Estável: o cartão devolve o foco ao "Fechar" sempre que `onClose` muda, e
  // um snapshot novo a cada passo do mapa tiraria o foco do "Pedir" no meio da pergunta.
  const closePin = useCallback(() => {
    onOpenPinIdChange(null)
    connection.dismissShownPin()
  }, [connection, onOpenPinIdChange])
  // Estável pelo mesmo motivo: o cartão do recado religa o Escape quando `onClose` muda.
  const closeNote = useCallback(() => connection.dismissNote(), [connection])
  const shownPin = state.shownPin

  return (
    <>
      {/* "Mostrar agora a…": o mestre abriu este cartão aqui. Só lê — sem
          posição nem passagem; `key` no id remonta a cada envio, e o foco
          vai de novo ao "Fechar". */}
      {shownPin && <PlayerPinCard key={`mostrado-${shownPin.id}`} pin={shownPin.pin} onClose={closePin} />}
      {!shownPin && openPin && (
        <PlayerPinCard
          pin={openPin}
          onClose={closePin}
          travelWaiting={state.travel?.phase === 'waiting'}
          onRequestTravel={(exitId) => {
            // Pedido enviado, o cartão sai: a espera fica no aviso de baixo,
            // e o mapa volta inteiro à vista enquanto o mestre decide.
            if (connection.requestTravel(openPin.id, exitId)) onOpenPinIdChange(null)
          }}
        />
      )}
      {state.note && (
        // `key` no id: recado novo com outro aberto remonta o cartão (e a entrada anima de novo).
        <PlayerNoteCard key={state.note.id} text={state.note.text} onClose={closeNote} escapeCloses={openPin === null && !shownPin} />
      )}
    </>
  )
}
