import { useId } from 'react'
import type { GridSettings, GridShape, MapData } from '../types/map'
import { gridTile, type GridTile } from './gridArt'
import { mapBoundsRect } from '../pixi/drawMapBounds'

/**
 * Cor com que o editor limpa o canvas a cada quadro (`backgroundColor` do
 * `Application`, pixi/PixiCanvas.tsx). É ela que a pessoa vê num mapa
 * recém-criado: `background` do tipo 'color' não é desenhado por ninguém —
 * `redrawBackground` (mesmo arquivo) só vira sprite quando o tipo é 'image' —,
 * então a cor honesta da prévia é esta, e não `map.background.src`.
 */
const CANVAS_BACKGROUND = '#2b2b2b'

/** Traço/vão do tracejado e do pontilhado da grade, em px de MUNDO — os mesmos
 *  números de `DASH_LENGTH`/`DASH_GAP`/`DOT_LENGTH`/`DOT_GAP` (pixi/grid.ts),
 *  que é o que o editor desenha. */
const DASH = { dashed: '10 6', dotted: '2 6' } as const

const round = (value: number) => Math.round(value * 1000) / 1000

/**
 * Ladrilho da malha TRIANGULAR, no mesmo formato de `gridTile`.
 *
 * Mora aqui, e não junto de `squareTile`/`hexTile` em `gridArt.ts`, porque esse
 * arquivo está fora da lista de escrita desta peça (ver relatório) — é o único
 * motivo, e o lugar certo dele continua sendo lá.
 *
 * Geometria idêntica à de `pixi/triGrid.ts`, que é o que o editor desenha: a
 * malha é o lattice gerado por (s, 0) e (s/2, s·√3/2), com `s = map.grid` o
 * LADO do triângulo. O ladrilho que se repete é s × 2·alturaDaFileira (duas
 * fileiras), e de cada vértice saem as mesmas 3 direções de `EDGE_DIRECTIONS`
 * (triGrid.ts) — as que cobrem a malha inteira sem traçar aresta repetida.
 */
function triangleTile(side: number): GridTile {
  const rowHeight = (Math.sqrt(3) / 2) * side
  const segments: string[] = []
  for (let row = 0; row <= 2; row += 1) {
    const y = row * rowHeight
    for (let column = -1; column <= 2; column += 1) {
      const x = column * side + (row * side) / 2
      // A horizontal da fileira 2 é a da fileira 0 do ladrilho de baixo:
      // desenhar as duas dobraria a opacidade exatamente na emenda.
      if (row < 2) segments.push(`M${round(x)} ${round(y)}H${round(x + side)}`)
      segments.push(`M${round(x)} ${round(y)}L${round(x + side / 2)} ${round(y + rowHeight)}`)
      segments.push(`M${round(x)} ${round(y)}L${round(x + side / 2)} ${round(y - rowHeight)}`)
    }
  }
  return { width: round(side), height: round(2 * rowHeight), path: segments.join('') }
}

function tileFor(shape: GridShape, cell: number): GridTile {
  // `gridTile` cai no ladrilho quadrado quando a forma é 'triangle'; o editor,
  // não (drawTriGrid, PixiCanvas.tsx). Desviar aqui é o que impede a prévia de
  // prometer quadrados e o editor abrir com triângulos.
  return shape === 'triangle' ? triangleTile(cell) : gridTile(shape, cell)
}

function nomeDaGrade(shape: GridShape): string {
  if (shape === 'hex') return 'hexagonal'
  if (shape === 'triangle') return 'triangular'
  return 'quadrada'
}

function dashArray(lineStyle: GridSettings['lineStyle']): string | undefined {
  return lineStyle === 'solid' ? undefined : DASH[lineStyle]
}

