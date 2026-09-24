import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ITEM_NAME_MAX_LENGTH } from '../lib/items'
import type { PartyDestination, PartyItemAction, PartyMember } from '../lib/party'
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

/** Os formulários de uma linha do Grupo, abaixo da lista: "Mandar para…" ou "Dar item…". */
export type PartyFormKind = 'send' | 'give'

/**
 * O "Mandar para…" e o "Dar item…" do Grupo: um formulário por vez (abrir um
 * fecha o outro), e o foco volta ao botão que o abriu ao terminar ou cancelar
 * (quem abriu pode ter saído da lista).
 */
export function usePartySend() {
  const [open, setOpen] = useState<{ kind: PartyFormKind; playerId: string } | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  const close = () => {
    setOpen(null)
    const opener = openerRef.current
    openerRef.current = null
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus()
    })
  }

  const toggle = (playerId: string, opener: HTMLElement, kind: PartyFormKind = 'send') => {
    if (open !== null && open.kind === kind && open.playerId === playerId) {
      close()
      return
    }
    openerRef.current = opener
    setOpen({ kind, playerId })
  }

  const sendingId = open?.kind === 'send' ? open.playerId : null
  const givingId = open?.kind === 'give' ? open.playerId : null
  return { sendingId, givingId, toggle, close }
}

interface PartyActionsProps {
  member: PartyMember
  party: PartySectionProps
  sendOpen: boolean
  sendFormId: string
  onToggleSend(opener: HTMLElement): void
  /** "Dar item…" aberto para este jogador. */
  giveOpen: boolean
  giveFormId: string
  onToggleGive(opener: HTMLElement): void
}

/**
 * As ações de mesa de uma linha do Grupo: ir ver ("Ir lá"), a câmera
 * acompanhar ("Seguir"), trazer ou levar o jogador ("Mandar para…") e, quando
 * quem monta grava mochila, dar um item ("Dar item…"). São as que o mestre
 * usa a cada cena: ficam sempre à vista, nunca no "Mais".
 */
export function PartyActions({ member, party, sendOpen, sendFormId, onToggleSend, giveOpen, giveFormId, onToggleGive }: PartyActionsProps) {
  const { onGoTo, onToggleFollow, followingId = null, onItem } = party
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
      {onItem !== undefined && (
        <button
          type="button"
          className="lb-btn lb-btn--compact"
          aria-label={`Dar item a ${member.name}`}
          aria-expanded={giveOpen}
          aria-controls={giveOpen ? giveFormId : undefined}
          onClick={(event) => onToggleGive(event.currentTarget)}
        >
          Dar item…
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

/** O formulário do "Dar item…" de um jogador, logo abaixo da lista do Grupo. Sem `onItem`, nada. */
export function PartyGiveForm({ member, party, formId, onClose }: PartySendFormProps) {
  const { onItem } = party
  if (onItem === undefined) return null
  return (
    <div id={formId}>
      {/* `key`: trocar de jogador reabre o campo vazio, sem o texto do anterior. */}
      <GiveForm key={member.playerId} member={member} onGive={(target, nome) => onItem({ kind: 'dar', member: target, nome })} onClose={onClose} />
    </div>
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
      <ul className="lb-party__mochila" aria-label={`Mochila de ${member.name}`}>
        {member.mochila.map((item) => (
          <li key={`${item.tokenId}:${item.id}`} className="lb-player__line lb-player__line--acoes">
            <span className="lb-player__note">{item.nome}</span>{' '}
            <button type="button" className="lb-btn lb-btn--compact" aria-label={`Tirar ${item.nome} de ${member.name}`} onClick={() => run({ kind: 'tirar', item })}>
              Tirar
            </button>
            <button
              type="button"
              className="lb-btn lb-btn--compact"
              aria-label={`Devolver ao chão ${item.nome} de ${member.name}`}
              onClick={() => run({ kind: 'devolver', item })}
            >
              Devolver ao chão
            </button>
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

interface PartyBackpackProps {
  member: PartyMember
  onItem: PartySectionProps['onItem']
}

/**
 * ITEM PEGÁVEL na linha do Grupo: quem tem o quê, de relance. Mochila vazia
 * não ocupa linha. Sem `onItem` (quem monta não grava mochila), só o resumo
 * com os nomes; com ele, a contagem e, por item, Tirar e Devolver ao chão.
 */
export function PartyBackpack({ member, onItem }: PartyBackpackProps) {
  if (member.mochila.length === 0) return null
  if (onItem === undefined) {
    return <p className="lb-player__note">{`Mochila: ${member.mochila.length} — ${member.mochila.map((item) => item.nome).join(', ')}`}</p>
  }
  return (
    <>
      <p className="lb-player__note">{`Mochila: ${member.mochila.length}`}</p>
      <BackpackList member={member} onItem={onItem} />
    </>
  )
}
