/**
 * Régua EFÊMERA — mede a distância entre dois pontos de mundo (px) sem
 * nascer nenhuma entidade nova no mapa (a régua permanente está cortada, ver
 * PLANO-FASES.md §4). Todo cálculo aqui é puro: quem desenha o resultado no
 * canvas é `pixi/drawMeasurementIndicator.ts`; quem decide QUANDO chamar
 * (pointerdown/pointermove/pointerup da ferramenta "measure") é o integrador
 * em `pixi/PixiCanvas.tsx`.
 *
 * `start`/`end` são sempre pixels de mundo, nunca de tela — mesma convenção
 * do resto do app (ver comentário no topo de types/tools.ts... na verdade
 * map.ts). `gridSize` é `MapData.grid`.
 */
import type { GridShape, MapScale, MeasurementMode } from '../types/map'
import type { Point } from '../pixi/world'
import { pixelToAxialRaw } from '../pixi/hexGrid'

export const MEASUREMENT_MODE_LABELS: Record<MeasurementMode, string> = {
  chessboard: 'Tabuleiro (D&D 5e)',
  alternating: 'Diagonal alternada (3.5e)',
  euclidean: 'Euclidiana',
  manhattan: 'Manhattan',
  hex: 'Hexagonal',
}

/**
 * Modos válidos para cada formato de grade, na ordem de exibição do
 * seletor. 'euclidean' vale nos três formatos (comentário de MeasurementMode
 * em types/map.ts); os outros são exclusivos de um formato só.
 *
 * 'triangle' (F3, contrato do agente C6) usa só 'euclidean': não existe
 * convenção de mesa de RPG equivalente ao "tabuleiro 5-10-5" pra malha
 * triangular (ao contrário de hex, que tem distância-cúbica bem
 * estabelecida) — inventar um modo dedicado sem demanda real violaria YAGNI.
 * Sem este caso a régua caía no ramo `else` de quadrado (chessboard/
 * alternating/manhattan), que MENTE: nenhum desses três é geometricamente
 * coerente com uma malha de triângulos.
 */
export function measurementModesForShape(gridShape: GridShape): MeasurementMode[] {
  if (gridShape === 'hex') return ['hex', 'euclidean']
  if (gridShape === 'triangle') return ['euclidean']
  return ['chessboard', 'alternating', 'euclidean', 'manhattan']
}

/**
 * Default ao entrar num formato de grade novo — sempre o primeiro item de
 * `measurementModesForShape`. Chamado por `setGridShape` (mapStore.ts /
 * mapFactory.ts, território do integrador I3): sem isso um mapa quadrado em
 * modo 'manhattan' que vira hex fica com um modo que não existe lá.
 */
export function defaultMeasurementModeForShape(gridShape: GridShape): MeasurementMode {
  return measurementModesForShape(gridShape)[0]
}

/**
 * Distância nos 4 modos de grade quadrada, em CÉLULAS (fracionárias — a
 * régua efêmera não trava em vértice de grade, então dx/dy raramente caem em
 * número inteiro de células).
 *
 * `chessboard` (D&D 5e): diagonal custa o mesmo que reto — distância de
 * Chebyshev, `max(dx, dy)`.
 *
 * `alternating` (3.5e "5-10-5"): a cada 2 passos diagonais, o segundo custa
 * o dobro. Fórmula padrão: `maior + floor(menor / 2)`, onde maior/menor são
 * os dois deltas em células — ver ex.: (3,3) dá `3 + floor(3/2) = 4`
 * células (20 ft a 5 ft/célula), que bate com 5+10+5 = 20 ft do 3.5e.
 *
 * `manhattan`: soma simples dos dois eixos, sem diagonal.
 */
function measureSquareCells(
  start: Point,
  end: Point,
  gridSize: number,
  mode: 'chessboard' | 'alternating' | 'manhattan',
): number {
  const dxCells = Math.abs(end.x - start.x) / gridSize
  const dyCells = Math.abs(end.y - start.y) / gridSize

  switch (mode) {
    case 'chessboard':
      return Math.max(dxCells, dyCells)
    case 'alternating': {
      const larger = Math.max(dxCells, dyCells)
      const smaller = Math.min(dxCells, dyCells)
      return larger + Math.floor(smaller / 2)
    }
    case 'manhattan':
      return dxCells + dyCells
  }
}

