import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { CHAT_TEXT_MAX_LENGTH, chatSpeakerLabel, cleanChatText, mentionsMaster } from '../lib/chat'
import type { MasterChatState } from '../net/hostSession'
import type { ChatEntry } from '../net/protocol'
import { formatNoteTime } from '../player/PlayerNotebook'
import './MasterChatPanel.css'

/**
 * CHAT DOS JOGADORES na tela do mestre (fatia D de docs/plano-chat.md): o
 * painel da aba Chat da coluna da direita (`RightColumn`). O mestre lê o
 * Global e cada cena com conversa; escreve só no Global (a cena é só leitura
 * para ele). Cada linha é texto do React — nunca HTML, nunca link automático.
 * O que chegou com o canal fora da vista conta como não lido; a menção ao
 * mestre (`@mestre`) acende forte, no canal, na aba e no botão que reabre a
 * coluna. O mestre apaga qualquer linha (com confirmação): ela some para todos.
 */
export interface MasterChatPanelProps {
  chat: MasterChatState
  /** O painel está à vista (aba Chat escolhida, coluna aberta): só assim o canal aberto conta como lido. */
  active: boolean
  /** O total não lido e se há `@mestre` esperando, a cada mudança — a aba e o botão de reabrir mostram. */
  onUnreadChange?: (unread: ChatUnread) => void
  /** Manda no Global; `false` = não saiu (sala fechada, texto vazio ou longo demais). */
  onSend: (text: string) => boolean
  /** Apaga a linha `id` para todos: do Global (`sceneKey` `null`) ou da cena. */
  onDelete: (sceneKey: string | null, id: string) => void
}

/** O que o mestre ainda não leu, somando os canais. */
export interface ChatUnread {
  count: number
  /** Alguma das não lidas chama `@mestre`. */
  mention: boolean
}

export const NO_CHAT_UNREAD: ChatUnread = { count: 0, mention: false }

/** `global`, ou `cena:<chave>`: o prefixo impede uma chave de cena de se passar pelo Global. */
type ChannelId = string

const GLOBAL: ChannelId = 'global'

/** Nome da cena que saiu da aventura (a conversa dela continua guardada na sala). */
const SCENE_GONE = 'Cena fora da aventura'

type LocalAlert = 'empty' | 'long' | 'failed'

const ALERT_TEXT: Record<LocalAlert, string> = {
  empty: 'Escreva a mensagem antes de mandar.',
  long: `Passou de ${CHAT_TEXT_MAX_LENGTH} caracteres. Corte um pouco e mande de novo.`,
  failed: 'A mensagem não saiu: a sala está fechada.',
}

/** Até esta distância do fim, em px, o log acompanha a mensagem nova; mais acima, quem lê não é empurrado. */
const STICK_DISTANCE_PX = 48

/** O contador aparece quando faltam menos caracteres que isto. */
const COUNTER_FROM = 250

interface Channel {
  id: ChannelId
  /** `null` = o Global. */
  sceneKey: string | null
  name: string
  messages: readonly ChatEntry[]
}

const sceneChannelId = (key: string): ChannelId => `cena:${key}`

function channelsOf(chat: MasterChatState): Channel[] {
  return [
    { id: GLOBAL, sceneKey: null, name: 'Global', messages: chat.global },
    ...chat.scenes.map((scene) => ({ id: sceneChannelId(scene.key), sceneKey: scene.key, name: scene.name ?? SCENE_GONE, messages: scene.messages })),
  ]
}

/** As linhas que o mestre ainda não viu: as dele e as que voltaram do disco (`restoredIds`) nunca contam. */
function unreadOf(channel: Channel, seen: ReadonlySet<string> | undefined, restored: ReadonlySet<string> | undefined): ChatEntry[] {
  return channel.messages.filter((entry) => entry.fromMaster !== true && seen?.has(entry.id) !== true && restored?.has(entry.id) !== true)
}

function unreadLabel(count: number, mention: boolean): string {
  const novas = count === 1 ? '1 nova' : `${count} novas`
  return mention ? `${novas}, menciona você` : novas
}

/** Nome de quem leva o contador ("Chat", "Chat (3 novas, menciona você)"): a aba e o botão de reabrir a coluna. */
export function chatUnreadLabel(base: string, unread: ChatUnread): string {
  return unread.count === 0 ? base : `${base} (${unreadLabel(unread.count, unread.mention)})`
}

