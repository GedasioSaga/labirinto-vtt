import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { PARTY_CENTER_LABEL, type PartyDestination } from '../lib/party'
import { SCENE_FILTER_MIN, sceneSearchSummary, sceneSearchWords, searchScenes } from '../lib/sceneSearch'
import { SceneChoice, SceneSearchField } from './SceneSearch'

/** Valor do `<select>` de chegada que quer dizer "centro da cena" (id de pino nunca é vazio). */
const CENTER = ''

export interface SceneSendFormProps {
  /** Título visível: "Mandar Ana para…", "Levar Zumbi para…". */
  title: string
  /** Nome acessível do formulário. */
  ariaLabel: string
  /** O botão que confirma: "Mandar", "Levar". */
  submitLabel: string
  /** O aviso quando a confirmação não deu. */
  failedText: string
  /** As cenas oferecidas, na ordem da lista; a primeira já vem escolhida. */
  destinations: PartyDestination[]
  /** Confirmado. `false` = não deu, e o formulário fica aberto com o aviso. */
  onSend(sceneId: string, pinId: string | null): boolean
  onClose(): void
}

/**
 * Cena e chegada em duas listas nativas (teclado e leitor de tela de graça),
 * "Centro da cena" já escolhido — é o destino que sempre existe. Enter envia
 * (é um `<form>`); Esc cancela. Serve ao "Mandar para…" do Grupo (jogador) e
 * ao "Levar para…" do painel da ficha (NPC): o mesmo gesto, as mesmas teclas.
 *
 * BUSCA: com muitas cenas (`SCENE_FILTER_MIN`), o foco nasce num campo de
 * busca acima das listas. Digitar mostra as cenas achadas com o caminho em
 * cinza; as setas andam por elas; Enter (ou o clique) escolhe a cena na
 * lista "Cena" e leva o foco à "Chegada", que já tem os pinos de lá. Com o
 * campo vazio, Enter envia como sempre. Esc com texto só limpa a busca.
 */
export function SceneSendForm({ title, ariaLabel, submitLabel, failedText, destinations, onSend, onClose }: SceneSendFormProps) {
  const baseId = useId()
  const [sceneId, setSceneId] = useState(destinations[0]?.sceneId ?? '')
  const [arrival, setArrival] = useState(CENTER)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const sceneRef = useRef<HTMLSelectElement | null>(null)
  const arrivalRef = useRef<HTMLSelectElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const foundRef = useRef<HTMLUListElement | null>(null)
  const scene = destinations.find((destination) => destination.sceneId === sceneId)
  const showSearch = destinations.length >= SCENE_FILTER_MIN
  const searching = showSearch && sceneSearchWords(query).length > 0
  const found = searching ? searchScenes(destinations, query) : []

  useEffect(() => {
    // Com busca, o foco nasce nela: digitar já filtra. Sem ela, na lista "Cena".
    const first = searchRef.current ?? sceneRef.current
    first?.focus()
  }, [])

  /** Escolher pela busca: a cena vai para a lista "Cena", a chegada volta ao centro e o foco vai para ela. */
  const choose = (destination: PartyDestination) => {
    setSceneId(destination.sceneId)
    setArrival(CENTER)
    setFailed(false)
    setQuery('')
    arrivalRef.current?.focus()
  }

  const foundButtons = () => Array.from(foundRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && query !== '') {
      // O primeiro Esc só limpa a busca; com o campo vazio, o Esc fecha o formulário.
      event.preventDefault()
      event.stopPropagation()
      setQuery('')
      return
    }
    if (!searching) return
    if (event.key === 'Enter') {
      // Com busca digitada, Enter escolhe a cena — não envia para a que estava escolhida.
      event.preventDefault()
      const first = found[0]
      if (first !== undefined) choose(first)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      event.stopPropagation()
      foundButtons()[0]?.focus()
    }
  }

  /** Setas entre as achadas; subir da primeira volta ao campo. Esc limpa a busca e volta ao campo. */
  const onFoundKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setQuery('')
      searchRef.current?.focus()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    // Seta não pode chegar ao mapa: lá ela empurra o que estiver selecionado.
    event.preventDefault()
    event.stopPropagation()
    const buttons = foundButtons()
    const at = buttons.indexOf(event.currentTarget)
    const next = at + (event.key === 'ArrowDown' ? 1 : -1)
    if (next < 0) searchRef.current?.focus()
    else buttons[Math.min(next, buttons.length - 1)]?.focus()
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (scene === undefined) return
    if (onSend(scene.sceneId, arrival === CENTER ? null : arrival)) onClose()
    else setFailed(true)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return
    // Esc fecha sem mandar; não pode chegar ao canvas (Esc lá troca a ferramenta).
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  return (
    <form className="lb-party__send" aria-label={ariaLabel} onSubmit={submit} onKeyDown={onKeyDown}>
      <span className="lb-label">{title}</span>
      {showSearch && (
        <>
          <SceneSearchField
            id={`${baseId}-search`}
            label="Buscar destino"
            value={query}
            inputRef={searchRef}
            controls={searching ? `${baseId}-found` : undefined}
            onChange={setQuery}
            onKeyDown={onSearchKeyDown}
          />
          {searching && found.length > 0 && (
            <ul ref={foundRef} id={`${baseId}-found`} className="lb-travel__options" aria-label="Destinos achados">
              {found.map((destination, index) => (
                <li key={destination.sceneId} className="lb-travel__option">
                  <SceneChoice
                    name={destination.name}
                    trail={destination.trail}
                    enterTarget={index === 0}
                    onChoose={() => choose(destination)}
                    onKeyDown={onFoundKeyDown}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="lb-cenas__resumo" role="status">
            {searching ? sceneSearchSummary(found.length, query) : ''}
          </p>
        </>
      )}
      <label className="lb-label" htmlFor={`${baseId}-scene`}>
        Cena
      </label>
      <select
        id={`${baseId}-scene`}
        ref={sceneRef}
        className="lb-input"
        value={sceneId}
        onChange={(event) => {
          setSceneId(event.target.value)
          // O pino escolhido era da outra cena: a chegada volta ao centro.
          setArrival(CENTER)
          setFailed(false)
        }}
      >
        {destinations.map((destination) => (
          <option key={destination.sceneId} value={destination.sceneId}>
            {destination.name}
          </option>
        ))}
      </select>
      <label className="lb-label" htmlFor={`${baseId}-arrival`}>
        Chegada
      </label>
      <select
        id={`${baseId}-arrival`}
        ref={arrivalRef}
        className="lb-input"
        value={arrival}
        onChange={(event) => {
          setArrival(event.target.value)
          setFailed(false)
        }}
      >
        <option value={CENTER}>{PARTY_CENTER_LABEL}</option>
        {(scene?.arrivals ?? []).map((pin) => (
          <option key={pin.pinId} value={pin.pinId}>
            {pin.label}
          </option>
        ))}
      </select>
      {failed && (
        <p className="lb-room__error" role="alert">
          {failedText}
        </p>
      )}
      <div className="lb-party__actions">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="lb-btn lb-btn--primary">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