/**
 * Distância hexagonal em CÉLULAS, via coordenada axial contínua (SEM
 * arredondar pro hex mais próximo — `pixelToAxialRaw`, não `pixelToAxial`).
 * Fórmula padrão de distância cúbica `(|dq| + |dq+dr| + |dr|) / 2`,
 * generalizada de coordenada inteira pra fracionária: com `start`/`end`
 * exatamente nos centros de dois hexágonos ela devolve o mesmo inteiro que a
 * distância de hex-a-hex clássica; entre centros ela varia suavemente.
 *
 * OBRIGATÓRIO reusar `pixelToAxialRaw` (pixi/hexGrid.ts:42-46) — não
 * reescrever a trigonometria aqui: uma fórmula própria diverge da malha que
 * `drawHexGrid`/`snapToHexGrid` desenham e produz um número que não bate com
 * o que está na tela (ver PLANO-FASES.md §3, contrato do B4).
 */
function measureHexCells(start: Point, end: Point, gridSize: number): number {
  const a = pixelToAxialRaw(start, gridSize)
  const b = pixelToAxialRaw(end, gridSize)
  const dq = a.q - b.q
  const dr = a.r - b.r
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2
}

/**
 * Distância entre `start` e `end`, em CÉLULAS de grade — a unidade
 * intermediária antes de multiplicar por `MapScale.unitsPerCell`
 * (`measureDistance`, abaixo, faz essa segunda parte).
 *
 * `gridSize <= 0` devolve 0 — mesma guarda defensiva de
 * `computeVisibleGridLines`/`snapToHexGrid` (grid.ts / hexGrid.ts): grade
 * sem tamanho não tem célula, e dividir por zero produziria `Infinity`/`NaN`
 * que vazaria pro rótulo exibido.
 */
export function measureCells(
  start: Point,
  end: Point,
  gridSize: number,
  _gridShape: GridShape,
  mode: MeasurementMode,
): number {
  if (gridSize <= 0) return 0

  if (mode === 'euclidean') {
    return Math.hypot(end.x - start.x, end.y - start.y) / gridSize
  }
  if (mode === 'hex') {
    return measureHexCells(start, end, gridSize)
  }
  // Só resta 'chessboard' | 'alternating' | 'manhattan' aqui — os dois `if`
  // acima já eliminaram 'euclidean' e 'hex' por estreitamento de tipo.
  return measureSquareCells(start, end, gridSize, mode)
}

function roundToPrecision(value: number, precision: number): number {
  const safePrecision = Math.max(0, precision)
  const factor = 10 ** safePrecision
  return Math.round(value * factor) / factor
}

export interface MeasurementResult {
  /** Distância em células de grade (fracionária), antes da escala. */
  cells: number
  /** `cells * scale.unitsPerCell`, já arredondado para `scale.precision`
   *  casas decimais. */
  units: number
  /** Rótulo pronto pra exibir — `"${units} ${scale.unit}"`, ex. "25 ft",
   *  "7.5 m". Passar direto pra `drawMeasurementIndicator`. */
  label: string
}

/**
 * Pipeline completo: célula → unidade real → rótulo. É a única função que
 * `PixiCanvas.tsx` (I4) precisa chamar a cada pointermove/pointerup da
 * ferramenta "measure" — `measureCells` fica exposta à parte só porque
 * `measurement.test.ts` testa os 5 modos isoladamente, sem precisar montar
 * um `MapScale` pra cada caso.
 */
export function measureDistance(
  start: Point,
  end: Point,
  gridSize: number,
  gridShape: GridShape,
  mode: MeasurementMode,
  scale: MapScale,
): MeasurementResult {
  const cells = measureCells(start, end, gridSize, gridShape, mode)
  const units = roundToPrecision(cells * scale.unitsPerCell, scale.precision)
  const safePrecision = Math.max(0, scale.precision)
  // Vírgula decimal (pt-BR) e casas fixas, sem separador de milhar: "1,5 m", "3,0 m", "1500 ft".
  const number = units.toLocaleString('pt-BR', {
    minimumFractionDigits: safePrecision,
    maximumFractionDigits: safePrecision,
    useGrouping: false,
  })
  const label = `${number} ${scale.unit}`.trim()
  return { cells, units, label }
}
