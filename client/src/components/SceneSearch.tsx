import type { KeyboardEvent, RefObject } from 'react'
import { SCENE_TRAIL_SEPARATOR } from '../lib/adventure'
import { travelSceneLabel } from '../lib/pinTravel'
import { SearchIcon } from './icons'

/** Dica do campo: o jeito de buscar, não o rótulo. */
const SEARCH_PLACEHOLDER = 'Parte do nome, como “tav”'

interface SceneSearchFieldProps {
  id: string
  /** Rótulo visível. Nos formulários de envio não diz "Cena": esse é o da lista nativa logo abaixo. */
  label: string
  value: string
  inputRef: RefObject<HTMLInputElement | null>
  /** O id da lista de cenas achadas que o campo filtra. */
  controls?: string
  onChange(value: string): void
  onKeyDown(event: KeyboardEvent<HTMLInputElement>): void
}

/**
 * O campo de busca dos seletores de cena ("Mandar para…", "Levar para…",
 * "Leva a…"): a mesma lupa e a mesma dica do "Filtrar cenas" da lista Cenas.
 * As teclas (setas, Enter, Esc) são de quem usa: cada seletor escolhe de um jeito.
 */
export function SceneSearchField({ id, label, value, inputRef, controls, onChange, onKeyDown }: SceneSearchFieldProps) {
  return (
    <>
      <label className="lb-label" htmlFor={id}>
        {label}
      </label>
      <div className="lb-objetos__campo">
        <span className="lb-objetos__lupa" aria-hidden="true">
          <SearchIcon size={16} />
        </span>
        <input
          id={id}
          ref={inputRef}
          type="search"
          className="lb-input lb-objetos__busca"
          placeholder={SEARCH_PLACEHOLDER}
          value={value}
          autoComplete="off"
          spellCheck={false}
          aria-controls={controls}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
    </>
  )
}

interface SceneChoiceProps {
  name: string
  /** As cenas de fora; ausente ou vazio = primeiro nível, sem linha cinza. */
  trail?: readonly string[]
  disabled?: boolean
  /** É a cena que o Enter do campo escolhe agora: ganha o destaque do resultado ativo. */
  enterTarget?: boolean
  /** Marca para achar o botão de volta (o foco do "Voltar" do "Leva a…"). */
  dataCena?: string
  onChoose(): void
  onKeyDown?(event: KeyboardEvent<HTMLButtonElement>): void
}

/**
 * Uma cena num seletor: o nome e, embaixo, o caminho em cinza ("Porto Cinza ›
 * Vila Velha"). O nome acessível é o caminho inteiro numa linha
 * ("Porto Cinza › Taverna"): duas Tavernas não soam iguais no leitor de tela.
 */
export function SceneChoice({ name, trail = [], disabled = false, enterTarget = false, dataCena, onChoose, onKeyDown }: SceneChoiceProps) {
  const withTrail = trail.length > 0
  return (
    <button
      type="button"
      className={withTrail ? 'lb-btn lb-travel__choice lb-travel__choice--caminho' : 'lb-btn lb-travel__choice'}
      aria-label={withTrail ? travelSceneLabel({ name, trail }) : undefined}
      data-cena={dataCena}
      data-enter={enterTarget ? 'true' : undefined}
      disabled={disabled}
      onClick={onChoose}
      onKeyDown={onKeyDown}
    >
      {withTrail ? (
        <>
          <span className="lb-travel__choice-nome">{name}</span>
          <span className="lb-travel__caminho">{trail.join(SCENE_TRAIL_SEPARATOR)}</span>
        </>
      ) : (
        name
      )}
    </button>
  )
}
