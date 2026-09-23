import type { MapData, Drawing } from '../types/map'

export interface Camera {
  x: number
  y: number
  scale: number
}

export interface Point {
  x: number
  y: number
}

export const MIN_SCALE = 0.1
export const MAX_SCALE = 4

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

export function zoomAt(camera: Camera, pointer: Point, wheelDeltaY: number): Camera {
  const zoomFactor = Math.exp(-wheelDeltaY * 0.001)
  const newScale = clampScale(camera.scale * zoomFactor)

  const worldX = (pointer.x - camera.x) / camera.scale
  const worldY = (pointer.y - camera.y) / camera.scale

  return {
    scale: newScale,
    x: pointer.x - worldX * newScale,
    y: pointer.y - worldY * newScale,
  }
}

/** Ponto de mundo no centro de uma tela de `width` × `height` px com esta câmera. */
export function viewportCenterWorld(camera: Camera, width: number, height: number): Point {
  return {
    x: (width / 2 - camera.x) / camera.scale,
    y: (height / 2 - camera.y) / camera.scale,
  }
}

export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy }
}

/**
 * Câmera com a escala `scale` (dentro dos limites) que mantém parado na tela o
 * ponto do mundo que está sob `pointer`. É o `zoomAt` com alvo em escala, não
 * em passo de roda: os botões + e − do jogador sabem a escala que querem.
 */
export function zoomToScale(camera: Camera, pointer: Point, scale: number): Camera {
  const next = clampScale(scale)
  const worldX = (pointer.x - camera.x) / camera.scale
  const worldY = (pointer.y - camera.y) / camera.scale
  return { scale: next, x: pointer.x - worldX * next, y: pointer.y - worldY * next }
}

/**
 * Começo de uma pinça de dois dedos: o ponto do MUNDO sob o meio dos dedos, a
 * escala e a distância entre eles naquele instante. Tudo o que a pinça faz
 * depois é relativo a isto, e não ao quadro anterior — não acumula erro.
 */
export interface PinchStart {
  anchor: Point
  scale: number
  distance: number
}

/**
 * Distância mínima entre os dedos, em px de tela. Dois dedos que encostam no
 * mesmo pixel dariam distância 0 e uma divisão por zero (zoom infinito).
 */
const MIN_PINCH_DISTANCE = 1

function pinchGeometry(a: Point, b: Point): { middle: Point; distance: number } {
  return {
    middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    distance: Math.max(Math.hypot(b.x - a.x, b.y - a.y), MIN_PINCH_DISTANCE),
  }
}

export function pinchStart(camera: Camera, a: Point, b: Point): PinchStart {
  const { middle, distance } = pinchGeometry(a, b)
  return {
    anchor: { x: (middle.x - camera.x) / camera.scale, y: (middle.y - camera.y) / camera.scale },
    scale: camera.scale,
    distance,
  }
}

/**
 * Câmera da pinça com os dedos em `a` e `b`: a escala segue a razão entre a
 * distância dos dedos agora e no começo, e o ponto do mundo que estava sob o
 * meio deles continua sob o meio — que pode ter andado, então os dois dedos
 * juntos também arrastam o mapa, como em qualquer mapa de celular.
 */
export function pinchCamera(start: PinchStart, a: Point, b: Point): Camera {
  const { middle, distance } = pinchGeometry(a, b)
  const scale = clampScale(start.scale * (distance / start.distance))
  return { scale, x: middle.x - start.anchor.x * scale, y: middle.y - start.anchor.y * scale }
}

// Trava o segmento start->end no múltiplo de `stepDegrees` mais próximo do
// ângulo livre atual (default 45: produz 0/45/90/135/180/225/270/315).
// Calcula o ângulo livre via atan2(dy,dx), arredonda pro múltiplo mais
// próximo de stepDegrees e recalcula o ponto final na MESMA distância de
// `start` — só a DIREÇÃO muda, o comprimento do arrasto é preservado.
//
// Generaliza a versão anterior (constrainToRightAngle, removida), que zerava
// o eixo não-dominante em vez de girar em torno de `start`: com stepDegrees=90
// os números batem só quando o ângulo livre já cai exatamente num eixo (dx=0
// ou dy=0) — fora disso o comprimento final passa a ser preservado (era
// truncado antes). stepDegrees=90 continua sendo um caso particular válido
// desta função (só 4 direções, sem 45/135/225/315).
export function constrainToAngleStep(start: Point, end: Point, stepDegrees = 45): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.hypot(dx, dy)
  const freeAngle = Math.atan2(dy, dx)
  const stepRadians = (stepDegrees * Math.PI) / 180
  const snappedAngle = Math.round(freeAngle / stepRadians) * stepRadians
  return {
    x: start.x + distance * Math.cos(snappedAngle),
    y: start.y + distance * Math.sin(snappedAngle),
  }
}

