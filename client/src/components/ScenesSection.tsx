import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CollapsibleSection } from './CollapsibleSection'
import { NOTE_MAX_LENGTH } from '../net/protocol'
import { pendingRequestsLabel, type ScenePeople, type ScenePerson, type SceneRoom } from '../lib/party'
import { esperaLonga, minutosDeEspera, rotuloDeEspera, type EsperaPorCena } from '../lib/cenaQueEspera'
import type { SceneListItem } from '../stores/adventureStore'

export interface ScenesSectionProps {
  scenes: SceneListItem[]
  /** Um clique troca a cena aberta. */
  onSelect: (sceneId: string) => void
  onCreate: (name: string) => void
  onRename: (sceneId: string, name: string) => void
  /**
   * Quem está em cada cena e quantos pedidos esperam lá (`peopleByScene`).
   * Ausente ou vazio = sala fechada ou mapa solto: a linha fica só com o nome.
   */
  people?: ReadonlyMap<string, ScenePeople>
  /**
   * RECADO POR CENA: manda `text` a quem está em `sceneId`. Devolve quantos
   * jogadores receberam, ou `null` se não deu (sala fechou no meio). Ausente =
   * sala fechada: a linha fica sem o botão "Recado". `playerIds` vem quando o
   * mestre escolheu quem recebe entre os presentes (só esses); ausente = todos.
   */
  onNote?: (sceneId: string, text: string, playerIds?: readonly string[]) => number | null
  /** PAUSA POR CENA: ids das cenas pausadas agora. Ausente = nenhuma. */
  paused?: ReadonlySet<string>
  /**
   * Pausa (`true`) ou solta a cena. Ausente = sala fechada: a linha fica sem o
   * botão "Pausar" (sem sala, não há grupo esperando).
   */
  onTogglePause?: (sceneId: string, paused: boolean) => void
  /**
   * Desde quando (ms, relógio do mestre) cada cena espera o mestre: gente lá
   * e o editor noutra cena (`lib/cenaQueEspera.ts`). A linha mostra 'há N
   * min' a partir de 1 min. Ausente ou vazio = nenhuma linha mostra espera.
   */
  waitingSince?: EsperaPorCena
}

/** De quanto em quanto tempo o 'há N min' se atualiza sozinho. */
const WAITING_TICK_MS = 15_000

/**
 * O relógio do 'há N min', vivo só enquanto alguma cena espera. Mora aqui, e
 * não no `App`: o tique re-renderiza só a lista Cenas, não o editor inteiro.
 */
function useWaitingMinutes(waitingSince: EsperaPorCena | undefined): ReadonlyMap<string, number> {
  const [now, setNow] = useState(() => Date.now())
  const waiting = waitingSince !== undefined && waitingSince.size > 0
  useEffect(() => {
    if (!waiting) return
    // O relógio pode ter parado enquanto ninguém esperava: acerta antes do primeiro tique.
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), WAITING_TICK_MS)
    return () => clearInterval(timer)
  }, [waiting, waitingSince])
  return waitingSince === undefined ? NO_WAITING : minutosDeEspera(waitingSince, now)
}

const NO_WAITING: ReadonlyMap<string, number> = new Map()

/** Quanto tempo o aviso "Recado enviado…" fica na linha da cena. */
export const NOTE_FEEDBACK_MS = 4000

/** O aviso depois de enviar: quantos leram, ou que ninguém estava lá para ler. */
export function noteFeedbackText(sent: number | null): string {
  if (sent === null) return 'Não deu para enviar: a sala não está aberta.'
  if (sent === 0) return 'Ninguém está nesta cena'
  return sent === 1 ? 'Recado enviado a 1 jogador' : `Recado enviado a ${sent} jogadores`
}

/** Sem ninguém para marcar (lista estável: o estado inicial do formulário lê dela). */
const NO_PEOPLE: readonly ScenePerson[] = []

export interface NoteFormProps {
  /** O rótulo do campo: diz para quem vai o recado. */
  label: string
  /**
   * Quem está na cena agora. Vazio ou ausente = ninguém para escolher: vai para
   * a cena inteira (no Grupo, para o jogador da linha).
   */
  people?: readonly ScenePerson[]
  /** `playerIds` só quando o mestre escolheu entre os presentes. */
  onSend(text: string, playerIds?: string[]): void
  onCancel(): void
}

