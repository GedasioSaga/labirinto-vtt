import type { RegionPoint, RoomMeta } from '../types/map'

/**
 * GIRAR SALA — a geometria pura, sem Pixi nem store.
 *
 * O giro é gravado nos PONTOS (`lib/mapFactory.ts` → `rotateRegion`), não num
 * ângulo que o desenho aplica depois: parede, névoa, colisão e o recorte do
 * jogador já leem `region.points`, então tudo acompanha sem mexer neles.
 * `RoomMeta.rotation` guarda só o ângulo acumulado — para o campo "Rotação"
 * do painel e para a alça saber onde fica o "em cima" da sala girada.
 *
 * Convenção de sinal: positivo = sentido HORÁRIO na tela. Com y crescendo
 * para baixo (Pixi), é o que a fórmula de rotação comum já dá sem ajuste — a
 * mesma convenção de `Token.rotation`/`Prop.rotation` (`types/map.ts`).
 */

interface Ponto {
  x: number
  y: number
}

/** Abaixo disto o polígono é uma linha ou um ponto: o centróide por área divide por ~0. */
const AREA_DEGENERADA = 1e-6

/**
 * Centróide de ÁREA do polígono (fórmula do shoelace) — o pivô do giro.
 *
 * Por que de área e não o meio da caixa: o centróide de área de um polígono
 * girado é o centróide girado, então ele NÃO se mexe quando a sala gira. É
 * isso que faz girar +30° e depois −30° devolver a sala ao mesmo lugar; com o
 * meio da caixa, a caixa de uma sala em L muda de centro a cada giro e a sala
 * sairia andando. É também a âncora do nome da sala (`pixi/drawRoomNames.ts`
 * → `roomLabelAnchor` chama esta função), então o nome fica parado no giro.
 * Polígono degenerado (área ~0) cai na média dos vértices.
 */
export function roomCentroid(points: readonly RegionPoint[]): Ponto {
  if (points.length === 0) return { x: 0, y: 0 }
  let doubleArea = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const cross = a.x * b.y - b.x * a.y
    doubleArea += cross
    cx += (a.x + b.x) * cross
    cy += (a.y + b.y) * cross
  }
  if (Math.abs(doubleArea) < AREA_DEGENERADA) {
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
    return { x: sum.x / points.length, y: sum.y / points.length }
  }
  return { x: cx / (3 * doubleArea), y: cy / (3 * doubleArea) }
}

/**
 * Precisão com que um ângulo é guardado: um milionésimo de grau. Sem isto
 * 0,1 + 0,2 vira 0,30000000000000004° e o campo mostraria lixo; ninguém gira
 * uma sala com mais precisão do que isto.
 */
const PRECISAO_DO_ANGULO = 1e6

/**
 * Ângulo em (−180°, 180°]. É a faixa do campo "Rotação": um giro pequeno para
 * a esquerda lê "−15", não "345". Valor não finito (arquivo corrompido) vale 0.
 */
export function normalizeRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0
  let d = (Math.round(degrees * PRECISAO_DO_ANGULO) / PRECISAO_DO_ANGULO) % 360
  if (d <= -180) d += 360
  if (d > 180) d -= 360
  // `-0` vira `0`: o campo mostraria "-0" e o ida-e-volta por disco mudaria o sinal.
  return d === 0 ? 0 : d
}

/**
 * Ângulo acumulado da sala. Ausente = 0 (sala de todo mapa salvo antes deste
 * campo existir), e valor que não é número finito também — a leitura do
 * arquivo já descarta esse caso (`lib/mapFile.ts`), isto é a segunda rede.
 */
export function roomRotationOf(room: Pick<RoomMeta, 'rotation'> | undefined): number {
  const rotation = room?.rotation
  return typeof rotation === 'number' ? normalizeRotation(rotation) : 0
}

/** Passo da trava do Shift: 15° é o passo de todo editor de desenho (Figma, Illustrator). */
export const ROTATION_SHIFT_STEP = 15

/**
 * Ângulo da alça depois da trava: grau inteiro solto, múltiplo de 15° com
 * Shift. A trava vale sobre o ângulo ABSOLUTO (o que o campo mostra), não
 * sobre o quanto a mão andou: com a sala em 37°, o Shift leva a 30° ou 45°,
 * nunca a 52°. Grau inteiro no arrasto solto porque a mão não tem precisão
 * de décimo de grau e o campo não deve mostrar "37,4821".
 */
