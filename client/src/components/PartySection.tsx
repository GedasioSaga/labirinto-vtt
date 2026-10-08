import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ITEM_NAME_MAX_LENGTH } from '../lib/items'
import { awayTokenLabel, awayTokenName, type PartyDestination, type PartyItemAction, type PartyMember } from '../lib/party'
import { SceneSendForm } from './SceneSendForm'
import type { PlayerNoteDelivery, TradeProposeRefusal, TradeProposeResult } from '../net/hostSession'
import { MOEDAS_MAX, moedasLabel, TRADE_FROM_MAX_LENGTH, TRADE_ITEMS_MAX, type TradeProposal } from '../lib/troca'
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
   * "Ver tela": abre a Visão de jogador (a janela de teste, no Olhar) na ficha
   * da linha, com a memória do jogador. Com a janela já aberta, ela troca para
   * esta ficha. Sem ele, não há botão.
   */
  onViewScreen?(member: PartyMember): void
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
  /**
   * CONGELAR FICHA — "Congelar todos" e "Descongelar todos" no alto do Grupo.
   * `todas`: toda ficha de jogador já está congelada (some o "Congelar todos");
   * `alguma`: há ficha congelada em cena (aparece o "Descongelar todos").
   * `onChange(true)` congela, `false` solta (`lib/congelar.ts`,
   * `congelamentoDaMesa`). Ausente = sem os botões.
   */
  congelar?: { todas: boolean; alguma: boolean; onChange(congelar: boolean): void }
}

/** Os botões do alto do Grupo e a marca da linha de quem o mestre congelou. */
export const CONGELAR_TODOS_LABEL = 'Congelar todos'
export const DESCONGELAR_TODOS_LABEL = 'Descongelar todos'
export const CONGELADO_TAG = 'congelado'

export const PARTY_ITEM_FAILED = 'Não deu: a ficha ou o item mudou. Tente de novo.'

/** O que a linha diz quando a oferta não saiu. */
export const PARTY_TRADE_REFUSAL_TEXT: Record<TradeProposeRefusal, string> = {
  pending: 'Já há uma oferta esperando este jogador.',
  short: 'A ficha não tem o que você pede.',
  offline: 'O jogador está fora do ar agora.',
  too_many: `Até ${TRADE_ITEMS_MAX} itens de cada lado da troca.`,
  hidden: 'A ficha está escondida do jogador: mostre-a antes de propor a troca.',
  unavailable: 'Não deu: a ficha mudou. Tente de novo.',
}
/** O que a linha diz quando o jogador pôs a marca "vamos para cá". */
export const DESTINATION_MARKED_LABEL = 'destino marcado'
export const VIEW_DESTINATION_LABEL = 'Ver'
/** O aviso na linha quando o "Trazer" não deu. */
export const BRING_FAILED = 'Não deu para trazer: a ficha ou a cena mudou.'

/** Nome FIXO do botão: o estado vai em `aria-pressed`, e o leitor de tela lê "Seguir, pressionado". */
export const FOLLOW_LABEL = 'Seguir'

/** Texto do botão que abre a Visão de jogador na ficha da linha; o nome acessível leva o nome do jogador (`mirrorLabel`). */
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
 * Os formulários da ficha aberta de um jogador no Grupo: "Mandar para…" e
 * "Recado", os dois dentro dela. O "Dar item…" mora na aba Mochila
 * (`PartyBag`), com a mochila e a bolsa.
 */
export type PartyFormKind = 'send' | 'note'

/**
 * O "Mandar para…" e o "Recado" do Grupo: um formulário por vez (abrir um
 * fecha o outro), e o foco volta ao botão que o abriu ao terminar ou cancelar
 * (quem abriu pode ter saído da lista). `reset` fecha sem mexer no foco: é o
 * que a ficha usa ao fechar ou trocar de jogador, quando o foco tem outro dono.
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

  const reset = () => {
    openerRef.current = null
    setOpen(null)
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
  const notingId = open?.kind === 'note' ? open.playerId : null
  return { sendingId, notingId, toggle, close, reset }
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
  /** "Recado" aberto para este jogador. */
  noteOpen: boolean
  noteFormId: string
  onToggleNote(opener: HTMLElement): void
}

