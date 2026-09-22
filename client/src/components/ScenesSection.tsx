import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CollapsibleSection } from './CollapsibleSection'
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
export function ScenesSection({ scenes, onSelect, onCreate, onRename, people }: ScenesSectionProps) {
  const [editing, setEditing] = useState<Editing>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  /** Quem abriu o campo: o foco volta para ele ao confirmar ou cancelar. */
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (editing === null) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  const startEditing = (next: NonNullable<Editing>, initial: string) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDraft(initial)
    setEditing(next)
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
              {here !== undefined && (here.people.length > 0 || here.pendingRequests > 0) && <SceneGente people={here} />}
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
