/** Uma cena que a tela da mesa pode mostrar: a chave (`tableSceneKey`) e o nome que o MESTRE lê. */
export interface TableSceneOption {
  key: string
  name: string
}

export interface TableScreenSectionProps {
  /** Link da página da TV (`lib/tableScreen.ts`); `null` quando a sala não tem endereço utilizável. */
  url: string | null
  scenes: TableSceneOption[]
  /** A cena na tela agora; `null` = a tela espera. */
  sceneKey: string | null
  /** Quantas telas estão conectadas. */
  screens: number
  onSceneChange(key: string | null): void
}

const SELECT_ID = 'lb-room-table-scene'

export function tableScreensLabel(screens: number): string {
  if (screens === 0) return 'Nenhuma tela conectada.'
  return screens === 1 ? '1 tela conectada.' : `${screens} telas conectadas.`
}

/**
 * "Tela da mesa", na aba Jogo: o link para abrir na TV ou no projetor e a cena
 * que ela mostra. A tela mostra só o que o grupo já viu daquela cena — nunca o
 * nome dela (esse nome é só do mestre, aqui no seletor).
 */
export function TableScreenSection({ url, scenes, sceneKey, screens, onSceneChange }: TableScreenSectionProps) {
  // Cena escolhida que fechou (saiu do cache, a aventura trocou): a opção
  // fica, marcada, para o seletor não mentir mostrando "Nenhuma".
  const missing = sceneKey !== null && !scenes.some((scene) => scene.key === sceneKey)
  return (
    <div className="lb-field">
      <h3 className="lb-eyebrow">Tela da mesa</h3>
      <p className="lb-label">Abra este link na TV ou no projetor. Ela mostra só o que o grupo já viu da cena escolhida, sem nada do mestre.</p>
      {url !== null && (
        <ul className="lb-room__urls">
          <li>{url}</li>
        </ul>
      )}
      <p className="lb-label" role="status" aria-live="polite">
        {tableScreensLabel(screens)}
      </p>
      <label className="lb-label" htmlFor={SELECT_ID}>
        Cena na tela
      </label>
      <select
        id={SELECT_ID}
        className="lb-input"
        value={sceneKey ?? ''}
        onChange={(event) => onSceneChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">Nenhuma (tela espera)</option>
        {scenes.map((scene) => (
          <option key={scene.key} value={scene.key}>
            {scene.name}
          </option>
        ))}
        {missing && <option value={sceneKey}>Cena fechada</option>}
      </select>
    </div>
  )
}
