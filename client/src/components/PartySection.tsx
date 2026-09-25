import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ITEM_NAME_MAX_LENGTH } from '../lib/items'
import { awayTokenLabel, awayTokenName, type PartyDestination, type PartyItemAction, type PartyMember } from '../lib/party'
import { SceneSendForm } from './SceneSendForm'
import type { PlayerNoteDelivery, TradeProposeRefusal, TradeProposeResult } from '../net/hostSession'
import { MOEDAS_MAX, moedasLabel, TRADE_FROM_MAX_LENGTH, type TradeProposal } from '../lib/troca'
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
  /** "Ver" da marca "vamos para cá": a câmera vai até a marca, na cena dele. Sem ele, não há botão. */
  onViewDestination?(member: PartyMember): void
  /**
   * "Trazer" do aviso "Faísca ficou em outra cena": põe a ficha `tokenId` ao
   * lado do dono, na cena dele. `false` = não deu (a linha avisa). Ausente =
   * sala fechada: o aviso aparece sem o botão.
   */
  onBring?(playerId: string, tokenId: string): boolean
  /**
   * MOEDAS E TROCA — "Propor troca…" confirmado: a oferta vai ao jogador da
   * linha. Devolve `sent` ou o motivo de não ter saído (a linha avisa e o
   * formulário fica). Ausente = sala fechada: a linha fica sem o botão.
   */
  onTrade?(member: PartyMember, proposta: TradeProposal): TradeProposeResult
}

export const PARTY_ITEM_FAILED = 'Não deu: a ficha ou o item mudou. Tente de novo.'

/** O que a linha diz quando a oferta não saiu. */
export const PARTY_TRADE_REFUSAL_TEXT: Record<TradeProposeRefusal, string> = {
  pending: 'Já há uma oferta esperando este jogador.',
  short: 'A ficha não tem o que você pede.',
  offline: 'O jogador está fora do ar agora.',
  unavailable: 'Não deu: a ficha mudou. Tente de novo.',
}
/** O que a linha diz quando o jogador pôs a marca "vamos para cá". */
export const DESTINATION_MARKED_LABEL = 'destino marcado'
export const VIEW_DESTINATION_LABEL = 'Ver'
/** O aviso na linha quando o "Trazer" não deu. */
export const BRING_FAILED = 'Não deu para trazer: a ficha ou a cena mudou.'

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
 * a lista do Grupo — o resto do painel não sabe que ele existe.
 */
export function useOfflineClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), OFFLINE_TICK_MS)
    return () => clearInterval(timer)
  }, [active])
  return now
}

/**
 * As cenas para onde ESTE jogador pode ir: todas menos a dele. As que têm
 * gente (outro jogador conectado lá) vêm primeiro — é para junto do grupo
 * que o mestre manda quem se perdeu —, e cada parte segue a ordem da lista.
 */
export function sendDestinationsFor(member: PartyMember, destinations: PartyDestination[], members: readonly PartyMember[] = []): PartyDestination[] {
  const occupied = new Set<string>()
  for (const other of members) {
    if (other.playerId !== member.playerId && other.connected && other.sceneId !== null) occupied.add(other.sceneId)
  }
  const targets = destinations.filter((destination) => destination.sceneId !== member.sceneId)
  return [...targets.filter((destination) => occupied.has(destination.sceneId)), ...targets.filter((destination) => !occupied.has(destination.sceneId))]
}

/**
 * Os formulários de uma linha do Grupo: "Mandar para…" e "Dar item…" abaixo
 * da lista, o "Recado" dentro da própria linha.
 */
export type PartyFormKind = 'send' | 'give' | 'note'

