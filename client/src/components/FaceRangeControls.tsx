import { useEffect, useState } from 'react'
import { Toggle } from './Toggle'
import { FACE_RANGE_DEFAULT_CELLS, FACE_RANGE_MAX_CELLS, FACE_RANGE_MIN_CELLS, faceRangeCellsOrNull } from '../lib/tokenVulto'

export interface FaceRangeControlsProps {
  /** `MapData.faceRangeCells` já lido: `null` = opção desligada. */
  faceRangeCells: number | null
  onFaceRangeCellsChange: (cells: number | null) => void
}

/**
 * "Rostos só de perto: N casas" — opção da cena, na janela Configurações do
 * mapa. Ligada, a ficha dos outros além de N casas chega aos jogadores como
 * "Vulto" (`lib/tokenVulto.ts`). O campo guarda o que a pessoa está digitando
 * e só manda número inteiro de 1 a 99; ao sair dele, volta ao valor da cena.
 */
export function FaceRangeControls({ faceRangeCells, onFaceRangeCellsChange }: FaceRangeControlsProps) {
  const enabled = faceRangeCells !== null
  const shown = faceRangeCells ?? FACE_RANGE_DEFAULT_CELLS
  const [draft, setDraft] = useState(String(shown))

  // Desfazer, trocar de cena ou ligar pela caixa mudam o valor por fora do campo.
  useEffect(() => setDraft(String(shown)), [shown])

  function changeCells(value: string) {
    setDraft(value)
    // `Number('')` é 0, que a faixa já recusa: campo vazio não desliga nada.
    const cells = faceRangeCellsOrNull(Number(value))
    if (cells !== null && cells !== faceRangeCells) onFaceRangeCellsChange(cells)
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Jogadores</h2>

      <Toggle
        label="Rostos só de perto"
        checked={enabled}
        describedBy="lb-face-range-hint"
        onChange={(checked) => onFaceRangeCellsChange(checked ? shown : null)}
      />

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-face-range-cells">
          Casas
        </label>
        <input
          id="lb-face-range-cells"
          className="lb-input"
          type="number"
          min={FACE_RANGE_MIN_CELLS}
          max={FACE_RANGE_MAX_CELLS}
          step={1}
          disabled={!enabled}
          value={draft}
          onChange={(event) => changeCells(event.target.value)}
          onBlur={() => setDraft(String(shown))}
        />
        <p id="lb-face-range-hint" className="lb-field__hint">
          Além dessa distância, a ficha dos outros aparece aos jogadores como Vulto: sem nome, foto nem cor.
        </p>
      </div>
    </section>
  )
}
