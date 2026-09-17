import { useEffect, useId, useMemo, useState } from 'react'
import type { MapData, GridShape } from '../types/map'
import * as mapFactory from '../lib/mapFactory'
import { GridShapePicker } from '../components/GridShapePicker'
import { MapPreview } from '../components/MapPreview'
import { Toggle } from '../components/Toggle'
import { MenuShell } from './MenuShell'

interface NewDungeonMapProps {
  onCreate: (map: MapData) => void
  onBack: () => void
}

/** Tamanho da área de desenho do editor: `.lb-editor__canvas` é `inset: 0`
 *  dentro de uma casca de 100vw × 100vh (main.css), então é a janela inteira. */
function tamanhoDaJanela(): { width: number; height: number } {
  return { width: window.innerWidth, height: window.innerHeight }
}

export function NewDungeonMap({ onCreate, onBack }: NewDungeonMapProps) {
  const [name, setName] = useState('Mapa sem título')
  const [width, setWidth] = useState(30)
  const [height, setHeight] = useState(20)
  const [gridSize, setGridSize] = useState(64)
  const [gridShape, setGridShape] = useState<GridShape>('square')
  // Nasce no mesmo estado em que o mapa nasce (lib/mapFactory.ts): o valor vem
  // de lá, não de um `false` repetido aqui.
  const [showGrid, setShowGrid] = useState(mapFactory.NEW_MAP_SHOW_GRID)
  const [janela, setJanela] = useState(tamanhoDaJanela)
  // Id fixo enquanto a tela está aberta: a prévia e o mapa criado são o MESMO
  // objeto, então o id não pode mudar a cada tecla digitada no nome.
  const [mapId] = useState(() => `map_${crypto.randomUUID()}`)
  const gridHintId = useId()

  // A pessoa pode redimensionar a janela com o formulário aberto; o recorte que
  // a prévia desenha tem de acompanhar, senão vira mais uma promessa errada.
  useEffect(() => {
    const aoRedimensionar = () => setJanela(tamanhoDaJanela())
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [])

  // Normalização única, usada pela prévia E pela criação — campo vazio ou
  // inválido mostra o mapa que realmente vai nascer.
  const safeWidth = Math.max(1, Math.round(width) || 30)
  const safeHeight = Math.max(1, Math.round(height) || 20)
  const safeGrid = Math.max(1, Math.round(gridSize) || 64)

  /**
   * O mapa que o botão "Criar mapa" entrega ao editor, montado agora e desenhado
   * pela prévia.
   *
   * É o coração do conserto: antes a prévia recebia quatro números soltos
   * (largura, altura, quadro, formato) e desenhava a grade SEMPRE, enquanto o
   * mapa nascia com `showGrid: false`. Com um objeto só não há onde divergir —
   * o que a prévia mostra é literalmente o que vai ser criado.
   */
  const draftMap = useMemo<MapData>(
    () => ({
      ...mapFactory.createEmptyMap(mapId, name.trim() || 'Mapa sem título', safeWidth, safeHeight, safeGrid),
      gridShape,
      showGrid,
    }),
    [mapId, name, safeWidth, safeHeight, safeGrid, gridShape, showGrid],
  )

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onCreate(draftMap)
  }

  const pxWidth = safeWidth * safeGrid
  const pxHeight = safeHeight * safeGrid
  const cabeInteiro = janela.width >= pxWidth && janela.height >= pxHeight
  const quadrosNaTela = {
    x: Math.min(safeWidth, Math.floor(janela.width / safeGrid)),
    y: Math.min(safeHeight, Math.floor(janela.height / safeGrid)),
  }

  return (
    <MenuShell title="Novo Dungeon Map" onBack={onBack} crumbs={['Labirinto', 'Criar Mapas']}>
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

          <div className="lb-field">
            <Toggle label="Mostrar grade" checked={showGrid} onChange={setShowGrid} describedBy={gridHintId} />
            <p className="lb-field__hint" id={gridHintId}>
              {showGrid
                ? 'O mapa abre com a grade desenhada, igual à prévia ao lado.'
                : 'O mapa abre liso, no estilo minimapa — igual à prévia ao lado. Dá para ligar depois, no painel Mapa.'}
            </p>
          </div>

          <button type="submit" className="lb-btn lb-btn--primary lb-btn--block">
            Criar mapa
          </button>
        </form>

        <aside className="lb-start__aside">
          <h2 className="lb-eyebrow">Prévia</h2>
          <div className="lb-preview">
            <MapPreview map={draftMap} viewport={janela} />
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
                {pxWidth} × {pxHeight} px
              </span>
            </p>
            {/* O editor abre em 1:1 ancorado no canto do mapa, então mapa maior
                que a janela começa com as bordas fora de vista — dizer isso
                ANTES de criar é o que evita a surpresa da área lisa sem
                nenhuma referência de onde o mapa acaba. */}
            <p className="lb-stat">
              <span className="lb-stat__key">Cabe na tela</span>
              <span className="lb-stat__value">
                {cabeInteiro
                  ? 'o mapa inteiro'
                  : `${quadrosNaTela.x} × ${quadrosNaTela.y} dos ${safeWidth} × ${safeHeight} quadros`}
              </span>
            </p>
          </div>
        </aside>
      </div>
    </MenuShell>
  )
}
