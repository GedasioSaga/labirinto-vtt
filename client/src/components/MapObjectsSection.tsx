import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { CollapsibleSection } from './CollapsibleSection'
import { CloseIcon, SearchIcon } from './icons'
import { filterMapObjects, mapObjectsOf, MAP_OBJECT_GROUPS, type MapObjectEntry } from '../lib/mapObjects'
import type { MapData } from '../types/map'

export interface MapObjectsSectionProps {
  /** A cena aberta: a lista é dela e de nenhuma outra. */
  map: MapData
  /** `key` do objeto selecionado no editor (`currentObjectKey`): a linha dele fica marcada. */
  currentKey: string | null
  /** Clique (ou Enter na busca) numa linha: seleciona e leva a câmera até o objeto. */
  onGoTo: (entry: MapObjectEntry) => void
  /** Muda a cada Ctrl+K: abre a seção e põe o cursor na busca. */
  searchRequest?: number
}

/**
 * "Objetos do mapa", na aba Mapa: busca e lista, pelo nome, das salas, portas,
 * pinos, tokens e textos da cena aberta. Clicar numa linha seleciona o objeto
 * e leva a câmera do editor até ele (`stores/mapObjectNavigation.ts`).
 *
 * Nasce recolhida e o corpo só existe com ela aberta (`lazy`): numa mesa com
 * trinta salas a lista é longa, e fechada ela não custa nada nem repete na
 * página os nomes que o painel Grupo e as Cenas já mostram.
 */
export function MapObjectsSection({ map, currentKey, onGoTo, searchRequest = 0 }: MapObjectsSectionProps) {
  /** Último Ctrl+K já atendido. Mora aqui, fora do corpo que monta e desmonta com a seção. */
  const consumedSearch = useRef(searchRequest)
  return (
    <CollapsibleSection id="objects" title="Objetos do mapa" defaultOpen={false} lazy openRequest={searchRequest}>
      <ObjectFinder map={map} currentKey={currentKey} onGoTo={onGoTo} searchRequest={searchRequest} consumedSearch={consumedSearch} />
    </CollapsibleSection>
  )
}

interface ObjectFinderProps {
  map: MapData
  currentKey: string | null
  onGoTo: (entry: MapObjectEntry) => void
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
function ObjectMark({ entry }: { entry: MapObjectEntry }) {
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

function ObjectFinder({ map, currentKey, onGoTo, searchRequest, consumedSearch }: ObjectFinderProps) {
  const [query, setQuery] = useState('')
  /** Linha que o Tab alcança: a última que teve foco. Sem ela, a marcada; sem esta, a primeira. */
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const fieldId = useId()
  const listId = useId()
  const objects = useMemo(() => mapObjectsOf(map), [map])
  const results = useMemo(() => filterMapObjects(objects, query), [objects, query])

  useEffect(() => {
    if (searchRequest === consumedSearch.current) return
    consumedSearch.current = searchRequest
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [searchRequest, consumedSearch])

  if (objects.length === 0) {
    return <p className="lb-objetos__vazio">Esta cena ainda não tem sala, porta, pino, token nem texto.</p>
  }

  const keys = results.map((entry) => entry.key)
  const tabKey = focusKey !== null && keys.includes(focusKey) ? focusKey : currentKey !== null && keys.includes(currentKey) ? currentKey : keys[0] ?? null
  const trimmed = query.trim()
  /** Com busca digitada, o primeiro resultado é o que o Enter abre — e a linha dele mostra isso. */
  const enterTarget = trimmed === '' ? null : (results[0] ?? null)
  const summary =
    trimmed === ''
      ? countLabel(objects.length)
      : results.length === 0
        ? `Nenhum objeto com “${trimmed}”. Tente só o começo do nome.`
        : `${results.length} de ${countLabel(objects.length)}`

  const rowButtons = (): HTMLButtonElement[] => [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-objeto]') ?? [])]

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
      if (event.nativeEvent.isComposing || enterTarget === null) return
      consume(event)
      onGoTo(enterTarget)
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
          placeholder="Sala, porta, pino, token ou texto"
          value={query}
          autoComplete="off"
          spellCheck={false}
          aria-keyshortcuts="Control+K"
          aria-controls={listId}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKeyDown}
        />
        {query !== '' && (
          <button type="button" className="lb-iconbtn lb-iconbtn--sm lb-objetos__limpar" aria-label="Limpar busca" title="Limpar busca" onClick={clearSearch}>
            <CloseIcon size={14} />
          </button>
        )}
      </div>
      <p className="lb-objetos__resumo" role="status">
        {summary}
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
                {items.map((entry) => (
                  <li key={entry.key}>
                    <button
                      type="button"
                      data-objeto={entry.key}
                      data-enter={entry === enterTarget ? 'true' : undefined}
                      className="lb-objetos__item"
                      aria-current={entry.key === currentKey ? 'true' : undefined}
                      tabIndex={entry.key === tabKey ? 0 : -1}
                      title={entry.blockedReason === null ? undefined : `Leva até lá sem selecionar: ${entry.blockedReason}`}
                      onFocus={() => setFocusKey(entry.key)}
                      onClick={() => onGoTo(entry)}
                    >
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
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
