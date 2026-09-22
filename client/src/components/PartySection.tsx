import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { PARTY_CENTER_LABEL, partyPresenceLabel, type PartyDestination, type PartyMember } from '../lib/party'

export interface PartySectionProps {
  members: PartyMember[]
  /** Todas as cenas da aventura que abriram; vazio no mapa solto (não há para onde mandar). */
  destinations: PartyDestination[]
  /** "Ir lá": o editor abre a cena do jogador com a ficha dele no centro. */
  onGoTo(member: PartyMember): void
  /** "Mandar para…" confirmado. `false` = não deu, e o formulário fica aberto com o aviso. */
  onSend(playerId: string, sceneId: string, pinId: string | null): boolean
}

/** Valor do `<select>` de chegada que quer dizer "centro da cena" (id de pino nunca é vazio). */
const CENTER = ''

export const PARTY_SEND_FAILED = 'Não deu para mandar: a cena ou a ficha mudou. Escolha de novo.'

/** O rótulo do botão que abre o envio: o teste e o leitor de tela acham a linha por ele. */
export const SEND_TO_LABEL = 'Mandar para…'

/** As cenas para onde ESTE jogador pode ir: todas menos a dele. */
export function sendDestinationsFor(member: PartyMember, destinations: PartyDestination[]): PartyDestination[] {
  return destinations.filter((destination) => destination.sceneId !== member.sceneId)
}

interface SendFormProps {
  member: PartyMember
  destinations: PartyDestination[]
  onSend: PartySectionProps['onSend']
  onClose(): void
}

/**
 * O envio de um jogador, logo abaixo da lista: cena e chegada em duas listas
 * nativas (teclado e leitor de tela de graça), "Centro da cena" já escolhido
 * — é o destino que sempre existe. Enter envia (é um `<form>`); Esc cancela.
 */
function SendForm({ member, destinations, onSend, onClose }: SendFormProps) {
  const baseId = useId()
  const [sceneId, setSceneId] = useState(destinations[0]?.sceneId ?? '')
  const [arrival, setArrival] = useState(CENTER)
  const [failed, setFailed] = useState(false)
  const sceneRef = useRef<HTMLSelectElement | null>(null)
  const scene = destinations.find((destination) => destination.sceneId === sceneId)

  useEffect(() => {
    sceneRef.current?.focus()
  }, [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (scene === undefined) return
    if (onSend(member.playerId, scene.sceneId, arrival === CENTER ? null : arrival)) onClose()
    else setFailed(true)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return
    // Esc fecha sem mandar; não pode chegar ao canvas (Esc lá troca a ferramenta).
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  return (
    <form className="lb-party__send" aria-label={`Mandar ${member.name} para outra cena`} onSubmit={submit} onKeyDown={onKeyDown}>
      <span className="lb-label">Mandar {member.name} para…</span>
      <label className="lb-label" htmlFor={`${baseId}-scene`}>
        Cena
      </label>
      <select
        id={`${baseId}-scene`}
        ref={sceneRef}
        className="lb-input"
        value={sceneId}
        onChange={(event) => {
          setSceneId(event.target.value)
          // O pino escolhido era da outra cena: a chegada volta ao centro.
          setArrival(CENTER)
          setFailed(false)
        }}
      >
        {destinations.map((destination) => (
          <option key={destination.sceneId} value={destination.sceneId}>
            {destination.name}
          </option>
        ))}
      </select>
      <label className="lb-label" htmlFor={`${baseId}-arrival`}>
        Chegada
      </label>
      <select
        id={`${baseId}-arrival`}
        className="lb-input"
        value={arrival}
        onChange={(event) => {
          setArrival(event.target.value)
          setFailed(false)
        }}
      >
        <option value={CENTER}>{PARTY_CENTER_LABEL}</option>
        {(scene?.arrivals ?? []).map((pin) => (
          <option key={pin.pinId} value={pin.pinId}>
            {pin.label}
          </option>
        ))}
      </select>
      {failed && (
        <p className="lb-room__error" role="alert">
          {PARTY_SEND_FAILED}
        </p>
      )}
      <div className="lb-party__actions">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="lb-btn lb-btn--primary">
          Mandar
        </button>
      </div>
    </form>
  )
}

/**
 * "Grupo", no alto da aba Jogo: onde está cada jogador, de relance, e as duas
 * ações de quem conduz uma mesa espalhada — ir ver ("Ir lá") e trazer ou
 * levar alguém ("Mandar para…"). A bolinha é a cor do disco da ficha: é a
 * mesma peça que o mestre procura no mapa.
 */
export function PartySection({ members, destinations, onGoTo, onSend }: PartySectionProps) {
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
          <SendForm key={sending.playerId} member={sending} destinations={sendDestinationsFor(sending, destinations)} onSend={onSend} onClose={closeSend} />
        </div>
      )}
    </section>
  )
}
