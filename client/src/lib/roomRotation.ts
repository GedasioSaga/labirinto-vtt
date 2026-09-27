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

/** Folga, em px, para dizer que dois cantos da sala estão a um número inteiro de casas um do outro. */
const FOLGA_DA_GRADE = 1e-6
/** Folga para dizer que dois pivôs candidatos estão à mesma distância do centro (em meias casas, ao quadrado). */
const FOLGA_DO_EMPATE = 1e-9

/** Um múltiplo inteiro de `passo`, a menos de ruído de conta? */
function ehMultiplo(valor: number, passo: number): boolean {
  return Math.abs(valor - Math.round(valor / passo) * passo) <= FOLGA_DA_GRADE
}

/**
 * Onde o pivô pode ficar para o giro levar a grade nela mesma, em MEIAS casas
 * contadas de um canto da sala. 180° leva o ponto p em 2·pivô − p: basta o
 * pivô estar em meia casa. ±90° leva (x, y) em (pivô.x + pivô.y − y, …): as
 * duas coordenadas do pivô precisam ser meia casa com a SOMA inteira — o
 * tabuleiro de xadrez dos cantos e dos centros de casa.
 */
function pivoServe(a: number, b: number, giro: number): boolean {
  return giro === 180 || (a + b) % 2 === 0
}

/**
 * Para que lado desempatar o pivô, dado o ângulo em que a sala JÁ está.
 *
 * Numa sala de lados ímpar e par (3 x 4) o centro está à mesma distância de
 * quatro pivôs possíveis, e qualquer um deixa a sala na grade — mas um lado
 * fixo faria a sala andar meia casa na diagonal a cada +90° e nunca voltar.
 * O lado preferido gira com a sala: +90° e depois −90° escolhem o mesmo
 * pivô (volta exata), e quatro giros de +90° usam os quatro lados, então a
 * meia casa de cada um se cancela e a sala fecha a volta onde começou.
 */
function ladoPreferido(anguloDaSala: number, giro: number): Ponto {
  const base = { x: 0, y: 1 }
  const angulo = giro === -90 ? 180 - anguloDaSala : -anguloDaSala
  return rotateVector(base, rotationTrig(angulo))
}

/**
 * O pivô do giro de `turn` graus numa sala que já está a `roomRotation` graus.
 *
 * Ângulo livre: o centróide de área, sempre (`roomCentroid` — ida e volta
 * exata, o nome parado). Quarto de volta (±90°, 180°) numa sala com os cantos
 * na grade (`grid` px, contada a partir do canto 0 da sala, então vale com a
 * grade deslocada também): o ponto da grade mais perto do centróide em volta
 * do qual o giro devolve cada canto à grade. Sem isto uma sala 3 x 4 girada
 * 90° ficava a meia casa da grade nos dois eixos; com isto ela anda no máximo
 * meia casa em cada eixo e fica na grade. Sala fora da grade, grade inválida
 * ou sala vazia: o centróide, como antes.
 */
export function rotationPivot(points: readonly RegionPoint[], roomRotation: number, turn: number, grid: number): Ponto {
  const centro = roomCentroid(points)
  const giro = normalizeRotation(turn)
  if (giro !== 90 && giro !== -90 && giro !== 180) return centro
  if (!Number.isFinite(grid) || grid <= 0 || points.length === 0) return centro
  const origem = points[0]
  if (!points.every((p) => ehMultiplo(p.x - origem.x, grid) && ehMultiplo(p.y - origem.y, grid))) return centro

  const meia = grid / 2
  const alvo = { x: (centro.x - origem.x) / meia, y: (centro.y - origem.y) / meia }
  const lado = ladoPreferido(roomRotation, giro)
  const ladoAoLado = rotateVector(lado, rotationTrig(90))
  let melhor: { a: number; b: number; distancia: number; frente: number; flanco: number } | null = null
  // O mais perto está sempre a menos de uma meia casa de distância em cada eixo: ±1 em volta basta.
  for (let a = Math.floor(alvo.x) - 1; a <= Math.ceil(alvo.x) + 1; a++) {
    for (let b = Math.floor(alvo.y) - 1; b <= Math.ceil(alvo.y) + 1; b++) {
      if (!pivoServe(a, b, giro)) continue
      const v = { x: alvo.x - a, y: alvo.y - b }
      const candidato = {
        a,
        b,
        distancia: v.x * v.x + v.y * v.y,
        frente: v.x * lado.x + v.y * lado.y,
        flanco: v.x * ladoAoLado.x + v.y * ladoAoLado.y,
      }
      if (melhor === null || ganhaDe(candidato, melhor)) melhor = candidato
    }
  }
  if (melhor === null) return centro
  return { x: origem.x + melhor.a * meia, y: origem.y + melhor.b * meia }
}

/** Mais perto ganha; no empate, o do lado preferido; e, se ainda empatar, o do flanco. */
function ganhaDe(
  novo: { distancia: number; frente: number; flanco: number },
  atual: { distancia: number; frente: number; flanco: number },
): boolean {
  if (novo.distancia < atual.distancia - FOLGA_DO_EMPATE) return true
  if (novo.distancia > atual.distancia + FOLGA_DO_EMPATE) return false
  if (novo.frente > atual.frente + FOLGA_DO_EMPATE) return true
  if (novo.frente < atual.frente - FOLGA_DO_EMPATE) return false
  return novo.flanco > atual.flanco + FOLGA_DO_EMPATE
}

