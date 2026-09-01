/**
 * Desenho do rótulo de dimensão perto do cursor durante o arrasto de
 * Sala/Retângulo/Elipse/Círculo/Polígono/Escada — item 16 do
 * PLANO-REFINAMENTO.md. Reaproveita o molde de `drawAngleIndicator.ts`
 * (cache de um único `Text` por instância, container passado em `show`,
 * `hide` limpa em todo ponto de fim de gesto) e de `drawMeasurementIndicator.ts`
 * (mesmo offset base). Difere nos dois pontos que o plano pede
 * explicitamente:
 *
 * 1. O rótulo TROCA DE LADO (direita/esquerda, cima/baixo) conforme a
 *    âncora está perto de qual borda do viewport VISÍVEL — não do mapa, que
 *    é "infinito" e quase sempre maior que a tela. `drawAngleIndicator`/
 *    `drawMeasurementIndicator` usam offset fixo porque o texto deles é
 *    curto (ângulo, ou a régua efêmera que raramente termina colada na
 *    borda); rótulo de forma inteira ("20 ft × 10 ft") é mais largo e o
 *    gesto de desenhar uma Sala/Círculo termina perto da borda da tela com
 *    frequência real (zoom alto, mapa grande).
 * 2. Texto com CONTORNO (stroke preto sobre fill branco), não só `fill` —
 *    o rótulo fica sobre a imagem de fundo do mapa, que o usuário escolhe;
 *    `ANGLE_INDICATOR_COLOR`/`SELECTION_COLOR` (constants.ts) foram
 *    calibradas pra contraste contra o CHROME do app (fundo fixo 0x2b2b2b
 *    fora da imagem), não contra fundo de imagem arbitrário claro OU
 *    escuro — branco+contorno preto lê nos dois.
 */
import { Container, Text } from 'pixi.js'
import type { Point } from './world'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'

export interface WorldViewport {
  left: number
  top: number
  right: number
  bottom: number
}

export interface DimensionLabelRenderer {
  /**
   * Mostra/atualiza o rótulo de dimensão perto de `anchor` (tipicamente o
   * `end` do draft, o ponto que o cursor está arrastando agora). Chamar a
   * cada pointermove dos blocos `drawing-rect`/`drawing-room`/
   * `drawing-ellipse`/`drawing-circle`/`drawing-stair`/`drawing-polygon-room`
   * — o texto de `label` vem pronto de `lib/dimensionText.ts`
   * (`dimensionLabel(...)`), este módulo só posiciona e desenha.
   *
   * `viewport` é o retângulo visível em coordenadas de MUNDO — a mesma
   * forma que `computeViewport()` já calcula em `PixiCanvas.tsx` (uso local
   * em drawGrid/drawHexGrid/drawTriGrid) — usado só pra decidir de que lado
   * da âncora o rótulo nasce, pra nunca sair da tela perto da borda.
   */
  show: (container: Container, anchor: Point, label: string, viewport: WorldViewport) => void
  /** Esconde o rótulo. Chamar nos mesmos pontos de limpeza de draft que já
   *  escondem `AngleIndicatorRenderer`/`MeasurementIndicatorRenderer`
   *  (clearDrafts, pointerup, pointerupoutside) — senão fica "grudado" na
   *  tela depois que o arrasto termina. */
  hide: () => void
}

const FONT_SIZE = 13
const FILL_COLOR = 0xffffff
const STROKE_COLOR = 0x000000
const STROKE_WIDTH = 3

// Offset base em unidades de MUNDO, mesma grandeza de drawAngleIndicator/
// drawMeasurementIndicator (12px) — só que aqui é o ponto de partida antes
// de `resolveDimensionLabelPosition` decidir o lado.
const LABEL_OFFSET = 12

