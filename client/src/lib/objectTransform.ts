import type { Drawing, DrawingPoint, Token, Prop } from '../types/map'
import type { Point } from '../pixi/world'

/**
 * Agente B3 — dossiê `docs/DOSSIE-FEEDBACK-F4.md`, seção "bug3 mover e
 * redimensionar". Geometria PURA de bounding-box + alça de canto, para os
 * kinds que ainda não tinham resize algum (Drawing rect/ellipse/polygon,
 * Token, Prop) — mesmo padrão de `lib/roomOps.ts` (âncora no canto OPOSTO
 * ao arrastado, clamp de dimensão mínima, reconstrói o retângulo inteiro em
 * vez de só mover 1 canto), generalizado para um `Box` genérico em vez dos 4
 * `RegionPoint[]` fixos de uma Sala. Não importa de `roomOps.ts` de propósito
 * — mantém a fronteira de arquivos desta fase (cada agente só escreve a
 * própria lista) e o algoritmo é pequeno o bastante pra duplicar sem risco.
 *
 * Fora de escopo por natureza (não por falta de tempo — ver relatório):
 * Wall é um segmento (resize já existe via arrasto de ponta, `updateWallPoint`);
 * Light é um ponto com raio (resize já existe via `updateLightRadiusLive`).
 * Nenhum dos dois tem "bounding box" que faça sentido redimensionar por canto.
 */

/**
 * Índice de canto de um `Box`: 0 topo-esquerda, 1 topo-direita, 2 baixo-
 * direita, 3 baixo-esquerda — MESMA convenção de `RoomCorner` (`lib/roomOps.ts`),
 * deliberadamente, para quem já conhece o resize de Sala reconhecer o padrão
 * de cara.
 */
export type Corner = 0 | 1 | 2 | 3

export interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Menor dimensão aceita (px de mundo) ao redimensionar Drawing rect/ellipse/
 *  polygon por canto — mesma ordem de grandeza de `MIN_ROOM_DIMENSION`
 *  (`lib/roomOps.ts`). Evita forma degenerada (largura/altura zero ou
 *  negativa) e, no caso do polígono, divisão por um intervalo zerado ao
 *  calcular o fator de escala (ver `resizePolygonDrawing`). */
export const MIN_DRAWING_DIMENSION = 1

/** Mesmo raciocínio de `MIN_DRAWING_DIMENSION`, para Prop (`resizePropBox`). */
export const MIN_PROP_DIMENSION = 1

/**
 * Menor `Token.size` aceito ao redimensionar pela alça de canto — `size` é
 * multiplicador de célula (ver `tokenBoundingBox`), não px; 0.25 = um quarto
 * de célula, pequeno o bastante pra não sumir mas longe de zero/negativo.
 * Sem controle de UI equivalente hoje (`ItemTransformControls.tsx` só expõe
 * rotação/travar/ocultar) — este é o primeiro jeito de mudar o tamanho de um
 * Token depois de criado.
 */
export const MIN_TOKEN_SIZE = 0.25

/** Tolerância de clique/arrasto sobre uma alça de canto de resize, em px de
 *  mundo — mesma ordem de grandeza de `ROOM_CORNER_HIT_TOLERANCE`
 *  (`lib/roomOps.ts`). */
export const RESIZE_HANDLE_TOLERANCE = 10

/** Os 4 cantos de `box`, na ordem de `Corner` (0..3). */
export function boxCorners(box: Box): [Point, Point, Point, Point] {
  return [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ]
}

export function cornerPoint(box: Box, corner: Corner): Point {
  return boxCorners(box)[corner]
}

export function oppositeCorner(corner: Corner): Corner {
  // corner+2 mod 4 sempre cai em 0..3 (canto diagonalmente oposto) — mesmo
  // padrão de cast estreito que roomOps.ts usa para RoomCorner (`i as RoomCorner`
  // em findRoomCornerAt): a aritmética garante o intervalo, TS não infere
  // sozinho que `number` aqui é sempre 0|1|2|3.
  return ((corner + 2) % 4) as Corner
}

