import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { awayTokenLabel, awayTokenName, PARTY_CENTER_LABEL, partyPresenceLabel, type PartyDestination, type PartyMember } from '../lib/party'
import type { PlayerNoteDelivery } from '../net/hostSession'
import { NOTE_FEEDBACK_MS, NoteForm } from './ScenesSection'

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
  /**
   * "Recado" da linha: manda `text` SÓ a este jogador. Devolve se saiu agora,
   * se fica para quando ele voltar, ou `null` se não deu. Ausente = sala
   * fechada: a linha fica sem o botão.
   */
  onNote?(playerId: string, text: string): PlayerNoteDelivery
  /**
   * "Trazer" do aviso "Faísca ficou em outra cena": põe a ficha `tokenId` ao
   * lado do dono, na cena dele. `false` = não deu (a linha avisa). Ausente =
   * sala fechada: o aviso aparece sem o botão.
   */
  onBring?(playerId: string, tokenId: string): boolean
}

/** O aviso na linha quando o "Trazer" não deu. */
export const BRING_FAILED = 'Não deu para trazer: a ficha ou a cena mudou.'

/** Nome FIXO do botão: o estado vai em `aria-pressed`, e o leitor de tela lê "Seguir, pressionado". */
export const FOLLOW_LABEL = 'Seguir'

/** Valor do `<select>` de chegada que quer dizer "centro da cena" (id de pino nunca é vazio). */
const CENTER = ''

export const PARTY_SEND_FAILED = 'Não deu para mandar: a cena ou a ficha mudou. Escolha de novo.'

/** O rótulo do botão que abre o envio: o teste e o leitor de tela acham a linha por ele. */
export const SEND_TO_LABEL = 'Mandar para…'

/** O botão do recado para UM jogador; o nome acessível leva o nome dele ("Recado para Gabi"). */
export const NOTE_LABEL = 'Recado'

/** O aviso na linha do jogador depois do "Recado": o que aconteceu com ele. */
export function playerNoteFeedbackText(name: string, delivery: PlayerNoteDelivery): string {
  if (delivery === 'sent') return `Recado enviado a ${name}`
  if (delivery === 'queued') return `${name} recebe ao voltar`
  return 'Não deu para enviar: a sala não está aberta.'
}

/** O "fora há 0:10" anda de segundo em segundo no primeiro minuto. */
const OFFLINE_TICK_MS = 1_000

/**
 * Relógio do "fora há…": só anda enquanto alguém está fora, e só re-renderiza
 * esta seção — o resto do painel não sabe que ele existe.
 */
function useOfflineClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), OFFLINE_TICK_MS)
    return () => clearInterval(timer)
  }, [active])
  return now
}

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
 * levar alguém ("Mandar para…") — e o "Recado" que só aquele jogador lê. A
 * bolinha é a cor do disco da ficha: é a mesma peça que o mestre procura no mapa.
 */
export function PartySection({ members, destinations, onGoTo, onSend, followingId = null, onToggleFollow, onNote, onBring }: PartySectionProps) {
  const headingId = useId()
  const formId = useId()
  const noteFormId = useId()
  const [sendingId, setSendingId] = useState<string | null>(null)
  /** Jogador com o "Recado" aberto; `null` = nenhum. */
  const [notingId, setNotingId] = useState<string | null>(null)
  /** Aviso do último recado, na linha do jogador; some sozinho. */
  const [noteFeedback, setNoteFeedback] = useState<{ playerId: string; text: string } | null>(null)
  /** A ficha cujo "Trazer" não deu; `null` = nenhuma. */
  const [bringFailedId, setBringFailedId] = useState<string | null>(null)
  /** Quem abriu o envio ou o recado: o foco volta para ele ao fechar. */
  const openerRef = useRef<HTMLElement | null>(null)
  const sending = members.find((member) => member.playerId === sendingId)
  const now = useOfflineClock(members.some((member) => member.offlineSince !== undefined))

  useEffect(() => {
    if (noteFeedback === null) return
    const timer = setTimeout(() => setNoteFeedback(null), NOTE_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [noteFeedback])

  const returnFocus = () => {
    const opener = openerRef.current
    openerRef.current = null
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus()
    })
  }

  const closeSend = () => {
    setSendingId(null)
    returnFocus()
  }

  const closeNote = () => {
    setNotingId(null)
    returnFocus()
  }

  const sendNote = (member: PartyMember, text: string) => {
    const delivery = onNote?.(member.playerId, text) ?? null
    setNoteFeedback({ playerId: member.playerId, text: playerNoteFeedbackText(member.name, delivery) })
    closeNote()
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
          const noting = member.playerId === notingId
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
                <span className={`lb-party__presence${member.connected ? ' lb-party__presence--on' : ''}`}>{partyPresenceLabel(member, now)}</span>
              </div>{' '}
              <span className="lb-party__where">{member.token === null ? 'sem ficha no mapa' : (member.sceneName ?? 'no mapa aberto')}</span>
              {(member.token !== null || onNote !== undefined) && (
                <div className="lb-party__actions">
                  {member.token !== null && (
                    <button type="button" className="lb-btn" onClick={() => onGoTo(member)}>
                      Ir lá
                    </button>
                  )}
                  {member.token !== null && onToggleFollow !== undefined && (
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
                        setNotingId(null)
                        setSendingId(member.playerId)
                      }}
                    >
                      {SEND_TO_LABEL}
                    </button>
                  )}
                  {onNote !== undefined && (
                    // Montado também com o campo aberto: é para ele que o foco volta.
                    <button
                      type="button"
                      className={noting ? 'lb-btn lb-btn--primary' : 'lb-btn'}
                      aria-label={`${NOTE_LABEL} para ${member.name}`}
                      aria-expanded={noting}
                      aria-controls={noting ? noteFormId : undefined}
                      title="Recado: só este jogador lê"
                      onClick={(event) => {
                        if (noting) {
                          closeNote()
                          return
                        }
                        openerRef.current = event.currentTarget
                        setSendingId(null)
                        setNoteFeedback(null)
                        setNotingId(member.playerId)
                      }}
                    >
                      {NOTE_LABEL}
                    </button>
                  )}
                </div>
              )}
              {(member.awayTokens ?? []).map((away) => (
                <p key={away.tokenId} className="lb-party__where" title={`Em ${away.sceneName}`}>
                  {awayTokenLabel(away.name)}
                  {onBring !== undefined && (
                    <>
                      {' '}
                      <button
                        type="button"
                        className="lb-btn"
                        aria-label={`Trazer ${awayTokenName(away.name)} para perto de ${member.name}`}
                        onClick={() => setBringFailedId(onBring(member.playerId, away.tokenId) ? null : away.tokenId)}
                      >
                        Trazer
                      </button>
                    </>
                  )}
                  {bringFailedId === away.tokenId && (
                    <>
                      {' '}
                      <span className="lb-room__error" role="alert">
                        {BRING_FAILED}
                      </span>
                    </>
                  )}
                </p>
              ))}
              {onNote !== undefined && noting && (
                <div id={noteFormId}>
                  <NoteForm label={`Recado só para ${member.name}`} onSend={(text) => sendNote(member, text)} onCancel={closeNote} />
                </div>
              )}
              {noteFeedback?.playerId === member.playerId && (
                <p className="lb-party__recado-aviso" role="status">
                  {noteFeedback.text}
                </p>
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