// Estimativa de largura/altura do texto em unidades de MUNDO, sem depender
// de medição real de canvas (TextMetrics) — deixa a decisão "de que lado
// nasce o rótulo" pura e testável sem instanciar nenhum objeto Pixi.
// ~0.6×FONT_SIZE por caractere é a proporção usual de fonte sans-serif
// (DEFAULT_TEXT_FONT_FAMILY = Arial); superestimar um pouco é seguro aqui
// porque o efeito de errar pra mais é só "troca de lado um pouco cedo
// demais", nunca corta o texto — o clamp final (abaixo) cobre o resto.
const CHAR_WIDTH_ESTIMATE = FONT_SIZE * 0.6
const LABEL_HEIGHT_ESTIMATE = FONT_SIZE * 1.4

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/**
 * Posição (canto superior-esquerdo do `Text`, mesma convenção de pivot
 * padrão do Pixi) que `show` usa pra desenhar o rótulo — extraída como
 * função PURA, sem tocar em nenhum objeto Pixi, pra dar pra testar a
 * decisão de lado sem `Container`/`Text` (dimensionLabel.test.ts cobre os 4
 * cantos de borda + o caso degenerado de viewport menor que o rótulo).
 *
 * Lado padrão (longe de toda borda): acima e à direita da âncora — mesmo
 * canto que `drawAngleIndicator`/`drawMeasurementIndicator` já usam
 * (`OFFSET_X=12, OFFSET_Y=-12`), pra quem já conhece o indicador de ângulo
 * não estranhar o de dimensão ao lado.
 *
 * A decisão de trocar de lado compara a âncora com a BORDA do viewport
 * visível de cada lado (não o meio do viewport) — o mapa é maior que a
 * tela na prática, então "meio do viewport" quase nunca é "meio do mapa";
 * o que importa é se sobra espaço suficiente pro rótulo caber no lado
 * padrão sem cortar.
 */
export function resolveDimensionLabelPosition(anchor: Point, label: string, viewport: WorldViewport): Point {
  const estimatedWidth = label.length * CHAR_WIDTH_ESTIMATE
  const estimatedHeight = LABEL_HEIGHT_ESTIMATE
  const needed = LABEL_OFFSET + estimatedWidth
  const neededVertical = LABEL_OFFSET + estimatedHeight

  const roomRight = viewport.right - anchor.x
  const roomLeft = anchor.x - viewport.left
  // Só troca pra esquerda se a direita não couber E a esquerda tiver mais
  // espaço — evita oscilar pro lado errado num viewport minúsculo dos dois
  // lados (o clamp final resolve esse caso residual).
  const goLeft = roomRight < needed && roomLeft > roomRight

  const roomAbove = anchor.y - viewport.top
  const roomBelow = viewport.bottom - anchor.y
  // Perto da borda SUPERIOR (pouco espaço acima) é o único caso que troca
  // de "acima" pra "abaixo" — perto da borda inferior o padrão (acima) já
  // tem espaço de sobra na prática, então não precisa de simetria aqui.
  const goBelow = roomAbove < neededVertical && roomBelow > roomAbove

  const rawX = goLeft ? anchor.x - LABEL_OFFSET - estimatedWidth : anchor.x + LABEL_OFFSET
  const rawY = goBelow ? anchor.y + LABEL_OFFSET : anchor.y - LABEL_OFFSET - estimatedHeight

  // Clamp final dentro do viewport visível — rede de segurança pro caso
  // degenerado (viewport menor que o rótulo, zoom extremo): garante que o
  // texto nunca fica com os dois lados fora da tela ao mesmo tempo, mesmo
  // quando a heurística de lado acima não acha um lado que caiba inteiro.
  const x = clamp(rawX, viewport.left, viewport.right - estimatedWidth)
  const y = clamp(rawY, viewport.top, viewport.bottom - estimatedHeight)

  return { x, y }
}

/** Cache de um único `Text` por instância, fechado por closure — mesma
 *  lifecycle de `createAngleIndicatorRenderer`/`createMeasurementIndicatorRenderer`:
 *  instanciar uma vez por mount do PixiCanvas (dentro do `setup()`), nunca
 *  em escopo de módulo, senão StrictMode remonta e o objeto Pixi já
 *  destruído. */
export function createDimensionLabelRenderer(): DimensionLabelRenderer {
  let textObj: Text | null = null

  function ensureText(container: Container): Text {
    if (!textObj) {
      textObj = new Text({
        style: {
          fontSize: FONT_SIZE,
          fill: FILL_COLOR,
          stroke: { color: STROKE_COLOR, width: STROKE_WIDTH },
          fontFamily: DEFAULT_TEXT_FONT_FAMILY,
        },
      })
      container.addChild(textObj)
    }
    return textObj
  }

  function show(container: Container, anchor: Point, label: string, viewport: WorldViewport): void {
    const text = ensureText(container)
    text.text = label
    const position = resolveDimensionLabelPosition(anchor, label, viewport)
    text.x = position.x
    text.y = position.y
    text.visible = true
  }

  function hide(): void {
    if (textObj) textObj.visible = false
  }

  return { show, hide }
}