/** Os atalhos "Quem está em: <sala>": cada Sala onde há alguém, sem repetir, na ordem das bolinhas. */
export function roomShortcuts(people: readonly ScenePerson[]): SceneRoom[] {
  const seen = new Map<string, SceneRoom>()
  for (const person of people) {
    for (const room of person.rooms ?? []) if (!seen.has(room.id)) seen.set(room.id, room)
  }
  return [...seen.values()]
}

/**
 * "Quem recebe": uma marca por jogador presente (a bolinha na cor da ficha e o
 * nome), "Todos" com estado misto e os atalhos por sala. Caixa de marcar
 * nativa: clique no nome, no quadrado e Espaço alternam igual.
 */
function RecipientPicker({ people, chosen, onChange }: { people: readonly ScenePerson[]; chosen: ReadonlySet<string>; onChange(next: Set<string>): void }) {
  const allRef = useRef<HTMLInputElement | null>(null)
  const count = people.filter((p) => chosen.has(p.playerId)).length
  const all = count === people.length
  const some = count > 0 && !all

  useEffect(() => {
    if (allRef.current !== null) allRef.current.indeterminate = some
  }, [some])

  return (
    <fieldset className="lb-cenas__quem">
      <legend className="lb-label">Quem recebe</legend>
      <label className="lb-cenas__escolha">
        <input ref={allRef} type="checkbox" checked={all} onChange={() => onChange(all ? new Set() : new Set(people.map((p) => p.playerId)))} />
        Todos
      </label>
      {people.map((person) => (
        <label key={person.playerId} className="lb-cenas__escolha">
          <input
            type="checkbox"
            checked={chosen.has(person.playerId)}
            onChange={() => {
              const next = new Set(chosen)
              if (!next.delete(person.playerId)) next.add(person.playerId)
              onChange(next)
            }}
          />
          <span className="lb-cenas__pessoa" aria-hidden="true" style={{ background: person.color }} />
          {person.name}
        </label>
      ))}
      {roomShortcuts(people).map((room) => (
        <button
          key={room.id}
          type="button"
          className="lb-cenas__atalho"
          onClick={() => onChange(new Set(people.filter((p) => p.rooms?.some((r) => r.id === room.id) === true).map((p) => p.playerId)))}
        >
          Quem está em: {room.name}
        </button>
      ))}
    </fieldset>
  )
}

/**
 * O recado de uma cena (ou de um jogador, no Grupo), dentro da linha dela: um campo de texto curto e
 * "Enviar"/"Cancelar", no molde do "Mandar para…" do Grupo. Enter comum quebra
 * linha (é um recado, pode ter duas frases); Ctrl+Enter envia; Esc cancela.
 * Com gente na cena, o mestre escolhe quem recebe e o botão diz quantos.
 */
export function NoteForm({ label, people = NO_PEOPLE, onSend, onCancel }: NoteFormProps) {
  const fieldId = useId()
  const emptyHintId = useId()
  const [text, setText] = useState('')
  // Abre com todos marcados: o recado da cena inteira continua a um Enviar de distância.
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(people.map((p) => p.playerId)))
  const fieldRef = useRef<HTMLTextAreaElement | null>(null)
  const empty = text.trim().length === 0
  const choosing = people.length > 0
  // Filtra pelos presentes de AGORA: quem saiu da cena com o campo aberto não conta.
  const recipients = people.filter((p) => chosen.has(p.playerId)).map((p) => p.playerId)
  const noOneChosen = choosing && recipients.length === 0
  const canSend = !empty && !noOneChosen

  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  const send = () => {
    if (!canSend) return
    if (choosing) onSend(text, recipients)
    else onSend(text)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    send()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      // Esc fecha sem enviar; não pode chegar ao canvas (Esc lá troca a ferramenta).
      event.preventDefault()
      event.stopPropagation()
      onCancel()
      return
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      send()
    }
  }

  return (
    <form className="lb-cenas__recado" onSubmit={submit}>
      <label className="lb-label" htmlFor={fieldId}>
        {label}
      </label>
      <textarea
        id={fieldId}
        ref={fieldRef}
        className="lb-input lb-cenas__recado-campo"
        rows={3}
        value={text}
        maxLength={NOTE_MAX_LENGTH}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {choosing && <RecipientPicker people={people} chosen={chosen} onChange={setChosen} />}
      {noOneChosen && (
        <p id={emptyHintId} className="lb-cenas__recado-vazio">
          Marque quem recebe o recado
        </p>
      )}
      <div className="lb-cenas__acoes">
        <span className="lb-cenas__recado-conta" aria-hidden="true">
          {text.length}/{NOTE_MAX_LENGTH}
        </span>
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="lb-btn lb-btn--primary" disabled={!canSend} aria-describedby={noOneChosen ? emptyHintId : undefined}>
          {choosing ? `Enviar para ${recipients.length}` : 'Enviar'}
        </button>
      </div>
    </form>
  )
}

