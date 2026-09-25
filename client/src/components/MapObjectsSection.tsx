import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { CollapsibleSection } from './CollapsibleSection'
import { CloseIcon, SearchIcon, TokenIcon } from './icons'
import { searchAdventure, type AdventureHit, type SceneSearchSource } from '../lib/buscaNaAventura'
import type { SendCandidate } from '../lib/gatherParty'
import { filterMapObjects, mapObjectsOf, MAP_OBJECT_GROUPS, type MapObjectEntry } from '../lib/mapObjects'
import type { AlvoDeMandar, ResultadoDeMandar } from '../stores/buscaDoMestre'
import type { MapData } from '../types/map'

export interface MapObjectsSectionProps {
  /** A cena aberta: a lista sem busca é dela e de nenhuma outra. */
  map: MapData
  /** `key` do objeto selecionado no editor (`currentObjectKey`): a linha dele fica marcada. */
  currentKey: string | null
  /** Clique (ou Enter na busca) numa linha: seleciona e leva a câmera até o objeto. */
  onGoTo: (entry: MapObjectEntry) => void
  /** Muda a cada Ctrl+K: abre a seção e põe o cursor na busca. */
  searchRequest?: number
  /**
   * BUSCA DO MESTRE: as OUTRAS cenas da aventura (`fontesDaBusca`). Com algo
   * digitado, o grupo "Outras cenas" lista o que achou nelas. Ausente ou vazio
   * (mapa solto) = só a cena aberta, como sempre.
   */
  otherScenes?: readonly SceneSearchSource[]
  /** Clique (ou Enter) num achado de outra cena: abre a cena e vai até ele (`irAoAchado`). */
  onGoToOther?: (hit: AdventureHit) => void
  /** Jogadores com ficha que o mestre pode mandar a um achado. Vazio ou ausente = sem "Mandar ficha". */
  senders?: readonly SendCandidate[]
  /** "Mandar ficha para cá" confirmado: quem vai e para onde. A resposta vira o aviso da seção. */
  onSendHere?: (playerId: string, target: AlvoDeMandar) => ResultadoDeMandar
}

/**
 * "Objetos do mapa", na aba Mapa: busca e lista, pelo nome, das salas, portas,
 * pinos, tokens e textos da cena aberta. Clicar numa linha seleciona o objeto
 * e leva a câmera do editor até ele (`stores/mapObjectNavigation.ts`).
 *
 * Com aventura, a busca também procura salas, pinos e fichas nas OUTRAS cenas
 * (`lib/buscaNaAventura.ts`): cada achado mostra o caminho de onde mora, e o
 * clique abre a cena dele. Sala e pino, daqui ou de lá, ganham "Mandar ficha".
 *
 * Nasce recolhida e o corpo só existe com ela aberta (`lazy`): numa mesa com
 * trinta salas a lista é longa, e fechada ela não custa nada nem repete na
 * página os nomes que o painel Grupo e as Cenas já mostram.
 */
export function MapObjectsSection({ searchRequest = 0, ...rest }: MapObjectsSectionProps) {
  /** Último Ctrl+K já atendido. Mora aqui, fora do corpo que monta e desmonta com a seção. */
  const consumedSearch = useRef(searchRequest)
  return (
    <CollapsibleSection id="objects" title="Objetos do mapa" defaultOpen={false} lazy openRequest={searchRequest}>
      <ObjectFinder {...rest} searchRequest={searchRequest} consumedSearch={consumedSearch} />
    </CollapsibleSection>
  )
}

interface ObjectFinderProps extends Omit<MapObjectsSectionProps, 'searchRequest'> {
  searchRequest: number
  consumedSearch: RefObject<number>
}

function countLabel(count: number): string {
  return count === 1 ? '1 objeto' : `${count} objetos`
}