interface MapPreviewProps {
  /**
   * O MESMO `MapData` que o botão "Criar mapa" vai entregar ao editor, não uma
   * cópia dos campos do formulário: `showGrid`, `gridShape`, `gridSettings` e
   * as dimensões saem daqui. Sem um segundo lugar onde divergir, a prévia não
   * tem como prometer uma coisa e o editor abrir outra.
   */
  map: MapData
  /**
   * Tamanho da área de desenho do editor em px de tela — a janela, já que
   * `.lb-editor__canvas` é `inset: 0` numa casca de 100vw × 100vh (main.css).
   * Ausente = quem chama não sabe, e aí a prévia não desenha o recorte.
   */
  viewport?: { width: number; height: number }
}

/**
 * Prévia do mapa que está sendo criado: proporção real, a grade EXATA que o
 * editor vai desenhar (ou grade nenhuma, quando o mapa nasce sem ela), a mesma
 * cor de fundo e — quando o mapa é maior que a janela — o retângulo do que cabe
 * na tela no primeiro segundo do editor.
 *
 * Antes desta versão ela desenhava a grade SEMPRE, sem olhar `showGrid`: quem
 * escolhia "Quadrado" via a grade aqui e o editor abria liso. A prévia mentia;
 * o editor, não.
 */
export function MapPreview({ map, viewport }: MapPreviewProps) {
  const patternId = useId()
  const rect = mapBoundsRect(map)
  const nome = nomeDaGrade(map.gridShape)

  // Dimensão degenerada (zero, negativa, não-finita): não há retângulo a
  // mostrar, e inventar um seria a prévia mentindo de novo.
  if (!rect) {
    return (
      <svg
        role="img"
        aria-label={`Prévia do mapa: ${map.width} por ${map.height} quadros de ${map.grid} px não formam uma área desenhável`}
      />
    )
  }

  const pxWidth = rect.maxX - rect.minX
  const pxHeight = rect.maxY - rect.minY
  const tile = map.showGrid ? tileFor(map.gridShape, map.grid) : null

  // O editor abre em 1:1 com a origem do mapa no canto da janela: a câmera nova
  // é {x:0, y:0, scale:1} e o enquadramento de abertura só olha CONTEÚDO, que um
  // mapa novo não tem (`fitToContent` → `contentBounds`, PixiCanvas.tsx). Então
  // o pedaço visível é literalmente a janela, ancorada em (0,0).
  const recorte =
    viewport && (viewport.width < pxWidth || viewport.height < pxHeight)
      ? { width: Math.min(viewport.width, pxWidth), height: Math.min(viewport.height, pxHeight) }
      : null

  // Traço em px de MUNDO proporcional ao mapa: o recorte tem a mesma presença
  // visual num mapa de 10 quadros e num de 200.
  const escala = Math.max(pxWidth, pxHeight)

  const rotulo =
    `Prévia do mapa: ${map.width} por ${map.height} quadros, ` +
    (tile ? `grade ${nome} visível` : `sem grade (a grade ${nome} nasce desligada)`) +
    (recorte ? ', e o retângulo tracejado é a parte que cabe na janela quando o editor abre' : '')

  return (
    <svg viewBox={`0 0 ${pxWidth} ${pxHeight}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={rotulo}>
      <defs>
        {tile && (
          <pattern id={patternId} width={tile.width} height={tile.height} patternUnits="userSpaceOnUse">
            <path
              d={tile.path}
              fill="none"
              stroke={map.gridSettings.color}
              strokeOpacity={map.gridSettings.opacity}
              strokeWidth={map.gridSettings.lineWidth}
              strokeDasharray={dashArray(map.gridSettings.lineStyle)}
              strokeLinecap={map.gridSettings.lineStyle === 'dotted' ? 'round' : 'butt'}
              vectorEffect="non-scaling-stroke"
            />
          </pattern>
        )}
      </defs>
      <rect width={pxWidth} height={pxHeight} fill={CANVAS_BACKGROUND} />
      {tile && <rect width={pxWidth} height={pxHeight} fill={`url(#${patternId})`} />}
      {recorte && (
        <rect
          width={recorte.width}
          height={recorte.height}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.5}
          strokeWidth={round(escala / 400)}
          strokeDasharray={`${round(escala / 60)} ${round(escala / 100)}`}
        />
      )}
      <rect className="lb-preview__frame" width={pxWidth} height={pxHeight} />
    </svg>
  )
}
