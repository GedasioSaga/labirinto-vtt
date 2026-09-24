import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { CollapsibleSection } from './CollapsibleSection'
import { SceneOverviewDialog, tokenCountLabel } from './SceneOverview'
import { CorteDaTorreDialog } from './CorteDaTorre'
import type { CorteJogador } from '../lib/corteDaTorre'
import { ChevronDownIcon, CloseIcon, MoveIntoIcon, SearchIcon } from './icons'
import { useSceneDrag, type SceneDrag } from './sceneDrag'
import { NOTE_MAX_LENGTH } from '../net/protocol'
import { sceneTree, SCENE_TRAIL_SEPARATOR, type SceneTreeRow } from '../lib/adventure'
import { normalizeForSearch } from '../lib/mapObjects'
import { pendingRequestsLabel, type ScenePeople, type ScenePerson } from '../lib/party'
import type { SceneListItem } from '../stores/adventureStore'
import type { MapData } from '../types/map'
import { cenasVizinhas, origensDaCena, type AbaloContagem, type AbaloOrigem, type AbaloTextos } from '../lib/abalo'
import { AbaloForm } from './AbaloForm'

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
  /**
   * ABALO POR DISTÂNCIA: um envio só, com a origem, o texto de cada faixa e as
   * cenas vizinhas da origem (`cenasVizinhas`, pela árvore desta lista).
   * Ausente = sala fechada: a linha fica sem o botão "Abalo".
   */
  onQuake?: AbaloEnvio
  /**
   * CENAS EM PASTAS: põe `sceneId` dentro de `parentId` (`null` = primeiro
   * nível). `false` = não deu. Ausente = mapa solto: sem arrastar e sem
   * "Mover para…".
   */
  onMove?: (sceneId: string, parentId: string | null) => boolean
  /** A aventura aberta: as pastas recolhidas são lembradas por aventura, neste computador. */
  adventureId?: string | null
  /**
   * CORTE DA TORRE: leva o editor à cena `sceneId` com o ponto no centro (o
   * "Ir lá" do Grupo). Com ele e a "Visão geral" possível, a seção ganha o
   * botão "Corte da torre". Ausente = sem o botão.
   */
  onGoToPoint?: (sceneId: string, x: number, y: number) => void
  /** Jogadores da sala, para o corte pintar os pontos deles. Ausente = sala fechada: só fichas sem dono. */
  towerPlayers?: readonly CorteJogador[]
}

/** Sala fechada: nenhum jogador. Constante para o corte não recalcular a cada render. */
const NO_TOWER_PLAYERS: readonly CorteJogador[] = []

/** Quanto tempo o aviso "Recado enviado…" fica na linha da cena. */
export const NOTE_FEEDBACK_MS = 4000

/** Com menos cenas que isto a lista inteira cabe no olho, e a seção fica sem "Filtrar cenas". */
export const SCENE_FILTER_MIN = 6

/** Recuo desenhado até este nível; mais fundo a cena continua na árvore, só não anda mais para a direita (o painel é estreito). */
const MAX_VISUAL_DEPTH = 5

/** Valor do "Mover para…" que quer dizer "primeiro nível" (id de cena de aventura nunca é vazio). */
const FIRST_LEVEL = ''

/** Chave das pastas recolhidas no localStorage: `lb-cenas-recolhidas:<id da aventura>`. */
const COLLAPSED_STORAGE_PREFIX = 'lb-cenas-recolhidas:'

/** O aviso depois de enviar: quantos leram, ou que ninguém estava lá para ler. */
export function noteFeedbackText(sent: number | null): string {
  if (sent === null) return 'Não deu para enviar: a sala não está aberta.'
  if (sent === 0) return 'Ninguém está nesta cena'
  return sent === 1 ? 'Recado enviado a 1 jogador' : `Recado enviado a ${sent} jogadores`
}

/** O envio do abalo: devolve quantos ouviram em cada faixa, ou `null` com a sala fechada. */
export type AbaloEnvio = (origem: AbaloOrigem, textos: AbaloTextos, vizinhas: string[]) => AbaloContagem | null

