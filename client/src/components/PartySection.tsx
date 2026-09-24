import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ITEM_NAME_MAX_LENGTH } from '../lib/items'
import { partyPresenceLabel, type PartyDestination, type PartyItemAction, type PartyMember } from '../lib/party'
import { SceneSendForm } from './SceneSendForm'
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
  /** De quem é a tela aberta no espelho agora; `null` = nenhuma. */
  mirroringId?: string | null
  /** "Ver tela": abre (ou fecha, se já é a dele) o espelho da tela do jogador. Sem ele, não há botão. */
  onToggleMirror?(member: PartyMember): void
  /**
   * ITEM PEGÁVEL: tirar, devolver ao chão ou dar um item. `false` = não deu
   * (a ficha ou o item mudou), e a linha avisa. Sem ele, a mochila é só leitura.
   */
  onItem?(action: PartyItemAction): boolean
  /**
   * "Recado" da linha: manda `text` SÓ a este jogador. Devolve se saiu agora,
   * se fica para quando ele voltar, ou `null` se não deu. Ausente = sala
   * fechada: a linha fica sem o botão.
   */
  onNote?(playerId: string, text: string): PlayerNoteDelivery
}

export const PARTY_ITEM_FAILED = 'Não deu: a ficha ou o item mudou. Tente de novo.'

/** Nome FIXO do botão: o estado vai em `aria-pressed`, e o leitor de tela lê "Seguir, pressionado". */
export const FOLLOW_LABEL = 'Seguir'

/** Texto visível do botão de espelhar; o nome acessível leva o nome do jogador (`mirrorLabel`). */
export const MIRROR_LABEL = 'Ver tela'

/** Começa pelo texto visível: quem comanda por voz diz "Ver tela" e acha o botão. */
export function mirrorLabel(name: string): string {
  return `${MIRROR_LABEL} de ${name}`
}

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

interface GiveFormProps {
  member: PartyMember
  onGive(member: PartyMember, nome: string): boolean
  onClose(): void
}

/**
 * "Dar item…" do mestre, logo abaixo da lista, no molde do "Mandar para…":
 * um campo com rótulo, já com o foco; "Dar" fica indisponível com o campo
 * vazio; Enter dá (é um `<form>`); Esc cancela. Não deu: o texto fica.
 */
function GiveForm({ member, onGive, onClose }: GiveFormProps) {
  const fieldId = useId()
  const [nome, setNome] = useState('')
  const [failed, setFailed] = useState(false)
  const fieldRef = useRef<HTMLInputElement | null>(null)
  const empty = nome.trim() === ''

  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (empty) return
    if (onGive(member, nome)) onClose()
    else setFailed(true)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return
    // Esc fecha sem dar; não pode chegar ao canvas (Esc lá troca a ferramenta).
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  return (
    <form className="lb-party__send" aria-label={`Item novo para ${member.name}`} onSubmit={submit} onKeyDown={onKeyDown}>
      <label className="lb-label" htmlFor={fieldId}>
        Item para {member.name}
      </label>
      <input
        id={fieldId}
        ref={fieldRef}
        type="text"
        className="lb-input"
        value={nome}
        maxLength={ITEM_NAME_MAX_LENGTH}
        onChange={(event) => {
          setNome(event.target.value)
          setFailed(false)
        }}
      />
      {failed && (
        <p className="lb-room__error" role="alert">
          {PARTY_ITEM_FAILED}
        </p>
      )}
      <div className="lb-party__actions">
        <span className="lb-cenas__recado-conta" aria-hidden="true">
          {nome.length}/{ITEM_NAME_MAX_LENGTH}
        </span>
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="lb-btn lb-btn--primary" disabled={empty}>
          Dar
        </button>
      </div>
    </form>
  )
}

interface BackpackListProps {
  member: PartyMember
  onItem(action: PartyItemAction): boolean
}

/**
 * A mochila de um jogador, item por item, com o que o mestre faz com cada um:
 * "Tirar" (a chave usada some) e "Devolver ao chão" (vira pino pegável onde a
 * ficha está). O nome acessível diz o item e de quem é: com sete jogadores,
 * "Tirar" sozinho não diz qual.
 */
function BackpackList({ member, onItem }: BackpackListProps) {
  const [failed, setFailed] = useState(false)
  const run = (action: PartyItemAction) => setFailed(!onItem(action))
  return (
    <>
      <ul className="lb-party__list" aria-label={`Mochila de ${member.name}`}>
        {member.mochila.map((item) => (
          <li key={`${item.tokenId}:${item.id}`} className="lb-party__where">
            {item.nome}{' '}
            <span className="lb-party__actions">
              <button type="button" className="lb-btn" aria-label={`Tirar ${item.nome} de ${member.name}`} onClick={() => run({ kind: 'tirar', item })}>
                Tirar
              </button>
              <button
                type="button"
                className="lb-btn"
                aria-label={`Devolver ao chão ${item.nome} de ${member.name}`}
                onClick={() => run({ kind: 'devolver', item })}
              >
                Devolver ao chão
              </button>
            </span>
          </li>
        ))}
      </ul>
      {failed && (
        <p className="lb-room__error" role="alert">
          {PARTY_ITEM_FAILED}
        </p>
      )}
    </>
  )
}

