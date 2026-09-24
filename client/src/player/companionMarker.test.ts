import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { COMPANION_RING_WIDTH_PX, drawCompanionRing } from './companionMarker'
import { OWNER_RING_WIDTH_PX } from './ownerMarker'

type Instrucao = Graphics['context']['instructions'][number]

function tracos(g: Graphics): Instrucao[] {
  return g.context.instructions.filter((i) => i.action === 'stroke')
}

function estilo(i: Instrucao): { color: number; width: number; alpha: number } {
  if (i.action !== 'stroke') throw new Error('não é traço')
  return i.data.style as { color: number; width: number; alpha: number } // o `stroke` do Pixi guarda o estilo já convertido (cor numérica); mesmo recorte de ownerMarker.test.ts
}

function raioDoCirculo(i: Instrucao): number {
  if (i.action !== 'stroke') throw new Error('não é traço')
  const circulo = i.data.path.instructions.find((p) => p.action === 'circle')
  if (!circulo) throw new Error('traço sem círculo')
  return (circulo.data as number[])[2] // `circle` guarda [x, y, raio, transform] no GraphicsPath do Pixi 8
}

const RAIO_DA_FICHA = 20
const COR = 0x81c784

describe('drawCompanionRing: aro fino na cor do jogador dono da ficha', () => {
  it('aro na cor do companheiro, com espessura fixa de TELA em qualquer zoom, por fora do disco', () => {
    for (const zoom of [0.3, 1, 2.5]) {
      const g = new Graphics()
      drawCompanionRing(g, RAIO_DA_FICHA, zoom, COR)
      const aro = tracos(g).find((t) => estilo(t).color === COR)
      expect(aro, `sem aro no zoom ${zoom}`).toBeDefined()
      if (!aro) continue
      expect(estilo(aro).width * zoom).toBeCloseTo(COMPANION_RING_WIDTH_PX, 9)
      expect(raioDoCirculo(aro) - estilo(aro).width / 2).toBeCloseTo(RAIO_DA_FICHA, 9)
    }
  })

  it('mais fino que o aro de dono: o "é seu" continua sendo o aro mais forte da tela', () => {
    expect(COMPANION_RING_WIDTH_PX).toBeGreaterThan(0)
    expect(COMPANION_RING_WIDTH_PX).toBeLessThan(OWNER_RING_WIDTH_PX)
  })

  it('não é branco (o branco é do aro de dono) e tem fio escuro por fora para ler em chão claro', () => {
    const g = new Graphics()
    drawCompanionRing(g, RAIO_DA_FICHA, 1, COR)
    const cores = tracos(g).map((t) => estilo(t).color)
    expect(cores).toContain(COR)
    expect(cores).toContain(0x000000)
    expect(cores).not.toContain(0xffffff)
  })

  it('zoom inválido não gera traço infinito', () => {
    const g = new Graphics()
    drawCompanionRing(g, RAIO_DA_FICHA, 0, COR)
    expect(tracos(g).length).toBeGreaterThan(0)
    for (const t of tracos(g)) expect(Number.isFinite(estilo(t).width)).toBe(true)
  })
})
