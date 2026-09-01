/**
 * Alinhar a grade do editor à grade já DESENHADA numa imagem de fundo
 * importada — paridade com Owlbear Rodeo (docs/PLANO-FASES.md, item "Alinhar
 * grade à imagem de fundo"). Problema real: hoje não há jeito nenhum de
 * casar `MapData.grid` com a grade impressa na imagem — o usuário só pode
 * mudar o tamanho de célula no chute.
 *
 * Tudo aqui é função pura. Quem lê a textura (nome do arquivo, largura/altura
 * naturais) é `pixi/PixiCanvas.tsx` (integrador); quem desenha a prévia é
 * `pixi/drawGridAlignOverlay.ts`; quem decide QUANDO chamar é
 * `components/GridAlignControls.tsx`.
 *
 * Convenção de unidade: cellSize/offset estão em PIXELS DE MUNDO. O sprite
 * de fundo em `PixiCanvas.tsx` nasce em `new Sprite(Texture.EMPTY)` sem
 * `.x`/`.y`/`.scale` jamais atribuídos fora do padrão (grep confirmado) —
 * ou seja, 1px de imagem importada == 1px de mundo, sem escala nem
 * deslocamento implícitos. `offset` é o deslocamento da PRIMEIRA linha de
 * grade (o vértice superior-esquerdo da célula "0,0") a partir da origem
 * da imagem (0,0).
 */
import type { GridLine, Viewport } from '../pixi/grid'
import type { Point } from '../pixi/world'

export interface GridAlignResult {
  cellSize: number
  offset: Point
}

/**
 * Deriva tamanho de célula + offset a partir de quantas colunas/linhas o
 * usuário CONTOU na imagem (ex.: "30 x 20"). `offset` sai sempre em (0,0)
 * aqui — a grade nasce encostada no canto superior-esquerdo da imagem;
 * afinar o encaixe fino é responsabilidade de `wrapGridOffset` +
 * `GridAlignControls`, chamado à parte depois que o usuário compara a
 * prévia com a imagem.
 *
 * `cellSize` é a MÉDIA entre `imageWidth/cols` e `imageHeight/rows`: a
 * grade do app é sempre QUADRADA — um `MapData.grid` só, sem x/y separado
 * (mesma limitação de `GridShape = 'square' | 'hex'` em types/map.ts) — então
 * uma imagem cuja grade real não é perfeitamente quadrada (erro de contagem,
 * imagem levemente esticada) ainda produz UM valor utilizável em vez de
 * travar ou escolher um eixo arbitrariamente.
 *
 * Devolve `null` para qualquer entrada não-positiva — célula de tamanho
 * <= 0 não é grade, é divisão por zero adiada pra `computeAlignedGridLines`.
 */
export function computeGridFromCount(imageWidth: number, imageHeight: number, cols: number, rows: number): GridAlignResult | null {
  if (imageWidth <= 0 || imageHeight <= 0 || cols <= 0 || rows <= 0) return null

  const cellFromCols = imageWidth / cols
  const cellFromRows = imageHeight / rows
  return { cellSize: (cellFromCols + cellFromRows) / 2, offset: { x: 0, y: 0 } }
}

export interface DetectedGridCount {
  cols: number
  rows: number
}

/** Nenhuma mesa de RPG usa mapa com mais de 200 quadrados num eixo — teto
 *  deliberadamente baixo pra funcionar como segunda blindagem contra falso
 *  positivo de resolução de imagem (ver `detectGridCountFromFilename`).
 *  Também é o `max` dos campos numéricos de colunas/linhas no painel. */
export const MAX_DETECTED_DIMENSION = 200

/**
 * Casa um par "NxM" separado por "x"/"X"/"×", com espaço opcional em volta,
 * em qualquer lugar do nome do arquivo. Os lookaround negativos
 * `(?<!\d)`/`(?!\d)` impedem casar um PEDAÇO de número maior: sem eles,
 * "mapa_1920x1080.png" (resolução de imagem, não grade) casaria "920x108"
 * pelas costas, porque `\d{1,3}` sozinho aceita greedy-then-backtrack dentro
 * de uma sequência de 4 dígitos. Com o lookbehind, nenhuma posição dentro de
 * "1920" serve de início de match (toda posição interna é precedida por
 * dígito), então o padrão não encontra nada nesse trecho.
 */