/** As figuras das ações da ficha: traço fino na cor do texto, como o × do chip. */
type AcaoIcone = 'ir' | 'seguir' | 'tela' | 'recado' | 'mandar'

const ACAO_TRACOS: Record<AcaoIcone, string> = {
  ir: 'M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3',
  seguir: 'M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z',
  tela: 'M2.5 3.5h11v7.5h-11zM6 14h4M8 11v3',
  recado: 'M2 4h12v8.5H2zM2.5 4.5L8 9l5.5-4.5',
  mandar: 'M2 8h11M9 4l4 4-4 4',
}

/** O círculo do "Ir lá" (a mira) e a pupila do "Seguir": o resto é traço. */
const ACAO_CIRCULOS: Partial<Record<AcaoIcone, number>> = { ir: 4, seguir: 2 }

function AcaoFigura({ icone }: { icone: AcaoIcone }) {
  const raio = ACAO_CIRCULOS[icone]
  return (
    <svg className="lb-grupo__acao-icone" aria-hidden="true" focusable="false" viewBox="0 0 16 16">
      <path d={ACAO_TRACOS[icone]} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {raio !== undefined && <circle cx="8" cy="8" r={raio} stroke="currentColor" strokeWidth="1.4" fill="none" />}
    </svg>
  )
}

/** O rótulo curto à vista, embaixo da figura; o nome acessível completo vai no `aria-label` quando difere. */
function AcaoRotulo({ icone, children }: { icone: AcaoIcone; children: string }) {
  return (
    <>
      <AcaoFigura icone={icone} />
      <span className="lb-grupo__acao-rotulo">{children}</span>
    </>
  )
}

/** Rótulos curtos à vista na barra da ficha; o nome acessível continua o de sempre. */
const MIRROR_SHORT_LABEL = 'Tela'
const SEND_SHORT_LABEL = 'Mandar'

/**
 * A barra de ações da ficha aberta de um jogador: cinco botões com figura e
 * rótulo curto, na ordem em que o mestre age. "Acompanhar" (um grupo com
 * nome): ir ver ("Ir lá"), a câmera ir junto ("Seguir") e ver a tela dele
 * ("Ver tela"). Depois, agir sobre ele: o "Recado" que só ele lê e trazer ou
 * levar ("Mandar para…"). Os nomes acessíveis são os de sempre — é por eles
 * que o mestre por voz, o leitor de tela e as jornadas acham cada um. Sem
 * ficha no mapa, só o "Recado" (ele chega quando o mapa do jogador aparecer).
 */
