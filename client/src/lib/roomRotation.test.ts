import { describe, expect, it } from 'vitest'
import {
  ROOM_ROTATE_HANDLE,
  formatRotationLabel,
  isOnRoomRotateHandle,
  normalizeRotation,
  roomCentroid,
  roomRotateHandle,
  roomRotationOf,
  rotatePointAround,
  rotationDelta,
  rotationPivot,
  rotationTrig,
  snapRoomRotation,
  withoutRotationNoise,
} from './roomRotation'

/** A sala da jornada: 2 x 6 quadrados de 64 px, em pé. */
const EM_PE = [
  { x: 576, y: 256 },
  { x: 704, y: 256 },
  { x: 704, y: 640 },
  { x: 576, y: 640 },
]

/** Sala em L: o centróide de ÁREA não é o meio da caixa. */
const EM_L = [
  { x: 0, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 100 },
  { x: 100, y: 100 },
  { x: 100, y: 300 },
  { x: 0, y: 300 },
]

describe('roomCentroid — o pivô do giro', () => {
  it('retângulo: o meio dele', () => {
    expect(roomCentroid(EM_PE)).toEqual({ x: 640, y: 448 })
  })

  it('sala em L: centróide de área, puxado para o lado com mais chão (não o meio da caixa, 150/150)', () => {
    // Área: 300x100 + 100x200 = 50000. Cx = (30000*150 + 20000*50) / 50000 = 110.
    const c = roomCentroid(EM_L)
    expect(c.x).toBeCloseTo(110, 9)
    expect(c.y).toBeCloseTo(110, 9)
  })

  it('polígono sem área (pontos numa linha): cai na média dos vértices em vez de dividir por zero', () => {
    expect(roomCentroid([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }])).toEqual({ x: 10, y: 0 })
  })
})