/**
 * Hit-test de alça de canto — usado no pointerdown da ferramenta Selecionar
 * (com Drawing rect/ellipse/polygon, Token ou Prop já selecionado) para
 * decidir se o clique começou um resize em vez de mover a seleção. Mesmo
 * padrão de `findRoomCornerAt` (`lib/roomOps.ts`): função pura, sem import de
 * `pixi.js`, usada tanto pelo hit-test do PixiCanvas quanto (via
 * `drawResizeHandles.ts`) pelo desenho.
 */
export function findBoxCornerAt(box: Box, point: Point, tolerance = RESIZE_HANDLE_TOLERANCE): Corner | null {
  const corners = boxCorners(box)
  for (let i = 0; i < corners.length; i += 1) {
    if (Math.hypot(point.x - corners[i].x, point.y - corners[i].y) <= tolerance) {
      // i percorre boxCorners na mesma ordem de Corner (0..3) — ver comentário do tipo.
      return i as Corner
    }
  }
  return null
}

/**
 * Afasta `value` de `anchor` por pelo menos `min`, preservando de que lado de
 * `anchor` ele já estava — mesma função de `lib/roomOps.ts` (`clampAwayFrom`),
 * reimplementada aqui em vez de importada (ver comentário do topo do arquivo).
 */
function clampAwayFromAnchor(anchor: number, value: number, min: number): number {
  if (value >= anchor) return Math.max(value, anchor + min)
  return Math.min(value, anchor - min)
}

/**
 * Recalcula `box` a partir do canto OPOSTO ao arrastado (âncora, fixo) e do
 * canto arrastado, agora em `(x, y)` — mesma ideia de `resizeRoomCorner`
 * (`lib/roomOps.ts`): reconstrói a caixa inteira a partir de 2 cantos opostos,
 * nunca só desloca 1 canto isolado, então o resultado nunca fica torto mesmo
 * se o arrasto cruzar a âncora (o retângulo espelha).
 */
export function resizeBox(box: Box, corner: Corner, x: number, y: number, minSize = MIN_DRAWING_DIMENSION): Box {
  const anchor = cornerPoint(box, oppositeCorner(corner))
  const clampedX = clampAwayFromAnchor(anchor.x, x, minSize)
  const clampedY = clampAwayFromAnchor(anchor.y, y, minSize)
  return {
    minX: Math.min(anchor.x, clampedX),
    minY: Math.min(anchor.y, clampedY),
    maxX: Math.max(anchor.x, clampedX),
    maxY: Math.max(anchor.y, clampedY),
  }
}

/**
 * Item 17 do plano (Onda 3, frente B): Shift trava proporção e Alt
 * redimensiona a partir do CENTRO em vez do canto oposto — os dois reflexos
 * que Figma/Paint/Excalidraw já ensinam pra resize por alça.
 *
 * `lib/shapeConstraint.ts` (Onda 2) resolve o problema IRMÃO — travar
 * proporção ao CRIAR uma forma nova — mas não serve aqui sem generalizar: lá
 * a forma ainda não existe, então "Shift" sempre vira 1:1 (quadrado/círculo
 * perfeito). Aqui o objeto JÁ TEM uma proporção própria (w:h de `box`, quase
 * nunca 1:1) e Shift precisa PRESERVAR essa proporção, não forçar quadrado.
 * A técnica é a mesma generalizada (ver `squareFromCorner`,
 * shapeConstraint.ts): compara o quanto cada eixo moveu RELATIVO à sua
 * própria dimensão de referência (`sx`/`sy` abaixo) e usa o MAIOR dos dois
 * como fator de escala único — "puxa o lado mais curto até o mais longo",
 * nunca o inverso.
 */
export interface ResizeModifiers {
  shift: boolean
  alt: boolean
}

function boxCenter(box: Box): Point {
  return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 }
}

/**
 * `resizeBox` com Shift (preserva a proporção ORIGINAL de `box`) e Alt
 * (âncora no CENTRO de `box` em vez do canto oposto — os dois lados se
 * movem, simétricos) opcionais. Sem nenhum modificador é idêntico a
 * `resizeBox` — sempre seguro chamar incondicionalmente, mesma convenção de
 * `constrainDraft` (shapeConstraint.ts): nenhum `if` extra no integrador.
 *
 * `origW`/`origH` zerados (box já degenerada numa linha) desliga só a trava
 * de Shift — proporção 0:N ou N:0 não é uma razão que faça sentido
 * preservar (divisão por zero); Alt sozinho continua funcionando normal.
 */