export function MasterChatPanel({ chat, active, onUnreadChange, onSend, onDelete }: MasterChatPanelProps) {
  const [channelId, setChannelId] = useState<ChannelId>(GLOBAL)
  // Por canal: os ids já vistos (com o painel aberto nele).
  const [seen, setSeen] = useState<ReadonlyMap<ChannelId, ReadonlySet<string>>>(() => new Map())
  const [draft, setDraft] = useState('')
  const [alert, setAlert] = useState<LocalAlert | null>(null)
  // A linha que espera o "Apagar" de confirmação (apagar some para todos: dois cliques, nunca um).
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const stickRef = useRef(true)
  const baseId = useId()
  const inputId = `${baseId}-input`
  const alertId = `${baseId}-alert`
  const countId = `${baseId}-count`

  const channels = channelsOf(chat)
  // O canal escolhido sumiu (a sala reabriu): volta ao Global.
  const current = channels.find((channel) => channel.id === channelId) ?? channels[0]
  const writable = current.id === GLOBAL
  const lastId = current.messages.at(-1)?.id ?? ''
  const unreadByChannel = new Map(channels.map((channel) => [channel.id, unreadOf(channel, seen.get(channel.id), chat.restoredIds)]))
  const unreadTotal = [...unreadByChannel.values()].reduce((sum, list) => sum + list.length, 0)
  const mentionWaiting = [...unreadByChannel.values()].some((list) => list.some((entry) => mentionsMaster(entry.mentions)))
  const left = CHAT_TEXT_MAX_LENGTH - draft.length
  const counter = left >= COUNTER_FROM ? null : left >= 0 ? `Faltam ${left} caracteres` : `Passou ${-left} caracteres do limite`
  const currentUnread = unreadByChannel.get(current.id)?.length ?? 0

  // Painel à vista num canal: o que está nele foi visto.
  useEffect(() => {
    if (!active || currentUnread === 0) return
    setSeen((before) => {
      const next = new Map(before)
      next.set(current.id, new Set(current.messages.map((entry) => entry.id)))
      return next
    })
  }, [active, current, currentUnread])

  // A aba e o botão de reabrir a coluna leem o contador daqui. Ref, não
  // dependência: o pai passa uma função nova a cada render.
  const onUnreadChangeRef = useRef(onUnreadChange)
  onUnreadChangeRef.current = onUnreadChange
  useEffect(() => {
    onUnreadChangeRef.current?.({ count: unreadTotal, mention: mentionWaiting })
  }, [unreadTotal, mentionWaiting])
  // Painel desmontado (a sala fechou): nada mais esperando leitura.
  useEffect(() => () => onUnreadChangeRef.current?.(NO_CHAT_UNREAD), [])

  // Mensagem nova, canal trocado ou painel à vista: desce até o fim, a menos que o mestre tenha subido para ler.
  useLayoutEffect(() => {
    const box = logRef.current
    if (box !== null && stickRef.current) box.scrollTop = box.scrollHeight
  }, [lastId, current.id, active])

  function trackScroll(): void {
    const box = logRef.current
    if (box === null) return
    stickRef.current = box.scrollHeight - box.scrollTop - box.clientHeight <= STICK_DISTANCE_PX
  }

  function chooseChannel(id: ChannelId): void {
    setChannelId(id)
    setConfirmId(null)
    stickRef.current = true
  }

  function send(): void {
    const text = cleanChatText(draft)
    if (text === '' || text.length > CHAT_TEXT_MAX_LENGTH) {
      setAlert(text === '' ? 'empty' : 'long')
      inputRef.current?.focus()
      return
    }
    if (!onSend(text)) {
      setAlert('failed')
      return
    }
    setAlert(null)
    setDraft('')
    stickRef.current = true
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    send()
  }

  function onFieldKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    // Enter que confirma a palavra do teclado de acentos/IME não é Enter de mandar.
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  return (
    // A moldura é dele, como a do RoomPanel na aba Jogo. O Esc passa direto:
    // largar a seleção continua sendo do editor.
    <section className="lb-panel lb-mchat" aria-label="Chat dos jogadores">
      <div className="lb-mchat__channels" role="group" aria-label="Canal">
        {channels.map((channel) => {
          const unread = unreadByChannel.get(channel.id) ?? []
          const mention = unread.some((entry) => mentionsMaster(entry.mentions))
          return (
            <button
              key={channel.id}
              type="button"
              className="lb-mchat__channel"
              aria-pressed={channel.id === current.id}
              onClick={() => chooseChannel(channel.id)}
            >
              <span className="lb-mchat__channel-name">{channel.name}</span>
              {unread.length > 0 && (
                <span className={mention ? 'lb-mchat__badge lb-mchat__badge--mention' : 'lb-mchat__badge'}>
                  {mention ? `@${unread.length}` : unread.length}
                  <span className="lb-sr-only"> ({unreadLabel(unread.length, mention)})</span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Um log por canal: trocar de canal começa do fim do outro, não da rolagem deste. */}
      <div key={current.id} ref={logRef} className="lb-mchat__log lb-scroll" role="log" aria-label={`Mensagens: ${current.name}`} tabIndex={0} onScroll={trackScroll}>
        {current.messages.length === 0 ? (
          <p className="lb-mchat__empty">{writable ? 'Ninguém falou no Global ainda.' : 'Ninguém falou nesta cena ainda.'}</p>
        ) : (
          <ul className="lb-mchat__list">
            {current.messages.map((entry) => (
              <MasterChatLine
                key={entry.id}
                entry={entry}
                confirming={confirmId === entry.id}
                onAsk={() => setConfirmId(entry.id)}
                onCancel={() => setConfirmId(null)}
                onConfirm={() => {
                  setConfirmId(null)
                  onDelete(current.sceneKey, entry.id)
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {writable ? (
        <form className="lb-mchat__form" aria-label="Mandar mensagem no Global" noValidate onSubmit={submit}>
          <label className="lb-sr-only" htmlFor={inputId}>
            Mensagem para o Global
          </label>
          <div className="lb-mchat__row">
            <textarea
              ref={inputRef}
              id={inputId}
              className="lb-input lb-mchat__input"
              rows={2}
              value={draft}
              maxLength={CHAT_TEXT_MAX_LENGTH}
              placeholder="Mensagem para todos"
              autoComplete="off"
              aria-invalid={alert === 'empty' || alert === 'long' ? true : undefined}
              aria-describedby={[counter === null ? '' : countId, alert === null ? '' : alertId].filter((id) => id !== '').join(' ') || undefined}
              onChange={(event) => {
                setDraft(event.target.value)
                setAlert(null)
              }}
              onKeyDown={onFieldKeyDown}
            />
            <button type="submit" className="lb-btn lb-btn--primary lb-mchat__send">
              Enviar
            </button>
          </div>
          {counter !== null && (
            <p id={countId} className="lb-mchat__note">
              {counter}
            </p>
          )}
          {alert !== null && (
            <p id={alertId} className="lb-mchat__alert" role="alert">
              {ALERT_TEXT[alert]}
            </p>
          )}
        </form>
      ) : (
        <p className="lb-mchat__readonly">Só leitura: aqui só os jogadores da cena falam. Você fala no Global.</p>
      )}
    </section>
  )
}

/** O número de não lidas, no molde do canal: latão cheio com `@` quando chamam o mestre. Decorativo: o nome de quem o leva já diz. */
export function ChatUnreadBadge({ unread }: { unread: ChatUnread }) {
  if (unread.count === 0) return null
  return (
    <span className={unread.mention ? 'lb-mchat__badge lb-mchat__badge--mention' : 'lb-mchat__badge'} aria-hidden="true">
      {unread.mention ? `@${unread.count}` : unread.count}
    </span>
  )
}

/**
 * Uma fala: quem (o mestre pela marca do host; o jogador chamado "Mestre" com
 * " (jogador)"), a hora e o texto, este só como texto do React. A que
 * menciona o mestre se destaca. "Apagar" pede confirmação na própria linha.
 */
function MasterChatLine({ entry, confirming, onAsk, onCancel, onConfirm }: { entry: ChatEntry; confirming: boolean; onAsk: () => void; onCancel: () => void; onConfirm: () => void }) {
  const master = entry.fromMaster === true
  const mention = mentionsMaster(entry.mentions)
  const className = ['lb-mchat__msg', master ? 'lb-mchat__msg--master' : '', mention ? 'lb-mchat__msg--mention' : ''].filter((name) => name !== '').join(' ')
  return (
    <li className={className}>
      <p className="lb-mchat__meta">
        <span className="lb-mchat__from">{chatSpeakerLabel(entry.from, master)}</span>
        <time className="lb-mchat__time">{formatNoteTime(entry.at)}</time>
        {mention && (
          <span className="lb-mchat__tag">
            <span className="lb-sr-only">(</span>menciona você<span className="lb-sr-only">)</span>
          </span>
        )}
        {!confirming && (
          <button type="button" className="lb-mchat__delete" aria-label={`Apagar a mensagem de ${chatSpeakerLabel(entry.from, master)} das ${formatNoteTime(entry.at)}`} onClick={onAsk}>
            Apagar
          </button>
        )}
      </p>
      <p className="lb-mchat__text">{entry.text}</p>
      {confirming && (
        <div className="lb-mchat__confirm" role="group" aria-label="Apagar para todos?">
          <span>Apagar para todos?</span>
          <button type="button" className="lb-btn lb-mchat__confirm-yes" onClick={onConfirm}>
            Apagar
          </button>
          <button type="button" className="lb-btn lb-btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      )}
    </li>
  )
}
