import { useId, useState, type KeyboardEvent } from 'react'
import { CollapsibleSection } from './CollapsibleSection'
import { searchPins, type PinDirectoryEntry } from '../lib/pinDirectory'

export interface PinsSectionProps {
  /** Todos os pinos da aventura (`pinDirectory`), na ordem das cenas. */
  entries: readonly PinDirectoryEntry[]
  /** Leva o editor até o pino: abre a cena dele e o seleciona. */
  onGo: (entry: PinDirectoryEntry) => void
}

/** Valor do filtro que mostra todas as cenas. */
const ALL_SCENES = ''

/** As cenas que têm pino, na ordem da lista, sem repetir: as opções do filtro. */
function scenesOf(entries: readonly PinDirectoryEntry[]): { id: string; name: string }[] {
  const seen = new Map<string, string>()
  for (const entry of entries) {
    if (entry.sceneId !== null && !seen.has(entry.sceneId)) seen.set(entry.sceneId, entry.sceneName)
  }
  return Array.from(seen, ([id, name]) => ({ id, name }))
}

/**
 * "Pinos", logo abaixo de "Cenas" na aba Mapa: a lista de todos os pinos da
 * aventura pelo nome que só o mestre vê ("Faca"), com busca e filtro por
 * cena. Um toque na linha (ou Enter na busca, que vai ao primeiro) abre a
 * cena do pino com ele selecionado. Esc na busca limpa o texto e não chega ao
 * canvas (Esc lá troca a ferramenta).
 */
export function PinsSection({ entries, onGo }: PinsSectionProps) {
  const searchId = useId()
  const sceneFilterId = useId()
  const [query, setQuery] = useState('')
  const [sceneFilter, setSceneFilter] = useState(ALL_SCENES)
  const scenes = scenesOf(entries)
  // Cena que sumiu da lista (renomeada, sem pinos) não prende o filtro vazio.
  const activeFilter = scenes.some((scene) => scene.id === sceneFilter) ? sceneFilter : ALL_SCENES
  const results = searchPins(entries, query, activeFilter === ALL_SCENES ? null : activeFilter)

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setQuery('')
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const first = results[0]
      if (first !== undefined) onGo(first)
    }
  }

  return (
    <CollapsibleSection id="pins" title="Pinos" defaultOpen={false}>
      <div className="lb-field">
        <label className="lb-label" htmlFor={searchId}>
          Buscar pino
        </label>
        <input
          id={searchId}
          type="search"
          className="lb-input"
          value={query}
          placeholder="Nome ou descrição"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKeyDown}
        />
      </div>
      {scenes.length > 1 && (
        <div className="lb-field">
          <label className="lb-label" htmlFor={sceneFilterId}>
            Cena
          </label>
          <select id={sceneFilterId} className="lb-input" value={activeFilter} onChange={(event) => setSceneFilter(event.target.value)}>
            <option value={ALL_SCENES}>Todas as cenas</option>
            {scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <ul className="lb-cenas lb-pinos" aria-label="Pinos da aventura">
        {results.map((entry) => (
          <li key={`${entry.sceneId ?? ''}/${entry.pinId}`} className="lb-cenas__item">
            <button type="button" className="lb-cenas__nome lb-pinos__linha" title={entry.description || undefined} onClick={() => onGo(entry)}>
              <span className="lb-pinos__nome">{entry.label}</span>
              <span className="lb-pinos__cena">{entry.sceneName}</span>
            </button>
          </li>
        ))}
      </ul>
      {entries.length === 0 && <p className="lb-label">Nenhum pino no mapa ainda.</p>}
      {entries.length > 0 && results.length === 0 && <p className="lb-label">{`Nenhum pino com “${query.trim()}”.`}</p>}
    </CollapsibleSection>
  )
}