const FILENAME_GRID_PATTERN = /(?<!\d)(\d{1,3})\s*[x×]\s*(\d{1,3})(?!\d)/i

/**
 * Heurística de nome de arquivo — mesma paridade que o Owlbear oferece:
 * "taverna_49x28.png" propõe 49 colunas x 28 linhas; "mapa 30x20.jpg" propõe
 * 30 x 20. Convenção: primeiro número = colunas, segundo = linhas — mesma
 * ordem do campo manual em `GridAlignControls`.
 *
 * `MAX_DETECTED_DIMENSION` é a segunda blindagem, depois do lookaround acima:
 * um nome tipo "banner_800x600.jpg" tem dois números de 3 dígitos cada, que
 * passam ilesos pelo lookaround (não fazem parte de um número maior), mas
 * 800 e 600 estouram o teto de 200 e a função devolve `null` mesmo assim.
 *
 * Devolve `null` quando não há match, ou quando o match casado foge da
 * faixa [1, MAX_DETECTED_DIMENSION] em qualquer um dos dois eixos.
 */
export function detectGridCountFromFilename(filename: string): DetectedGridCount | null {
  const match = FILENAME_GRID_PATTERN.exec(filename)
  if (!match) return null

  const cols = Number(match[1])
  const rows = Number(match[2])
  if (cols < 1 || rows < 1 || cols > MAX_DETECTED_DIMENSION || rows > MAX_DETECTED_DIMENSION) return null

  return { cols, rows }
}

/**
 * "Enrola" o offset para dentro de `[0, cellSize)` em cada eixo — deslocar a
 * origem nominal por um múltiplo inteiro de célula não muda o alinhamento
 * VISUAL da grade (ela é infinita/repetida), só o valor bruto. Mantém os
 * campos numéricos do painel sempre pequenos mesmo que o usuário acumule
 * cliques de nudge além de uma célula inteira.
 *
 * `cellSize <= 0` devolve o offset sem tocar — mesma guarda defensiva de
 * `computeAlignedGridLines`, evita dividir por zero dentro do módulo (`%`).
 */
export function wrapGridOffset(offset: Point, cellSize: number): Point {
  if (cellSize <= 0) return offset
  const wrap = (value: number) => ((value % cellSize) + cellSize) % cellSize
  return { x: wrap(offset.x), y: wrap(offset.y) }
}

/**
 * Igual a `computeVisibleGridLines` (pixi/grid.ts), mas com offset. Cópia
 * DELIBERADA, não import+wrap: `pixi/grid.ts` é território do agente
 * A4/I2 (fora da minha lista de escrita nesta fase — ver prompt da tarefa),
 * e acrescentar um parâmetro novo ali reabriria um arquivo de outro agente
 * e todos os call sites já existentes de `computeVisibleGridLines`. Ganho
 * de ~8 linhas duplicadas é mais barato que essa colisão.
 *
 * Com `offset = {x:0, y:0}` este algoritmo produz exatamente as mesmas
 * posições de linha que `computeVisibleGridLines` — a única mudança é somar
 * `offset.x`/`offset.y` ao ponto de partida antes de percorrer o viewport.
 */
export function computeAlignedGridLines(cellSize: number, offset: Point, viewport: Viewport): GridLine[] {
  if (cellSize <= 0) return []

  const lines: GridLine[] = []

  const startX = Math.floor((viewport.left - offset.x) / cellSize) * cellSize + offset.x
  for (let x = startX; x < viewport.right + cellSize; x += cellSize) {
    lines.push({ axis: 'x', position: x })
  }

  const startY = Math.floor((viewport.top - offset.y) / cellSize) * cellSize + offset.y
  for (let y = startY; y < viewport.bottom + cellSize; y += cellSize) {
    lines.push({ axis: 'y', position: y })
  }

  return lines
}
