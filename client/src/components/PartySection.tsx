import { useRef, useState } from 'react'
import type { PartyDestination, PartyMember } from '../lib/party'
import { SceneSendForm } from './SceneSendForm'

export interface PartySectionProps {
  members: PartyMember[]
  /** Todas as cenas da aventura que abriram; vazio no mapa solto (não há para onde mandar). */
  destinations: PartyDestination[]
  /** "Ir lá": o editor abre a cena do jogador com a ficha dele no centro. */
  onGoTo(member: PartyMember): void
  /** "Mandar para…" confirmado. `false` = não deu, e o formulário fica aberto com o aviso. */
  onSend(playerId: string, sceneId: string, pinId: string | null): boolean
  /** Quem a câmera do editor está seguindo agora (G7); `null` = ninguém. */
  followingId?: string | null
  /** "Seguir": liga neste jogador (e desliga o anterior) ou desliga se já era ele. Sem ele, não há botão. */
  onToggleFollow?(member: PartyMember): void
}

/** Nome FIXO do botão: o estado vai em `aria-pressed`, e o leitor de tela lê "Seguir, pressionado". */
export const FOLLOW_LABEL = 'Seguir'

export const PARTY_SEND_FAILED = 'Não deu para mandar: a cena ou a ficha mudou. Escolha de novo.'

/** O rótulo do botão que abre o envio: o teste e o leitor de tela acham a linha por ele. */
export const SEND_TO_LABEL = 'Mandar para…'

/** As cenas para onde ESTE jogador pode ir: todas menos a dele. */
export function sendDestinationsFor(member: PartyMember, destinations: PartyDestination[]): PartyDestination[] {
  return destinations.filter((destination) => destination.sceneId !== member.sceneId)
}

/**
 * O "Mandar para…" do Grupo: um formulário por vez, e o foco volta ao botão
 * que o abriu ao mandar ou cancelar (quem abriu pode ter saído da lista).
 */
export function usePartySend() {
  const [sendingId, setSendingId] = useState<string | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  const close = () => {
    setSendingId(null)
    const opener = openerRef.current
    openerRef.current = null
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus()
    })
  }

  const toggle = (playerId: string, opener: HTMLElement) => {
    if (sendingId === playerId) {
      close()
      return
    }
    openerRef.current = opener
    setSendingId(playerId)
  }

  return { sendingId, toggle, close }
}

interface PartyActionsProps {
  member: PartyMember
  party: PartySectionProps
  sendOpen: boolean
  sendFormId: string
  onToggleSend(opener: HTMLElement): void
}

/**
 * As ações de mesa de uma linha do Grupo: ir ver ("Ir lá"), a câmera
 * acompanhar ("Seguir") e trazer ou levar o jogador ("Mandar para…"). São
 * as que o mestre usa a cada cena: ficam sempre à vista, nunca no "Mais".
 */
export function PartyActions({ member, party, sendOpen, sendFormId, onToggleSend }: PartyActionsProps) {
  const { onGoTo, onToggleFollow, followingId = null } = party
  const targets = sendDestinationsFor(member, party.destinations)
  const following = member.playerId === followingId
  return (
    <div className="lb-player__actions">
      <button type="button" className="lb-btn lb-btn--compact" onClick={() => onGoTo(member)}>
        Ir lá
      </button>
      {onToggleFollow !== undefined && (
        // Ligado ganha o destaque do "Laser" da mesma aba: um botão de modo, não uma ação de uma vez.
        <button
          type="button"
          className={following ? 'lb-btn lb-btn--compact lb-btn--primary' : 'lb-btn lb-btn--compact'}
          aria-pressed={following}
          onClick={() => onToggleFollow(member)}
        >
          {FOLLOW_LABEL}
        </button>
      )}
      {targets.length > 0 && (
        <button
          type="button"
          className="lb-btn lb-btn--compact"
          aria-expanded={sendOpen}
          aria-controls={sendOpen ? sendFormId : undefined}
          onClick={(event) => onToggleSend(event.currentTarget)}
        >
          {SEND_TO_LABEL}
        </button>
      )}
    </div>
  )
}

interface PartySendFormProps {
  member: PartyMember
  party: PartySectionProps
  formId: string
  onClose(): void
}

/** O formulário do "Mandar para…" de um jogador, logo abaixo da lista do Grupo. */
export function PartySendForm({ member, party, formId, onClose }: PartySendFormProps) {
  return (
    <div id={formId}>
      {/* `key`: trocar de jogador reabre o formulário do zero, sem a escolha do anterior. */}
      <SceneSendForm
        key={member.playerId}
        title={`Mandar ${member.name} para…`}
        ariaLabel={`Mandar ${member.name} para outra cena`}
        submitLabel="Mandar"
        failedText={PARTY_SEND_FAILED}
        destinations={sendDestinationsFor(member, party.destinations)}
        onSend={(sceneId, pinId) => party.onSend(member.playerId, sceneId, pinId)}
        onClose={onClose}
      />
    </div>
  )
}