/** O ângulo é um quarto de volta (0°, ±90°, 180°)? */
export function isQuarterAngle(degrees: number): boolean {
  const angulo = normalizeRotation(degrees)
  return angulo === 0 || angulo === 90 || angulo === -90 || angulo === 180
}

/**
 * Quanto deslocar uma sala que CHEGOU a um quarto de volta vindo de um ângulo
 * livre (a 30°, o campo pede 90°; ou o segundo arrasto da alça) para os
 * cantos caírem na grade do mapa.
 *
 * O giro por ângulo livre é sempre em volta do centróide, e giros seguidos em
 * volta do mesmo ponto somam um só: 0° → 30° → 90° dá o mesmo que +90° em
 * volta do centro — numa sala 3 x 4, meia casa fora da grade nos dois eixos
 * (numa sala em L, qualquer fração). `rotationPivot` não resolve: o giro que
 * falta não é um quarto de volta, e o canto 0 da sala torta já não diz onde a
 * grade estava. A referência passa a ser a grade do mapa, múltiplos de `grid`
 * a partir da origem — a mesma do ímã do desenho (`snapToGrid`).
 *
 * Desfaz o giro do trecho (um quarto de volta em volta do centro, o pivô de
 * todo giro livre) para achar a sala de partida com os cantos na grade, e
 * desloca a sala até onde o botão daria o mesmo giro a partir dela
 * (`rotationPivot`): numa sala em L, 0° → 30° → 90° cai onde o botão +90°
 * poria, e a ida e volta (0° → 30° → 90° → 30° → 0°, ou por meia volta) é
 * exata porque a do botão é.
 *
 * Com o centro no meio de uma aresta da grade (retângulo 3 x 4, 1 x 2), o
 * quarto de volta deixa todos os cantos a meia casa nos dois eixos, e desfazer
 * +90° ou −90° dá cantos na grade: os pontos não dizem de onde a sala saiu, e
 * o ângulo livre do meio do caminho também não (0° → −30° → 90° e
 * 180° → 150° → 90° passam do mesmo lado). Aí vale uma regra que não depende
 * do caminho: a 0° ou 180° a sala anda meia casa para a direita e para baixo,
 * a ±90° para a esquerda e para cima.
 * Esse trecho é sempre de ±90° e o da volta cai no mesmo caso, com a partida
 * do outro par de ângulos — então a volta desfaz a ida. A 90° vindo de 0°,
 * fica onde o botão +90° poria.
 *
 * A sala desenhada fora da grade (Alt) não tem partida na grade: fica onde o
 * giro a deixou e volta exatamente aonde estava. Os pontos não guardam de onde
 * o trecho saiu: a sala fora da grade que, desfeito algum quarto de volta em
 * volta do centro, cai nela é tratada como vinda da grade e vai para ela (meia
 * casa num retângulo; num L com o centro a 3/8 de casa, um quarto de casa num
 * eixo só). Ângulo fora do quarto de
 * volta, grade inválida, sala vazia, já na grade ou sem partida na grade (lado
 * de 150 px numa grade de 64, canto em 10, 10): {0, 0}.
 */
export function quarterAngleGridShift(points: readonly RegionPoint[], roomRotation: number, grid: number): Ponto {
  const nada = { x: 0, y: 0 }
  if (!isQuarterAngle(roomRotation)) return nada
  if (!Number.isFinite(grid) || grid <= 0 || points.length === 0) return nada
  if (cantosNaGrade(points, grid)) return nada
  const partidas = partidasNaGrade(points, roomRotation, grid)
  if (partidas.length === 0) return nada
  if (partidas.length > 1) {
    const angulo = normalizeRotation(roomRotation)
    const meia = angulo === 0 || angulo === 180 ? grid / 2 : -grid / 2
    return { x: Math.round((points[0].x + meia) / grid) * grid - points[0].x, y: Math.round((points[0].y + meia) / grid) * grid - points[0].y }
  }
  const [partida] = partidas
  const pivo = rotationPivot(partida.points, partida.angulo, partida.giro, grid)
  const pelo = rotatePointAround(partida.points[0], pivo, rotationTrig(partida.giro))
  // O canto do botão está na grade (`rotationPivot`): arredondar só tira o ruído da conta.
  return { x: Math.round(pelo.x / grid) * grid - points[0].x, y: Math.round(pelo.y / grid) * grid - points[0].y }
}

function cantosNaGrade(points: readonly RegionPoint[], grid: number): boolean {
  return points.every((p) => ehMultiplo(p.x, grid) && ehMultiplo(p.y, grid))
}

/**
 * As salas de onde o trecho pode ter saído: cada quarto de volta em volta do
 * centro que põe os cantos na grade, com o ângulo em que ela estava e o giro
 * até agora. A de verdade está sempre entre elas; mais de uma só acontece com
 * +90° e −90° juntos (centro no meio de uma aresta da grade).
 */
function partidasNaGrade(points: readonly RegionPoint[], roomRotation: number, grid: number): { points: RegionPoint[]; angulo: number; giro: number }[] {
  const centro = roomCentroid(points)
  return [90, -90, 180].flatMap((desfaz) => {
    const candidata = points.map((p) => rotatePointAround(p, centro, rotationTrig(desfaz)))
    if (!cantosNaGrade(candidata, grid)) return []
    return [{ points: candidata, angulo: normalizeRotation(roomRotation + desfaz), giro: normalizeRotation(-desfaz) }]
  })
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