/** O aviso depois do abalo: quantos ouviram em cada faixa (faixa sem ninguém fica de fora). */
export function abaloFeedbackText(porFaixa: AbaloContagem | null): string {
  if (porFaixa === null) return 'Não deu para enviar: a sala não está aberta.'
  const partes = [
    porFaixa.perto > 0 ? `${porFaixa.perto} nesta cena` : '',
    porFaixa.andar > 0 ? `${porFaixa.andar} nas vizinhas` : '',
    porFaixa.longe > 0 ? `${porFaixa.longe} longe` : '',
  ].filter((parte) => parte !== '')
  if (partes.length === 0) return 'Ninguém ouviu: nenhum jogador nas faixas com texto'
  return `Abalo: ${partes.join(', ')}`
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

/** Uma cena para onde a do "Mover para…" pode ir, com o caminho no nome (duas "Taverna" não se confundem). */
interface MoveOption {
  id: string
  label: string
}

interface MoveFormProps {
  sceneName: string
  options: readonly MoveOption[]
  /** Onde ela está hoje: vem escolhido, e escolher o mesmo não move nada. */
  currentParentId: string | null
  onMove(parentId: string | null): void
  onCancel(): void
}

/**
 * "Mover para…": o caminho sem arrasto (teclado, leitor de tela, touchpad
 * difícil), dentro da linha como o recado. Lista nativa — setas, inicial e
 * leitor de tela de graça — já na pasta de hoje; Enter na lista ou "Mover"
 * move; Esc cancela. A cena e as de dentro dela não estão na lista: não dá
 * para pôr uma pasta dentro de si mesma.
 */
function MoveForm({ sceneName, options, currentParentId, onMove, onCancel }: MoveFormProps) {
  const fieldId = useId()
  const current = currentParentId ?? FIRST_LEVEL
  const [choice, setChoice] = useState(current)
  const fieldRef = useRef<HTMLSelectElement | null>(null)
  const unchanged = choice === current

  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  const move = () => {
    if (!unchanged) onMove(choice === FIRST_LEVEL ? null : choice)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    move()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape') {
      // Esc fecha sem mover; não pode chegar ao canvas (lá ele larga a seleção).
      event.preventDefault()
      event.stopPropagation()
      onCancel()
      return
    }
    // A lista nativa não envia o formulário no Enter: aqui ela envia, como um campo de texto.
    if (event.key === 'Enter' && event.target instanceof HTMLSelectElement) {
      event.preventDefault()
      move()
    }
  }

  return (
    <form className="lb-cenas__mover" aria-label={`Mover ${sceneName}`} onSubmit={submit} onKeyDown={onKeyDown}>
      <label className="lb-label" htmlFor={fieldId}>
        Mover {sceneName} para dentro de
      </label>
      <select id={fieldId} ref={fieldRef} className="lb-input" value={choice} onChange={(event) => setChoice(event.target.value)}>
        <option value={FIRST_LEVEL}>Nenhuma (primeiro nível)</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="lb-cenas__acoes">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="lb-btn lb-btn--primary" disabled={unchanged}>
          Mover
        </button>
      </div>
    </form>
  )
}

/** Campo aberto na seção: nome da cena nova, ou novo nome da cena aberta. */
type Editing = { kind: 'create' } | { kind: 'rename'; sceneId: string } | null

/** Uma bolinha da linha. `where` = ela está numa cena de dentro da pasta recolhida, e o rótulo diz qual. */
interface RowPerson extends ScenePerson {
  where?: string
}

interface RowPeople {
  people: RowPerson[]
  pendingRequests: number
}

/**
 * A segunda linha do item: uma bolinha por jogador na cena (cor da ficha,
 * nome no rótulo e no título — o mouse em cima diz quem é) e o selo dos
 * pedidos que esperam o mestre. Fica numa linha própria para sete jogadores
 * não espremerem o nome da cena. Na pasta recolhida entram também os de
 * dentro dela, e o rótulo diz onde cada um está.
 */
function SceneGente({ people }: { people: RowPeople }) {
  return (
    <div className="lb-cenas__gente">
      {people.people.map((person) => {
        const label = person.where === undefined ? person.name : `${person.name}, em ${person.where}`
        return <span key={person.playerId} role="img" className="lb-cenas__pessoa" aria-label={label} title={label} style={{ background: person.color }} />
      })}
      {people.pendingRequests > 0 && <span className="lb-cenas__pedidos">{pendingRequestsLabel(people.pendingRequests)}</span>}
    </div>
  )
}

/** localStorage pode não existir ou lançar (janela privada, dado bloqueado): sem ele, nada vem recolhido. */
function readCollapsed(adventureId: string | null): ReadonlySet<string> {
  if (adventureId === null) return new Set()
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_PREFIX + adventureId)
    const parsed: unknown = raw === null ? [] : JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeCollapsed(adventureId: string | null, ids: ReadonlySet<string>): void {
  if (adventureId === null) return
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_PREFIX + adventureId, JSON.stringify([...ids]))
  } catch {
    // Sem armazenamento, o recolhido vale enquanto a seção está montada.
  }
}

/**
 * As pastas recolhidas da aventura aberta. É conveniência de quem olha, não
 * dado da aventura: mora no localStorage deste computador, não no
 * `adventure.json` — recolher não pede Salvar. Sobrevive a trocar de aba e a
 * reabrir o app; outra aventura tem as suas.
 */
