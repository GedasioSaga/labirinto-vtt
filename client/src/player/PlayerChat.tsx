import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent, SyntheticEvent } from 'react'
import { CHAT_CHANNELS, CHAT_MASTER_MENTION, CHAT_TEXT_MAX_LENGTH, chatSpeakerLabel, cleanChatText, findMentions, type ChatChannel } from '../lib/chat'
import type { ChatEntry, PartyMember } from '../net/protocol'
import { formatNoteTime } from './PlayerNotebook'
import type { ChatLog, ChatSend, ChatUnread } from './playerConnection'
import './PlayerChat.css'

/**
 * CHAT DOS JOGADORES, a tela (fatia A de docs/plano-chat.md): o canal da cena
 * ou o Global, cada linha só como texto do React (sem HTML, sem link
 * automático), e o campo em que "@" sugere quem está no canal e o mestre.
 * O texto só sai do campo quando o mestre confirma; recusado, fica.
 */
export interface PlayerChatProps {
  /** O que o mestre mandou de cada canal, do mais velho ao mais novo. */
  log: ChatLog
  /** Menções a mim ainda não vistas, por canal. Ausente = nenhuma. */
  unread?: ChatUnread
  /** O último envio e a resposta do mestre. Ausente = nada mandado ainda. */
  status?: ChatSend
  /** Meu nome na mesa, como o mestre o escreve (com o "(2)", se houver). Ausente = nada me destaca. */
  selfName?: string
  /** Os companheiros: quem está "aqui" é sugerido na cena; todos, no Global. */
  party?: readonly PartyMember[]
  /** A aba está à vista: só então as marcas do canal aberto contam como lidas. */
  visible: boolean
  /** Manda a mensagem; `false` = não saiu (sem conexão com o mestre). */
  onSend: (channel: ChatChannel, text: string, mentions: readonly string[]) => boolean
  /** O canal foi visto com as marcas dele à vista. */
  onRead: (channel: ChatChannel) => void
}

/** Respostas do mestre que devolvem a mensagem ao campo. */
type Refusal = 'too_soon' | 'no_scene' | 'not_seated' | 'failed'

/** Avisos da própria tela, antes de a mensagem sair. */
type LocalAlert = 'empty' | 'long' | 'offline'

const REFUSAL_TEXT: Record<Refusal, string> = {
  too_soon: 'Espere um instante e mande de novo.',
  no_scene: 'Você não está em nenhuma cena agora. Fale no Global.',
  not_seated: 'Você está sem ficha agora: o chat volta quando o mestre te der uma.',
  failed: 'O mestre não aceitou a mensagem. Tente de novo.',
}

const LOCAL_ALERT_TEXT: Record<LocalAlert, string> = {
  empty: 'Escreva a mensagem antes de mandar.',
  long: `Passou de ${CHAT_TEXT_MAX_LENGTH} letras. Corte um pouco e mande de novo.`,
  offline: 'Sem conexão com o mestre. Tente de novo.',
}

const CHANNEL_NAME: Record<ChatChannel, string> = { cena: 'Cena', global: 'Global' }
const LOG_LABEL: Record<ChatChannel, string> = { cena: 'Mensagens da cena', global: 'Mensagens do Global' }
const EMPTY_TEXT: Record<ChatChannel, string> = { cena: 'Ninguém falou na cena ainda.', global: 'Ninguém falou no Global ainda.' }
const FIELD_LABEL: Record<ChatChannel, string> = { cena: 'Mensagem para a cena', global: 'Mensagem para o Global' }

/** O contador aparece quando faltam menos letras que isto (três quartos do limite já usados). */
const COUNTER_FROM = 250

/** Até esta distância do fim, em px, o log acompanha a mensagem nova; mais acima, quem lê não é empurrado. */
const STICK_DISTANCE_PX = 48

/** "@" e o pedaço de nome digitado até o cursor. O "@" começa menção onde `findMentions` também aceita. */
const MENTION_QUERY = /(?<![\p{L}\p{N}\p{M}])@([^\s@]*)$/u

