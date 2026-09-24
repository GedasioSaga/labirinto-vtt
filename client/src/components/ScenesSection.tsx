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
  /**
   * "Planta conhecida por todos" da cena. Ausente = a linha fica sem o botão
   * de planta (a revelação para jogadores mora no mesmo painel).
   */
  onTogglePlanKnown?: (sceneId: string, known: boolean) => void
  /** Jogadores da sala, na ordem do painel Grupo: as caixas do "Revelar planta para…". */
  players?: readonly PlanPlayer[]
  /**
   * "Revelar planta para…": a planta de `sceneId` para estes jogadores, mesmo
   * fora dela. Devolve quantos ganharam, ou `null` se não deu. Ausente = sala
   * fechada: o painel fica só com a "Planta conhecida por todos".
   */
  onRevealPlanFor?: (sceneId: string, playerIds: string[]) => number | null
}

/** Um jogador na lista do "Revelar planta para…". */
export interface PlanPlayer {
  playerId: string
  name: string
}

/** O aviso depois de "Revelar": para quantos, ou por que não deu. */
export function planRevealFeedbackText(granted: number | null): string {
  if (granted === null) return 'Não deu para revelar: a sala não está aberta.'
  if (granted === 0) return 'Nenhum jogador recebeu: a cena ou os jogadores não estão mais na sala.'
  return granted === 1 ? 'Planta revelada para 1 jogador' : `Planta revelada para ${granted} jogadores`
}

export const PLAN_KNOWN_HINT = 'Quem chegar vê paredes, salas e portas. Teto fechado e zona oculta continuam escondidos. Desligar não apaga o que já foi mostrado.'

interface PlanPanelProps {
  scene: SceneListItem
  onTogglePlanKnown(known: boolean): void
  players?: readonly PlanPlayer[]
  onReveal?: (playerIds: string[]) => void
  onClose(): void
}

/**
 * A planta de uma cena, dentro da linha dela: "Planta conhecida por todos" e,
 * com a sala aberta, "Revelar planta para…" com uma caixa por jogador. Vale
 * mesmo em cena vazia: quem ganhou vê a planta quando chegar. Esc fecha.
 */
