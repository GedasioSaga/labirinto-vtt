import { useState } from 'react'
import type { MapData, GridShape } from './types/map'
import * as mapFactory from './lib/mapFactory'

interface StartScreenProps {
  onCreate: (map: MapData) => void
  onOpen: () => void
}

const inputStyle = { width: '100%', boxSizing: 'border-box' as const }
const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: 4 }

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

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a1a',
        color: '#eee',
      }}
    >
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            width: 280,
            background: '#242424',
            padding: 24,
            borderRadius: 8,
          }}
        >
          <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>Labirinto</h1>
          <label style={fieldStyle}>
            Nome do mapa
            <input style={inputStyle} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label style={fieldStyle}>
            Largura (quadros)
            <input
              style={inputStyle}
              type="number"
              min={1}
              value={width}
              onChange={(event) => setWidth(Number(event.target.value))}
            />
          </label>
          <label style={fieldStyle}>
            Altura (quadros)
            <input
              style={inputStyle}
              type="number"
              min={1}
              value={height}
              onChange={(event) => setHeight(Number(event.target.value))}
            />
          </label>
          <label style={fieldStyle}>
            Tamanho do quadro (px)
            <input
              style={inputStyle}
              type="number"
              min={1}
              value={gridSize}
              onChange={(event) => setGridSize(Number(event.target.value))}
            />
          </label>
          <label style={fieldStyle}>
            Formato da grade
            <select
              style={inputStyle}
              value={gridShape}
              onChange={(event) => setGridShape(event.target.value as GridShape)}
            >
              <option value="square">Quadrado</option>
              <option value="hex">Hexágono</option>
            </select>
          </label>
          <button type="submit">Criar mapa</button>
        </form>
        <button type="button" onClick={onOpen} style={{ alignSelf: 'center' }}>
          Abrir mapa existente...
        </button>
      </div>
    </div>
  )
}
