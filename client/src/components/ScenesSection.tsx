import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CollapsibleSection } from './CollapsibleSection'
import { SceneOverviewDialog, tokenCountLabel } from './SceneOverview'
import { NOTE_MAX_LENGTH } from '../net/protocol'
import { pendingRequestsLabel, type ScenePeople } from '../lib/party'
import type { SceneDeletionInfo, SceneListItem } from '../stores/adventureStore'
import type { MapData } from '../types/map'

export interface ScenesSectionProps {
  scenes: SceneListItem[]
  /** Um clique troca a cena aberta. */
  onSelect: (sceneId: string) => void
  onCreate: (name: string) => void
  onRename: (sceneId: string, name: string) => void
  /**
   * VISÃO GERAL DAS CENAS: o mapa de cada cena, pelo id da lista (`sceneMaps`).
   * Com duas cenas ou mais, a seção ganha o botão "Visão geral", que abre as
   * miniaturas. Ausente = sem o botão.
   */
  maps?: ReadonlyMap<string, MapData>
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
  // MENU "…" DA CENA. Ausentes os quatro (mapa solto) = a linha fica sem o
  // "…". Um só ausente = o item dele aparece esmaecido.
  /** "Duplicar": a cópia entra logo abaixo, sem as fichas dos jogadores. */
  onDuplicate?: (sceneId: string) => void
  /** "Subir" (`-1`) e "Descer" (`1`): a cena anda uma posição. */
  onMove?: (sceneId: string, delta: -1 | 1) => void
  /** Chamado só depois da confirmação, e nunca com jogador na cena. */
  onDelete?: (sceneId: string) => void
  /** O que a confirmação de "Apagar cena…" mostra: pinos que ficam soltos e quem ainda está lá. */
  deletionInfo?: (sceneId: string) => SceneDeletionInfo
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

/** "Ana", "Ana e Bruno", "Ana, Bruno e Carla". */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

/** O que a confirmação diz dos pinos de outras cenas que levavam à apagada. */
export function orphanPinsText(count: number): string {
  if (count === 0) return 'Nenhum pino de outra cena leva para cá.'
  if (count === 1) return '1 pino de viagem de outra cena vai ficar sem destino.'
  return `${count} pinos de viagem de outras cenas vão ficar sem destino.`
}

/** Por que o Apagar está desligado: quem ainda está na cena. */
export function deleteBlockedText(blockers: readonly string[]): string {
  return `Não dá para apagar: ${joinNames(blockers)} ${blockers.length === 1 ? 'está' : 'estão'} nesta cena.`
}

interface SceneMenuItem {
  label: string
  disabled: boolean
  onSelect(): void
}

interface SceneMenuProps {
  id: string
  label: string
  items: SceneMenuItem[]
  /** O "…" que abriu: o clique nele alterna o menu, então fica fora do "clique fora". */
  trigger: HTMLElement | null
  /** `focusTrigger`: Esc e escolha devolvem o foco ao "…"; Tab e clique fora, não. */
  onClose(focusTrigger: boolean): void
}

/**
 * O menu "…" de uma cena, no molde do menu de imagem de fundo (`ActionBar`):
 * o foco entra no primeiro item que age, setas andam pulando o esmaecido,
 * Home/End vão às pontas, Esc fecha e devolve o foco ao "…". O item que não se
 * aplica agora (Subir na primeira cena) fica no lugar, esmaecido, para o
 * mestre aprender onde ele mora.
 */
function SceneMenu({ id, label, items, trigger, onClose }: SceneMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  /** Os itens que agem, na ordem: é por eles que as setas andam. */
  const enabled = (): HTMLButtonElement[] => {
    const out: HTMLButtonElement[] = []
    items.forEach((item, index) => {
      const el = itemRefs.current[index]
      if (!item.disabled && el !== null && el !== undefined) out.push(el)
    })
    return out
  }

  // Só ao abrir (o menu monta a cada abertura): o foco não volta ao primeiro a cada render.
  useEffect(() => {
    enabled()[0]?.focus()
  }, [])

  useEffect(() => {
    // `pointerdown`, como no ActionBar: fecha antes de o clique acertar o que está por baixo.
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (menuRef.current?.contains(event.target) || trigger?.contains(event.target)) return
      onClose(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [trigger, onClose])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Nenhuma tecla do menu vale como atalho do editor (Esc, setas movendo o selecionado).
    event.stopPropagation()
    const list = enabled()
    const current = list.findIndex((el) => el === document.activeElement)
    const focusAt = (index: number) => {
      event.preventDefault()
      list[(index + list.length) % list.length]?.focus()
    }
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        onClose(true)
        return
      case 'Tab':
        onClose(false)
        return
      case 'ArrowDown':
        focusAt(current + 1)
        return
      case 'ArrowUp':
        focusAt(current < 0 ? list.length - 1 : current - 1)
        return
      case 'Home':
        focusAt(0)
        return
      case 'End':
        focusAt(list.length - 1)
        return
    }
  }

  return (
    <div ref={menuRef} id={id} className="lb-panel lb-cenas__menu" role="menu" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item, index) => (
        <button
          key={item.label}
          ref={(node) => {
            itemRefs.current[index] = node
          }}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="lb-cenas__menu-item"
          aria-disabled={item.disabled ? 'true' : undefined}
          onClick={() => {
            if (!item.disabled) item.onSelect()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

interface DeleteConfirmProps {
  sceneName: string
  info: SceneDeletionInfo
  onConfirm(): void
  onCancel(): void
}

/**
 * "Apagar cena…": confirmação na própria linha, no molde da de "Dar a…" do
 * painel Sala. Começa no botão seguro; com alguém na cena, diz quem e o
 * Apagar fica desligado — mandar o grupo para outra cena vem antes.
 */
function DeleteConfirm({ sceneName, info, onConfirm, onCancel }: DeleteConfirmProps) {
  const titleId = useId()
  const blocked = info.blockers.length > 0
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="lb-cenas__apagar"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // Esc é desta confirmação: não chega aos atalhos do editor.
        event.preventDefault()
        event.stopPropagation()
        onCancel()
      }}
    >
      <p id={titleId} className="lb-cenas__apagar-titulo">
        Apagar {sceneName}?
      </p>
      <p>{orphanPinsText(info.orphanPins)}</p>
      {blocked && <p className="lb-cenas__apagar-bloqueio">{deleteBlockedText(info.blockers)}</p>}
      <div className="lb-cenas__acoes">
        <button type="button" className="lb-btn lb-btn--danger" disabled={blocked} onClick={onConfirm}>
          Apagar
        </button>
        {/* Foco começa no botão seguro (convenção de confirmação destrutiva). */}
        <button type="button" className="lb-btn lb-btn--ghost" autoFocus onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

/** Campo aberto na seção: nome da cena nova, ou novo nome da cena aberta. */
type Editing = { kind: 'create' } | { kind: 'rename'; sceneId: string } | null

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
 * (`aria-current`), "+ Nova cena", renomear e a "Visão geral" (miniaturas de
 * todas as cenas com as fichas, `SceneOverview.tsx`). O nome da cena é o botão
 * inteiro — trocar de cena é um clique —, e a contagem de tokens fica FORA
 * dele, para o nome acessível do botão ser só o nome da cena.
 */
export function ScenesSection({ scenes, onSelect, onCreate, onRename, people, onNote, maps, onDuplicate, onMove, onDelete, deletionInfo }: ScenesSectionProps) {
  const [editing, setEditing] = useState<Editing>(null)
  /** Cena com o menu "…" aberto; `null` = nenhuma. */
  const [menuFor, setMenuFor] = useState<string | null>(null)
  /** Cena com a confirmação de apagar aberta; `null` = nenhuma. */
  const [deleting, setDeleting] = useState<string | null>(null)
  /** O "…" de cada cena, pelo id: é para ele que o foco volta. */
  const menuTriggers = useRef(new Map<string, HTMLButtonElement>())
  /** "+ Nova cena": o foco cai nele quando a linha da cena apagada some. */
  const createButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuIdBase = useId()
  const hasSceneMenu = onDuplicate !== undefined || onMove !== undefined || onDelete !== undefined || deletionInfo !== undefined
  const [draft, setDraft] = useState('')
  /** Janela "Visão geral das cenas" aberta. */
  const [overviewOpen, setOverviewOpen] = useState(false)
  /** O botão "Visão geral": é para ele que o foco volta quando a janela fecha. */
  const overviewButtonRef = useRef<HTMLButtonElement | null>(null)
  // Com uma cena só (mapa solto) não há o que comparar: a vista dela já é o editor.
  const canOverview = maps !== undefined && scenes.length > 1
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

  const focusTrigger = (sceneId: string) => {
    const focus = () => {
      const trigger = menuTriggers.current.get(sceneId)
      if (trigger?.isConnected) trigger.focus()
      else createButtonRef.current?.focus()
    }
    focus()
    // De novo depois do render: Subir/Descer mudam a linha de lugar, e o
    // navegador tira o foco de um nó que é movido.
    requestAnimationFrame(focus)
  }

  const closeMenu = (focus: boolean) => {
    const sceneId = menuFor
    setMenuFor(null)
    if (focus && sceneId !== null) focusTrigger(sceneId)
  }

  const cancelDelete = () => {
    const sceneId = deleting
    setDeleting(null)
    if (sceneId !== null) focusTrigger(sceneId)
  }

  const confirmDelete = (sceneId: string) => {
    setDeleting(null)
    onDelete?.(sceneId)
    // A linha some: o foco vai para "+ Nova cena", que fica sempre montado.
    createButtonRef.current?.focus()
  }

  const menuItems = (scene: SceneListItem, index: number): SceneMenuItem[] => {
    const andClose = (run: () => void) => () => {
      closeMenu(true)
      run()
    }
    return [
      { label: 'Duplicar', disabled: onDuplicate === undefined || !scene.available, onSelect: andClose(() => onDuplicate?.(scene.id)) },
      { label: 'Subir', disabled: onMove === undefined || index === 0, onSelect: andClose(() => onMove?.(scene.id, -1)) },
      { label: 'Descer', disabled: onMove === undefined || index === scenes.length - 1, onSelect: andClose(() => onMove?.(scene.id, 1)) },
      {
        label: 'Apagar cena…',
        // A última cena não se apaga: a aventura sem cena nenhuma não abre.
        disabled: onDelete === undefined || deletionInfo === undefined || scenes.length <= 1,
        onSelect: () => {
          setMenuFor(null)
          setEditing(null)
          setNoting(null)
          setDeleting(scene.id)
        },
      },
    ]
  }

  const closeOverview = () => {
    setOverviewOpen(false)
    overviewButtonRef.current?.focus()
  }

  /** Miniatura clicada: abre aquela cena. A que já está aberta só fecha a janela — trocar para ela não faria nada. */
  const pickFromOverview = (sceneId: string) => {
    const picked = scenes.find((scene) => scene.id === sceneId)
    closeOverview()
    if (picked !== undefined && !picked.active) onSelect(sceneId)
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
        {scenes.map((scene, index) => {
          const here = people?.get(scene.id)
          const menuId = `${menuIdBase}-menu-${index}`
          const menuOpen = menuFor === scene.id
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
              <span className="lb-cenas__conta">{tokenCountLabel(scene.tokenCount)}</span>
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
              {hasSceneMenu && scene.id !== '' && (
                <button
                  ref={(node) => {
                    if (node === null) menuTriggers.current.delete(scene.id)
                    else menuTriggers.current.set(scene.id, node)
                  }}
                  type="button"
                  className="lb-cenas__mais"
                  aria-label={`Mais ações de ${scene.name}`}
                  title="Duplicar, mover ou apagar"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-controls={menuOpen ? menuId : undefined}
                  onClick={() => {
                    if (menuOpen) {
                      setMenuFor(null)
                      return
                    }
                    setDeleting(null)
                    setMenuFor(scene.id)
                  }}
                >
                  <span aria-hidden="true">…</span>
                </button>
              )}
              {menuOpen && (
                <SceneMenu
                  id={menuId}
                  label={`Ações de ${scene.name}`}
                  items={menuItems(scene, index)}
                  trigger={menuTriggers.current.get(scene.id) ?? null}
                  onClose={closeMenu}
                />
              )}
              {here !== undefined && (here.people.length > 0 || here.pendingRequests > 0) && <SceneGente people={here} />}
              {deleting === scene.id && deletionInfo !== undefined && (
                <DeleteConfirm sceneName={scene.name} info={deletionInfo(scene.id)} onConfirm={() => confirmDelete(scene.id)} onCancel={cancelDelete} />
              )}
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
      <div className="lb-cenas__rodape">
        {/* Sempre montado: é para ele que o foco volta depois de criar ou cancelar. */}
        <button ref={createButtonRef} type="button" className="lb-btn" onClick={() => startEditing({ kind: 'create' }, `Cena ${scenes.length + 1}`)}>
          + Nova cena
        </button>
        {canOverview && (
          <button
            ref={overviewButtonRef}
            type="button"
            className="lb-btn"
            aria-haspopup="dialog"
            aria-expanded={overviewOpen}
            title="Todas as cenas lado a lado, com as fichas"
            onClick={() => setOverviewOpen(true)}
          >
            Visão geral
          </button>
        )}
      </div>
      {overviewOpen && canOverview && maps !== undefined && (
        <SceneOverviewDialog scenes={scenes} maps={maps} onPick={pickFromOverview} onClose={closeOverview} />
      )}
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
