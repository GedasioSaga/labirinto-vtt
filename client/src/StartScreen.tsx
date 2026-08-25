import { useState } from 'react'
import type { MapData, GridShape } from './types/map'
import * as mapFactory from './lib/mapFactory'
import { LabyrinthMark } from './components/icons'
import { GridShapePicker } from './components/GridShapePicker'
import { MapPreview } from './components/MapPreview'

interface StartScreenProps {
  onCreate: (map: MapData) => void
  onOpen: () => void
}

export function StartScreen({ onCreate, onOpen }: StartScreenProps) {
  const [name, setName] = useState('Mapa sem título')
  const [width, setWidth] = useState(30)
  const [height, setHeight] = useState(20)
  const [gridSize, setGridSize] = useState(64)
  const [gridShape, setGridShape] = useState<GridShape>('square')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const map: MapData = {
      ...mapFactory.createEmptyMap(
        `map_${crypto.randomUUID()}`,
        name.trim() || 'Mapa sem título',
        Math.max(1, Math.round(width) || 30),
        Math.max(1, Math.round(height) || 20),
        Math.max(1, Math.round(gridSize) || 64),
      ),
      gridShape,
    }
    onCreate(map)
  }

  // Mesma normalização do submit, para a prévia mostrar o mapa que vai nascer
  // mesmo enquanto um campo está vazio ou inválido.
  const safeWidth = Math.max(1, Math.round(width) || 30)
  const safeHeight = Math.max(1, Math.round(height) || 20)
  const safeGrid = Math.max(1, Math.round(gridSize) || 64)

  return (
    <div className="lb-start">
      <div className="lb-start__stage">
        <header className="lb-brand">
          <span className="lb-brand__mark" aria-hidden="true">
            <LabyrinthMark size={30} />
          </span>
          <span>
            <h1 className="lb-brand__name">Labirinto</h1>
            <p className="lb-brand__tagline">Editor de mapas de mesa</p>
          </span>
        </header>

        <div className="lb-start__columns">
          <form className="lb-card" onSubmit={handleSubmit}>
            <h2 className="lb-eyebrow">Novo mapa</h2>

            <div className="lb-field">
              <label className="lb-label" htmlFor="lb-map-name">
                Nome do mapa
              </label>
              <input
                id="lb-map-name"
                className="lb-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="lb-card__grid">
              <div className="lb-field">
                <label className="lb-label" htmlFor="lb-map-width">
                  Largura (quadros)
                </label>
                <input
                  id="lb-map-width"
                  className="lb-input"
                  type="number"
                  min={1}
                  value={width}
                  onChange={(event) => setWidth(Number(event.target.value))}
                />
              </div>
              <div className="lb-field">
                <label className="lb-label" htmlFor="lb-map-height">
                  Altura (quadros)
                </label>
                <input
                  id="lb-map-height"
                  className="lb-input"
                  type="number"
                  min={1}
                  value={height}
                  onChange={(event) => setHeight(Number(event.target.value))}
                />
              </div>
            </div>

            <div className="lb-field">
              <label className="lb-label" htmlFor="lb-map-grid">
                Tamanho do quadro
              </label>
              <span className="lb-inputgroup">
                <input
                  id="lb-map-grid"
                  className="lb-input"
                  type="number"
                  min={1}
                  value={gridSize}
                  onChange={(event) => setGridSize(Number(event.target.value))}
                />
                <span className="lb-inputgroup__suffix">px</span>
              </span>
            </div>

            <div className="lb-field">
              <span className="lb-label">Formato da grade</span>
              <GridShapePicker value={gridShape} onChange={setGridShape} groupLabel="Formato da grade" />
            </div>

            <button type="submit" className="lb-btn lb-btn--primary lb-btn--block">
              Criar mapa
            </button>
          </form>

          <aside className="lb-start__aside">
            <h2 className="lb-eyebrow">Prévia</h2>
            <div className="lb-preview">
              <MapPreview width={safeWidth} height={safeHeight} grid={safeGrid} shape={gridShape} />
            </div>
            <div>
              <p className="lb-stat">
                <span className="lb-stat__key">Quadros</span>
                <span className="lb-stat__value">
                  {safeWidth} × {safeHeight}
                </span>
              </p>
              <p className="lb-stat">
                <span className="lb-stat__key">Tamanho</span>
                <span className="lb-stat__value">
                  {safeWidth * safeGrid} × {safeHeight * safeGrid} px
                </span>
              </p>
            </div>
          </aside>
        </div>

        <footer className="lb-start__foot">
          <span>Já tem um mapa salvo?</span>
          <button type="button" className="lb-btn lb-btn--ghost" onClick={onOpen}>
            Abrir mapa existente...
          </button>
        </footer>
      </div>
    </div>
  )
}
