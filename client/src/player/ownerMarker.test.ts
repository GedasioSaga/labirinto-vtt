import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import {
  OWNER_PULSE_DURATION_MS,
  OWNER_RING_COLOR,
  OWNER_RING_WIDTH_PX,
  drawOwnerPulse,
  drawOwnerRing,
  ownerRingOuterPx,
} from './ownerMarker'

type Instrucao = Graphics['context']['instructions'][number]

function tracos(g: Graphics): Instrucao[] {
  return g.context.instructions.filter((i) => i.action === 'stroke')
}

function estilo(i: Instrucao): { color: number; width: number; alpha: number } {
  if (i.action !== 'stroke') throw new Error('não é traço')
  return i.data.style as { color: number; width: number; alpha: number }
}

/** Raio do `circle` que o traço contorna (GraphicsPath guarda [x, y, raio, transform]). */
function raioDoCirculo(i: Instrucao): number {
  if (i.action !== 'stroke') throw new Error('não é traço')
  const circulo = i.data.path.instructions.find((p) => p.action === 'circle')
  if (!circulo) throw new Error('traço sem círculo')
  return (circulo.data as number[])[2]
}

const RAIO_DA_FICHA = 25

describe('drawOwnerRing: o aro que diz "esta ficha é sua" é BRANCO, em qualquer cor de ficha', () => {
  it('aro branco com 3 px de TELA em qualquer zoom, começando na borda do disco', () => {
    for (const zoom of [0.3, 0.616, 1, 2.5]) {
      const g = new Graphics()
      drawOwnerRing(g, RAIO_DA_FICHA, zoom)
      const branco = tracos(g).find((t) => estilo(t).color === 0xffffff)
      expect(branco, `sem aro branco no zoom ${zoom}`).toBeDefined()
      if (!branco) continue
      expect(estilo(branco).alpha).toBe(1)
      expect(estilo(branco).width * zoom).toBeCloseTo(OWNER_RING_WIDTH_PX, 9)
      // Por FORA do disco: a cor da ficha continua inteira, e o aro não come a borda dela.
      expect(raioDoCirculo(branco) - estilo(branco).width / 2).toBeCloseTo(RAIO_DA_FICHA, 9)
    }
  })

  it('a cor do aro não é a azul de antes (numa ficha azul ele sumia)', () => {
    expect(OWNER_RING_COLOR).toBe(0xffffff)
    const g = new Graphics()
    drawOwnerRing(g, RAIO_DA_FICHA, 1)
    expect(tracos(g).map((t) => estilo(t).color)).not.toContain(0x3b82f6)
  })

  it('um fio escuro por fora do branco: o aro continua lendo em chão claro', () => {
    const g = new Graphics()
    drawOwnerRing(g, RAIO_DA_FICHA, 1)
    const branco = tracos(g).find((t) => estilo(t).color === 0xffffff)
    const escuro = tracos(g).find((t) => estilo(t).color === 0x000000)
    expect(branco && escuro).toBeTruthy()
    if (!branco || !escuro) return
    const foraDoBranco = raioDoCirculo(branco) + estilo(branco).width / 2
    expect(raioDoCirculo(escuro) - estilo(escuro).width / 2).toBeCloseTo(foraDoBranco, 9)
    expect(ownerRingOuterPx(RAIO_DA_FICHA, 1)).toBeCloseTo(raioDoCirculo(escuro) + estilo(escuro).width / 2, 9)
  })

  it('zoom inválido não gera traço infinito', () => {
    const g = new Graphics()
    drawOwnerRing(g, RAIO_DA_FICHA, 0)
    for (const t of tracos(g)) expect(Number.isFinite(estilo(t).width)).toBe(true)
  })
})

describe('drawOwnerPulse: "você está aqui" — ondas brancas que saem do aro e somem', () => {
  const CENTRO = { x: 640, y: 400 }
  const DO_ARO = 20

  it('no começo desenha onda branca em volta do aro, e diz que ainda está pulsando', () => {
    const g = new Graphics()
    expect(drawOwnerPulse(g, CENTRO.x, CENTRO.y, DO_ARO, 60)).toBe(true)
    const ondas = tracos(g)
    expect(ondas.length).toBeGreaterThan(0)
    for (const onda of ondas) {
      expect(estilo(onda).color).toBe(0xffffff)
      expect(estilo(onda).alpha).toBeGreaterThan(0)
      expect(raioDoCirculo(onda)).toBeGreaterThanOrEqual(DO_ARO)
    }
  })

  it('a onda cresce e esmaece com o tempo', () => {
    const cedo = new Graphics()
    const tarde = new Graphics()
    drawOwnerPulse(cedo, CENTRO.x, CENTRO.y, DO_ARO, 40)
    drawOwnerPulse(tarde, CENTRO.x, CENTRO.y, DO_ARO, 240)
    const [primeiraCedo] = tracos(cedo)
    const [primeiraTarde] = tracos(tarde)
    expect(raioDoCirculo(primeiraTarde)).toBeGreaterThan(raioDoCirculo(primeiraCedo))
    expect(estilo(primeiraTarde).alpha).toBeLessThan(estilo(primeiraCedo).alpha)
  })

  it('passada a duração não desenha nada e avisa que acabou', () => {
    const g = new Graphics()
    drawOwnerPulse(g, CENTRO.x, CENTRO.y, DO_ARO, 60)
    expect(drawOwnerPulse(g, CENTRO.x, CENTRO.y, DO_ARO, OWNER_PULSE_DURATION_MS)).toBe(false)
    expect(g.context.instructions).toHaveLength(0)
  })

  it('dura pouco: um sinal, não um enfeite que fica piscando', () => {
    expect(OWNER_PULSE_DURATION_MS).toBeGreaterThan(0)
    expect(OWNER_PULSE_DURATION_MS).toBeLessThanOrEqual(1500)
  })
})