// Ângulo do segmento start->end em graus, normalizado pra [0, 360). Y cresce
// pra baixo no canvas (convenção Pixi), então isso já é o sentido horário na
// tela sem ajuste extra — usado pelo indicador visual de ângulo durante o
// arrasto de Parede/Linha (ver PixiCanvas.tsx).
export function angleDegrees(start: Point, end: Point): number {
  const rad = Math.atan2(end.y - start.y, end.x - start.x)
  const deg = (rad * 180) / Math.PI
  return deg < 0 ? deg + 360 : deg
}

// ─────────────────────────────────────────────────────────────
// ENQUADRAMENTO — item #9 do PLANO-REFINAMENTO.md. A câmera nasce sempre em
// {x:0, y:0, scale:1} (stores/mapStore.ts:446); estas duas funções puras dão
// ao integrador o que falta para enquadrar tudo (tecla F), resetar 100%
// (Ctrl+0) e fazer fit automático ao abrir um mapa salvo.
// ─────────────────────────────────────────────────────────────

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Viewport {
  width: number
  height: number
}

function extend(bounds: Bounds | null, x: number, y: number): Bounds {
  if (bounds === null) return { minX: x, minY: y, maxX: x, maxY: y }
  return {
    minX: Math.min(bounds.minX, x),
    minY: Math.min(bounds.minY, y),
    maxX: Math.max(bounds.maxX, x),
    maxY: Math.max(bounds.maxY, y),
  }
}

// Envelope de um Drawing por `kind` — mesma ideia de `lib/objectTransform.ts`
// (`drawingBoundingBox`), mas cobrindo os 8 kinds (aqui é só leitura pra
// enquadrar câmera, não redimensionar por alça, então não há razão pra
// devolver `null` em nenhum kind). Não importa de `objectTransform.ts` de
// propósito: mantém `world.ts` sem depender de outro arquivo em progresso
// nesta onda, e a lista de `kind` é pequena o bastante pra duplicar sem risco.
function extendDrawing(bounds: Bounds | null, drawing: Drawing): Bounds | null {
  switch (drawing.kind) {
    case 'freehand':
    case 'curve':
    case 'polygon':
    case 'path': {
      // Lista de pontos vazia (drawing degenerado) devolve `bounds` intacto,
      // `null` incluso — nunca fabrica um ponto (0,0) que não existe no mapa.
      let next = bounds
      for (const p of drawing.points) next = extend(next, p.x, p.y)
      return next
    }
    case 'line': {
      const withStart = extend(bounds, drawing.x1, drawing.y1)
      return extend(withStart, drawing.x2, drawing.y2)
    }
    case 'circle': {
      const withMin = extend(bounds, drawing.cx - drawing.radius, drawing.cy - drawing.radius)
      return extend(withMin, drawing.cx + drawing.radius, drawing.cy + drawing.radius)
    }
    case 'rect': {
      const withOrigin = extend(bounds, drawing.x, drawing.y)
      return extend(withOrigin, drawing.x + drawing.w, drawing.y + drawing.h)
    }
    case 'ellipse': {
      const withMin = extend(bounds, drawing.cx - drawing.rx, drawing.cy - drawing.ry)
      return extend(withMin, drawing.cx + drawing.rx, drawing.cy + drawing.ry)
    }
    case 'text':
      return extend(bounds, drawing.x, drawing.y)
  }
}

/**
 * Caixa que contém TODO o conteúdo do mapa (paredes, regiões, tokens, peças,
 * escadas, luzes, desenhos) em coordenadas de mundo. `null` para mapa vazio —
 * não existe caixa de conteúdo nenhum, e forçar um valor (ex.: {0,0,0,0})
 * esconderia o caso "nada pra enquadrar" de quem chama.
 *
 * Ignora `locked`/`hidden`: "enquadrar tudo" é enquadrar tudo, incluindo o
 * que está oculto no editor — mesmo raciocínio de `hidden` em Wall/Light/
 * Region/Token/Prop/Stair (ver types/map.ts): oculto é organização de cena
 * pro mestre, não uma segunda visibilidade real.
 *
 * Token/Prop reusam a MESMA conta de meio-lado que
 * `lib/objectTransform.ts` (`tokenBoundingBox`/`propBoundingBox`) usa pro
 * resize, sem importar de lá (mesmo motivo de `extendDrawing`, acima).
 */