/** Campo aberto na seção: nome da cena nova, ou novo nome da cena aberta. */
type Editing = { kind: 'create' } | { kind: 'rename'; sceneId: string } | null

function tokenLabel(count: number | null): string {
  if (count === null) return 'indisponível'
  return count === 1 ? '1 token' : `${count} tokens`
}

/**
 * A segunda linha do item: uma bolinha por jogador na cena (cor da ficha,
 * nome no rótulo e no título — o mouse em cima diz quem é) e o selo dos
 * pedidos que esperam o mestre. Fica numa linha própria para sete jogadores
 * não espremerem o nome da cena.
 */
function SceneGente({ people }: { people: ScenePeople }) {
  return (
    <div className="lb-cenas__gente">
      {people.people.map((person) => (
        <span key={person.playerId} role="img" className="lb-cenas__pessoa" aria-label={person.name} title={person.name} style={{ background: person.color }} />
      ))}
      {people.pendingRequests > 0 && <span className="lb-cenas__pedidos">{pendingRequestsLabel(people.pendingRequests)}</span>}
    </div>
  )
}

/**
 * 'há 11 min' na linha da cena que espera o mestre; âmbar a partir de
 * `ESPERA_LONGA_MIN`. O título diz o que é e ensina o Ctrl+J (atalho
 * invisível é atalho inexistente).
 */
function SceneEspera({ minutes }: { minutes: number }) {
  const label = rotuloDeEspera(minutes)
  return (
    <span className={`lb-cenas__espera${esperaLonga(minutes) ? ' lb-cenas__espera--longa' : ''}`} title={`Esperando você ${label} · Ctrl+J abre a que espera mais`}>
      {label}
    </span>
  )
}

/**
 * "Cenas", no topo da aba Mapa: as cenas da aventura, a aberta destacada
 * (`aria-current`), "+ Nova cena" e renomear. O nome da cena é o botão
 * inteiro — trocar de cena é um clique —, e a contagem de tokens fica FORA
 * dele, para o nome acessível do botão ser só o nome da cena.
 */