/**
 * Em miniatura, como o objeto aparece no minimapa: o chão da sala na cor dele,
 * o retângulo pequeno da porta, a cabeça de latão do pino (escura no de
 * viagem), o disco do token na cor da ficha e o "T" do rótulo.
 */
function ObjectMark({ entry }: { entry: Pick<MapObjectEntry, 'kind' | 'travel' | 'color'> }) {
  const variant = entry.kind === 'pin' && entry.travel ? 'pin-viagem' : entry.kind
  return (
    <span
      className={`lb-objetos__marca lb-objetos__marca--${variant}`}
      style={entry.color === null ? undefined : { background: entry.color }}
      aria-hidden="true"
    >
      {entry.kind === 'text' ? 'T' : null}
    </span>
  )
}

/** O que o Enter da busca abre: um objeto da cena aberta ou um achado de outra. */
type EnterTarget = { where: 'aqui'; entry: MapObjectEntry } | { where: 'fora'; hit: AdventureHit }

/** A pergunta "Mandar quem para …?" aberta: em que linha e para onde. */
interface SendPrompt {
  rowKey: string
  target: AlvoDeMandar
}

/** Só sala e pino recebem ficha: ficha em cima de ficha, porta ou texto não é lugar. */
function canReceive(kind: MapObjectEntry['kind']): boolean {
  return kind === 'room' || kind === 'pin'
}