/** Acentos soltos depois do NFD: "@jo" acha "João". */
const COMBINING_MARKS = /\p{M}/gu

function isRefusal(phase: ChatSend['phase'] | undefined): phase is Refusal {
  return phase === 'too_soon' || phase === 'no_scene' || phase === 'not_seated' || phase === 'failed'
}

/** A menção sendo digitada: onde está o "@" e o que veio depois dele. */
function mentionQuery(draft: string, caret: number): { start: number; text: string } | null {
  const match = MENTION_QUERY.exec(draft.slice(0, caret))
  if (match === null) return null
  return { start: match.index, text: match[1] }
}

function loose(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()
}

/**
 * Quem pode ser mencionado no canal, começando pelo que foi digitado: na cena,
 * só quem está nela; no Global, o grupo inteiro; e sempre o mestre, por
 * último. Um jogador chamado "Mestre" fica de fora: o "@mestre" é do mestre.
 */
function mentionOptions(channel: ChatChannel, party: readonly PartyMember[] | undefined, typed: string): string[] {
  const names = (party ?? [])
    .filter((member) => channel === 'global' || member.where === 'aqui')
    .map((member) => member.name)
    .filter((name) => name.toLowerCase() !== CHAT_MASTER_MENTION)
  const wanted = loose(typed)
  return [...new Set(names), CHAT_MASTER_MENTION].filter((name) => loose(name).startsWith(wanted))
}

/** Rola a lista de sugestões só o bastante para a opção ativa aparecer inteira. */
function keepInView(list: HTMLElement, item: HTMLElement): void {
  const top = item.offsetTop
  const bottom = top + item.offsetHeight
  if (top < list.scrollTop) list.scrollTop = top
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
}

function counterText(left: number): string | null {
  if (left >= COUNTER_FROM) return null
  if (left >= 0) return `Faltam ${left} ${left === 1 ? 'letra' : 'letras'}`
  return `Passou ${-left} ${left === -1 ? 'letra' : 'letras'} do limite`
}

