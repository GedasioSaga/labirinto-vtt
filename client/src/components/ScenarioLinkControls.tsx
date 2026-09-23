export interface ScenarioLinkControlsProps {
  scenarioLink: string | null
  onScenarioLinkChange: (value: string | null) => void
}

/**
 * Campo de texto com o link do cenário associado ao mapa aberto. O app só
 * guarda o texto em `map.scenarioLink` (salvo no arquivo do mapa) e nunca o
 * abre; `lib/fogFilter.ts` zera o campo antes de mandar o mapa aos jogadores.
 */
export function ScenarioLinkControls({ scenarioLink, onScenarioLinkChange }: ScenarioLinkControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Link de cenário</h2>
      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-scenario-link">
          Endereço do cenário
        </label>
        <input
          id="lb-scenario-link"
          className="lb-input"
          aria-describedby="lb-scenario-link-hint"
          value={scenarioLink ?? ''}
          onChange={(event) => onScenarioLinkChange(event.target.value || null)}
        />
        <p id="lb-scenario-link-hint" className="lb-field__hint">
          Anota o link do material da aventura deste mapa, para você consultar. Fica salvo no arquivo do mapa e não
          vai para os jogadores.
        </p>
      </div>
    </section>
  )
}