export function resizeBoxWithModifiers(
  box: Box,
  corner: Corner,
  x: number,
  y: number,
  modifiers: ResizeModifiers,
  minSize = MIN_DRAWING_DIMENSION,
): Box {
  const anchor = modifiers.alt ? boxCenter(box) : cornerPoint(box, oppositeCorner(corner))
  const origW = box.maxX - box.minX
  const origH = box.maxY - box.minY

  let targetX = x
  let targetY = y

  if (modifiers.shift && origW > 0 && origH > 0) {
    // Com Alt, a âncora é o centro: a dimensão de referência de cada eixo é
    // a MEIA largura/altura (distância do centro até o canto), não a
    // largura/altura inteira — sem Alt, a âncora é o canto oposto, que já
    // está a uma largura/altura INTEIRA de distância do canto arrastado.
    const refW = modifiers.alt ? origW / 2 : origW
    const refH = modifiers.alt ? origH / 2 : origH
    const dx = x - anchor.x
    const dy = y - anchor.y
    const scale = Math.max(Math.abs(dx) / refW, Math.abs(dy) / refH)
    targetX = anchor.x + Math.sign(dx) * refW * scale
    targetY = anchor.y + Math.sign(dy) * refH * scale
  }

  if (modifiers.alt) {
    // Âncora no centro: os dois lados de cada eixo se movem junto, então o
    // box final é reconstruído a partir de meia-largura/meia-altura em vez
    // de reusar `resizeBox` (que sempre fixa o canto OPOSTO parado).
    const halfW = Math.max(Math.abs(targetX - anchor.x), minSize / 2)
    const halfH = Math.max(Math.abs(targetY - anchor.y), minSize / 2)
    return { minX: anchor.x - halfW, minY: anchor.y - halfH, maxX: anchor.x + halfW, maxY: anchor.y + halfH }
  }

  return resizeBox(box, corner, targetX, targetY, minSize)
}

/** Bounding box de uma lista de pontos crus (ex.: `Drawing` kind 'polygon').
 *  `null` para lista vazia — não existe caixa de zero ponto. */
