/**
 * Número ao vivo durante o desenho — item 16 do PLANO-REFINAMENTO.md ("Sala,
 * Retângulo, Elipse, Círculo, Polígono e Escada se desenham no escuro").
 * Função PURA: dado o rascunho (draft) em andamento de uma ferramenta de
 * forma, devolve o texto pronto pra exibir perto do cursor. Quem desenha o
 * texto no canvas é `pixi/drawDimensionLabel.ts`; quem decide QUANDO chamar
 * (a cada pointermove dos blocos `drawing-*`) é o integrador em
 * `pixi/PixiCanvas.tsx`.
 *
 * REUSA `lib/measurement.ts` (`measureDistance`) em vez de reimplementar a
 * conversão célula→unidade→arredondamento→rótulo — mesma fonte de verdade
 * que a ferramenta Medir já usa, então "10 ft" aqui e "10 ft" na régua nunca
 * divergem por causa de duas implementações de arredondamento.
 *
 * `start`/`end`/`center` são sempre pixels de MUNDO, nunca de tela — mesma
 * convenção do resto do app.
 */
import type { GridShape, MapScale } from '../types/map'
import type { Point } from '../pixi/world'
import { measureDistance } from './measurement'

/**
 * Um rascunho por ferramenta, na forma exata que `PixiCanvas.tsx` já tem em
 * mãos em cada bloco `drawing-*` — sem exigir nenhuma transformação do
 * integrador antes de chamar `dimensionLabel`. 'rect'/'room' e 'line'/'wall'/
 * 'stair' compartilham formato (ambos pares start/end) mas ficam listados
 * separado por clareza de leitura no call site — a decisão de agrupá-los ou
 * não é só de rótulo do tipo, o `switch` abaixo já trata os dois grupos com
 * o mesmo código.
 */
export type DimensionDraft =
  | { tool: 'rect' | 'room'; start: Point; end: Point }
  | { tool: 'ellipse'; center: Point; end: Point }
  | { tool: 'circle'; center: Point; end: Point }
  | { tool: 'line' | 'wall' | 'stair'; start: Point; end: Point }
  | { tool: 'polygon-room'; center: Point; end: Point; sides: number }

const SEPARATOR = ' × '

/**
 * Distância euclidiana entre dois pontos, já formatada em unidade real —
 * fininha em cima de `measureDistance` fixando `mode: 'euclidean'` (a única
 * geometricamente correta pra "largura de um retângulo" ou "comprimento de
 * um segmento"; os outros modos — tabuleiro/diagonal-alternada/manhattan —
 * são regra de MOVIMENTO em grade, não medida de forma, e não fazem sentido
 * aqui). `gridShape` é passado adiante só porque `measureDistance` exige o
 * parâmetro; o modo 'euclidean' não o consulta (ver measurement.ts).
 */
function axisLabel(a: Point, b: Point, gridSize: number, gridShape: GridShape, scale: MapScale): string {
  return measureDistance(a, b, gridSize, gridShape, 'euclidean', scale).label
}

/**
 * Devolve o texto certo pra ferramenta do `draft`, na escala do mapa
 * (`MapScale`, já com unidade/casas decimais — ver `lib/measurement.ts`).
 *
 * - 'rect'/'room': "largura × altura", medida eixo a eixo a partir de
 *   `start` (o canto fixo do arrasto) — mesma decomposição x/y que
 *   `drawRectDraft`/`drawRoomDraft` (pixi/drawDraft.ts) já usam pra desenhar
 *   o preview, só que aqui em unidade real em vez de px de mundo.
 * - 'ellipse': "largura × altura" também, mas das duas EXTENSÕES TOTAIS
 *   (2×rx, 2×ry) — não dos semieixos. Ellipse.rx/ry na store já são
 *   semieixos (ver drawEllipseDraft), e mostrar o raio confundiria com a
 *   largura/altura que rect/room já reportam nesse mesmo formato "W × H".
 *   Consegue o dobro reaplicando `axisLabel` sobre um ponto 2× mais longe de
 *   `center` na mesma direção — a distância medida nesse ponto é
 *   exatamente 2×rx (ou 2×ry) já arredondada, sem duplicar a lógica de
 *   arredondamento de `measureDistance` fazendo `label` × 2 na mão (que
 *   arredondaria duas vezes, com erro acumulado).
 * - 'circle': raio E diâmetro juntos — o plano pede "raio ou diâmetro" sem
 *   decidir qual; os dois cabem numa linha e tiram a ambiguidade de quem lê.
 *   Diâmetro pela mesma técnica do ponto 2× mais longe, mesmo motivo acima.
 * - 'line'/'wall'/'stair': só o comprimento — Parede e Linha já têm o
 *   indicador de ÂNGULO (`drawAngleIndicator.ts`, ligado no integrador da
 *   Onda 1); este módulo cobre a lacuna do COMPRIMENTO nas três, que hoje
 *   nenhuma mostra.
 * - 'polygon-room': número de lados (fixo durante o arrasto — vem de
 *   `polygonSides`/`ROOM_CIRCLE_SIDES` na store, não muda com o gesto) mais
 *   o raio, mesma técnica de 'circle' sem o diâmetro (polígono não tem a
 *   mesma leitura de "diâmetro" que um círculo).
 */
export function dimensionLabel(draft: DimensionDraft, gridSize: number, gridShape: GridShape, scale: MapScale): string {
  switch (draft.tool) {
    case 'rect':
    case 'room': {
      const widthLabel = axisLabel(draft.start, { x: draft.end.x, y: draft.start.y }, gridSize, gridShape, scale)
      const heightLabel = axisLabel(draft.start, { x: draft.start.x, y: draft.end.y }, gridSize, gridShape, scale)
      return `${widthLabel}${SEPARATOR}${heightLabel}`
    }

    case 'ellipse': {
      const fullWidthPoint: Point = { x: draft.center.x + (draft.end.x - draft.center.x) * 2, y: draft.center.y }
      const fullHeightPoint: Point = { x: draft.center.x, y: draft.center.y + (draft.end.y - draft.center.y) * 2 }
      const widthLabel = axisLabel(draft.center, fullWidthPoint, gridSize, gridShape, scale)
      const heightLabel = axisLabel(draft.center, fullHeightPoint, gridSize, gridShape, scale)
      return `${widthLabel}${SEPARATOR}${heightLabel}`
    }

    case 'circle': {
      const diameterPoint: Point = {
        x: draft.center.x + (draft.end.x - draft.center.x) * 2,
        y: draft.center.y + (draft.end.y - draft.center.y) * 2,
      }
      const radiusLabel = axisLabel(draft.center, draft.end, gridSize, gridShape, scale)
      const diameterLabel = axisLabel(draft.center, diameterPoint, gridSize, gridShape, scale)
      return `r ${radiusLabel} (⌀ ${diameterLabel})`
    }

    case 'line':
    case 'wall':
    case 'stair':
      return axisLabel(draft.start, draft.end, gridSize, gridShape, scale)

    case 'polygon-room': {
      const radiusLabel = axisLabel(draft.center, draft.end, gridSize, gridShape, scale)
      return `${draft.sides} lados · r ${radiusLabel}`
    }
  }
}