function useCollapsedScenes(adventureId: string | null) {
  const [state, setState] = useState(() => ({ adventureId, ids: readCollapsed(adventureId) }))
  let current = state
  if (state.adventureId !== adventureId) {
    current = { adventureId, ids: readCollapsed(adventureId) }
    setState(current)
  }
  const update = (ids: ReadonlySet<string>) => {
    writeCollapsed(adventureId, ids)
    setState({ adventureId, ids })
  }
  const toggle = (sceneId: string) => {
    const ids = new Set(current.ids)
    if (ids.has(sceneId)) ids.delete(sceneId)
    else ids.add(sceneId)
    update(ids)
  }
  const expand = (sceneIds: readonly string[]) => {
    if (!sceneIds.some((id) => current.ids.has(id))) return
    const ids = new Set(current.ids)
    for (const id of sceneIds) ids.delete(id)
    update(ids)
  }
  return { collapsed: current.ids, toggle, expand }
}

/** As palavras do filtro, sem maiúscula nem acento (a mesma régua do "Buscar objeto"). */
function filterWords(query: string): string[] {
  return normalizeForSearch(query)
    .split(/\s+/)
    .filter((word) => word !== '')
}

/**
 * A cena entra no filtro quando toda palavra aparece no caminho ou no nome, e
 * pelo menos uma no nome: "tav" acha as duas Tavernas, "porto tav" só a de
 * Porto Cinza, e "vila" acha a Vila do Vau sem trazer junto tudo o que ela tem.
 */
function matchesFilter(words: readonly string[], name: string, trail: readonly string[]): boolean {
  const own = normalizeForSearch(name)
  const whole = normalizeForSearch([...trail, name].join(' '))
  return words.every((word) => whole.includes(word)) && words.some((word) => own.includes(word))
}

/** O nível da linha para o CSS: o recuo e os fios da pasta saem de `--lb-cena-nivel`. */
function levelStyle(depth: number): CSSProperties {
  return { '--lb-cena-nivel': String(depth) } as CSSProperties
}

/** O que soltar a cena arrastada ali faria: a dica do fantasma, o destaque do destino e a pasta nova. */
interface DropVerdict {
  tone: 'ok' | 'neutro' | 'erro'
  hint: string
  parentId: string | null
}

const DROP_HINT = 'Solte sobre outra cena para pôr dentro dela'

/** O título da seta da pasta recolhida: quantas cenas ela esconde, contando as de dentro das de dentro. */
function insideCountLabel(count: number): string {
  return count === 1 ? 'Mostrar a cena de dentro' : `Mostrar as ${count} cenas de dentro`
}

/**
 * "Cenas", no topo da aba Mapa: as cenas da aventura, a aberta destacada
 * (`aria-current`), "+ Nova cena", renomear e a "Visão geral" (miniaturas de
 * todas as cenas com as fichas, `SceneOverview.tsx`). O nome da cena é o botão
 * inteiro — trocar de cena é um clique —, e a contagem de tokens fica FORA
 * dele, para o nome acessível do botão ser só o nome da cena.
 *
 * CENAS EM PASTAS: cena dentro de cena (região > cidade > bairro > casa) vira
 * árvore — recuo e fio claro por nível, seta para recolher (a pasta recolhida
 * soma as bolinhas de quem está dentro), arrastar uma cena sobre outra põe
 * dentro, "Mover para…" na cena aberta, e "Filtrar cenas" com o caminho em
 * cinza. Tudo isso é da lista do mestre: o jogador não recebe nada.
 */