export function PartyActions({ member, party, sendOpen, sendFormId, onToggleSend, noteOpen, noteFormId, onToggleNote }: PartyActionsProps) {
  const { onGoTo, onToggleFollow, followingId = null, onViewScreen, onNote } = party
  const hasToken = member.token !== null
  const targets = hasToken ? sendDestinationsFor(member, party.destinations) : []
  const following = member.playerId === followingId
  if (!hasToken && onNote === undefined) return null
  return (
    <div className="lb-grupo__acoes">
      {hasToken && (
        <div className="lb-grupo__acoes-olhar" role="group" aria-label={`Acompanhar ${member.name}`}>
          <button type="button" className="lb-grupo__acao" onClick={() => onGoTo(member)}>
            <AcaoRotulo icone="ir">Ir lá</AcaoRotulo>
          </button>
          {onToggleFollow !== undefined && (
            // Ligado ganha o latão: um botão de modo, não uma ação de uma vez.
            <button type="button" className="lb-grupo__acao" aria-pressed={following} onClick={() => onToggleFollow(member)}>
              <AcaoRotulo icone="seguir">{FOLLOW_LABEL}</AcaoRotulo>
            </button>
          )}
          {/* Fora do ar também: a janela de teste parte da memória dele, não da conexão. */}
          {onViewScreen !== undefined && (
            <button
              type="button"
              className="lb-grupo__acao"
              aria-label={mirrorLabel(member.name)}
              title={`${mirrorLabel(member.name)}: abre a Visão de jogador nesta ficha`}
              onClick={() => onViewScreen(member)}
            >
              <AcaoRotulo icone="tela">{MIRROR_SHORT_LABEL}</AcaoRotulo>
            </button>
          )}
        </div>
      )}
      {onNote !== undefined && (
        // Montado também com o campo aberto: é para ele que o foco volta.
        <button
          type="button"
          className="lb-grupo__acao"
          aria-label={`${NOTE_LABEL} para ${member.name}`}
          aria-expanded={noteOpen}
          aria-controls={noteOpen ? noteFormId : undefined}
          title="Recado: só este jogador lê"
          onClick={(event) => onToggleNote(event.currentTarget)}
        >
          <AcaoRotulo icone="recado">{NOTE_LABEL}</AcaoRotulo>
        </button>
      )}
      {targets.length > 0 && (
        <button
          type="button"
          className="lb-grupo__acao"
          aria-label={SEND_TO_LABEL}
          aria-expanded={sendOpen}
          aria-controls={sendOpen ? sendFormId : undefined}
          title={SEND_TO_LABEL}
          onClick={(event) => onToggleSend(event.currentTarget)}
        >
          <AcaoRotulo icone="mandar">{SEND_SHORT_LABEL}</AcaoRotulo>
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

/** O formulário do "Mandar para…" de um jogador, dentro da ficha aberta dele no Grupo. */
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
 * "Dar item…" do mestre, na aba Mochila da ficha (`PartyBag`):
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
 * ficha está). O nome do item fica numa linha e as duas ações na de baixo,
 * sempre: na coluna da ficha nome e botões não cabem lado a lado, e soltos na
 * mesma linha cada item quebrava num ponto diferente. O nome acessível diz o
 * item e de quem é: com sete jogadores, "Tirar" sozinho não diz qual.
 */
function BackpackList({ member, onItem }: BackpackListProps) {
  const [failed, setFailed] = useState(false)
  const run = (action: PartyItemAction) => setFailed(!onItem(action))
  return (
    <>
      <ul className="lb-party__mochila" aria-label={`Mochila de ${member.name}`}>
        {member.mochila.map((item) => (
          <li key={`${item.tokenId}:${item.id}`} className="lb-party__coisa">
            <span className="lb-party__coisa-nome">{item.nome}</span>{' '}
            <span className="lb-party__coisa-acoes">
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

/** Um pedaço da linha de estado; `vazia` é a bolsa ou a mochila sem nada, que desce de tom. */
interface StatusPart {
  texto: string
  vazia: boolean
}

/**
 * O estado do jogador no alto da aba Mochila, de relance: sem ficha no mapa, a
 * bolsa e a mochila com os nomes (ITEM PEGÁVEL, MOEDAS E TROCA). Uma linha
 * só, que quebra em vez de cortar: o nome do item é o que o mestre procura.
 * Com ficha na cena, bolsa e mochila sempre se dizem, e a vazia vem um tom
 * abaixo (`lb-player__vazio`): sem a linha, o mestre não distingue "não leva
 * nada" de "a linha sumiu". Sem ficha na cena não há bolsa; a mochila só
 * aparece se uma ficha de outra cena levar algo. Mexer nelas fica logo abaixo
 * (`PartyBag`).
 */
export function PartyStatus({ member }: { member: PartyMember }) {
  const comFicha = member.token !== null
  const partes: StatusPart[] = []
  if (!comFicha) partes.push({ texto: 'sem ficha no mapa', vazia: false })
  const moedas = member.moedas ?? 0
  if (moedas > 0) partes.push({ texto: `Bolsa: ${moedasLabel(moedas)}`, vazia: false })
  else if (comFicha) partes.push({ texto: 'Bolsa vazia', vazia: true })
  if (member.mochila.length > 0) partes.push({ texto: `Mochila: ${member.mochila.length} — ${member.mochila.map((item) => item.nome).join(', ')}`, vazia: false })
  else if (comFicha) partes.push({ texto: 'Mochila vazia', vazia: true })
  if (partes.length === 0) return null
  return (
    <p className="lb-player__note lb-player__estado">
      {partes.map((parte, i) => (
        <Fragment key={parte.texto}>
          {i > 0 && ' · '}
          {parte.vazia ? <span className="lb-player__vazio">{parte.texto}</span> : parte.texto}
        </Fragment>
      ))}
    </p>
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

/** Se a aba Mochila tem o que fazer: há item para tirar, ou ficha para dar, acertar a bolsa ou propor troca. */
export function partyBagVisible(member: PartyMember, { onItem, onTrade }: Pick<PartySectionProps, 'onItem' | 'onTrade'>): boolean {
  if (onItem !== undefined && member.mochila.length > 0) return true
  return member.token !== null && (onItem !== undefined || onTrade !== undefined)
}

/** O formulário aberto em "Mochila e bolsa"; um por vez. */
type BagForm = 'dar' | 'moedas' | 'troca'

interface PartyBagProps {
  member: PartyMember
  party: Pick<PartySectionProps, 'onItem' | 'onTrade'>
}

/**
 * A mochila e a bolsa na aba Mochila da ficha (pedido 13): por item, "Tirar" e
 * "Devolver ao chão"; depois "Dar item…", "Moedas…" (acerta o valor) e
 * "Propor troca…" (a oferta ao jogador). São de vez em quando: à vista, cada
 * cartão ganhava uma pilha de botões que o mestre quase nunca usa. Um
 * formulário por vez; Enter, Cancelar ou Esc fecham e devolvem o foco ao
 * botão que o abriu. Sem ficha, só a mochila (ITEM PEGÁVEL, MOEDAS E TROCA).
 */
export function PartyBag({ member, party }: PartyBagProps) {
  const { onItem, onTrade } = party
  const [open, setOpen] = useState<BagForm | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const formId = useId()
  const hasToken = member.token !== null

  const close = () => {
    const opener = openerRef.current
    openerRef.current = null
    setOpen(null)
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus()
    })
  }
  const toggle = (kind: BagForm, opener: HTMLElement) => {
    if (open === kind) {
      close()
      return
    }
    openerRef.current = opener
    setOpen(kind)
  }
  return (
    <>
      {onItem !== undefined && member.mochila.length > 0 && <BackpackList member={member} onItem={onItem} />}
      {hasToken && (onItem !== undefined || onTrade !== undefined) && (
        <div className="lb-player__line lb-player__line--acoes">
          {onItem !== undefined && (
            <button
              type="button"
              className="lb-btn lb-btn--compact"
              aria-label={`Dar item a ${member.name}`}
              aria-expanded={open === 'dar'}
              aria-controls={open === 'dar' ? formId : undefined}
              onClick={(event) => toggle('dar', event.currentTarget)}
            >
              Dar item…
            </button>
          )}
          {onItem !== undefined && (
            <button
              type="button"
              className="lb-btn lb-btn--compact"
              aria-label={`Moedas de ${member.name}`}
              aria-expanded={open === 'moedas'}
              aria-controls={open === 'moedas' ? formId : undefined}
              onClick={(event) => toggle('moedas', event.currentTarget)}
            >
              Moedas…
            </button>
          )}
          {onTrade !== undefined && (
            <button
              type="button"
              className="lb-btn lb-btn--compact"
              aria-label={`Propor troca a ${member.name}`}
              aria-expanded={open === 'troca'}
              aria-controls={open === 'troca' ? formId : undefined}
              onClick={(event) => toggle('troca', event.currentTarget)}
            >
              Propor troca…
            </button>
          )}
        </div>
      )}
      {open !== null && (
        <div id={formId}>
          {open === 'dar' && onItem !== undefined && (
            <GiveForm member={member} onGive={(target, nome) => onItem({ kind: 'dar', member: target, nome })} onClose={close} />
          )}
          {open === 'moedas' && onItem !== undefined && <CoinsForm member={member} onItem={onItem} onClose={close} />}
          {open === 'troca' && onTrade !== undefined && <TradeForm member={member} onTrade={onTrade} onClose={close} />}
        </div>
      )}
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
  // O mesmo teto que o host cobra: avisar aqui evita um "não deu" depois.
  const demais = nomes.length > TRADE_ITEMS_MAX || pedidos.length > TRADE_ITEMS_MAX

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  const togglePedido = (id: string) => {
    setRefusal(null)
    setPedidos((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (vazia || demais || dou === null || peco === null) return
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
      {demais && refusal === null && (
        <p className="lb-room__error" role="alert">
          {PARTY_TRADE_REFUSAL_TEXT.too_many}
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
        <button type="submit" className="lb-btn lb-btn--primary" disabled={vazia || torta || demais}>
          Propor
        </button>
      </div>
    </form>
  )
}