export function pointsBoundingBox(points: DrawingPoint[]): Box | null {
  if (points.length === 0) return null
  let minX = points[0].x
  let minY = points[0].y
  let maxX = points[0].x
  let maxY = points[0].y
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Bounding box de um `Drawing`, só para os kinds redimensionáveis por canto
 * nesta fase (rect/ellipse/polygon — prioridades 1-2 do agente B3). `null`
 * para os demais kinds (freehand/line/circle/curve/text): eles têm move nesta
 * fase (ver CONTRATO), mas nenhuma alça de resize — mesmo raciocínio de
 * Wall/Light no comentário do topo do arquivo, aplicado por kind em vez de
 * por entidade inteira.
 */
export function drawingBoundingBox(drawing: Drawing): Box | null {
  if (drawing.kind === 'rect') {
    return { minX: drawing.x, minY: drawing.y, maxX: drawing.x + drawing.w, maxY: drawing.y + drawing.h }
  }
  if (drawing.kind === 'ellipse') {
    return {
      minX: drawing.cx - drawing.rx,
      minY: drawing.cy - drawing.ry,
      maxX: drawing.cx + drawing.rx,
      maxY: drawing.cy + drawing.ry,
    }
  }
  if (drawing.kind === 'polygon') return pointsBoundingBox(drawing.points)
  return null
}

/** Bounding box de um Token — quadrado centrado em (token.x, token.y), meio-
 *  lado = raio de hit-test que `tokenInteraction.ts` (`findTokenAt`) já usa:
 *  `(gridSize / 2) * token.size`. Mesma fonte de verdade, não duplicada. */
export function tokenBoundingBox(token: Token, gridSize: number): Box {
  const half = (gridSize / 2) * token.size
  return { minX: token.x - half, minY: token.y - half, maxX: token.x + half, maxY: token.y + half }
}

/** Bounding box de um Prop — retângulo `width`×`height` centrado em
 *  (prop.x, prop.y), mesma convenção de `propInteraction.ts` (`findPropAt`). */
export function propBoundingBox(prop: Prop): Box {
  return {
    minX: prop.x - prop.width / 2,
    minY: prop.y - prop.height / 2,
    maxX: prop.x + prop.width / 2,
    maxY: prop.y + prop.height / 2,
  }
}

type RectDrawing = Extract<Drawing, { kind: 'rect' }>
type EllipseDrawing = Extract<Drawing, { kind: 'ellipse' }>
type PolygonDrawing = Extract<Drawing, { kind: 'polygon' }>

/** Modificadores "sem nenhum" — mesmo valor default em toda assinatura que
 *  ganhou `modifiers` nesta onda (item 17), pra quem chama sem passar nada
 *  (todo call site de antes desta mudança) continuar com o resultado
 *  idêntico ao de antes, byte a byte. */
const NO_RESIZE_MODIFIERS: ResizeModifiers = { shift: false, alt: false }

/** Redimensiona um Drawing 'rect' pelo canto arrastado — reconstrói x/y/w/h
 *  a partir do `Box` resultante de `resizeBoxWithModifiers`. `modifiers`
 *  opcional (item 17): Shift preserva a proporção w:h original, Alt
 *  redimensiona a partir do centro. */
export function resizeRectDrawing(
  drawing: RectDrawing,
  corner: Corner,
  x: number,
  y: number,
  modifiers: ResizeModifiers = NO_RESIZE_MODIFIERS,
): RectDrawing {
  const box = resizeBoxWithModifiers(
    { minX: drawing.x, minY: drawing.y, maxX: drawing.x + drawing.w, maxY: drawing.y + drawing.h },
    corner,
    x,
    y,
    modifiers,
  )
  return { ...drawing, x: box.minX, y: box.minY, w: box.maxX - box.minX, h: box.maxY - box.minY }
}

/** Redimensiona um Drawing 'ellipse' pelo canto arrastado — trata a elipse
 *  como a bounding box (cx±rx, cy±ry) pro resize, depois reconverte pra
 *  centro+raios. `modifiers` opcional (item 17), mesma regra de
 *  `resizeRectDrawing`. */
export function resizeEllipseDrawing(
  drawing: EllipseDrawing,
  corner: Corner,
  x: number,
  y: number,
  modifiers: ResizeModifiers = NO_RESIZE_MODIFIERS,
): EllipseDrawing {
  const box = resizeBoxWithModifiers(
    { minX: drawing.cx - drawing.rx, minY: drawing.cy - drawing.ry, maxX: drawing.cx + drawing.rx, maxY: drawing.cy + drawing.ry },
    corner,
    x,
    y,
    modifiers,
  )
  return {
    ...drawing,
    cx: (box.minX + box.maxX) / 2,
    cy: (box.minY + box.maxY) / 2,
    rx: (box.maxX - box.minX) / 2,
    ry: (box.maxY - box.minY) / 2,
  }
}

/**
 * Redimensiona um Drawing 'polygon' pelo canto arrastado — diferente de
 * rect/ellipse (que SÃO a própria bounding box), um polígono é uma nuvem de
 * pontos arbitrária: a bounding box aqui é só o "envelope" usado pra calcular
 * o fator de escala (sx, sy) e a âncora (canto oposto), e TODO ponto do
 * polígono escala em torno dessa âncora — é o mesmo efeito visual de
 * arrastar a alça de canto de um objeto vetorial em qualquer editor.
 * `oldW`/`oldH` zerados (polígono achatado numa linha) tratam a escala
 * daquele eixo como 1 (não escala, evita divisão por zero) em vez de recusar
 * o resize inteiro.
 *
 * `modifiers` opcional (item 17): Shift preserva a proporção original (via
 * `resizeBoxWithModifiers`, que já resolve o fator de escala único pros dois
 * eixos — aqui só se reaplica esse MESMO fator a cada ponto, em vez de só
 * aos 4 cantos da bounding box). Alt muda a âncora pro CENTRO da caixa
 * original, então cada ponto escala em torno do centro, não do canto oposto.
 */
export function resizePolygonDrawing(
  drawing: PolygonDrawing,
  corner: Corner,
  x: number,
  y: number,
  modifiers: ResizeModifiers = NO_RESIZE_MODIFIERS,
): PolygonDrawing {
  const box = pointsBoundingBox(drawing.points)
  if (!box) return drawing

  const newBox = resizeBoxWithModifiers(box, corner, x, y, modifiers)
  const oldW = box.maxX - box.minX
  const oldH = box.maxY - box.minY
  const sx = oldW === 0 ? 1 : (newBox.maxX - newBox.minX) / oldW
  const sy = oldH === 0 ? 1 : (newBox.maxY - newBox.minY) / oldH
  const anchor = modifiers.alt ? boxCenter(box) : cornerPoint(box, oppositeCorner(corner))

  return {
    ...drawing,
    points: drawing.points.map((p) => ({
      x: anchor.x + (p.x - anchor.x) * sx,
      y: anchor.y + (p.y - anchor.y) * sy,
    })),
  }
}

/**
 * Novo `Token.size` a partir do canto arrastado até `(x, y)` — diferente de
 * rect/ellipse/prop, Token é sempre um círculo centrado em (token.x, token.y):
 * não há "largura" e "altura" independentes, só um raio. Por isso o resize é
 * uniforme (distância de Chebyshev — `max(|dx|, |dy|)` — do centro até o
 * ponto do cursor, não a distância euclidiana) e `corner` não entra na conta:
 * qualquer um dos 4 cantos produz o mesmo raio para o mesmo ponto do cursor,
 * por simetria. `gridSize <= 0` (mapa sem grade válida) devolve o tamanho
 * atual sem mudança, em vez de dividir por zero.
 */
export function resizeTokenSize(token: Token, gridSize: number, x: number, y: number): number {
  const baseRadius = gridSize / 2
  if (baseRadius <= 0) return token.size
  const half = Math.max(Math.abs(x - token.x), Math.abs(y - token.y))
  return Math.max(half / baseRadius, MIN_TOKEN_SIZE)
}

/**
 * Novo x/y/width/height de um Prop a partir do canto arrastado — mesmo
 * `resizeBoxWithModifiers` de rect/ellipse, mas Prop guarda center+dimensões
 * (não min-corner+dimensões como rect), então o retorno já vem convertido
 * pro formato que `Prop` usa. `modifiers` opcional (item 17), mesma regra de
 * `resizeRectDrawing`.
 */
export function resizePropBox(
  prop: Prop,
  corner: Corner,
  x: number,
  y: number,
  modifiers: ResizeModifiers = NO_RESIZE_MODIFIERS,
): { x: number; y: number; width: number; height: number } {
  const box = resizeBoxWithModifiers(propBoundingBox(prop), corner, x, y, modifiers, MIN_PROP_DIMENSION)
  return {
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2,
    width: box.maxX - box.minX,
    height: box.maxY - box.minY,
  }
}

type CircleDrawing = Extract<Drawing, { kind: 'circle' }>

/**
 * Item 18 do plano (mesma frente, mesma onda): novo raio de um Drawing
 * 'circle' a partir do ponto arrastado até `(x, y)` — completa a alça de
 * raio que `pixi/drawEditHandles.ts` passa a desenhar/hit-testar pro
 * Drawing circle (reaproveitando `drawLightRadiusHandle`), pra ela não ficar
 * só decorativa: sem esta função, arrastar a alça não move nada.
 *
 * MESMA matemática que já roda inline pra Luz em `pixi/PixiCanvas.tsx`
 * (`updateLightRadiusLive` / `Math.hypot(worldPoint.x - light.x,
 * worldPoint.y - light.y)`) — não dá pra chamar a mesma função porque
 * `Light` guarda o centro em `x`/`y` e Drawing 'circle' guarda em `cx`/`cy`
 * (shapes diferentes), mas o CÁLCULO é idêntico, extraído aqui em vez de
 * reescrito inline uma segunda vez. Sem mínimo: mesmo comportamento de hoje
 * pra Luz — o raio pode passar por 0 durante o arrasto, sem clamp.
 */
export function resizeCircleDrawingRadius(drawing: CircleDrawing, x: number, y: number): number {
  return Math.hypot(x - drawing.cx, y - drawing.cy)
}