/**
 * "Grupo", no alto da aba Jogo: onde está cada jogador, de relance, e as duas
 * ações de quem conduz uma mesa espalhada — ir ver ("Ir lá") e trazer ou
 * levar alguém ("Mandar para…") — e o "Recado" que só aquele jogador lê. A
 * bolinha é a cor do disco da ficha: é a mesma peça que o mestre procura no mapa.
 */
export function PartySection({ members, destinations, onGoTo, onSend, followingId = null, onToggleFollow, mirroringId = null, onToggleMirror, onItem, onNote }: PartySectionProps) {
  const headingId = useId()
  const formId = useId()
  const giveFormId = useId()
  const noteFormId = useId()
  const [sendingId, setSendingId] = useState<string | null>(null)
  /** De quem é o "Dar item…" aberto. Um formulário por vez: abrir um fecha o outro. */
  const [givingId, setGivingId] = useState<string | null>(null)
  /** Jogador com o "Recado" aberto; `null` = nenhum. */
  const [notingId, setNotingId] = useState<string | null>(null)
  /** Aviso do último recado, na linha do jogador; some sozinho. */
  const [noteFeedback, setNoteFeedback] = useState<{ playerId: string; text: string } | null>(null)
  /** Quem abriu o envio, o "Dar item…" ou o recado: o foco volta para ele ao fechar. */
  const openerRef = useRef<HTMLElement | null>(null)
  const sending = members.find((member) => member.playerId === sendingId)
  const giving = members.find((member) => member.playerId === givingId)
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

  const closeForm = () => {
    setSendingId(null)
    setGivingId(null)
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
          const givingOpen = member.playerId === givingId
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
              {/* ITEM PEGÁVEL: quem tem o quê, de relance. Mochila vazia não ocupa linha. */}
              {member.mochila.length > 0 &&
                (onItem === undefined ? (
                  <span className="lb-party__where">
                    {`Mochila: ${member.mochila.length} — ${member.mochila.map((item) => item.nome).join(', ')}`}
                  </span>
                ) : (
                  <>
                    <span className="lb-party__where">{`Mochila: ${member.mochila.length}`}</span>
                    <BackpackList member={member} onItem={onItem} />
                  </>
                ))}
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
                  {/* Desconectado não tem tela: o botão abriria um espelho vazio. */}
                  {member.token !== null && onToggleMirror !== undefined && member.connected && (
                    <button
                      type="button"
                      className="lb-btn"
                      aria-label={mirrorLabel(member.name)}
                      aria-expanded={member.playerId === mirroringId}
                      aria-haspopup="dialog"
                      onClick={() => onToggleMirror(member)}
                    >
                      {MIRROR_LABEL}
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
                          closeForm()
                          return
                        }
                        openerRef.current = event.currentTarget
                        setGivingId(null)
                        setNotingId(null)
                        setSendingId(member.playerId)
                      }}
                    >
                      {SEND_TO_LABEL}
                    </button>
                  )}
                  {member.token !== null && onItem !== undefined && (
                    <button
                      type="button"
                      className="lb-btn"
                      aria-label={`Dar item a ${member.name}`}
                      aria-expanded={givingOpen}
                      aria-controls={givingOpen ? giveFormId : undefined}
                      onClick={(event) => {
                        if (givingOpen) {
                          closeForm()
                          return
                        }
                        openerRef.current = event.currentTarget
                        setSendingId(null)
                        setNotingId(null)
                        setGivingId(member.playerId)
                      }}
                    >
                      Dar item…
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
                        setGivingId(null)
                        setNoteFeedback(null)
                        setNotingId(member.playerId)
                      }}
                    >
                      {NOTE_LABEL}
                    </button>
                  )}
                </div>
              )}
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
          <SceneSendForm
            key={sending.playerId}
            title={`Mandar ${sending.name} para…`}
            ariaLabel={`Mandar ${sending.name} para outra cena`}
            submitLabel="Mandar"
            failedText={PARTY_SEND_FAILED}
            destinations={sendDestinationsFor(sending, destinations)}
            onSend={(sceneId, pinId) => onSend(sending.playerId, sceneId, pinId)}
            onClose={closeForm}
          />
        </div>
      )}
      {giving !== undefined && giving.token !== null && onItem !== undefined && (
        <div id={giveFormId}>
          <GiveForm key={giving.playerId} member={giving} onGive={(member, nome) => onItem({ kind: 'dar', member, nome })} onClose={closeForm} />
        </div>
      )}
    </section>
  )
}
