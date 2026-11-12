import type { Stair } from '../types/map'
import type { Point } from '../pixi/world'
import { isOnPropRotateHandle, normalizeRotation, propRotateHandle, rotatePointAround, rotationTrig, type PropParaGirar, type RoomRotateHandle } from './roomRotation'
import { stairSpiralCircle } from './stairs'
import { stairCenterline, stairChord } from './stairCurve'

/**
 * GIRAR ESCADA (pedido de 12/11/2026: "uma vez que eu coloco a escada não da
 * para colocar trocar para vertical e horizontal faz a opção de colocar a
 * rotação"). Conta pura: o campo e o botão da ficha (`components/StairControls.tsx`),
 * a bolinha no mapa (`pixi/roomRotateGesture.ts`, `pixi/drawEditHandles.ts`) e
 * o cursor (`lib/hoverHitTest.ts`) leem daqui.
 *
 * A escada não guarda ângulo: ela É os lances (x1, y1)→(x2, y2), e o arrasto
 * de criação já os deixa correr em qualquer direção. Girar é girar os pontos
 * dos lances em volta do centro dela — o desenho, o clique, a borracha, a tela
 * do jogador, o piso e o pino da escada que leva a outro andar (na boca, x1,
 * y1) só leem os lances, então seguem sem mudança. A curva é relativa à corda
 * e gira junto sem mudar de número. O campo `Stair.rotation` do schema segue
 * sem uso: gravar nele obrigaria cada leitor a girar a escada de novo.
 *
 * O ÂNGULO é a direção do primeiro lance, de (x1, y1) para (x2, y2): 0° é a
 * escada deitada puxada da esquerda para a direita, 90° a em pé puxada de cima
 * para baixo. Trocar Sobe/Desce não mexe nele.
 */

/** Ângulo da escada em graus, em (−180°, 180°], horário. Escada sem lance vale 0. */
export function stairRotationOf(stair: Pick<Stair, 'segments'>): number {
  const first = stair.segments[0]
  const chord = first === undefined ? null : stairChord(first)
  if (chord === null) return 0
  return normalizeRotation((Math.atan2(chord.along.y, chord.along.x) * 180) / Math.PI)
}

/**
 * A caixa da escada no SISTEMA DELA (eixo x ao longo do primeiro lance, y
 * atravessando), com o centro em px de mundo: o retângulo que a bolinha de
 * girar contorna e em volta de cujo centro a escada gira. É a mesma escada que
 * a tela pinta (`guideBoxOfStair`, `lib/guideBoxes.ts`): a placa de cada corda
 * da linha do meio com meia largura para os lados, e o círculo na espiral.
 * Como a caixa gira junto com a escada, o centro não sai do lugar no giro.
 * `null` = escada sem lance.
 */
export interface StairRotateFrame {
  pivot: Point
  /** Ao longo do primeiro lance. */
  width: number
  /** Atravessando o primeiro lance. */
  height: number
  rotation: number
}

export function stairRotateFrame(stair: Stair): StairRotateFrame | null {
  const first = stair.segments[0]
  const chord = first === undefined ? null : stairChord(first)
  if (chord === null) return null
  const { along, normal, middle } = chord
  const noSistema = (p: Point): Point => {
    const dx = p.x - middle.x
    const dy = p.y - middle.y
    return { x: dx * along.x + dy * along.y, y: dx * normal.x + dy * normal.y }
  }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const incluir = (x1: number, y1: number, x2: number, y2: number): void => {
    minX = Math.min(minX, x1)
    maxX = Math.max(maxX, x2)
    minY = Math.min(minY, y1)
    maxY = Math.max(maxY, y2)
  }
  const circle = stairSpiralCircle(stair)
  if (circle !== null) {
    const c = noSistema(circle.center)
    incluir(c.x - circle.radius, c.y - circle.radius, c.x + circle.radius, c.y + circle.radius)
  } else {
    const half = (Number.isFinite(stair.stepWidth) ? Math.max(0, stair.stepWidth) : 0) / 2
    for (const segment of stairCenterline(stair)) {
      const a = noSistema({ x: segment.x1, y: segment.y1 })
      const b = noSistema({ x: segment.x2, y: segment.y2 })
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      if (!(length > 0) || !Number.isFinite(length)) continue
      const reachX = (half * Math.abs(b.y - a.y)) / length
      const reachY = (half * Math.abs(b.x - a.x)) / length
      incluir(Math.min(a.x, b.x) - reachX, Math.min(a.y, b.y) - reachY, Math.max(a.x, b.x) + reachX, Math.max(a.y, b.y) + reachY)
    }
  }
  if (!(maxX >= minX) || !(maxY >= minY)) return null
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return {
    pivot: { x: middle.x + along.x * cx + normal.x * cy, y: middle.y + along.y * cx + normal.y * cy },
    width: maxX - minX,
    height: maxY - minY,
    rotation: stairRotationOf(stair),
  }
}

/** A escada girada `degrees` (horário) em volta do centro dela. Mesma referência quando não gira. */
export function rotateStairBy(stair: Stair, degrees: number): Stair {
  const giro = normalizeRotation(degrees)
  const frame = giro === 0 ? null : stairRotateFrame(stair)
  if (frame === null) return stair
  const trig = rotationTrig(giro)
  const girar = (x: number, y: number): Point => rotatePointAround({ x, y }, frame.pivot, trig)
  return {
    ...stair,
    segments: stair.segments.map((segment) => {
      const a = girar(segment.x1, segment.y1)
      const b = girar(segment.x2, segment.y2)
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
    }),
  }
}

/** A caixa da escada no formato que a alça do objeto lê: centro, tamanho e giro. */
function caixaParaGirar(frame: StairRotateFrame): PropParaGirar {
  return { x: frame.pivot.x, y: frame.pivot.y, width: frame.width, height: frame.height, rotation: frame.rotation }
}

/** A bolinha de girar da escada: a mesma da sala e do objeto, acima da caixa dela, no sistema dela. */
export function stairRotateHandle(stair: Stair, cameraScale: number): RoomRotateHandle | null {
  const frame = stairRotateFrame(stair)
  return frame === null ? null : propRotateHandle(caixaParaGirar(frame), cameraScale)
}

/** Hit-test da bolinha da escada — a mesma conta do desenho (`stairRotateHandle`). */
export function isOnStairRotateHandle(stair: Stair, point: Point, cameraScale: number): boolean {
  const frame = stairRotateFrame(stair)
  return frame !== null && isOnPropRotateHandle(caixaParaGirar(frame), point, cameraScale)
}