export function PlayerChat({ log, unread, status, selfName, party, visible, onSend, onRead }: PlayerChatProps) {
  const [channel, setChannel] = useState<ChatChannel>('cena')
  const [draft, setDraft] = useState('')
  const [caret, setCaret] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [localAlert, setLocalAlert] = useState<LocalAlert | null>(null)
  // Recusa que o jogador já viu e respondeu editando o texto: o aviso sai.
  const [dismissedReqId, setDismissedReqId] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const stickRef = useRef(true)
  const pendingCaretRef = useRef<number | null>(null)
  // O texto que saiu no último envio: some do campo quando o mestre confirmar, se ninguém o mudou.
  const sentDraftRef = useRef<string | null>(null)
  const baseId = useId()
  const inputId = `${baseId}-input`
  const listId = `${baseId}-suggest`
  const hintId = `${baseId}-hint`
  const countId = `${baseId}-count`
  const alertId = `${baseId}-alert`

  const messages = log[channel]
  const lastId = messages.at(-1)?.id ?? ''
  const sending = status?.phase === 'sending'
  const okReqId = status?.phase === 'ok' ? status.reqId : null
  const unreadHere = unread === undefined ? 0 : unread[channel].length
  const query = suggestOpen ? mentionQuery(draft, caret) : null
  const options = query === null ? [] : mentionOptions(channel, party, query.text)
  const active = options.length === 0 ? -1 : Math.min(activeIndex, options.length - 1)
  const refusal =
    status !== undefined && isRefusal(status.phase) && status.channel === channel && status.reqId !== dismissedReqId
      ? REFUSAL_TEXT[status.phase]
      : null
  const shownAlert = localAlert === null ? refusal : LOCAL_ALERT_TEXT[localAlert]
  const counter = counterText(CHAT_TEXT_MAX_LENGTH - draft.length)
  const describedBy = [hintId, counter === null ? '' : countId, shownAlert === null ? '' : alertId].filter((id) => id !== '').join(' ')

  useEffect(() => {
    if (!visible || unreadHere === 0) return
    onRead(channel)
  }, [visible, channel, unreadHere, onRead])

  // Só a confirmação limpa o campo; o que foi escrito enquanto a mensagem ia fica.
  useEffect(() => {
    if (okReqId === null) return
    const sent = sentDraftRef.current
    sentDraftRef.current = null
    if (sent === null) return
    setDraft((current) => (current === sent ? '' : current))
  }, [okReqId])

  // O React põe o cursor no fim ao trocar o valor: depois da menção inserida, ele volta para logo depois dela.
  useLayoutEffect(() => {
    const at = pendingCaretRef.current
    const input = inputRef.current
    if (at === null || input === null) return
    pendingCaretRef.current = null
    input.setSelectionRange(at, at)
  }, [draft])

  // Mensagem nova, canal trocado ou aba aberta: desce até o fim, a menos que o jogador tenha subido para ler.
  useLayoutEffect(() => {
    const box = logRef.current
    if (box !== null && stickRef.current) box.scrollTop = box.scrollHeight
  }, [lastId, channel, visible])

  useLayoutEffect(() => {
    const list = listRef.current
    if (list === null || active < 0) return
    const item = list.children.item(active)
    if (item instanceof HTMLElement) keepInView(list, item)
  }, [active, options.length])

  function trackScroll(): void {
    const box = logRef.current
    if (box === null) return
    stickRef.current = box.scrollHeight - box.scrollTop - box.clientHeight <= STICK_DISTANCE_PX
  }

  function chooseChannel(next: ChatChannel): void {
    setChannel(next)
    setActiveIndex(0)
    stickRef.current = true
  }

  function changeDraft(event: ChangeEvent<HTMLTextAreaElement>): void {
    setDraft(event.target.value)
    setCaret(event.target.selectionStart)
    setActiveIndex(0)
    setSuggestOpen(true)
    setLocalAlert(null)
    if (status !== undefined && isRefusal(status.phase)) setDismissedReqId(status.reqId)
  }

  // Cursor andou sem o texto mudar (clique, seta para o lado): a sugestão segue o novo ponto.
  function followCaret(event: SyntheticEvent<HTMLTextAreaElement>): void {
    const at = event.currentTarget.selectionStart
    if (at === caret) return
    setCaret(at)
    setActiveIndex(0)
  }

  function insertMention(name: string): void {
    if (query === null) return
    const before = draft.slice(0, query.start)
    const inserted = `@${name} `
    const at = before.length + inserted.length
    pendingCaretRef.current = at
    setDraft(before + inserted + draft.slice(caret))
    setCaret(at)
    setActiveIndex(0)
  }

  function send(): void {
    if (sending) return
    const text = cleanChatText(draft)
    if (text === '' || text.length > CHAT_TEXT_MAX_LENGTH) {
      setLocalAlert(text === '' ? 'empty' : 'long')
      inputRef.current?.focus()
      return
    }
    // O grupo inteiro e o mestre: quem não está no canal, o mestre descarta.
    const candidates = [...(party ?? []).map((member) => member.name), CHAT_MASTER_MENTION]
    if (!onSend(channel, text, findMentions(text, candidates))) {
      setLocalAlert('offline')
      return
    }
    setLocalAlert(null)
    setSuggestOpen(false)
    sentDraftRef.current = draft
  }

  function onFieldKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    // Enter que confirma a palavra do teclado de acentos/IME não é Enter de mandar.
    if (event.nativeEvent.isComposing) return
    if (query !== null) {
      if (event.key === 'Escape') {
        // Fecha só as sugestões: o Esc não chega à janela, onde fecharia a gaveta inteira.
        event.preventDefault()
        event.stopPropagation()
        setSuggestOpen(false)
        return
      }
      if (options.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActiveIndex((active + step + options.length) % options.length)
        return
      }
      if (options.length > 0 && event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        insertMention(options[active])
        return
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    send()
  }

  return (
    <div className="pc-chat">
      <div className="pc-channels" role="group" aria-label="Canal">
        {CHAT_CHANNELS.map((item) => (
          <button key={item} type="button" className="pc-channel" aria-pressed={item === channel} onClick={() => chooseChannel(item)}>
            {CHANNEL_NAME[item]}
            {unread !== undefined && unread[item].length > 0 && (
              <span className="pc-unread">
                <span className="pp-visually-hidden"> (menção nova)</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Um log por canal: trocar de canal começa do fim do outro, não da rolagem deste. */}
      <div key={channel} ref={logRef} className="pc-log" role="log" aria-label={LOG_LABEL[channel]} tabIndex={0} onScroll={trackScroll}>
        {messages.length === 0 ? (
          <p className="pp-empty pc-log__empty">{EMPTY_TEXT[channel]}</p>
        ) : (
          <ul className="pc-list">
            {messages.map((entry) => (
              <ChatLine key={entry.id} entry={entry} mine={selfName !== undefined && entry.mentions.includes(selfName)} />
            ))}
          </ul>
        )}
      </div>

      <form className="pc-form" aria-label="Mandar mensagem" noValidate onSubmit={submit}>
        <label className="pp-label" htmlFor={inputId}>
          {FIELD_LABEL[channel]}
        </label>
        <div className="pc-field">
          {options.length > 0 && (
            <ul ref={listRef} id={listId} className="pc-suggest" role="listbox" aria-label="Mencionar">
              {options.map((name, index) => (
                <li
                  key={name}
                  id={`${listId}-opt-${index}`}
                  className="pc-suggest__option"
                  role="option"
                  aria-selected={index === active}
                  // Sem isto o toque tira o foco do campo antes do clique e as sugestões somem.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertMention(name)}
                >
                  @{name}
                </li>
              ))}
            </ul>
          )}
          {query !== null && options.length === 0 && (
            <p className="pc-suggest pc-suggest__none" role="status">
              Nenhum jogador com esse nome
            </p>
          )}
          <div className="pc-row">
            <textarea
              ref={inputRef}
              id={inputId}
              className="pp-input pc-input"
              rows={2}
              value={draft}
              maxLength={CHAT_TEXT_MAX_LENGTH}
              enterKeyHint="send"
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls={options.length > 0 ? listId : undefined}
              aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
              aria-invalid={localAlert === 'empty' || localAlert === 'long' ? true : undefined}
              aria-describedby={describedBy}
              onChange={changeDraft}
              onSelect={followCaret}
              onKeyDown={onFieldKeyDown}
              onBlur={() => setSuggestOpen(false)}
            />
            <button type="submit" className="pp-button pc-send" disabled={sending}>
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
        <p id={hintId} className="pp-visually-hidden">
          Enter manda; Shift e Enter quebram a linha.
        </p>
        {counter !== null && (
          <p id={countId} className="pp-empty pc-count">
            {counter}
          </p>
        )}
        {shownAlert !== null && (
          <p id={alertId} className="pp-error pc-alert" role="alert">
            {shownAlert}
          </p>
        )}
      </form>
    </div>
  )
}

/**
 * Uma fala: quem (o jogador chamado "Mestre" com " (jogador)"), a hora e o
 * texto, este só como texto do React. A que me menciona se destaca.
 */
function ChatLine({ entry, mine }: { entry: ChatEntry; mine: boolean }) {
  return (
    <li className={mine ? 'pc-msg pc-msg--me' : 'pc-msg'}>
      <p className="pc-msg__meta">
        <span className="pc-msg__from">{chatSpeakerLabel(entry.from)}</span>
        <time className="pc-msg__time">{formatNoteTime(entry.at)}</time>
        {mine && (
          <span className="pc-msg__tag">
            <span className="pp-visually-hidden">(</span>menciona você<span className="pp-visually-hidden">)</span>
          </span>
        )}
      </p>
      <p className="pc-msg__text">{entry.text}</p>
    </li>
  )
}
