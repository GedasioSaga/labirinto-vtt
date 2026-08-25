export interface ScenarioLinkControlsProps {
  scenarioLink: string | null
  onScenarioLinkChange: (value: string | null) => void
}

/** Campo de texto com o link do cenário associado ao mapa aberto. */
export function ScenarioLinkControls({ scenarioLink, onScenarioLinkChange }: ScenarioLinkControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Link de cenário</h2>
      <div className="lb-field">
        <input
          className="lb-input"
          value={scenarioLink ?? ''}
          onChange={(event) => onScenarioLinkChange(event.target.value || null)}
        />
      </div>
    </section>
  )
}