function PlanPanel({ scene, onTogglePlanKnown, players, onReveal, onClose }: PlanPanelProps) {
  const knownId = useId()
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const knownRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    knownRef.current?.focus()
  }, [])

  const toggle = (playerId: string) => {
    setChosen((previous) => {
      const next = new Set(previous)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    // Esc fecha; não pode chegar ao canvas (Esc lá troca a ferramenta).
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  const reveal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (onReveal === undefined || chosen.size === 0) return
    // Na ordem da sala, não na ordem em que o mestre marcou.
    onReveal((players ?? []).filter((p) => chosen.has(p.playerId)).map((p) => p.playerId))
  }

  return (
    <div className="lb-cenas__planta" onKeyDown={onKeyDown}>
      <label className="lb-gather__item" htmlFor={knownId}>
        <input
          id={knownId}
          ref={knownRef}
          type="checkbox"
          className="lb-gather__check"
          checked={scene.planKnownByAll === true}
          onChange={(event) => onTogglePlanKnown(event.target.checked)}
        />
        Planta conhecida por todos
      </label>
      <p className="lb-label">{PLAN_KNOWN_HINT}</p>
      {onReveal !== undefined && (
        <form onSubmit={reveal}>
          <fieldset className="lb-cenas__planta-quem">
            <legend className="lb-label">Revelar planta para…</legend>
            {players === undefined || players.length === 0 ? (
              <p className="lb-label">Nenhum jogador na sala.</p>
            ) : (
              <>
                {players.map((player) => (
                  <label key={player.playerId} className="lb-gather__item">
                    <input type="checkbox" className="lb-gather__check" checked={chosen.has(player.playerId)} onChange={() => toggle(player.playerId)} />
                    {player.name}
                  </label>
                ))}
                {chosen.size === 0 && <p className="lb-label">Marque ao menos um jogador.</p>}
              </>
            )}
          </fieldset>
          <div className="lb-cenas__acoes">
            <button type="button" className="lb-btn lb-btn--ghost" onClick={onClose}>
              Fechar
            </button>
            {players !== undefined && players.length > 0 && (
              <button type="submit" className="lb-btn lb-btn--primary" disabled={chosen.size === 0}>
                Revelar
              </button>
            )}
          </div>
        </form>
      )}
      {onReveal === undefined && (
        <div className="lb-cenas__acoes">
          <button type="button" className="lb-btn lb-btn--ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
      )}
    </div>
  )
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
export function ScenesSection({ scenes, onSelect, onCreate, onRename, people, onNote, onTogglePlanKnown, players, onRevealPlanFor }: ScenesSectionProps) {
  const [editing, setEditing] = useState<Editing>(null)
  const [draft, setDraft] = useState('')
  /** Cena com o recado aberto; `null` = nenhum. */
  const [noting, setNoting] = useState<string | null>(null)
  /** Aviso do último recado (ou da última revelação de planta), na linha da cena; some sozinho. */
  const [noteFeedback, setNoteFeedback] = useState<{ sceneId: string; text: string } | null>(null)
  /** Cena com o painel de planta aberto; `null` = nenhum. */
  const [planning, setPlanning] = useState<string | null>(null)
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
    setPlanning(null)
    setDraft(initial)
    setEditing(next)
  }

  const startNote = (sceneId: string) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setEditing(null)
    setPlanning(null)
    setNoteFeedback(null)
    setNoting(sceneId)
  }

  const startPlan = (sceneId: string) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setEditing(null)
    setNoting(null)
    setNoteFeedback(null)
    setPlanning(sceneId)
  }

  const closePlan = () => {
    setPlanning(null)
    const opener = openerRef.current
    openerRef.current = null
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus()
    })
  }

  const revealPlan = (sceneId: string, playerIds: string[]) => {
    const granted = onRevealPlanFor?.(sceneId, playerIds) ?? null
    setNoteFeedback({ sceneId, text: planRevealFeedbackText(granted) })
    closePlan()
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
                title={scene.available ? undefined : 'O arquivo desta cena não foi encontrado'}
                onClick={() => onSelect(scene.id)}
              >
                {scene.name}
              </button>
              <span className="lb-cenas__conta">{tokenLabel(scene.tokenCount)}</span>
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
              {onTogglePlanKnown !== undefined && scene.id !== '' && (
                <button
                  type="button"
                  className="lb-cenas__recado-btn"
                  aria-label={`Planta de ${scene.name}`}
                  aria-expanded={planning === scene.id}
                  title={scene.planKnownByAll === true ? 'Planta: conhecida por todos' : 'Planta: quem conhece esta cena'}
                  onClick={() => (planning === scene.id ? closePlan() : startPlan(scene.id))}
                >
                  {/* ▦ cheio quando a cena é conhecida por todos: o estado se lê sem abrir. */}
                  <span aria-hidden="true">{scene.planKnownByAll === true ? '▦' : '▢'}</span>
                </button>
              )}
              {here !== undefined && (here.people.length > 0 || here.pendingRequests > 0) && <SceneGente people={here} />}
              {onNote !== undefined && noting === scene.id && (
                <NoteForm sceneName={scene.name} onSend={(text) => sendNote(scene.id, text)} onCancel={closeNote} />
              )}
              {onTogglePlanKnown !== undefined && planning === scene.id && (
                <PlanPanel
                  scene={scene}
                  onTogglePlanKnown={(known) => onTogglePlanKnown(scene.id, known)}
                  players={players}
                  onReveal={onRevealPlanFor === undefined ? undefined : (ids) => revealPlan(scene.id, ids)}
                  onClose={closePlan}
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
