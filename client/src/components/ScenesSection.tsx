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
import { ChevronDownIcon, CloseIcon, MoveIntoIcon, SearchIcon } from './icons'
import { useSceneDrag, type SceneDrag } from './sceneDrag'
import { SceneAlarmControls, type ActiveAlarmView } from './SceneAlarmControls'
import { NOTE_MAX_LENGTH } from '../net/protocol'
import { sceneTree, SCENE_PUBLIC_NAME_MAX_LENGTH, SCENE_TRAIL_SEPARATOR, type SceneTreeRow } from '../lib/adventure'
import { matchesSceneSearch, SCENE_FILTER_MIN, sceneSearchWords } from '../lib/sceneSearch'
import { pendingRequestsLabel, type ScenePeople, type ScenePerson, type SceneRoom } from '../lib/party'
import { esperaLonga, minutosDeEspera, rotuloDeEspera, type EsperaPorCena } from '../lib/cenaQueEspera'
import type { SceneDeletionInfo, SceneListItem } from '../stores/adventureStore'
import type { MapData } from '../types/map'

export interface ScenesSectionProps {
  scenes: SceneListItem[]
  /** Um clique troca a cena aberta. */
  onSelect: (sceneId: string) => void
  onCreate: (name: string) => void
  /** Renomear devolve os dois nomes: o do mestre e o NOME PARA OS JOGADORES (vazio = sem). */
  onRename: (sceneId: string, name: string, publicName: string) => void
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
   * sala fechada: a linha fica sem o botão "Recado". `playerIds` vem quando o
   * mestre escolheu quem recebe entre os presentes (só esses); ausente = todos.
   */
  onNote?: (sceneId: string, text: string, playerIds?: readonly string[]) => number | null
  // MENU "…" DA CENA. Ausentes os quatro (mapa solto) = a linha fica sem o
  // "…". Um só ausente = o item dele aparece esmaecido.
  /** "Duplicar": a cópia entra logo abaixo, na mesma pasta, sem as fichas dos jogadores. */
  onDuplicate?: (sceneId: string) => void
  /** "Subir" (`-1`) e "Descer" (`1`): a cena troca de lugar com a irmã de cima ou de baixo, na mesma pasta. */
  onShift?: (sceneId: string, delta: -1 | 1) => void
  /** Chamado só depois da confirmação, e nunca com jogador na cena. */
  onDelete?: (sceneId: string) => void
  /** O que a confirmação de "Apagar cena…" mostra: pinos que ficam soltos, cenas de dentro que sobem e quem ainda está lá. */
  deletionInfo?: (sceneId: string) => SceneDeletionInfo
  /**
   * CENAS EM PASTAS: põe `sceneId` dentro de `parentId` (`null` = primeiro
   * nível). `false` = não deu. Ausente = mapa solto: sem arrastar e sem
   * "Mover para…".
   */
  onMove?: (sceneId: string, parentId: string | null) => boolean
  /** A aventura aberta: as pastas recolhidas são lembradas por aventura, neste computador. */
  adventureId?: string | null
  /**
   * ALARME PARA VÁRIAS CENAS: soa `text` em todas as `sceneIds` de uma vez.
   * Devolve quantos receberam agora, ou `null` se não deu. Ausente = sala
   * fechada: a seção fica sem o "Alarme…".
   */
  onAlarm?: (sceneIds: string[], text: string) => number | null
  /** Encerra o alarme soando. */
  onEndAlarm?: () => void
  /** O alarme soando; `null`/ausente = nenhum. */
  alarm?: ActiveAlarmView | null
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
  // Todos os presentes marcados = o recado da cena inteira (botão "Enviar", sem lista):
  // vira o recado da cena e chega também a quem entrar depois, como antes da escolha existir.
  const wholeScene = !choosing || recipients.length === people.length
  const canSend = !empty && !noOneChosen

  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  const send = () => {
    if (!canSend) return
    if (wholeScene) onSend(text)
    else onSend(text, recipients)
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
          {wholeScene ? 'Enviar' : `Enviar para ${recipients.length}`}
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

/** O que a confirmação diz das cenas de dentro da apagada. Sem nenhuma, não diz nada. */
export function insideScenesText(count: number): string {
  if (count === 0) return ''
  if (count === 1) return 'A cena de dentro dela sobe um nível.'
  return `As ${count} cenas de dentro dela sobem um nível.`
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
      {info.inside > 0 && <p>{insideScenesText(info.inside)}</p>}
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
  maps,
  onDuplicate,
  onShift,
  onDelete,
  deletionInfo,
  onMove,
  adventureId = null,
  onAlarm,
  onEndAlarm,
  alarm,
  paused,
  onTogglePause,
  waitingSince,
  onTogglePlanKnown,
  players,
  onRevealPlanFor,
}: ScenesSectionProps) {
  const waiting = useWaitingMinutes(waitingSince)
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
  const hasSceneMenu = onDuplicate !== undefined || onShift !== undefined || onDelete !== undefined || deletionInfo !== undefined
  const [draft, setDraft] = useState('')
  /** Janela "Visão geral das cenas" aberta. */
  const [overviewOpen, setOverviewOpen] = useState(false)
  /** O botão "Visão geral": é para ele que o foco volta quando a janela fecha. */
  const overviewButtonRef = useRef<HTMLButtonElement | null>(null)
  // Com uma cena só (mapa solto) não há o que comparar: a vista dela já é o editor.
  const canOverview = maps !== undefined && scenes.length > 1
  /** Nome para os jogadores no renomear; o criar não pergunta (a cena nasce sem). */
  const [publicDraft, setPublicDraft] = useState('')
  /** Cena com o recado aberto; `null` = nenhum. */
  const [noting, setNoting] = useState<string | null>(null)
  /** Aviso do último recado (ou da última revelação de planta), na linha da cena; some sozinho. */
  const [noteFeedback, setNoteFeedback] = useState<{ sceneId: string; text: string } | null>(null)
  /** Cena com o "Mover para…" aberto; `null` = nenhuma. */
  const [moving, setMoving] = useState<string | null>(null)
  /** Aviso da última mudança de pasta, na linha da cena movida; some sozinho. `ok` acende a linha. */
  const [moveFeedback, setMoveFeedback] = useState<{ sceneId: string; text: string; ok: boolean } | null>(null)
  const [query, setQuery] = useState('')
  /** Cena com o painel de planta aberto; `null` = nenhum. */
  const [planning, setPlanning] = useState<string | null>(null)
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
      if (moving !== null && isInside(moving, folderId)) setMoving(null)
    }
    toggle(folderId)
  }

  const showFilter = scenes.length >= SCENE_FILTER_MIN
  const words = showFilter ? sceneSearchWords(query) : []
  const filtering = words.length > 0
  const visibleRows: SceneTreeRow<SceneListItem>[] = []
  if (filtering) {
    for (const row of tree) if (matchesSceneSearch(words, row.entry.name, trailOf(row.entry.id))) visibleRows.push(row)
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

  const startEditing = (next: NonNullable<Editing>, initial: string, initialPublic = '') => {
    rememberOpener()
    setNoting(null)
    setMoving(null)
    setPlanning(null)
    setDraft(initial)
    setPublicDraft(initialPublic)
    setEditing(next)
  }

  const startNote = (sceneId: string) => {
    rememberOpener()
    setEditing(null)
    setMoving(null)
    setPlanning(null)
    setNoteFeedback(null)
    setNoting(sceneId)
  }

  const startMove = (sceneId: string) => {
    rememberOpener()
    setEditing(null)
    setNoting(null)
    setMoveFeedback(null)
    setMoving(sceneId)
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

  const sendNote = (sceneId: string, text: string, playerIds?: string[]) => {
    // Sem escolha, a chamada de antes (cena inteira), sem o terceiro argumento.
    const sent = (playerIds === undefined ? onNote?.(sceneId, text) : onNote?.(sceneId, text, playerIds)) ?? null
    setNoteFeedback({ sceneId, text: noteFeedbackText(sent) })
    closeNote()
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

  const menuItems = (row: SceneTreeRow<SceneListItem>): SceneMenuItem[] => {
    const scene = row.entry
    // Subir/Descer andam entre as irmãs (mesma pasta): a ponta que esmaece é a da pasta.
    const siblings = tree.filter((candidate) => candidate.parentId === row.parentId)
    const first = siblings[0]?.entry.id === scene.id
    const last = siblings[siblings.length - 1]?.entry.id === scene.id
    const andClose = (run: () => void) => () => {
      closeMenu(true)
      run()
    }
    return [
      { label: 'Duplicar', disabled: onDuplicate === undefined || !scene.available, onSelect: andClose(() => onDuplicate?.(scene.id)) },
      { label: 'Subir', disabled: onShift === undefined || first, onSelect: andClose(() => onShift?.(scene.id, -1)) },
      { label: 'Descer', disabled: onShift === undefined || last, onSelect: andClose(() => onShift?.(scene.id, 1)) },
      {
        label: 'Apagar cena…',
        // A última cena não se apaga: a aventura sem cena nenhuma não abre.
        disabled: onDelete === undefined || deletionInfo === undefined || scenes.length <= 1,
        onSelect: () => {
          setMenuFor(null)
          setEditing(null)
          setNoting(null)
          setMoving(null)
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
    else onRename(editing.sceneId, draft, publicDraft)
    close()
  }

  // Esc em QUALQUER dos dois campos fecha o formulário.
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
          const menuId = `${menuIdBase}-menu-${index}`
          const menuOpen = menuFor === scene.id
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
          const isPaused = paused?.has(scene.id) === true
          const minutesWaiting = waiting.get(scene.id)
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
              {minutesWaiting !== undefined && <SceneEspera minutes={minutesWaiting} />}
              {scene.active && scene.renamable && editing === null && (
                <button
                  type="button"
                  className="lb-cenas__renomear"
                  aria-label={`Renomear ${scene.name}`}
                  title="Renomear"
                  onClick={() => startEditing({ kind: 'rename', sceneId: scene.id }, scene.name, scene.publicName)}
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
                  items={menuItems(row)}
                  trigger={menuTriggers.current.get(scene.id) ?? null}
                  onClose={closeMenu}
                />
              )}
              {trail.length > 0 && (
                <span id={pathId} className="lb-cenas__caminho">
                  {trail.join(SCENE_TRAIL_SEPARATOR)}
                </span>
              )}
              {scene.publicName !== undefined && (
                // O mestre vê, sem abrir o renomear, que nome o selo "Onde estou" mostra.
                <p className="lb-cenas__publico" title='O selo "Onde estou" de quem está nesta cena'>
                  Jogadores leem: {scene.publicName}
                </p>
              )}
              {here !== null && <SceneGente people={here} />}
              {deleting === scene.id && deletionInfo !== undefined && (
                <DeleteConfirm sceneName={scene.name} info={deletionInfo(scene.id)} onConfirm={() => confirmDelete(scene.id)} onCancel={cancelDelete} />
              )}
              {onNote !== undefined && noting === scene.id && (
                <NoteForm
                  label={`Recado para quem está em ${scene.name}`}
                  people={people?.get(scene.id)?.people ?? NO_PEOPLE}
                  onSend={(text, playerIds) => sendNote(scene.id, text, playerIds)}
                  onCancel={closeNote}
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
        <SceneOverviewDialog scenes={tree.map((row) => row.entry)} maps={maps} onPick={pickFromOverview} onClose={closeOverview} />
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
          {editing.kind === 'rename' && (
            <div className="lb-field">
              <label className="lb-label" htmlFor="lb-cena-publico">
                Nome para os jogadores (opcional)
              </label>
              <input
                id="lb-cena-publico"
                className="lb-input"
                value={publicDraft}
                maxLength={SCENE_PUBLIC_NAME_MAX_LENGTH}
                placeholder="Ex.: 1º andar"
                aria-describedby="lb-cena-publico-dica"
                onChange={(event) => setPublicDraft(event.target.value)}
                onKeyDown={onInputKeyDown}
              />
              <p id="lb-cena-publico-dica" className="lb-cenas__dica">
                Aparece no canto da tela de quem está nesta cena. Vazio: os jogadores não veem nome nenhum.
              </p>
            </div>
          )}
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
      {onAlarm !== undefined && onEndAlarm !== undefined && (
        <SceneAlarmControls scenes={scenes} alarm={alarm ?? null} onAlarm={onAlarm} onEndAlarm={onEndAlarm} />
      )}
    </CollapsibleSection>
  )
}
