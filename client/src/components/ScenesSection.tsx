import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CollapsibleSection } from './CollapsibleSection'
import { NOTE_MAX_LENGTH } from '../net/protocol'
import { pendingRequestsLabel, type ScenePeople } from '../lib/party'
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
   * sala fechada: a linha fica sem o botão "Recado".
   */
  onNote?: (sceneId: string, text: string) => number | null
}

/** Quanto tempo o aviso "Recado enviado…" fica na linha da cena. */
export const NOTE_FEEDBACK_MS = 4000

/** O aviso depois de enviar: quantos leram, ou que ninguém estava lá para ler. */
export function noteFeedbackText(sent: number | null): string {
  if (sent === null) return 'Não deu para enviar: a sala não está aberta.'
  if (sent === 0) return 'Ninguém está nesta cena'
  return sent === 1 ? 'Recado enviado a 1 jogador' : `Recado enviado a ${sent} jogadores`
}

interface NoteFormProps {
  sceneName: string
  onSend(text: string): void
  onCancel(): void
}

/**
 * O recado de uma cena, dentro da linha dela: um campo de texto curto e
 * "Enviar"/"Cancelar", no molde do "Mandar para…" do Grupo. Enter comum quebra
 * linha (é um recado, pode ter duas frases); Ctrl+Enter envia; Esc cancela.
 */
function NoteForm({ sceneName, onSend, onCancel }: NoteFormProps) {
  const fieldId = useId()
  const [text, setText] = useState('')
  const fieldRef = useRef<HTMLTextAreaElement | null>(null)
  const empty = text.trim().length === 0

  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!empty) onSend(text)
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
      if (!empty) onSend(text)
    }
  }

  return (
    <form className="lb-cenas__recado" onSubmit={submit}>
      <label className="lb-label" htmlFor={fieldId}>
        Recado para quem está em {sceneName}
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
      <div className="lb-cenas__acoes">
        <span className="lb-cenas__recado-conta" aria-hidden="true">
          {text.length}/{NOTE_MAX_LENGTH}
        </span>
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="lb-btn lb-btn--primary" disabled={empty}>
          Enviar
        </button>
      </div>
    </form>
  )
}

/** Campo aberto na seção: nome da cena nova, ou novo nome da cena aberta. */
type Editing = { kind: 'create' } | { kind: 'rename'; sceneId: string } | null

/** Por que o nome da cena está desabilitado — `undefined` quando ela abre. */
function unavailableTitle(scene: SceneListItem): string | undefined {
  if (scene.available) return undefined
  return scene.loading === true ? 'Esta cena ainda está sendo lida do disco' : 'O arquivo desta cena não foi encontrado'
}

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
 * "Cenas", no topo da aba Mapa: as cenas da aventura, a aberta destacada
 * (`aria-current`), "+ Nova cena" e renomear. O nome da cena é o botão
 * inteiro — trocar de cena é um clique —, e a contagem de tokens fica FORA
 * dele, para o nome acessível do botão ser só o nome da cena.
 */
export function ScenesSection({ scenes, onSelect, onCreate, onRename, people, onNote }: ScenesSectionProps) {
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

  const sendNote = (sceneId: string, text: string) => {
    const sent = onNote?.(sceneId, text) ?? null
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
          return (
            <li key={scene.id || 'cena-solta'} className={`lb-cenas__item${scene.active ? ' lb-cenas__item--ativa' : ''}`}>
              <button
                type="button"
                className="lb-cenas__nome"
                aria-current={scene.active ? 'true' : undefined}
                disabled={!scene.available}
                title={unavailableTitle(scene)}
                onClick={() => onSelect(scene.id)}
              >
                {scene.name}
              </button>
              <span className="lb-cenas__conta">{scene.loading === true ? 'carregando…' : tokenLabel(scene.tokenCount)}</span>
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
              {here !== undefined && (here.people.length > 0 || here.pendingRequests > 0) && <SceneGente people={here} />}
              {onNote !== undefined && noting === scene.id && (
                <NoteForm sceneName={scene.name} onSend={(text) => sendNote(scene.id, text)} onCancel={closeNote} />
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
