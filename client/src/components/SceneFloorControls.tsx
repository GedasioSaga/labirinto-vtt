import { useEffect, useId, useState } from 'react'
import type { SceneFloor } from '../types/map'
import { cleanFloorLabel, FLOOR_BUILDING_MAX_LENGTH, FLOOR_LABEL_MAX_LENGTH, readSceneFloor } from '../lib/buildingFloors'

export interface SceneFloorControlsProps {
  /** Andar da cena aberta; `undefined` = cena comum. */
  andar: SceneFloor | undefined
  /** Recebe o andar já limpo, ou `undefined` para tirar a cena do prédio. */
  onChange: (next: SceneFloor | undefined) => void
}

/**
 * "Andar do prédio" da janela Configurações do mapa (MAPA POR ANDARES). Cenas
 * com o mesmo prédio viram abas na tela do jogador — só os andares onde ele já
 * esteve, e só pelo rótulo. Grava ao sair do campo (um passo de desfazer por
 * edição, não um por letra); prédio e andar preenchidos gravam, os dois vazios
 * tiram a cena do prédio, e um só preenchido espera o outro.
 */
export function SceneFloorControls({ andar, onChange }: SceneFloorControlsProps) {
  const buildingId = useId()
  const labelId = useId()
  const hintId = useId()
  const errorId = useId()
  const [building, setBuilding] = useState(andar?.predio ?? '')
  const [label, setLabel] = useState(andar?.rotulo ?? '')
  const [labelInvalid, setLabelInvalid] = useState(false)

  // Desfazer ou trocar de cena muda o andar por fora: os campos acompanham.
  const savedBuilding = andar?.predio ?? ''
  const savedLabel = andar?.rotulo ?? ''
  useEffect(() => {
    setBuilding(savedBuilding)
    setLabel(savedLabel)
    setLabelInvalid(false)
  }, [savedBuilding, savedLabel])

  function commit() {
    const invalid = label.trim() !== '' && cleanFloorLabel(label) === null
    setLabelInvalid(invalid)
    if (invalid) return
    if (building.trim() === '' && label.trim() === '') {
      if (andar !== undefined) onChange(undefined)
      return
    }
    const next = readSceneFloor({ predio: building, rotulo: label })
    if (next === undefined || (next.predio === andar?.predio && next.rotulo === andar.rotulo)) return
    onChange(next)
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Andar do prédio</h2>

      <div className="lb-field">
        <label className="lb-label" htmlFor={buildingId}>
          Prédio
        </label>
        <input
          id={buildingId}
          className="lb-input"
          type="text"
          maxLength={FLOOR_BUILDING_MAX_LENGTH}
          placeholder="Nenhum"
          aria-describedby={hintId}
          value={building}
          onChange={(event) => setBuilding(event.target.value)}
          onBlur={commit}
        />
      </div>

      <div className="lb-field">
        <label className="lb-label" htmlFor={labelId}>
          Andar
        </label>
        <input
          id={labelId}
          className="lb-input"
          type="text"
          maxLength={FLOOR_LABEL_MAX_LENGTH + 2}
          placeholder="1F"
          autoCapitalize="characters"
          aria-invalid={labelInvalid}
          aria-describedby={labelInvalid ? `${errorId} ${hintId}` : hintId}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={commit}
        />
        {labelInvalid && (
          <p id={errorId} className="lb-field__error" role="alert">
            Use até {FLOOR_LABEL_MAX_LENGTH} letras ou números, como 1F, 2F, B1.
          </p>
        )}
        <p id={hintId} className="lb-field__hint">
          Cenas do mesmo prédio viram abas na tela do jogador, só com os andares onde ele já esteve. O jogador lê só o
          andar; o nome do prédio fica com você.
        </p>
      </div>
    </section>
  )
}