export function ScenesSection({ scenes, onSelect, onCreate, onRename, people, onNote, paused, onTogglePause, waitingSince }: ScenesSectionProps) {
  const waiting = useWaitingMinutes(waitingSince)
  const [editing, setEditing] = useState<Editing>(null)
  const [draft, setDraft] = useState('')
  /** Cena com o recado aberto; `null` = nenhum. */
  const [noting, setNoting] = useState<string | null>(null)
  /** Aviso do último recado, na linha da cena dele; some sozinho. */
  const [noteFeedback, setNoteFeedback] = useState<{ sceneId: string; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  /** Quem abriu o campo: o foco volta para ele ao confirmar ou cancelar. */
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (editing === null) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  useEffect(() => {
    if (noteFeedback === null) return
    const timer = setTimeout(() => setNoteFeedback(null), NOTE_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [noteFeedback])

  const startEditing = (next: NonNullable<Editing>, initial: string) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setNoting(null)
    setDraft(initial)
    setEditing(next)
  }

  const startNote = (sceneId: string) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setEditing(null)
    setNoteFeedback(null)
    setNoting(sceneId)
  }

  const sendNote = (sceneId: string, text: string, playerIds?: string[]) => {
    // Sem escolha, a chamada de antes (cena inteira), sem o terceiro argumento.
    const sent = (playerIds === undefined ? onNote?.(sceneId, text) : onNote?.(sceneId, text, playerIds)) ?? null
    setNoteFeedback({ sceneId, text: noteFeedbackText(sent) })
    closeNote()
  }

  const close = () => {
    setEditing(null)
    const opener = openerRef.current
    openerRef.current = null
    // Depois do render: o botão que abriu pode ter sido trocado de lugar.
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus()
    })
  }

  const closeNote = () => {
    setNoting(null)
    const opener = openerRef.current
    openerRef.current = null
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus()
    })
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (editing === null) return
    if (editing.kind === 'create') onCreate(draft)
    else onRename(editing.sceneId, draft)
    close()
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return
    // Esc fecha o campo sem criar nem renomear; não pode chegar ao canvas (Esc lá troca a ferramenta).
    event.preventDefault()
    event.stopPropagation()
    close()
  }

  const inputLabel = editing?.kind === 'create' ? 'Nome da nova cena' : 'Novo nome da cena'

  return (
    <CollapsibleSection id="scenes" title="Cenas" defaultOpen>
      <ul className="lb-cenas" aria-label="Cenas da aventura">
        {scenes.map((scene) => {
          const here = people?.get(scene.id)
          const isPaused = paused?.has(scene.id) === true
          const minutesWaiting = waiting.get(scene.id)
          return (
            <li key={scene.id || 'cena-solta'} className={`lb-cenas__item${scene.active ? ' lb-cenas__item--ativa' : ''}`}>
              <button
                type="button"
                className="lb-cenas__nome"
                aria-current={scene.active ? 'true' : undefined}
                disabled={!scene.available}
                title={scene.available ? undefined : 'O arquivo desta cena não foi encontrado'}
                onClick={() => onSelect(scene.id)}
              >
                {scene.name}
              </button>
              <span className="lb-cenas__conta">{tokenLabel(scene.tokenCount)}</span>
              {minutesWaiting !== undefined && <SceneEspera minutes={minutesWaiting} />}
              {scene.active && scene.renamable && editing === null && (
                <button
                  type="button"
                  className="lb-cenas__renomear"
                  aria-label={`Renomear ${scene.name}`}
                  title="Renomear"
                  onClick={() => startEditing({ kind: 'rename', sceneId: scene.id }, scene.name)}
                >
                  ✎
                </button>
              )}
              {/* Montado também com o campo aberto: é para ele que o foco volta. */}
              {onNote !== undefined && scene.id !== '' && (
                <button
                  type="button"
                  className="lb-cenas__recado-btn"
                  aria-label={`Recado para ${scene.name}`}
                  aria-expanded={noting === scene.id}
                  title="Recado: só quem está nesta cena lê"
                  disabled={!scene.available}
                  onClick={() => (noting === scene.id ? closeNote() : startNote(scene.id))}
                >
                  {/* Glifo, como o ✎ do renomear: sete linhas repetindo "Recado"
                      poluem a lista. O nome vai no rótulo acessível e no título. */}
                  <span aria-hidden="true">✉</span>
                </button>
              )}
              {/* Mapa solto (`id` vazio) não tem cena para pausar. O nome
                  acessível é o mesmo ligado ou desligado; o estado vai em
                  `aria-pressed`, como pede um botão alternável. */}
              {onTogglePause !== undefined && scene.id !== '' && (
                <button
                  type="button"
                  className="lb-cenas__pausar"
                  aria-label={`Pausar ${scene.name}`}
                  aria-pressed={isPaused}
                  title={isPaused ? 'Pausada: quem está aqui espera. Clique para soltar' : 'Pausar: quem está nesta cena espera você'}
                  disabled={!scene.available}
                  onClick={() => onTogglePause(scene.id, !isPaused)}
                >
                  <span aria-hidden="true">⏸</span>
                </button>
              )}
              {here !== undefined && (here.people.length > 0 || here.pendingRequests > 0) && <SceneGente people={here} />}
              {onNote !== undefined && noting === scene.id && (
                <NoteForm
                  label={`Recado para quem está em ${scene.name}`}
                  people={here?.people ?? NO_PEOPLE}
                  onSend={(text, playerIds) => sendNote(scene.id, text, playerIds)}
                  onCancel={closeNote}
                />
              )}
              {noteFeedback?.sceneId === scene.id && (
                <p className="lb-cenas__recado-aviso" role="status">
                  {noteFeedback.text}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      {/* Sempre montado: é para ele que o foco volta depois de criar ou cancelar. */}
      <button type="button" className="lb-btn lb-btn--block" onClick={() => startEditing({ kind: 'create' }, `Cena ${scenes.length + 1}`)}>
        + Nova cena
      </button>
      {editing !== null && (
        <form className="lb-cenas__form" onSubmit={submit}>
          <div className="lb-field">
            <label className="lb-label" htmlFor="lb-cena-nome">
              {inputLabel}
            </label>
            <input
              id="lb-cena-nome"
              ref={inputRef}
              className="lb-input"
              value={draft}
              maxLength={80}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onInputKeyDown}
            />
          </div>
          <div className="lb-cenas__acoes">
            <button type="button" className="lb-btn lb-btn--ghost" onClick={close}>
              Cancelar
            </button>
            <button type="submit" className="lb-btn">
              {editing.kind === 'create' ? 'Criar' : 'Renomear'}
            </button>
          </div>
        </form>
      )}
    </CollapsibleSection>
  )
}