describe('normalizeRotation — o ângulo do campo, em (−180, 180]', () => {
  it('dá a volta pelos dois lados e guarda 180 (nunca −180)', () => {
    expect(normalizeRotation(540)).toBe(180)
    expect(normalizeRotation(-180)).toBe(180)
    expect(normalizeRotation(190)).toBe(-170)
    expect(normalizeRotation(-190)).toBe(170)
    expect(normalizeRotation(270)).toBe(-90)
  })

  it('sem ruído de conta, sem −0 e sem NaN', () => {
    expect(normalizeRotation(0.1 + 0.2)).toBe(0.3)
    expect(Object.is(normalizeRotation(-0), 0)).toBe(true)
    expect(Object.is(normalizeRotation(360), 0)).toBe(true)
    expect(normalizeRotation(Number.NaN)).toBe(0)
    expect(normalizeRotation(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('roomRotationOf: ausente e lixo valem 0', () => {
    expect(roomRotationOf(undefined)).toBe(0)
    expect(roomRotationOf({})).toBe(0)
    expect(roomRotationOf({ rotation: 450 })).toBe(90)
    expect(roomRotationOf({ rotation: Number.NaN })).toBe(0)
  })

  it('rotationDelta vai pelo caminho mais curto', () => {
    expect(rotationDelta(30, 90)).toBe(60)
    expect(rotationDelta(170, -170)).toBe(20)
    expect(rotationDelta(-90, 90)).toBe(180)
  })
})

describe('snapRoomRotation — grau inteiro solto, 15° com Shift, sobre o ângulo ABSOLUTO', () => {
  it('solto: grau inteiro', () => {
    expect(snapRoomRotation(37.4, false)).toBe(37)
    expect(snapRoomRotation(-12.6, false)).toBe(-13)
  })

  it('Shift: o múltiplo de 15 mais perto do ângulo da sala, não do quanto a mão andou', () => {
    expect(snapRoomRotation(37, true)).toBe(30)
    expect(snapRoomRotation(38, true)).toBe(45)
    // Sala a 10° + 30° de mão = 40° → 45°, e não 10 + 30 = 40 → 40.
    expect(snapRoomRotation(10 + 30, true)).toBe(45)
    expect(snapRoomRotation(352, true)).toBe(-15)
  })
})

describe('rotationTrig e rotatePointAround — quarto de volta exato', () => {
  it('90°, 180° e −90° dão seno e cosseno inteiros (Math.cos(PI/2) daria 6e-17)', () => {
    expect(rotationTrig(90)).toEqual({ sin: 1, cos: 0 })
    expect(rotationTrig(180)).toEqual({ sin: 0, cos: -1 })
    expect(rotationTrig(-90)).toEqual({ sin: -1, cos: 0 })
    expect(rotationTrig(450)).toEqual({ sin: 1, cos: 0 })
  })

  it('positivo gira no sentido horário da TELA (y para baixo): o ponto de cima vai para a direita', () => {
    const pivo = { x: 640, y: 448 }
    expect(rotatePointAround({ x: 640, y: 256 }, pivo, rotationTrig(90))).toEqual({ x: 832, y: 448 })
    expect(rotatePointAround({ x: 640, y: 256 }, pivo, rotationTrig(-90))).toEqual({ x: 448, y: 448 })
  })

  it('ida e volta de um ângulo qualquer volta EXATAMENTE ao ponto inteiro de partida', () => {
    const pivo = { x: 640, y: 448 }
    for (const p of EM_PE) {
      const ida = rotatePointAround(p, pivo, rotationTrig(37))
      expect(rotatePointAround(ida, pivo, rotationTrig(-37))).toEqual(p)
    }
  })

  it('withoutRotationNoise só puxa o que está a um fio de um múltiplo de 1/1024', () => {
    expect(withoutRotationNoise(575.9999999999999)).toBe(576)
    expect(withoutRotationNoise(12.5000000000001)).toBe(12.5)
    expect(withoutRotationNoise(612.8174)).toBe(612.8174)
    expect(Object.is(withoutRotationNoise(-1e-14), 0)).toBe(true)
  })
})

describe('roomRotateHandle — onde a alça mora', () => {
  it('sala nunca girada: bolinha acima do meio do topo, a offsetPx de tela', () => {
    const h = roomRotateHandle(EM_PE, 0, 1)
    expect(h?.base).toEqual({ x: 640, y: 256 })
    expect(h?.knob).toEqual({ x: 640, y: 256 - ROOM_ROTATE_HANDLE.offsetPx })
    expect(h?.pivot).toEqual({ x: 640, y: 448 })
    expect(h?.up).toEqual({ x: 0, y: -1 })
  })

  it('tamanho fixo na TELA: com zoom 2 a distância e o raio em px de mundo caem à metade', () => {
    const perto = roomRotateHandle(EM_PE, 0, 2)
    expect(perto?.knob.y).toBe(256 - ROOM_ROTATE_HANDLE.offsetPx / 2)
    expect(perto?.radius).toBe(ROOM_ROTATE_HANDLE.radiusPx / 2)
    expect(perto?.hitRadius).toBe(ROOM_ROTATE_HANDLE.hitRadiusPx / 2)
  })

  it('sala girada 90°: a alça gira junto e fica do lado que era o topo (à direita)', () => {
    // A mesma sala deitada, com os pontos já girados 90° em volta do centro.
    const deitada = EM_PE.map((p) => rotatePointAround(p, { x: 640, y: 448 }, rotationTrig(90)))
    const h = roomRotateHandle(deitada, 90, 1)
    expect(h?.base).toEqual({ x: 832, y: 448 })
    expect(h?.knob).toEqual({ x: 832 + ROOM_ROTATE_HANDLE.offsetPx, y: 448 })
    expect(h?.up).toEqual({ x: 1, y: 0 })
  })

  it('menos de 3 pontos não é sala: sem alça', () => {
    expect(roomRotateHandle([{ x: 0, y: 0 }, { x: 10, y: 0 }], 0, 1)).toBeNull()
  })

  it('hit-test aceita o centro e o erro de mão até hitRadiusPx, e recusa além', () => {
    const knob = { x: 640, y: 256 - ROOM_ROTATE_HANDLE.offsetPx }
    expect(isOnRoomRotateHandle(EM_PE, 0, knob, 1)).toBe(true)
    expect(isOnRoomRotateHandle(EM_PE, 0, { x: knob.x + ROOM_ROTATE_HANDLE.hitRadiusPx - 1, y: knob.y }, 1)).toBe(true)
    expect(isOnRoomRotateHandle(EM_PE, 0, { x: knob.x + ROOM_ROTATE_HANDLE.hitRadiusPx + 1, y: knob.y }, 1)).toBe(false)
    // O alvo não encosta no topo da sala: clicar no topo continua sendo clicar na sala.
    expect(isOnRoomRotateHandle(EM_PE, 0, { x: 640, y: 256 }, 1)).toBe(false)
  })
})

describe('rotationPivot — quarto de volta numa sala na grade gira em volta de um ponto da grade', () => {
  /** 3 x 4 quadrados de 64 px: o centro (672, 384) fica a meio quadrado da grade depois de 90°. */
  const TRES_POR_QUATRO = [
    { x: 576, y: 256 },
    { x: 768, y: 256 },
    { x: 768, y: 512 },
    { x: 576, y: 512 },
  ]
  const naGrade = (v: number): boolean => Number.isInteger(v / 64)

  it('+90° e −90°: o pivô é outro ponto (meia casa do centro) e todo canto girado cai na grade', () => {
    for (const giro of [90, -90]) {
      const pivo = rotationPivot(TRES_POR_QUATRO, 0, giro, 64)
      expect(pivo).not.toEqual(roomCentroid(TRES_POR_QUATRO))
      const girados = TRES_POR_QUATRO.map((p) => rotatePointAround(p, pivo, rotationTrig(giro)))
      for (const p of girados) expect(naGrade(p.x) && naGrade(p.y), `${giro}°: canto ${p.x},${p.y} fora da grade`).toBe(true)
    }
    expect(rotationPivot(TRES_POR_QUATRO, 0, 90, 64)).toEqual({ x: 672, y: 352 })
    expect(rotationPivot(TRES_POR_QUATRO, 0, -90, 64)).toEqual({ x: 672, y: 416 })
  })

  it('180°: o centro de um retângulo na grade já serve — o pivô não muda', () => {
    expect(rotationPivot(TRES_POR_QUATRO, 0, 180, 64)).toEqual({ x: 672, y: 384 })
  })

  it('ângulo livre continua girando em volta do centro, mesmo na sala da grade', () => {
    for (const giro of [30, -45, 15, 135]) expect(rotationPivot(TRES_POR_QUATRO, 0, giro, 64)).toEqual({ x: 672, y: 384 })
  })

  it('sala par (2 x 6) já gira na grade em volta do centro: nada muda', () => {
    expect(rotationPivot(EM_PE, 0, 90, 64)).toEqual({ x: 640, y: 448 })
  })

  it('sala fora da grade, grade inválida ou sala vazia: o centro, como antes', () => {
    const torta = [{ x: 0, y: 0 }, { x: 190, y: 0 }, { x: 190, y: 256 }, { x: 0, y: 256 }]
    expect(rotationPivot(torta, 0, 90, 64)).toEqual({ x: 95, y: 128 })
    expect(rotationPivot(TRES_POR_QUATRO, 0, 90, 0)).toEqual({ x: 672, y: 384 })
    expect(rotationPivot(TRES_POR_QUATRO, 0, 90, Number.NaN)).toEqual({ x: 672, y: 384 })
    expect(rotationPivot([], 0, 90, 64)).toEqual({ x: 0, y: 0 })
  })
})

describe('formatRotationLabel — a etiqueta do arrasto', () => {
  it('grau com o sinal de menos tipográfico', () => {
    expect(formatRotationLabel(37)).toBe('37°')
    expect(formatRotationLabel(-15)).toBe('−15°')
    expect(formatRotationLabel(0)).toBe('0°')
    expect(formatRotationLabel(12.34)).toBe('12.3°')
  })
})
