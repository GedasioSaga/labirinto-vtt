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
 *    é "infinito" e quase sempre maior que a tela. `drawMeasurementIndicator`
 *    usa offset fixo porque a régua efêmera raramente termina colada na
 *    borda; rótulo de forma inteira ("20 ft × 10 ft") é mais largo e o
 *    gesto de desenhar uma Sala/Círculo termina perto da borda da tela com
 *    frequência real (zoom alto, mapa grande).
 * 2. Texto com CONTORNO (stroke preto sobre fill branco), não só `fill` —
 *    o rótulo fica sobre a imagem de fundo do mapa, que o usuário escolhe, e
 *    sobre o chão das salas; um cinza calibrado contra o CHROME do app
 *    (fundo fixo 0x2b2b2b fora da imagem) some num fundo claro OU escuro —
 *    branco+contorno preto lê nos dois.
 *
 * Desde a conferência guias-4e5 o rótulo do TRAÇO (`drawAngleIndicator.ts`:
 * "comprimento · ângulo" de Parede, Linha e Caminho) também mora nas regras
 * daqui: o mesmo estilo (`measureLabelStyle`) e o lado escolhido por
 * `resolveStrokeLabelPosition`, que foge das guias da ponta.
 */
import { Container, Text, type TextStyleOptions } from 'pixi.js'
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
 * Tamanho estimado do rótulo em unidades de MUNDO (ver `CHAR_WIDTH_ESTIMATE`),
 * o mesmo que as duas decisões de lado usam. Exportado para o teste medir a
 * caixa do rótulo com a mesma régua de quem o posiciona.
 */
export function estimateMeasureLabelSize(label: string): { width: number; height: number } {
  return { width: label.length * CHAR_WIDTH_ESTIMATE, height: LABEL_HEIGHT_ESTIMATE }
}

/**
 * Estilo do rótulo de medida ao desenhar: branco com contorno preto (ver o
 * cabeçalho). Objeto novo a cada chamada, porque cada `Text` monta o próprio
 * `TextStyle` a partir dele. O rótulo do traço (`drawAngleIndicator.ts`) usa o
 * mesmo: na conferência guias-4e5 o cinza sem contorno dele sumia sobre o chão
 * da sala, enquanto este lia bem no mesmo print.
 */
export function measureLabelStyle(): Partial<TextStyleOptions> {
  return {
    fontSize: FONT_SIZE,
    fill: FILL_COLOR,
    stroke: { color: STROKE_COLOR, width: STROKE_WIDTH },
    fontFamily: DEFAULT_TEXT_FONT_FAMILY,
  }
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

/**
 * Fica no lado preferido, a não ser que ele não caiba e o outro tenha mais
 * espaço — a mesma regra de troca de `resolveDimensionLabelPosition`, agora
 * nos dois sentidos, porque o lado preferido do traço pode ser qualquer um.
 */
function staysOnPreferredSide(roomPreferred: number, roomOther: number, needed: number): boolean {
  return !(roomPreferred < needed && roomOther > roomPreferred)
}

/**
 * Posição (canto superior-esquerdo do `Text`) do rótulo "comprimento · ângulo"
 * do TRAÇO — Parede, Linha e o segmento do Caminho —, com `from` o começo do
 * traço e `end` a ponta que o cursor puxa.
 *
 * O rótulo nasce no quadrante que CONTINUA o traço depois da ponta: à direita
 * se o traço anda para a direita, embaixo se anda para baixo. As guias que
 * encaixam a ponta passam por ela, na vertical e na horizontal, e o rótulo
 * inteiro fica do outro lado das duas — e do próprio traço, que está atrás da
 * ponta. Conferência guias-4e5: com o canto fixo de antes (texto começando 12
 * px acima da ponta, mais baixo que a altura dele), a guia horizontal cortava
 * a base do "5,1 m · 325,2°" justamente ao alinhar pela lateral. Traço em pé
 * fica à direita e traço deitado fica em cima: o lado de sempre.
 *
 * Perto da borda da tela o lado troca, como no rótulo das formas; o clamp final
 * segura o caso degenerado.
 */
export function resolveStrokeLabelPosition(from: Point, end: Point, label: string, viewport: WorldViewport): Point {
  const { width, height } = estimateMeasureLabelSize(label)
  const neededX = LABEL_OFFSET + width
  const neededY = LABEL_OFFSET + height

  const roomRight = viewport.right - end.x
  const roomLeft = end.x - viewport.left
  const roomAbove = end.y - viewport.top
  const roomBelow = viewport.bottom - end.y

  const prefersLeft = end.x < from.x
  const prefersBelow = end.y > from.y
  const goLeft = prefersLeft ? staysOnPreferredSide(roomLeft, roomRight, neededX) : !staysOnPreferredSide(roomRight, roomLeft, neededX)
  const goBelow = prefersBelow ? staysOnPreferredSide(roomBelow, roomAbove, neededY) : !staysOnPreferredSide(roomAbove, roomBelow, neededY)

  const rawX = goLeft ? end.x - LABEL_OFFSET - width : end.x + LABEL_OFFSET
  const rawY = goBelow ? end.y + LABEL_OFFSET : end.y - LABEL_OFFSET - height

  return { x: clamp(rawX, viewport.left, viewport.right - width), y: clamp(rawY, viewport.top, viewport.bottom - height) }
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
      textObj = new Text({ style: measureLabelStyle() })
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