function ObjectFinder({ map, currentKey, onGoTo, searchRequest, consumedSearch, otherScenes, onGoToOther, senders, onSendHere }: ObjectFinderProps) {
  const [query, setQuery] = useState('')
  /** Linha que o Tab alcança: a última que teve foco. Sem ela, a marcada; sem esta, a primeira. */
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [sendPrompt, setSendPrompt] = useState<SendPrompt | null>(null)
  /** O que o último "Mandar ficha" fez, dito ao mestre até a próxima busca. */
  const [sendNotice, setSendNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const promptRef = useRef<HTMLDivElement | null>(null)
  const fieldId = useId()
  const listId = useId()
  const objects = useMemo(() => mapObjectsOf(map), [map])
  const results = useMemo(() => filterMapObjects(objects, query), [objects, query])
  const hasOtherScenes = otherScenes !== undefined && otherScenes.length > 0
  const elsewhere = useMemo(() => searchAdventure(otherScenes ?? [], query), [otherScenes, query])
  const canSend = onSendHere !== undefined && senders !== undefined && senders.length > 0

  useEffect(() => {
    if (searchRequest === consumedSearch.current) return
    consumedSearch.current = searchRequest
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [searchRequest, consumedSearch])

  // A pergunta abre com o foco no primeiro jogador: escolher é uma tecla só.
  useEffect(() => {
    if (sendPrompt !== null) promptRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [sendPrompt])

  if (objects.length === 0 && !hasOtherScenes) {
    return <p className="lb-objetos__vazio">Esta cena ainda não tem sala, porta, pino, token nem texto.</p>
  }

  const keys = [...results.map((entry) => entry.key), ...elsewhere.hits.map((hit) => hit.key)]
  const tabKey = focusKey !== null && keys.includes(focusKey) ? focusKey : currentKey !== null && keys.includes(currentKey) ? currentKey : keys[0] ?? null
  const trimmed = query.trim()
  /** Com busca digitada, o primeiro resultado é o que o Enter abre — e a linha dele mostra isso. A cena aberta vem antes. */
  const firstHit = elsewhere.hits[0]
  const enterTarget: EnterTarget | null =
    trimmed === '' ? null : results[0] !== undefined ? { where: 'aqui', entry: results[0] } : firstHit !== undefined ? { where: 'fora', hit: firstHit } : null
  const enterKey = enterTarget === null ? null : enterTarget.where === 'aqui' ? enterTarget.entry.key : enterTarget.hit.key
  const elsewhereLabel = elsewhere.total === 0 ? '' : ` · ${elsewhere.total} em outras cenas`
  const summary =
    trimmed === ''
      ? objects.length === 0
        ? 'Esta cena ainda não tem objeto. Digite para buscar nas outras cenas.'
        : countLabel(objects.length)
      : results.length === 0 && elsewhere.total === 0
        ? `Nenhum objeto com “${trimmed}”. Tente só o começo do nome.`
        : results.length === 0
          ? `Nenhum nesta cena${elsewhereLabel}`
          : `${results.length} de ${countLabel(objects.length)}${elsewhereLabel}`

  const rowButtons = (): HTMLButtonElement[] => [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-objeto]') ?? [])]

  const goTo = (target: EnterTarget) => {
    if (target.where === 'aqui') onGoTo(target.entry)
    else onGoToOther?.(target.hit)
  }

  const targetOf = (target: EnterTarget): AlvoDeMandar | null => {
    if (target.where === 'aqui') return canReceive(target.entry.kind) ? { sceneId: null, objectKey: target.entry.key, name: target.entry.name } : null
    return canReceive(target.hit.kind) ? { sceneId: target.hit.sceneId, objectKey: target.hit.objectKey, name: target.hit.name } : null
  }

  const openSendPrompt = (rowKey: string, target: AlvoDeMandar) => {
    setSendNotice(null)
    setSendPrompt({ rowKey, target })
  }

  /** Fecha a pergunta sem mandar; o foco volta à linha de onde ela saiu. */
  const cancelSendPrompt = () => {
    const rowKey = sendPrompt?.rowKey
    rowButtons()
      .find((button) => button.dataset.objeto === rowKey)
      ?.focus()
    setSendPrompt(null)
  }

  const send = (playerId: string) => {
    if (sendPrompt === null || onSendHere === undefined) return
    const result = onSendHere(playerId, sendPrompt.target)
    setSendPrompt(null)
    setSendNotice(result.mensagem)
    // A linha pode ter mudado de grupo (o mestre foi junto para a outra cena): o foco fica na busca.
    inputRef.current?.focus()
  }

  const clearSearch = () => {
    setQuery('')
    inputRef.current?.focus()
  }

  /** Tecla que a busca usou não segue para o mapa (Esc lá larga a seleção). */
  const consume = (event: KeyboardEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      const first = rowButtons()[0]
      if (first === undefined) return
      consume(event)
      first.focus()
      return
    }
    if (event.key === 'Enter') {
      // Sem nada digitado o Enter não escolhe por ninguém.
      if (event.nativeEvent.isComposing || enterTarget === null || enterKey === null) return
      consume(event)
      if (event.shiftKey) {
        const target = canSend ? targetOf(enterTarget) : null
        if (target !== null) openSendPrompt(enterKey, target)
        return
      }
      goTo(enterTarget)
      return
    }
    if (event.key === 'Escape') {
      consume(event)
      // Primeiro Esc apaga a busca; o segundo, com o campo vazio, sai dele.
      if (query !== '') setQuery('')
      else event.currentTarget.blur()
    }
  }

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = rowButtons()
    const index = buttons.findIndex((button) => button === event.target)
    if (index < 0) return
    let next: HTMLElement | null | undefined
    switch (event.key) {
      case 'ArrowDown':
        next = buttons[Math.min(index + 1, buttons.length - 1)]
        break
      case 'ArrowUp':
        next = index === 0 ? inputRef.current : buttons[index - 1]
        break
      case 'Home':
        next = buttons[0]
        break
      case 'End':
        next = buttons[buttons.length - 1]
        break
      case 'ArrowLeft':
      case 'ArrowRight':
        next = null
        break
      case 'Delete':
      case 'Backspace':
        // As setas andam o FOCO sem selecionar; o Delete do mapa apaga o que está
        // SELECIONADO. Com o foco noutra linha, ele apagaria um objeto que não é
        // o da linha em que a pessoa está — então ali ele não faz nada.
        if (buttons[index].dataset.objeto !== currentKey) consume(event)
        return
      default:
        return
    }
    // Seta com o foco num botão chegaria ao mapa, e lá ela EMPURRA o objeto
    // selecionado — justamente o que a linha acabou de selecionar.
    consume(event)
    next?.focus()
  }

  const onPromptKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(promptRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const index = buttons.findIndex((button) => button === event.target)
    switch (event.key) {
      case 'Escape':
        // Esc fecha sem mandar; não pode chegar ao canvas (Esc lá larga a seleção).
        consume(event)
        cancelSendPrompt()
        return
      case 'ArrowDown':
        consume(event)
        buttons[Math.min(index + 1, buttons.length - 1)]?.focus()
        return
      case 'ArrowUp':
        consume(event)
        buttons[Math.max(index - 1, 0)]?.focus()
        return
      case 'ArrowLeft':
      case 'ArrowRight':
        // Seta com o foco aqui não pode empurrar o objeto selecionado no mapa.
        consume(event)
        return
      default:
        return
    }
  }

  /** Uma linha da lista: o botão que vai até lá e, quando cabe, o "Mandar ficha" ao lado — e a pergunta aberta dela. */
  const renderRow = (rowKey: string, target: EnterTarget, content: ReactNode, extra: { current: boolean; title: string | undefined }) => {
    const sendTarget = canSend ? targetOf(target) : null
    const promptOpen = sendPrompt !== null && sendPrompt.rowKey === rowKey
    return (
      <li key={rowKey} className="lb-objetos__linha">
        <div className="lb-objetos__linha-acoes">
          <button
            type="button"
            data-objeto={rowKey}
            data-enter={rowKey === enterKey ? 'true' : undefined}
            className={target.where === 'fora' ? 'lb-objetos__item lb-objetos__item--fora' : 'lb-objetos__item'}
            aria-current={extra.current ? 'true' : undefined}
            aria-keyshortcuts={sendTarget === null ? undefined : 'Shift+Enter'}
            tabIndex={rowKey === tabKey ? 0 : -1}
            title={extra.title}
            onFocus={() => setFocusKey(rowKey)}
            onClick={() => goTo(target)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !event.shiftKey || sendTarget === null) return
              // Shift+Enter pergunta quem vai para lá; o Enter sozinho continua indo.
              consume(event)
              openSendPrompt(rowKey, sendTarget)
            }}
          >
            {content}
          </button>
          {sendTarget !== null && (
            <button
              type="button"
              className="lb-iconbtn lb-iconbtn--sm lb-objetos__mandar"
              aria-label={`Mandar ficha para ${sendTarget.name}`}
              title="Mandar ficha para cá (Shift+Enter)"
              aria-expanded={promptOpen}
              // Fora do Tab: a linha é a parada; pelo teclado, Shift+Enter nela.
              tabIndex={-1}
              onClick={() => (promptOpen ? cancelSendPrompt() : openSendPrompt(rowKey, sendTarget))}
            >
              <TokenIcon size={14} />
            </button>
          )}
        </div>
        {promptOpen && sendPrompt !== null && senders !== undefined && (
          <div ref={promptRef} className="lb-party__send lb-objetos__pergunta" role="group" aria-label={`Mandar quem para ${sendPrompt.target.name}?`} onKeyDown={onPromptKeyDown}>
            <span className="lb-label">Mandar quem para {sendPrompt.target.name}?</span>
            <ul className="lb-objetos__itens">
              {senders.map((sender) => (
                <li key={sender.playerId}>
                  <button type="button" className="lb-objetos__item" onClick={() => send(sender.playerId)}>
                    <span className="lb-party__dot" style={{ background: sender.color }} aria-hidden="true" />
                    <span className="lb-party__name">{sender.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="lb-party__actions">
              <button type="button" className="lb-btn lb-btn--ghost" onClick={cancelSendPrompt}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </li>
    )
  }

  const hiddenElsewhere = elsewhere.total - elsewhere.hits.length

  return (
    <div className="lb-objetos">
      <div className="lb-objetos__rotulo">
        <label className="lb-label" htmlFor={fieldId}>
          Buscar objeto
        </label>
        <kbd className="lb-objetos__atalho" aria-hidden="true">
          Ctrl+K
        </kbd>
      </div>
      <div className="lb-objetos__campo">
        <span className="lb-objetos__lupa" aria-hidden="true">
          <SearchIcon size={16} />
        </span>
        <input
          id={fieldId}
          ref={inputRef}
          type="search"
          className="lb-input lb-objetos__busca"
          placeholder={hasOtherScenes ? 'Sala, pino ou ficha, em qualquer cena' : 'Sala, porta, pino, token ou texto'}
          value={query}
          autoComplete="off"
          spellCheck={false}
          aria-keyshortcuts="Control+K"
          aria-controls={listId}
          onChange={(event) => {
            setQuery(event.target.value)
            setSendPrompt(null)
            setSendNotice(null)
          }}
          onKeyDown={onSearchKeyDown}
        />
        {query !== '' && (
          <button type="button" className="lb-iconbtn lb-iconbtn--sm lb-objetos__limpar" aria-label="Limpar busca" title="Limpar busca" onClick={clearSearch}>
            <CloseIcon size={14} />
          </button>
        )}
      </div>
      <p className="lb-objetos__resumo" role="status">
        {sendNotice ?? summary}
      </p>
      <div ref={listRef} id={listId} className="lb-objetos__lista lb-scroll" onKeyDown={onListKeyDown}>
        {MAP_OBJECT_GROUPS.map((group) => {
          const items = results.filter((entry) => entry.kind === group.kind)
          if (items.length === 0) return null
          return (
            <div key={group.kind} className="lb-objetos__grupo">
              <h3 className="lb-objetos__grupo-titulo">
                {group.label} <span className="lb-num">{items.length}</span>
              </h3>
              <ul className="lb-objetos__itens">
                {items.map((entry) =>
                  renderRow(
                    entry.key,
                    { where: 'aqui', entry },
                    <>
                      <ObjectMark entry={entry} />
                      <span className="lb-objetos__nome">{entry.name}</span>
                      {entry.detail !== '' && (
                        <>
                          {' '}
                          <span className="lb-objetos__detalhe">{entry.detail}</span>
                        </>
                      )}
                      {entry.blockedReason !== null && (
                        <>
                          {' '}
                          <span className="lb-objetos__bloqueio">{entry.blockedReason}</span>
                        </>
                      )}
                    </>,
                    {
                      current: entry.key === currentKey,
                      title: entry.blockedReason === null ? undefined : `Leva até lá sem selecionar: ${entry.blockedReason}`,
                    },
                  ),
                )}
              </ul>
            </div>
          )
        })}
        {elsewhere.total > 0 && (
          <div className="lb-objetos__grupo">
            <h3 className="lb-objetos__grupo-titulo">
              Outras cenas <span className="lb-num">{elsewhere.total}</span>
            </h3>
            <ul className="lb-objetos__itens">
              {elsewhere.hits.map((hit) =>
                renderRow(
                  hit.key,
                  { where: 'fora', hit },
                  <>
                    <ObjectMark entry={hit} />
                    <span className="lb-objetos__texto">
                      <span className="lb-objetos__nome">{hit.name}</span>{' '}
                      <span className="lb-objetos__caminho">{hit.path}</span>
                    </span>
                  </>,
                  { current: false, title: `Abre a cena e vai até lá: ${hit.path}` },
                ),
              )}
            </ul>
            {hiddenElsewhere > 0 && (
              <p className="lb-objetos__vazio">
                Mais {hiddenElsewhere} em outras cenas. Digite mais do nome para ver o resto.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
