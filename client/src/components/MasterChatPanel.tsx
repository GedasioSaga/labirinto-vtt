import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { CHAT_TEXT_MAX_LENGTH, chatSpeakerLabel, cleanChatText, mentionsMaster } from '../lib/chat'
import type { MasterChatState } from '../net/hostSession'
import type { ChatEntry } from '../net/protocol'
import { formatNoteTime } from '../player/PlayerNotebook'
import { ChatIcon } from './icons'
import './MasterChatPanel.css'

/**
 * CHAT DOS JOGADORES na tela do mestre (fatia D de docs/plano-chat.md): o
 * botão "Chat" no canto de baixo à esquerda e o painel que ele abre. O mestre
 * lê o Global e cada cena com conversa; escreve só no Global (a cena é só
 * leitura para ele). Cada linha é texto do React — nunca HTML, nunca link
 * automático. O que chegou com o canal fechado conta como não lido; a menção
 * ao mestre (`@mestre`) acende forte, no canal e no botão.
 */
export interface MasterChatPanelProps {
  chat: MasterChatState
  /** Manda no Global; `false` = não saiu (sala fechada, texto vazio ou longo demais). */
  onSend: (text: string) => boolean
}

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
  name: string
  messages: readonly ChatEntry[]
}

const sceneChannelId = (key: string): ChannelId => `cena:${key}`

function channelsOf(chat: MasterChatState): Channel[] {
  return [
    { id: GLOBAL, name: 'Global', messages: chat.global },
    ...chat.scenes.map((scene) => ({ id: sceneChannelId(scene.key), name: scene.name ?? SCENE_GONE, messages: scene.messages })),
  ]
}

/** As linhas que o mestre ainda não viu: as dele nunca contam. */
function unreadOf(channel: Channel, seen: ReadonlySet<string> | undefined): ChatEntry[] {
  return channel.messages.filter((entry) => entry.fromMaster !== true && seen?.has(entry.id) !== true)
}

function unreadLabel(count: number, mention: boolean): string {
  const novas = count === 1 ? '1 nova' : `${count} novas`
  return mention ? `${novas}, menciona você` : novas
}

export function MasterChatPanel({ chat, onSend }: MasterChatPanelProps) {
  const [open, setOpen] = useState(false)
  const [channelId, setChannelId] = useState<ChannelId>(GLOBAL)
  // Por canal: os ids já vistos (com o painel aberto nele).
  const [seen, setSeen] = useState<ReadonlyMap<ChannelId, ReadonlySet<string>>>(() => new Map())
  const [draft, setDraft] = useState('')
  const [alert, setAlert] = useState<LocalAlert | null>(null)
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const stickRef = useRef(true)
  const baseId = useId()
  const panelId = `${baseId}-panel`
  const inputId = `${baseId}-input`
  const alertId = `${baseId}-alert`
  const countId = `${baseId}-count`

  const channels = channelsOf(chat)
  // O canal escolhido sumiu (a sala reabriu): volta ao Global.
  const current = channels.find((channel) => channel.id === channelId) ?? channels[0]
  const writable = current.id === GLOBAL
  const lastId = current.messages.at(-1)?.id ?? ''
  const unreadByChannel = new Map(channels.map((channel) => [channel.id, unreadOf(channel, seen.get(channel.id))]))
  const unreadTotal = [...unreadByChannel.values()].reduce((sum, list) => sum + list.length, 0)
  const mentionWaiting = [...unreadByChannel.values()].some((list) => list.some((entry) => mentionsMaster(entry.mentions)))
  const left = CHAT_TEXT_MAX_LENGTH - draft.length
  const counter = left >= COUNTER_FROM ? null : left >= 0 ? `Faltam ${left} caracteres` : `Passou ${-left} caracteres do limite`
  const currentUnread = unreadByChannel.get(current.id)?.length ?? 0

  // Painel aberto num canal: o que está nele foi visto.
  useEffect(() => {
    if (!open || currentUnread === 0) return
    setSeen((before) => {
      const next = new Map(before)
      next.set(current.id, new Set(current.messages.map((entry) => entry.id)))
      return next
    })
  }, [open, current, currentUnread])

  // Mensagem nova, canal trocado ou painel aberto: desce até o fim, a menos que o mestre tenha subido para ler.
  useLayoutEffect(() => {
    const box = logRef.current
    if (box !== null && stickRef.current) box.scrollTop = box.scrollHeight
  }, [lastId, current.id, open])

  function trackScroll(): void {
    const box = logRef.current
    if (box === null) return
    stickRef.current = box.scrollHeight - box.scrollTop - box.clientHeight <= STICK_DISTANCE_PX
  }

  function chooseChannel(id: ChannelId): void {
    setChannelId(id)
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

  function closeOnEscape(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== 'Escape') return
    // Com o painel aberto, o Esc é dele: sem isto chegaria ao "cancelar" do editor.
    event.stopPropagation()
    setOpen(false)
    toggleRef.current?.focus()
  }

  const toggleLabel = unreadTotal === 0 ? 'Chat' : `Chat (${unreadLabel(unreadTotal, mentionWaiting)})`

  return (
    // Fechado, o Esc passa direto: largar a seleção continua sendo do editor.
    <div className="lb-mchat" onKeyDown={open ? closeOnEscape : undefined}>
      <section id={panelId} className="lb-panel lb-mchat__panel" aria-label="Chat dos jogadores" hidden={!open}>
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
                <MasterChatLine key={entry.id} entry={entry} />
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
      <button
        ref={toggleRef}
        type="button"
        className="lb-panel lb-mchat__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={toggleLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <ChatIcon size={16} />
        Chat
        {unreadTotal > 0 && (
          <span className={mentionWaiting ? 'lb-mchat__badge lb-mchat__badge--mention' : 'lb-mchat__badge'} aria-hidden="true">
            {mentionWaiting ? `@${unreadTotal}` : unreadTotal}
          </span>
        )}
      </button>
    </div>
  )
}

/**
 * Uma fala: quem (o mestre pela marca do host; o jogador chamado "Mestre" com
 * " (jogador)"), a hora e o texto, este só como texto do React. A que
 * menciona o mestre se destaca.
 */
function MasterChatLine({ entry }: { entry: ChatEntry }) {
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
      </p>
      <p className="lb-mchat__text">{entry.text}</p>
    </li>
  )
}