export function snapRoomRotation(degrees: number, shift: boolean): number {
  const step = shift ? ROTATION_SHIFT_STEP : 1
  return normalizeRotation(Math.round(degrees / step) * step)
}

/** Quanto girar para sair de `from` e chegar em `to`, pelo caminho mais curto. */
export function rotationDelta(from: number, to: number): number {
  return normalizeRotation(to - from)
}

export interface RotationTrig {
  sin: number
  cos: number
}

/**
 * Seno e cosseno do giro, EXATOS nos quartos de volta. `Math.cos(Math.PI/2)`
 * dá 6e-17, não 0: girar 90° uma sala na grade a deixaria a um fio de
 * distância da grade, e a sala retangular deixaria de ser "reta" para quem
 * confere com igualdade. Com a tabela, ±90° e 180° são permutação de
 * coordenadas — a sala continua exatamente onde a conta diz.
 */
export function rotationTrig(degrees: number): RotationTrig {
  const d = normalizeRotation(degrees)
  if (d === 0) return { sin: 0, cos: 1 }
  if (d === 90) return { sin: 1, cos: 0 }
  if (d === 180) return { sin: 0, cos: -1 }
  if (d === -90) return { sin: -1, cos: 0 }
  const rad = (d * Math.PI) / 180
  return { sin: Math.sin(rad), cos: Math.cos(rad) }
}

/** Grade fina a que uma coordenada volta quando só sobrou ruído de conta (1/1024 é exato em binário). */
const GRADE_FINA = 1024
/** Quanto de ruído de ponto flutuante um giro deixa, com folga: ~1e-13 por conta, em mapa de milhares de px. */
const RUIDO_DE_GIRO = 1e-9

/**
 * Tira o ruído que o seno e o cosseno deixam: girar 30° e depois −30° devolve
 * 575,9999999999999 em vez de 576. A coordenada que está a menos de um
 * bilionésimo de px de um múltiplo de 1/1024 É esse múltiplo — puxá-la de
 * volta mantém o arquivo salvo limpo e faz o ida-e-volta ser exato. Uma
 * coordenada girada de verdade quase nunca cai tão perto assim, e se cair o
 * deslocamento é de um bilionésimo de px.
 */
export function withoutRotationNoise(value: number): number {
  const fino = Math.round(value * GRADE_FINA) / GRADE_FINA
  if (Math.abs(value - fino) > RUIDO_DE_GIRO) return value
  return fino === 0 ? 0 : fino
}

/** Gira `point` em torno de `pivot` (positivo = horário na tela), sem ruído de conta. */
export function rotatePointAround(point: RegionPoint, pivot: RegionPoint, trig: RotationTrig): RegionPoint {
  const dx = point.x - pivot.x
  const dy = point.y - pivot.y
  return {
    x: withoutRotationNoise(pivot.x + dx * trig.cos - dy * trig.sin),
    y: withoutRotationNoise(pivot.y + dx * trig.sin + dy * trig.cos),
  }
}

/** Gira um VETOR (deslocamento, sem pivô) — o `labelOffset` do nome da sala. */
export function rotateVector(vector: RegionPoint, trig: RotationTrig): RegionPoint {
  return {
    x: withoutRotationNoise(vector.x * trig.cos - vector.y * trig.sin),
    y: withoutRotationNoise(vector.x * trig.sin + vector.y * trig.cos),
  }
}

/**
 * Direção de `point` vista do pivô, em graus. Com y para baixo, crescer é
 * andar no sentido horário — o mesmo sinal do giro, então a diferença entre
 * duas leituras é exatamente quanto a sala deve girar.
 */
export function angleAroundPivot(pivot: RegionPoint, point: RegionPoint): number {
  return (Math.atan2(point.y - pivot.y, point.x - pivot.x) * 180) / Math.PI
}