/**
 * O "Mandar para…", o "Dar item…" e o "Recado" do Grupo: um formulário por
 * vez (abrir um fecha o outro), e o foco volta ao botão que o abriu ao
 * terminar ou cancelar (quem abriu pode ter saído da lista).
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
  const notingId = open?.kind === 'note' ? open.playerId : null
  return { sendingId, givingId, notingId, toggle, close }
}

/**
 * O aviso do último "Recado", na linha do jogador; some sozinho depois de
 * `NOTE_FEEDBACK_MS`. Um por vez: o recado novo troca o aviso anterior.
 */
export function useNoteFeedback() {
  const [feedback, setFeedback] = useState<{ playerId: string; text: string } | null>(null)
  useEffect(() => {
    if (feedback === null) return
    const timer = setTimeout(() => setFeedback(null), NOTE_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [feedback])
  return {
    feedback,
    show: (playerId: string, text: string) => setFeedback({ playerId, text }),
    clear: () => setFeedback(null),
  }
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
  /** "Recado" aberto para este jogador. */
  noteOpen: boolean
  noteFormId: string
  onToggleNote(opener: HTMLElement): void
}

/**
 * As ações de mesa de uma linha do Grupo: ir ver ("Ir lá"), a câmera
 * acompanhar ("Seguir"), ver a tela dele ("Ver tela"), trazer ou levar o
 * jogador ("Mandar para…"), dar um item ("Dar item…", quando quem monta grava
 * mochila) e o "Recado" que só ele lê. São as que o mestre usa a cada cena:
 * ficam sempre à vista, nunca no "Mais". Sem ficha no mapa, só o "Recado"
 * (ele chega quando o mapa do jogador aparecer).
 */
export function PartyActions({ member, party, sendOpen, sendFormId, onToggleSend, giveOpen, giveFormId, onToggleGive, noteOpen, noteFormId, onToggleNote }: PartyActionsProps) {
  const { onGoTo, onToggleFollow, followingId = null, onToggleMirror, mirroringId = null, onItem, onNote } = party
  const hasToken = member.token !== null
  const targets = hasToken ? sendDestinationsFor(member, party.destinations) : []
  const following = member.playerId === followingId
  if (!hasToken && onNote === undefined) return null
  return (
    <div className="lb-player__actions">
      {hasToken && (
        <button type="button" className="lb-btn lb-btn--compact" onClick={() => onGoTo(member)}>
          Ir lá
        </button>
      )}
      {hasToken && onToggleFollow !== undefined && (
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
      {/* Desconectado não tem tela: o botão abriria um espelho vazio. */}
      {hasToken && onToggleMirror !== undefined && member.connected && (
        <button
          type="button"
          className="lb-btn lb-btn--compact"
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
          className="lb-btn lb-btn--compact"
          aria-expanded={sendOpen}
          aria-controls={sendOpen ? sendFormId : undefined}
          onClick={(event) => onToggleSend(event.currentTarget)}
        >
          {SEND_TO_LABEL}
        </button>
      )}
      {hasToken && onItem !== undefined && (
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
      {onNote !== undefined && (
        // Montado também com o campo aberto: é para ele que o foco volta.
        <button
          type="button"
          className={noteOpen ? 'lb-btn lb-btn--compact lb-btn--primary' : 'lb-btn lb-btn--compact'}
          aria-label={`${NOTE_LABEL} para ${member.name}`}
          aria-expanded={noteOpen}
          aria-controls={noteOpen ? noteFormId : undefined}
          title="Recado: só este jogador lê"
          onClick={(event) => onToggleNote(event.currentTarget)}
        >
          {NOTE_LABEL}
        </button>
      )}
    </div>
  )
}

interface PartyNoteFormProps {
  member: PartyMember
  formId: string
  onSend(text: string): void
  onCancel(): void
}

/** O campo do "Recado" de um jogador, dentro da linha dele: só ele lê. */
export function PartyNoteForm({ member, formId, onSend, onCancel }: PartyNoteFormProps) {
  return (
    <div id={formId}>
      <NoteForm label={`Recado só para ${member.name}`} onSend={(text) => onSend(text)} onCancel={onCancel} />
    </div>
  )
}

interface PartyDestinationMarkProps {
  member: PartyMember
  onViewDestination: PartySectionProps['onViewDestination']
}

/**
 * MARCA "VAMOS PARA CÁ" na linha: quem marcou diz "destino marcado", e o
 * "Ver" leva a câmera até a marca, na cena dele. Sem marca, nada.
 */
export function PartyDestinationMark({ member, onViewDestination }: PartyDestinationMarkProps) {
  if (member.destination === undefined) return null
  return (
    <div className="lb-party__destination">
      <span>{DESTINATION_MARKED_LABEL}</span>
      {onViewDestination !== undefined && (
        <button type="button" className="lb-btn lb-btn--compact" aria-label={`Ver o destino marcado por ${member.name}`} onClick={() => onViewDestination(member)}>
          {VIEW_DESTINATION_LABEL}
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
        destinations={sendDestinationsFor(member, party.destinations, party.members)}
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

interface PartyAwayTokensProps {
  member: PartyMember
  onBring: PartySectionProps['onBring']
}

/**
 * MONTARIA E FAMILIAR: a ficha do jogador que ficou em OUTRA cena (a Faísca
 * esquecida na Vila) avisa na linha dele, com "Trazer", que a põe ao lado
 * dele. Sem `onBring` (sala fechada), o aviso sem o botão. Sem ficha longe, nada.
 */
export function PartyAwayTokens({ member, onBring }: PartyAwayTokensProps) {
  /** A ficha cujo "Trazer" não deu; `null` = nenhuma. */
  const [bringFailedId, setBringFailedId] = useState<string | null>(null)
  const away = member.awayTokens ?? []
  if (away.length === 0) return null
  return (
    <>
      {away.map((token) => (
        <p key={token.tokenId} className="lb-player__note" title={`Em ${token.sceneName}`}>
          {awayTokenLabel(token.name)}
          {onBring !== undefined && (
            <>
              {' '}
              <button
                type="button"
                className="lb-btn lb-btn--compact"
                aria-label={`Trazer ${awayTokenName(token.name)} para perto de ${member.name}`}
                onClick={() => setBringFailedId(onBring(member.playerId, token.tokenId) ? null : token.tokenId)}
              >
                Trazer
              </button>
            </>
          )}
          {bringFailedId === token.tokenId && (
            <>
              {' '}
              <span className="lb-room__error" role="alert">
                {BRING_FAILED}
              </span>
            </>
          )}
        </p>
      ))}
    </>
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

/** Valor de um campo de moedas: vazio é zero; só inteiro de 0 ao teto vale. `null` = torto. */
function coinField(raw: string): number | null {
  if (raw.trim() === '') return 0
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 && value <= MOEDAS_MAX ? value : null
}

/** Esc fecha o formulário sem enviar e não chega ao canvas (lá Esc troca a ferramenta). */
function escCloses(onClose: () => void) {
  return (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }
}

interface PartyPurseProps {
  member: PartyMember
  onItem: PartySectionProps['onItem']
  onTrade: PartySectionProps['onTrade']
}

/**
 * MOEDAS E TROCA na linha do Grupo: a bolsa da ficha, "Moedas…" (acerta o
 * valor) e "Propor troca…" (a oferta ao jogador). Um formulário por vez na
 * linha; fechar devolve o foco ao botão que o abriu. Sem ficha, nada; sem
 * `onItem` nem `onTrade`, só o valor (e só quando há moeda).
 */
export function PartyPurse({ member, onItem, onTrade }: PartyPurseProps) {
  const [open, setOpen] = useState<'moedas' | 'troca' | null>(null)
  const coinsRef = useRef<HTMLButtonElement | null>(null)
  const tradeRef = useRef<HTMLButtonElement | null>(null)
  const moedas = member.moedas ?? 0
  if (member.token === null || (onItem === undefined && onTrade === undefined && moedas === 0)) return null

  const close = () => {
    const opener = open === 'moedas' ? coinsRef.current : tradeRef.current
    setOpen(null)
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus()
    })
  }
  const toggle = (kind: 'moedas' | 'troca') => setOpen((current) => (current === kind ? null : kind))

  return (
    <>
      <div className="lb-player__line lb-player__line--acoes">
        <span className="lb-player__note">{moedas === 0 ? 'Bolsa vazia' : `Bolsa: ${moedasLabel(moedas)}`}</span>{' '}
        {onItem !== undefined && (
          <button type="button" ref={coinsRef} className="lb-btn lb-btn--compact" aria-label={`Moedas de ${member.name}`} aria-expanded={open === 'moedas'} onClick={() => toggle('moedas')}>
            Moedas…
          </button>
        )}
        {onTrade !== undefined && (
          <button type="button" ref={tradeRef} className="lb-btn lb-btn--compact" aria-label={`Propor troca a ${member.name}`} aria-expanded={open === 'troca'} onClick={() => toggle('troca')}>
            Propor troca…
          </button>
        )}
      </div>
      {open === 'moedas' && onItem !== undefined && <CoinsForm member={member} onItem={onItem} onClose={close} />}
      {open === 'troca' && onTrade !== undefined && <TradeForm member={member} onTrade={onTrade} onClose={close} />}
    </>
  )
}

interface CoinsFormProps {
  member: PartyMember
  onItem(action: PartyItemAction): boolean
  onClose(): void
}

/** "Moedas…": o valor da bolsa, já preenchido com o de agora. Enter salva; Esc cancela; não deu, o valor fica. */
function CoinsForm({ member, onItem, onClose }: CoinsFormProps) {
  const fieldId = useId()
  const [valor, setValor] = useState(String(member.moedas ?? 0))
  const [failed, setFailed] = useState(false)
  const fieldRef = useRef<HTMLInputElement | null>(null)
  const moedas = coinField(valor)

  useEffect(() => {
    fieldRef.current?.focus()
    fieldRef.current?.select()
  }, [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (moedas === null) return
    if (onItem({ kind: 'moedas', member, moedas })) onClose()
    else setFailed(true)
  }

  return (
    <form className="lb-party__send" aria-label={`Moedas de ${member.name}`} onSubmit={submit} onKeyDown={escCloses(onClose)}>
      <label className="lb-label" htmlFor={fieldId}>
        Moedas de {member.name}
      </label>
      <input
        id={fieldId}
        ref={fieldRef}
        type="number"
        inputMode="numeric"
        min={0}
        max={MOEDAS_MAX}
        step={1}
        className="lb-input"
        value={valor}
        onChange={(event) => {
          setValor(event.target.value)
          setFailed(false)
        }}
      />
      {moedas === null && (
        <p className="lb-room__error" role="alert">
          Use um número inteiro de 0 a {MOEDAS_MAX}.
        </p>
      )}
      {failed && (
        <p className="lb-room__error" role="alert">
          {PARTY_ITEM_FAILED}
        </p>
      )}
      <div className="lb-party__actions">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="lb-btn lb-btn--primary" disabled={moedas === null}>
          Salvar moedas
        </button>
      </div>
    </form>
  )
}

interface TradeFormProps {
  member: PartyMember
  onTrade(member: PartyMember, proposta: TradeProposal): TradeProposeResult
  onClose(): void
}

/**
 * "Propor troca…": quem oferece (a Zulmira; vazio é "Mestre"), o que dá
 * (itens novos, separados por vírgula, e moedas) e o que pede (itens da
 * mochila da ficha da linha e moedas). "Propor" fica indisponível sem nada
 * dos dois lados. Não saiu: o formulário fica, com o motivo.
 */
function TradeForm({ member, onTrade, onClose }: TradeFormProps) {
  const ids = { de: useId(), itens: useId(), douMoedas: useId(), pecoMoedas: useId() }
  const [de, setDe] = useState('')
  const [itens, setItens] = useState('')
  const [douMoedas, setDouMoedas] = useState('')
  const [pecoMoedas, setPecoMoedas] = useState('')
  const [pedidos, setPedidos] = useState<string[]>([])
  const [refusal, setRefusal] = useState<TradeProposeRefusal | null>(null)
  const firstRef = useRef<HTMLInputElement | null>(null)
  const tokenId = member.token?.id
  const mochila = member.mochila.filter((item) => item.tokenId === tokenId)
  const dou = coinField(douMoedas)
  const peco = coinField(pecoMoedas)
  const nomes = itens
    .split(',')
    .map((nome) => nome.trim())
    .filter((nome) => nome !== '')
  const vazia = nomes.length === 0 && pedidos.length === 0 && (dou ?? 0) === 0 && (peco ?? 0) === 0
  const torta = dou === null || peco === null

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  const togglePedido = (id: string) => {
    setRefusal(null)
    setPedidos((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (vazia || dou === null || peco === null) return
    const result = onTrade(member, { de: de.trim(), dou: { itens: nomes, moedas: dou }, peco: { itemIds: pedidos, moedas: peco } })
    if (result === 'sent') onClose()
    else setRefusal(result)
  }

  const edit = (set: (value: string) => void) => (event: { target: { value: string } }) => {
    set(event.target.value)
    setRefusal(null)
  }

  return (
    <form className="lb-party__send" aria-label={`Troca com ${member.name}`} onSubmit={submit} onKeyDown={escCloses(onClose)}>
      <label className="lb-label" htmlFor={ids.de}>
        Quem oferece (opcional)
      </label>
      <input id={ids.de} ref={firstRef} name="de" type="text" className="lb-input" placeholder="Mestre" maxLength={TRADE_FROM_MAX_LENGTH} value={de} onChange={edit(setDe)} />
      <label className="lb-label" htmlFor={ids.itens}>
        Dá itens (separe por vírgula)
      </label>
      <input id={ids.itens} name="dou-itens" type="text" className="lb-input" value={itens} onChange={edit(setItens)} />
      <label className="lb-label" htmlFor={ids.douMoedas}>
        Dá moedas
      </label>
      <input id={ids.douMoedas} name="dou-moedas" type="number" inputMode="numeric" min={0} max={MOEDAS_MAX} step={1} className="lb-input" value={douMoedas} onChange={edit(setDouMoedas)} />
      {mochila.length > 0 && (
        <fieldset className="lb-party__troca-pede">
          <legend className="lb-label">Pede da mochila de {member.name}</legend>
          {mochila.map((item) => (
            <label key={item.id} className="lb-player__note">
              <input type="checkbox" value={item.id} checked={pedidos.includes(item.id)} onChange={() => togglePedido(item.id)} /> {item.nome}
            </label>
          ))}
        </fieldset>
      )}
      <label className="lb-label" htmlFor={ids.pecoMoedas}>
        Pede moedas (tem {member.moedas ?? 0})
      </label>
      <input id={ids.pecoMoedas} name="peco-moedas" type="number" inputMode="numeric" min={0} max={MOEDAS_MAX} step={1} className="lb-input" value={pecoMoedas} onChange={edit(setPecoMoedas)} />
      {torta && (
        <p className="lb-room__error" role="alert">
          Moedas: use um número inteiro de 0 a {MOEDAS_MAX}.
        </p>
      )}
      {refusal !== null && (
        <p className="lb-room__error" role="alert">
          {PARTY_TRADE_REFUSAL_TEXT[refusal]}
        </p>
      )}
      <div className="lb-party__actions">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="lb-btn lb-btn--primary" disabled={vazia || torta}>
          Propor
        </button>
      </div>
    </form>
  )
}
