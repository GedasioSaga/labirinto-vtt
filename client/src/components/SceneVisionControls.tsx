import { SCENE_VISION_CELLS_MAX, SCENE_VISION_CELLS_MIN, readSceneVisionCells } from '../lib/sceneVision'
import { Toggle } from './Toggle'

export interface SceneVisionControlsProps {
  /** "Visão nesta cena", em quadrados; `undefined` = sem valor. */
  visionCells: number | undefined
  onVisionCellsChange: (cells: number | undefined) => void
  /** "Cena escura" (`MapData.dark`). Ausente omite o toggle. */
  dark?: boolean
  onDarkChange?: (dark: boolean) => void
}

/**
 * "Visão nesta cena": até onde o jogador enxerga nesta cena, em quadrados.
 * Mapa-mundi longe, mina perto — o mestre acerta uma vez por cena, não o raio
 * de cada jogador a cada viagem. O "Fator de visão" de cada jogador (painel
 * Sala) multiplica este número. Vazio = o raio em px de cada jogador, como antes.
 *
 * "Cena escura": o jogador só vê a casa em volta da ficha e o que uma Luz
 * ilumina, mesmo além do raio (`lib/darkness.ts`).
 */
export function SceneVisionControls({ visionCells, onVisionCellsChange, dark, onDarkChange }: SceneVisionControlsProps) {
  function change(text: string) {
    if (text.trim() === '') {
      onVisionCellsChange(undefined)
      return
    }
    // Número fora da faixa (0, fração, negativo) não grava: o campo volta ao valor que vale.
    const cells = readSceneVisionCells(Number(text))
    if (cells !== undefined) onVisionCellsChange(cells)
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Visão dos jogadores</h2>
      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-scene-vision">
          Visão nesta cena (quadrados)
        </label>
        <input
          id="lb-scene-vision"
          className="lb-input"
          type="number"
          inputMode="numeric"
          min={SCENE_VISION_CELLS_MIN}
          max={SCENE_VISION_CELLS_MAX}
          step={1}
          placeholder="Sem valor"
          value={visionCells ?? ''}
          aria-describedby="lb-scene-vision-hint"
          onChange={(event) => change(event.target.value)}
        />
        <p id="lb-scene-vision-hint" className="lb-field__hint">
          Vale para todo jogador nesta cena, vezes o fator de visão dele (painel Sala). Vazio: cada um usa o raio em px de sempre.
        </p>
      </div>
      {dark !== undefined && onDarkChange !== undefined && (
        <>
          <Toggle label="Cena escura" checked={dark} onChange={onDarkChange} describedBy="lb-scene-dark-hint" />
          <p id="lb-scene-dark-hint" className="lb-field__hint">
            O jogador só vê a casa em volta da ficha e o que uma Luz ilumina, mesmo de longe. Você continua vendo tudo.
          </p>
        </>
      )}
    </section>
  )
}