/**
 * A alça de girar, em px de TELA — o tamanho não muda com o zoom, como o
 * contorno de seleção (`selectionOutlineWidth`, `pixi/drawWalls.ts`).
 *
 * - `offsetPx`: do topo da caixa ao centro da bolinha. Longe o bastante para
 *   a área de clique não encostar no topo da sala (28 − 14 = 14 px de folga)
 *   nem nos chips de canto; perto o bastante para ler como "da sala".
 * - `radiusPx`: a bolinha que se vê, maior que o vértice (3,5) e que o chip
 *   de canto (6) só o suficiente para não se confundir com eles.
 * - `hitRadiusPx`: a área que o clique aceita. 14 de raio = alvo de 28 px,
 *   acima dos 24 px do critério 2.5.8 da WCAG 2.2 — errar a bolinha por
 *   poucos px (o tremor normal da mão) ainda gira em vez de largar a seleção.
 */
export const ROOM_ROTATE_HANDLE = {
  offsetPx: 28,
  radiusPx: 6.5,
  hitRadiusPx: 14,
} as const

export interface RoomRotateHandle {
  /** Centróide da sala: em volta dele tudo gira. */
  pivot: Ponto
  /** Onde o traço encosta na caixa da sala (meio do topo, no sistema da sala). */
  base: Ponto
  /** Centro da bolinha. */
  knob: Ponto
  /** Direção unitária da base para a bolinha: o "para cima" da sala girada. */
  up: Ponto
  /** Raio da bolinha e da área de clique, já em px de MUNDO. */
  radius: number
  hitRadius: number
}

function validScale(cameraScale: number): number {
  return Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1
}

/**
 * Onde a alça de girar mora. A caixa é a da sala no SISTEMA DELA (os pontos
 * desgirados pelo ângulo acumulado), não a caixa alinhada à tela: assim a alça
 * gira junto com a sala — durante o arrasto ela acompanha o ponteiro, e
 * depois de soltar fica onde a mão a deixou, em vez de pular para cima da
 * caixa nova. Sala nunca girada (ângulo 0) tem a alça acima do topo, no meio.
 * Menos de 3 pontos não é sala: sem alça.
 */
export function roomRotateHandle(points: readonly RegionPoint[], rotationDegrees: number, cameraScale: number): RoomRotateHandle | null {
  if (points.length < 3) return null
  const scale = validScale(cameraScale)
  const pivot = roomCentroid(points)
  const para = rotationTrig(rotationDegrees)
  const desfaz: RotationTrig = { sin: -para.sin, cos: para.cos }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  for (const point of points) {
    const local = rotateVector({ x: point.x - pivot.x, y: point.y - pivot.y }, desfaz)
    if (local.x < minX) minX = local.x
    if (local.x > maxX) maxX = local.x
    if (local.y < minY) minY = local.y
  }
  const meio = (minX + maxX) / 2
  const offset = ROOM_ROTATE_HANDLE.offsetPx / scale
  const noMundo = (local: Ponto): Ponto => {
    const girado = rotateVector(local, para)
    return { x: pivot.x + girado.x, y: pivot.y + girado.y }
  }
  return {
    pivot,
    base: noMundo({ x: meio, y: minY }),
    knob: noMundo({ x: meio, y: minY - offset }),
    up: rotateVector({ x: 0, y: -1 }, para),
    radius: ROOM_ROTATE_HANDLE.radiusPx / scale,
    hitRadius: ROOM_ROTATE_HANDLE.hitRadiusPx / scale,
  }
}

/** Hit-test da alça — o mesmo cálculo que o desenho usa, para o clique cair onde a bolinha está. */
export function isOnRoomRotateHandle(
  points: readonly RegionPoint[],
  rotationDegrees: number,
  point: RegionPoint,
  cameraScale: number,
): boolean {
  const handle = roomRotateHandle(points, rotationDegrees, cameraScale)
  if (!handle) return false
  return Math.hypot(point.x - handle.knob.x, point.y - handle.knob.y) <= handle.hitRadius
}

/**
 * Etiqueta do ângulo durante o arrasto: "37°", "−15°". Menos tipográfico
 * (U+2212) em vez do hífen — é texto para ler no mapa, não para digitar.
 */
export function formatRotationLabel(degrees: number): string {
  const d = Math.round(normalizeRotation(degrees) * 10) / 10
  return d < 0 ? `−${-d}°` : `${d}°`
}