export function ScenesSection({
  scenes,
  onSelect,
  onCreate,
  onRename,
  people,
  onNote,
  onQuake,
  maps,
  onMove,
  adventureId = null,
  onGoToPoint,
  towerPlayers = NO_TOWER_PLAYERS,
}: ScenesSectionProps) {
  const [editing, setEditing] = useState<Editing>(null)
  const [draft, setDraft] = useState('')
  /** Janela "Visão geral das cenas" aberta. */
  const [overviewOpen, setOverviewOpen] = useState(false)
  /** O botão "Visão geral": é para ele que o foco volta quando a janela fecha. */
  const overviewButtonRef = useRef<HTMLButtonElement | null>(null)
  // Com uma cena só (mapa solto) não há o que comparar: a vista dela já é o editor.
  const canOverview = maps !== undefined && scenes.length > 1
  /** Janela "Corte da torre" aberta. */
  const [towerOpen, setTowerOpen] = useState(false)
  const towerButtonRef = useRef<HTMLButtonElement | null>(null)
  const canTower = canOverview && onGoToPoint !== undefined
  /** Cena com o recado aberto; `null` = nenhum. */
  const [noting, setNoting] = useState<string | null>(null)
  /** Cena de origem com o "Abalo" aberto; `null` = nenhuma. O aviso sai no mesmo lugar do recado. */
  const [quaking, setQuaking] = useState<string | null>(null)
  /** Aviso do último recado, na linha da cena dele; some sozinho. */
  const [noteFeedback, setNoteFeedback] = useState<{ sceneId: string; text: string } | null>(null)
  /** Cena com o "Mover para…" aberto; `null` = nenhuma. */
  const [moving, setMoving] = useState<string | null>(null)
  /** Aviso da última mudança de pasta, na linha da cena movida; some sozinho. `ok` acende a linha. */
  const [moveFeedback, setMoveFeedback] = useState<{ sceneId: string; text: string; ok: boolean } | null>(null)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const filterRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  /** Quem abriu o campo: o foco volta para ele ao confirmar ou cancelar. */
  const openerRef = useRef<HTMLElement | null>(null)
  const baseId = useId()
  const filterId = `${baseId}-filtro`
  const listId = `${baseId}-lista`
  const { collapsed, toggle, expand } = useCollapsedScenes(adventureId)

  const tree = useMemo(() => sceneTree(scenes), [scenes])
  const rowIndex = useMemo(() => new Map(tree.map((row, index) => [row.entry.id, index])), [tree])
  const hasFolders = tree.some((row) => row.childIds.length > 0)
  const rowOf = (sceneId: string): SceneTreeRow<SceneListItem> | undefined => {
    const index = rowIndex.get(sceneId)
    return index === undefined ? undefined : tree[index]
  }
  const nameOf = (sceneId: string) => rowOf(sceneId)?.entry.name ?? ''
  /** As Salas e os pinos que o "Abalo" oferece como origem. Cena sem mapa aberto (ou sem `maps`): só "sem ponto". */
  const originsOf = (sceneId: string) => {
    const map = maps?.get(sceneId)
    return map === undefined ? [] : origensDaCena(map)
  }
  /** As cenas de fora, da mais de fora para a mais de dentro. */
  const ancestorIdsOf = (sceneId: string): string[] => {
    const chain: string[] = []
    let parent = rowOf(sceneId)?.parentId ?? null
    while (parent !== null) {
      chain.unshift(parent)
      parent = rowOf(parent)?.parentId ?? null
    }
    return chain
  }
  const trailOf = (sceneId: string) => ancestorIdsOf(sceneId).map(nameOf)
  /** A pasta e tudo o que ela tem dentro são linhas seguidas da árvore: [início, fim). */
  const subtreeEnd = (index: number): number => {
    let end = index + 1
    while (end < tree.length && tree[end].depth > tree[index].depth) end += 1
    return end
  }
  const isInside = (sceneId: string, folderId: string) => ancestorIdsOf(sceneId).includes(folderId)

  /** Abre ou fecha a pasta. Fechar leva junto o recado ou o "Mover para…" aberto numa cena lá de dentro. */
  const toggleFolder = (folderId: string) => {
    if (!collapsed.has(folderId)) {
      if (noting !== null && isInside(noting, folderId)) setNoting(null)
      if (quaking !== null && isInside(quaking, folderId)) setQuaking(null)
      if (moving !== null && isInside(moving, folderId)) setMoving(null)
    }
    toggle(folderId)
  }

  const showFilter = scenes.length >= SCENE_FILTER_MIN
  const words = showFilter ? filterWords(query) : []
  const filtering = words.length > 0
  const visibleRows: SceneTreeRow<SceneListItem>[] = []
  if (filtering) {
    for (const row of tree) if (matchesFilter(words, row.entry.name, trailOf(row.entry.id))) visibleRows.push(row)
  } else {
    // Dentro de uma pasta recolhida, pula até a próxima linha do mesmo nível.
    let hiddenBelow: number | null = null
    for (const row of tree) {
      if (hiddenBelow !== null && row.depth > hiddenBelow) continue
      hiddenBelow = null
      visibleRows.push(row)
      if (row.childIds.length > 0 && collapsed.has(row.entry.id)) hiddenBelow = row.depth
    }
  }
  /** Com filtro digitado, a cena que o Enter do campo abre: a primeira achada que abre. */
  const enterTarget = filtering ? (visibleRows.find((row) => row.entry.available) ?? null) : null
  const trimmedQuery = query.trim()
  const filterSummary = !filtering
    ? ''
    : visibleRows.length === 0
      ? `Nenhuma cena com “${trimmedQuery}”. Tente só o começo do nome.`
      : `${visibleRows.length} de ${scenes.length} ${scenes.length === 1 ? 'cena' : 'cenas'}`

  const verdictFor = (current: SceneDrag): DropVerdict => {
    const target = current.target
    const neutral = (hint: string): DropVerdict => ({ tone: 'neutro', hint, parentId: null })
    if (target === null) return neutral(DROP_HINT)
    const parentId = rowOf(current.sceneId)?.parentId ?? null
    if (target.kind === 'raiz') return parentId === null ? neutral('Já está no primeiro nível') : { tone: 'ok', hint: 'No primeiro nível', parentId: null }
    if (target.sceneId === current.sceneId) return neutral(DROP_HINT)
    if (isInside(target.sceneId, current.sceneId)) {
      return { tone: 'erro', hint: `Não dá: ${nameOf(target.sceneId)} está dentro de ${nameOf(current.sceneId)}`, parentId: null }
    }
    if (target.sceneId === parentId) return neutral(`Já está dentro de ${nameOf(target.sceneId)}`)
    return { tone: 'ok', hint: `Dentro de ${nameOf(target.sceneId)}`, parentId: target.sceneId }
  }

  /** Muda a pasta e mostra onde a cena foi parar: a pasta de destino abre, e a linha avisa. */
  const applyMove = (sceneId: string, parentId: string | null) => {
    const name = nameOf(sceneId)
    if (onMove === undefined || !onMove(sceneId, parentId)) {
      setMoveFeedback({ sceneId, text: `Não deu para mover ${name}.`, ok: false })
      return
    }
    if (parentId !== null) expand([...ancestorIdsOf(parentId), parentId])
    setMoveFeedback({
      sceneId,
      text: parentId === null ? `${name} voltou ao primeiro nível.` : `${name} agora está dentro de ${nameOf(parentId)}.`,
      ok: true,
    })
  }

  const drag = useSceneDrag((sceneId, target) => {
    const verdict = verdictFor({ sceneId, target })
    if (verdict.tone === 'ok') applyMove(sceneId, verdict.parentId)
    else if (verdict.tone === 'erro') setMoveFeedback({ sceneId, text: `${verdict.hint}.`, ok: false })
  })
  const dragging = drag.drag
  const verdict = dragging === null ? null : verdictFor(dragging)
  const draggedHasParent = dragging !== null && (rowOf(dragging.sceneId)?.parentId ?? null) !== null

  const activeId = scenes.find((scene) => scene.active)?.id ?? null
  const revealedActive = useRef(activeId)
  // A cena aberta mudou (lista, pino de viagem, Voltar): as pastas de fora dela
  // abrem, para a linha destacada estar à vista. Na montagem não: quem fechou
  // a pasta da cena aberta e trocou de aba acha a lista como deixou.
  useEffect(() => {
    if (activeId === revealedActive.current) return
    revealedActive.current = activeId
    if (activeId !== null) expand(ancestorIdsOf(activeId))
  }, [activeId])

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

  useEffect(() => {
    if (moveFeedback === null) return
    if (moveFeedback.ok) {
      // A cena foi parar em outro ponto da lista (dentro de outra pasta): ela fica à vista.
      const row = Array.from(listRef.current?.children ?? []).find((li) => li instanceof HTMLElement && li.dataset.cenaId === moveFeedback.sceneId)
      row?.scrollIntoView?.({ block: 'nearest' })
    }
    const timer = setTimeout(() => setMoveFeedback(null), NOTE_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [moveFeedback])

  const rememberOpener = () => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }

  /** Depois do render: o botão que abriu pode ter sido trocado de lugar. */
  const refocusOpener = () => {
    const opener = openerRef.current
    openerRef.current = null
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus()
    })
  }

  const startEditing = (next: NonNullable<Editing>, initial: string) => {
    rememberOpener()
    setNoting(null)
    setQuaking(null)
    setMoving(null)
    setDraft(initial)
    setEditing(next)
  }

  const startNote = (sceneId: string) => {
    rememberOpener()
    setEditing(null)
    setMoving(null)
    setQuaking(null)
    setNoteFeedback(null)
    setNoting(sceneId)
  }

  const startQuake = (sceneId: string) => {
    rememberOpener()
    setEditing(null)
    setMoving(null)
    setNoting(null)
    setNoteFeedback(null)
    setQuaking(sceneId)
  }

  const startMove = (sceneId: string) => {
    rememberOpener()
    setEditing(null)
    setNoting(null)
    setQuaking(null)
    setMoveFeedback(null)
    setMoving(sceneId)
  }

  const sendNote = (sceneId: string, text: string) => {
    const sent = onNote?.(sceneId, text) ?? null
    setNoteFeedback({ sceneId, text: noteFeedbackText(sent) })
    closeNote()
  }

  /** Um envio só: as vizinhas saem da árvore desta lista (a mesma pasta, a de fora e as de dentro). */
  const sendQuake = (sceneId: string, origem: AbaloOrigem, textos: AbaloTextos) => {
    const porFaixa = onQuake?.(origem, textos, [...cenasVizinhas(scenes, sceneId)]) ?? null
    setNoteFeedback({ sceneId, text: abaloFeedbackText(porFaixa) })
    closeQuake()
  }

  const closeQuake = () => {
    setQuaking(null)
    refocusOpener()
  }

  const close = () => {
    setEditing(null)
    refocusOpener()
  }

  const closeNote = () => {
    setNoting(null)
    refocusOpener()
  }

  const closeMove = () => {
    setMoving(null)
    refocusOpener()
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

  const closeTower = () => {
    setTowerOpen(false)
    towerButtonRef.current?.focus()
  }

  /** Nome de cena no corte: a mesma regra da miniatura — a já aberta só fecha. */
  const pickSceneFromTower = (sceneId: string) => {
    const picked = scenes.find((scene) => scene.id === sceneId)
    closeTower()
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

  /** Tecla que a lista ou o filtro usou não segue para o mapa: seta lá empurra o objeto selecionado, Esc larga a seleção. */
  const consume = (event: KeyboardEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  /** Os nomes que as setas alcançam: cena cujo arquivo sumiu tem o nome desligado e fica de fora. */
  const nameButtons = (): HTMLButtonElement[] =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-cena-nome]') ?? []).filter((button) => !button.disabled)
  const nameButtonOf = (sceneId: string) => nameButtons().find((button) => button.dataset.cenaNome === sceneId)

  const onFilterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      const first = nameButtons()[0]
      if (first === undefined) return
      consume(event)
      first.focus()
      return
    }
    if (event.key === 'Enter') {
      // Sem nada digitado o Enter não escolhe por ninguém.
      if (event.nativeEvent.isComposing || enterTarget === null) return
      consume(event)
      onSelect(enterTarget.entry.id)
      return
    }
    if (event.key === 'Escape') {
      consume(event)
      // Primeiro Esc apaga o filtro; o segundo, com o campo vazio, sai dele.
      if (query !== '') setQuery('')
      else event.currentTarget.blur()
    }
  }

  /**
   * Setas no nome (ou na seta) de uma cena, como numa árvore de pastas: para
   * cima e para baixo andam pelas linhas à vista; direita abre a pasta e,
   * aberta, entra nela; esquerda fecha a pasta aberta e, fechada, volta à de
   * fora. Letra não é atalho aqui: com o foco no painel ela continua sendo a
   * ferramenta do mapa.
   */
  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!(event.target instanceof HTMLElement)) return
    const sceneId = event.target.dataset.cenaNome ?? event.target.dataset.cenaPasta
    if (sceneId === undefined) return
    const buttons = nameButtons()
    const index = buttons.findIndex((button) => button.dataset.cenaNome === sceneId)
    const row = rowOf(sceneId)
    const isFolder = !filtering && row !== undefined && row.childIds.length > 0
    let next: HTMLElement | null | undefined
    switch (event.key) {
      case 'ArrowDown':
        next = buttons[Math.min(index + 1, buttons.length - 1)]
        break
      case 'ArrowUp':
        next = index > 0 ? buttons[index - 1] : filterRef.current
        break
      case 'Home':
        next = buttons[0]
        break
      case 'End':
        next = buttons[buttons.length - 1]
        break
      case 'ArrowRight':
        if (isFolder && collapsed.has(sceneId)) toggleFolder(sceneId)
        else if (isFolder) next = nameButtonOf(row.childIds[0])
        break
      case 'ArrowLeft':
        if (isFolder && !collapsed.has(sceneId)) toggleFolder(sceneId)
        else if (!filtering && row !== undefined && row.parentId !== null) next = nameButtonOf(row.parentId)
        break
      default:
        return
    }
    consume(event)
    next?.focus()
  }

  /** Só o nome e o corpo da linha pegam a cena: os outros botões, o recado e o "Mover para…" são de quem está neles. */
  const onRowPointerDown = (sceneId: string, event: ReactPointerEvent<HTMLLIElement>) => {
    if (onMove === undefined || sceneId === '' || !(event.target instanceof Element)) return
    if (event.target.closest('form, input, textarea, select') !== null) return
    const button = event.target.closest('button')
    if (button !== null && !button.classList.contains('lb-cenas__nome')) return
    drag.begin(sceneId, event)
  }

  /** A linha da cena: o que ela mostra a mais quando é uma pasta recolhida. */
  const peopleOf = (index: number, collapsedFolder: boolean): RowPeople | null => {
    const row = tree[index]
    const own = people?.get(row.entry.id)
    const list: RowPerson[] = own === undefined ? [] : [...own.people]
    let pendingRequests = own?.pendingRequests ?? 0
    if (collapsedFolder) {
      for (const inner of tree.slice(index + 1, subtreeEnd(index))) {
        const here = people?.get(inner.entry.id)
        if (here === undefined) continue
        for (const person of here.people) list.push({ ...person, where: inner.entry.name })
        pendingRequests += here.pendingRequests
      }
    }
    return list.length > 0 || pendingRequests > 0 ? { people: list, pendingRequests } : null
  }

  const moveOptionsFor = (sceneId: string): MoveOption[] => {
    const start = rowIndex.get(sceneId) ?? -1
    const end = start < 0 ? start : subtreeEnd(start)
    return tree
      .filter((_row, index) => index < start || index >= end)
      .map((row) => ({ id: row.entry.id, label: [...trailOf(row.entry.id), row.entry.name].join(SCENE_TRAIL_SEPARATOR) }))
  }

  const inputLabel = editing?.kind === 'create' ? 'Nome da nova cena' : 'Novo nome da cena'

  return (
    <CollapsibleSection id="scenes" title="Cenas" defaultOpen>
      {showFilter && (
        <div className="lb-cenas__filtro">
          <label className="lb-label" htmlFor={filterId}>
            Filtrar cenas
          </label>
          <div className="lb-objetos__campo">
            <span className="lb-objetos__lupa" aria-hidden="true">
              <SearchIcon size={16} />
            </span>
            <input
              id={filterId}
              ref={filterRef}
              type="search"
              className="lb-input lb-objetos__busca"
              placeholder="Parte do nome, como “tav”"
              value={query}
              autoComplete="off"
              spellCheck={false}
              aria-controls={listId}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onFilterKeyDown}
            />
            {query !== '' && (
              <button
                type="button"
                className="lb-iconbtn lb-iconbtn--sm lb-objetos__limpar"
                aria-label="Limpar filtro"
                title="Limpar filtro"
                onClick={() => {
                  setQuery('')
                  filterRef.current?.focus()
                }}
              >
                <CloseIcon size={14} />
              </button>
            )}
          </div>
          <p className="lb-cenas__resumo" role="status">
            {filterSummary}
          </p>
        </div>
      )}
      <ul ref={listRef} id={listId} className="lb-cenas" aria-label="Cenas da aventura" onKeyDown={onListKeyDown}>
        {visibleRows.map((row) => {
          const scene = row.entry
          const index = rowIndex.get(scene.id) ?? 0
          const isFolder = !filtering && row.childIds.length > 0
          const collapsedFolder = isFolder && collapsed.has(scene.id)
          const here = peopleOf(index, collapsedFolder)
          const trail = filtering ? trailOf(scene.id) : []
          const pathId = `${baseId}-caminho-${index}`
          const depth = filtering ? 0 : Math.min(row.depth, MAX_VISUAL_DEPTH)
          const targeted = dragging?.target?.kind === 'cena' && dragging.target.sceneId === scene.id
          const alvo = targeted && verdict !== null ? (verdict.tone === 'ok' ? 'dentro' : verdict.tone === 'erro' ? 'invalido' : undefined) : undefined
          // A cena aberta está escondida nesta pasta recolhida: a borda da pasta avisa.
          const guardsActive = collapsedFolder && tree.slice(index + 1, subtreeEnd(index)).some((inner) => inner.entry.active)
          const classes = [
            'lb-cenas__item',
            scene.active ? 'lb-cenas__item--ativa' : '',
            depth > 0 ? 'lb-cenas__item--dentro' : '',
            guardsActive ? 'lb-cenas__item--guarda-ativa' : '',
          ]
            .filter((name) => name !== '')
            .join(' ')
          return (
            <li
              key={scene.id || 'cena-solta'}
              className={classes}
              style={levelStyle(depth)}
              aria-level={row.depth + 1}
              data-cena-id={scene.id === '' ? undefined : scene.id}
              data-arrastando={dragging?.sceneId === scene.id ? 'true' : undefined}
              data-alvo={alvo}
              data-movida={moveFeedback?.ok === true && moveFeedback.sceneId === scene.id ? 'true' : undefined}
              data-enter={enterTarget?.entry.id === scene.id ? 'true' : undefined}
              onPointerDown={(event) => onRowPointerDown(scene.id, event)}
            >
              {hasFolders &&
                !filtering &&
                (isFolder ? (
                  // A seta abre e fecha a pasta sem trocar de cena; o nome continua sendo o clique que troca.
                  <button
                    type="button"
                    className="lb-cenas__pasta"
                    data-cena-pasta={scene.id}
                    aria-expanded={!collapsedFolder}
                    aria-label={`Cenas dentro de ${scene.name}`}
                    title={collapsedFolder ? insideCountLabel(subtreeEnd(index) - index - 1) : 'Esconder as cenas de dentro'}
                    onClick={() => toggleFolder(scene.id)}
                  >
                    <ChevronDownIcon size={14} />
                  </button>
                ) : (
                  <span className="lb-cenas__recuo" aria-hidden="true" />
                ))}
              <button
                type="button"
                className="lb-cenas__nome"
                data-cena-nome={scene.id}
                aria-current={scene.active ? 'true' : undefined}
                aria-describedby={trail.length > 0 ? pathId : undefined}
                disabled={!scene.available}
                title={scene.available ? undefined : 'O arquivo desta cena não foi encontrado'}
                onClick={() => {
                  if (drag.swallowClick()) return
                  onSelect(scene.id)
                }}
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
              {/* Na cena aberta, como o renomear; montado também com o formulário aberto: é para ele que o foco volta. */}
              {scene.active && onMove !== undefined && scene.id !== '' && (
                <button
                  type="button"
                  className="lb-cenas__renomear lb-cenas__mover-btn"
                  aria-label={`Mover ${scene.name} para…`}
                  aria-expanded={moving === scene.id}
                  title="Mover para dentro de outra cena"
                  onClick={() => (moving === scene.id ? closeMove() : startMove(scene.id))}
                >
                  <MoveIntoIcon size={14} />
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
              {/* ABALO: montado também com o formulário aberto, como o Recado — é para ele que o foco volta. */}
              {onQuake !== undefined && scene.id !== '' && (
                <button
                  type="button"
                  className="lb-cenas__recado-btn"
                  aria-label={`Abalo a partir de ${scene.name}`}
                  aria-expanded={quaking === scene.id}
                  title="Abalo: um texto por distância para todas as cenas"
                  disabled={!scene.available}
                  onClick={() => (quaking === scene.id ? closeQuake() : startQuake(scene.id))}
                >
                  <span aria-hidden="true">≋</span>
                </button>
              )}
              {trail.length > 0 && (
                <span id={pathId} className="lb-cenas__caminho">
                  {trail.join(SCENE_TRAIL_SEPARATOR)}
                </span>
              )}
              {here !== null && <SceneGente people={here} />}
              {onNote !== undefined && noting === scene.id && (
                <NoteForm sceneName={scene.name} onSend={(text) => sendNote(scene.id, text)} onCancel={closeNote} />
              )}
              {onQuake !== undefined && quaking === scene.id && (
                <AbaloForm
                  sceneId={scene.id}
                  sceneName={scene.name}
                  origens={originsOf(scene.id)}
                  onSend={(origem, textos) => sendQuake(scene.id, origem, textos)}
                  onCancel={closeQuake}
                />
              )}
              {onMove !== undefined && moving === scene.id && (
                <MoveForm
                  sceneName={scene.name}
                  options={moveOptionsFor(scene.id)}
                  currentParentId={row.parentId}
                  onMove={(parentId) => {
                    applyMove(scene.id, parentId)
                    closeMove()
                  }}
                  onCancel={closeMove}
                />
              )}
              {noteFeedback?.sceneId === scene.id && (
                <p className="lb-cenas__recado-aviso" role="status">
                  {noteFeedback.text}
                </p>
              )}
              {moveFeedback?.sceneId === scene.id && (
                <p className="lb-cenas__recado-aviso" role="status">
                  {moveFeedback.text}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      {dragging !== null && draggedHasParent && (
        <div className="lb-cenas__raiz" data-cena-raiz="" data-alvo={dragging.target?.kind === 'raiz' && verdict?.tone === 'ok' ? 'dentro' : undefined}>
          Soltar aqui: primeiro nível
        </div>
      )}
      <div className="lb-cenas__rodape">
        {/* Sempre montado: é para ele que o foco volta depois de criar ou cancelar. */}
        <button type="button" className="lb-btn" onClick={() => startEditing({ kind: 'create' }, `Cena ${scenes.length + 1}`)}>
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
        {canTower && (
          <button
            ref={towerButtonRef}
            type="button"
            className="lb-btn"
            aria-haspopup="dialog"
            aria-expanded={towerOpen}
            title="Os andares empilhados, com os poços e quem está em cada um"
            onClick={() => setTowerOpen(true)}
          >
            Corte da torre
          </button>
        )}
      </div>
      {overviewOpen && canOverview && maps !== undefined && (
        <SceneOverviewDialog scenes={tree.map((row) => row.entry)} maps={maps} onPick={pickFromOverview} onClose={closeOverview} />
      )}
      {towerOpen && maps !== undefined && onGoToPoint !== undefined && canTower && (
        <CorteDaTorreDialog
          scenes={scenes}
          maps={maps}
          players={towerPlayers}
          onPickScene={pickSceneFromTower}
          onPickPoint={(ponto) => {
            closeTower()
            onGoToPoint(ponto.sceneId, ponto.x, ponto.y)
          }}
          onClose={closeTower}
        />
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
      {dragging !== null &&
        verdict !== null &&
        createPortal(
          // Só o olho precisa dele: o caminho sem arrasto é o "Mover para…".
          <div ref={drag.ghostRef} className="lb-cenas__fantasma" data-tom={verdict.tone} aria-hidden="true">
            <span className="lb-cenas__fantasma-nome">{nameOf(dragging.sceneId)}</span>
            <span className="lb-cenas__fantasma-dica">{verdict.hint}</span>
          </div>,
          document.body,
        )}
    </CollapsibleSection>
  )
}
