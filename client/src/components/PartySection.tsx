import { useId, useRef, useState } from 'react'
import { partyPresenceLabel, type PartyDestination, type PartyMember } from '../lib/party'
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
 * "Grupo", no alto da aba Jogo: onde está cada jogador, de relance, e as duas
 * ações de quem conduz uma mesa espalhada — ir ver ("Ir lá") e trazer ou
 * levar alguém ("Mandar para…"). A bolinha é a cor do disco da ficha: é a
 * mesma peça que o mestre procura no mapa.
 */
export function PartySection({ members, destinations, onGoTo, onSend, followingId = null, onToggleFollow }: PartySectionProps) {
  const headingId = useId()
  const formId = useId()
  const [sendingId, setSendingId] = useState<string | null>(null)
  /** Quem abriu o envio: o foco volta para ele ao mandar ou cancelar. */
  const openerRef = useRef<HTMLElement | null>(null)
  const sending = members.find((member) => member.playerId === sendingId)

  const closeSend = () => {
    setSendingId(null)
    const opener = openerRef.current
    openerRef.current = null
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus()
    })
  }

  return (
    <section className="lb-party" aria-labelledby={headingId}>
      <h3 id={headingId} className="lb-eyebrow">
        Grupo
      </h3>
      <ul className="lb-party__list">
        {members.map((member) => {
          const targets = member.token === null ? [] : sendDestinationsFor(member, destinations)
          const open = member.playerId === sendingId
          return (
            <li key={member.playerId} className="lb-party__item">
              <div className="lb-party__who">
                {/* Sem ficha, sem cor: a bolinha vazia diz "não está no mapa". */}
                <span
                  className="lb-party__dot"
                  aria-hidden="true"
                  style={member.token === null ? undefined : { background: member.token.color }}
                />
                {/* Os espaços são do texto: sem eles o leitor de tela lê "Anaonline". */}
                <strong className="lb-party__name">{member.name}</strong>{' '}
                <span className={`lb-party__presence${member.connected ? ' lb-party__presence--on' : ''}`}>{partyPresenceLabel(member)}</span>
              </div>{' '}
              <span className="lb-party__where">{member.token === null ? 'sem ficha no mapa' : (member.sceneName ?? 'no mapa aberto')}</span>
              {member.token !== null && (
                <div className="lb-party__actions">
                  <button type="button" className="lb-btn" onClick={() => onGoTo(member)}>
                    Ir lá
                  </button>
                  {onToggleFollow !== undefined && (
                    // Ligado ganha o destaque do "Laser" da mesma aba: um botão de modo, não uma ação de uma vez.
                    <button
                      type="button"
                      className={member.playerId === followingId ? 'lb-btn lb-btn--primary' : 'lb-btn'}
                      aria-pressed={member.playerId === followingId}
                      onClick={() => onToggleFollow(member)}
                    >
                      {FOLLOW_LABEL}
                    </button>
                  )}
                  {targets.length > 0 && (
                    <button
                      type="button"
                      className="lb-btn"
                      aria-expanded={open}
                      aria-controls={open ? formId : undefined}
                      onClick={(event) => {
                        if (open) {
                          closeSend()
                          return
                        }
                        openerRef.current = event.currentTarget
                        setSendingId(member.playerId)
                      }}
                    >
                      {SEND_TO_LABEL}
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {sending !== undefined && sending.token !== null && (
        <div id={formId}>
          {/* `key`: trocar de jogador reabre o formulário do zero, sem a escolha do anterior. */}
          <SceneSendForm
            key={sending.playerId}
            title={`Mandar ${sending.name} para…`}
            ariaLabel={`Mandar ${sending.name} para outra cena`}
            submitLabel="Mandar"
            failedText={PARTY_SEND_FAILED}
            destinations={sendDestinationsFor(sending, destinations)}
            onSend={(sceneId, pinId) => onSend(sending.playerId, sceneId, pinId)}
            onClose={closeSend}
          />
        </div>
      )}
    </section>
  )
}
