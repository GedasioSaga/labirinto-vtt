import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ITEM_NAME_MAX_LENGTH } from '../lib/items'
import { partyPresenceLabel, type PartyDestination, type PartyItemAction, type PartyMember } from '../lib/party'
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
  /**
   * ITEM PEGÁVEL: tirar, devolver ao chão ou dar um item. `false` = não deu
   * (a ficha ou o item mudou), e a linha avisa. Sem ele, a mochila é só leitura.
   */
  onItem?(action: PartyItemAction): boolean
}

export const PARTY_ITEM_FAILED = 'Não deu: a ficha ou o item mudou. Tente de novo.'

/** Nome FIXO do botão: o estado vai em `aria-pressed`, e o leitor de tela lê "Seguir, pressionado". */
export const FOLLOW_LABEL = 'Seguir'

export const PARTY_SEND_FAILED = 'Não deu para mandar: a cena ou a ficha mudou. Escolha de novo.'

/** O rótulo do botão que abre o envio: o teste e o leitor de tela acham a linha por ele. */
export const SEND_TO_LABEL = 'Mandar para…'

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
 * levar alguém ("Mandar para…"). A bolinha é a cor do disco da ficha: é a
 * mesma peça que o mestre procura no mapa.
 */
export function PartySection({ members, destinations, onGoTo, onSend, followingId = null, onToggleFollow, onItem }: PartySectionProps) {
  const headingId = useId()
  const formId = useId()
  const giveFormId = useId()
  const [sendingId, setSendingId] = useState<string | null>(null)
  /** De quem é o "Dar item…" aberto. Um formulário por vez: abrir um fecha o outro. */
  const [givingId, setGivingId] = useState<string | null>(null)
  /** Quem abriu o envio (ou o "Dar item…"): o foco volta para ele ao terminar ou cancelar. */
  const openerRef = useRef<HTMLElement | null>(null)
  const sending = members.find((member) => member.playerId === sendingId)
  const giving = members.find((member) => member.playerId === givingId)

  const closeForm = () => {
    setSendingId(null)
    setGivingId(null)
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
          const givingOpen = member.playerId === givingId
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
                          closeForm()
                          return
                        }
                        openerRef.current = event.currentTarget
                        setGivingId(null)
                        setSendingId(member.playerId)
                      }}
                    >
                      {SEND_TO_LABEL}
                    </button>
                  )}
                  {onItem !== undefined && (
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
                        setGivingId(member.playerId)
                      }}
                    >
                      Dar item…
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