export function contentBounds(map: MapData): Bounds | null {
  let bounds: Bounds | null = null

  for (const wall of map.walls) {
    bounds = extend(bounds, wall.x1, wall.y1)
    bounds = extend(bounds, wall.x2, wall.y2)
  }
  for (const region of map.regions) {
    for (const p of region.points) bounds = extend(bounds, p.x, p.y)
  }
  for (const token of map.tokens) {
    const half = (map.grid / 2) * token.size
    bounds = extend(bounds, token.x - half, token.y - half)
    bounds = extend(bounds, token.x + half, token.y + half)
  }
  for (const prop of map.props) {
    bounds = extend(bounds, prop.x - prop.width / 2, prop.y - prop.height / 2)
    bounds = extend(bounds, prop.x + prop.width / 2, prop.y + prop.height / 2)
  }
  for (const stair of map.stairs) {
    for (const seg of stair.segments) {
      bounds = extend(bounds, seg.x1, seg.y1)
      bounds = extend(bounds, seg.x2, seg.y2)
    }
  }
  for (const light of map.lights) {
    bounds = extend(bounds, light.x - light.radius, light.y - light.radius)
    bounds = extend(bounds, light.x + light.radius, light.y + light.radius)
  }
  for (const drawing of map.drawings) {
    bounds = extendDrawing(bounds, drawing)
  }

  return bounds
}

// Evita a divisão 0/0 (NaN) quando `bounds` é degenerado num eixo — parede
// perfeitamente horizontal tem altura 0, conteúdo de um único ponto (ou uma
// luz de raio 0) tem largura E altura 0. Não é preciso proteger contra
// viewport zero: X/0 é `Infinity` em JS, não `NaN`, e `clampScale` (chamada
// logo abaixo) já trava isso em MAX_SCALE — só o 0/0 literal produz NaN.
const MIN_CONTENT_DIMENSION = 1e-6

/**
 * Zoom e centro de câmera que enquadram `bounds` dentro de `viewport` (em px
 * de tela), com `margin` px de respiro de cada lado. Escala sempre passada
 * por `clampScale` — os mesmos MIN_SCALE/MAX_SCALE que `zoomAt` já respeita,
 * então esta função nunca devolve um zoom fora do que a roda do mouse também
 * conseguiria produzir.
 *
 * Não recebe `bounds: Bounds | null`: mapa vazio é decisão de quem chama
 * (ver `contentBounds`), não desta função — cair aqui com `bounds` sempre
 * definido mantém a assinatura de `viewport → câmera` sem um terceiro estado
 * ("null" = quê, câmera default? mantém a atual?) que não é geometria pura.
 */
export function fitCamera(bounds: Bounds, viewport: Viewport, margin: number): Camera {
  const contentWidth = Math.max(bounds.maxX - bounds.minX, MIN_CONTENT_DIMENSION)
  const contentHeight = Math.max(bounds.maxY - bounds.minY, MIN_CONTENT_DIMENSION)
  const availableWidth = Math.max(viewport.width - margin * 2, 0)
  const availableHeight = Math.max(viewport.height - margin * 2, 0)

  const scale = clampScale(Math.min(availableWidth / contentWidth, availableHeight / contentHeight))

  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2

  return {
    scale,
    x: viewport.width / 2 - centerX * scale,
    y: viewport.height / 2 - centerY * scale,
  }
}

/**
 * Menor fração do canvas que a área livre pode ter, em cada eixo. Abaixo
 * disso (janela estreita, painel enorme) o "livre" é só uma fresta: centrar
 * ali seria pior que centrar no canvas inteiro.
 */
const MIN_FREE_FRACTION = 0.25

/**
 * Centro, em px de tela, da parte do canvas que os painéis flutuantes não
 * cobrem. `obstacles` são os retângulos desses painéis, em px relativos ao
 * canvas (como `minX`..`maxY`). Painel mais alto que largo (o rail) come a
 * faixa do lado que ele encosta, esquerda ou direita; mais largo que alto (a
 * barra de ferramentas) come a faixa de cima ou de baixo. É o centro que o
 * mestre enxerga: o ponto posto no meio do canvas inteiro pode cair sob a
 * barra, a 400% de zoom (medido em 22/09 no "Ir lá" do chamado de fundo).
 */
export function freeAreaCenter(viewport: Viewport, obstacles: Bounds[]): Point {
  let left = 0
  let top = 0
  let right = viewport.width
  let bottom = viewport.height
  for (const o of obstacles) {
    const width = o.maxX - o.minX
    const height = o.maxY - o.minY
    // Painel fora do canvas ou sem tamanho não cobre nada.
    if (width <= 0 || height <= 0 || o.maxX <= 0 || o.maxY <= 0 || o.minX >= viewport.width || o.minY >= viewport.height) continue
    if (height > width) {
      if (o.minX < viewport.width - o.maxX) left = Math.max(left, o.maxX)
      else right = Math.min(right, o.minX)
    } else if (o.minY < viewport.height - o.maxY) top = Math.max(top, o.maxY)
    else bottom = Math.min(bottom, o.minY)
  }
  const whole = { x: viewport.width / 2, y: viewport.height / 2 }
  if (right - left < viewport.width * MIN_FREE_FRACTION || bottom - top < viewport.height * MIN_FREE_FRACTION) return whole
  return { x: (left + right) / 2, y: (top + bottom) / 2 }
}
