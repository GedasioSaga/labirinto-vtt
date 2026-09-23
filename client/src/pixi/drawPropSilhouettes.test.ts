import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { Prop } from '../types/map'
import {
  drawPropSilhouettes,
  PROP_SILHOUETTE_EDGE_ALPHA,
  PROP_SILHOUETTE_EDGE_COLOR,
  PROP_SILHOUETTE_FILL_ALPHA,
  PROP_SILHOUETTE_FILL_COLOR,
} from './drawPropSilhouettes'
import { WALL_COLOR, WALL_INTERIOR_ALPHA } from './drawWalls'
import { DEFAULT_PLAYER_SETTINGS } from '../player/PlayerPanel'

/** A cama como o jogador a recebe do recorte: só a geometria, sem imagem. */
function objeto(extra: Partial<Prop> = {}): Prop {
  return { id: 'cama', src: '', x: 250, y: 180, width: 80, height: 40, linkedMapPath: null, ...extra }
}

type Instruction = Graphics['context']['instructions'][number]

function fills(g: Graphics): Instruction[] {
  return g.context.instructions.filter((i) => i.action === 'fill')
}

function strokes(g: Graphics): Instruction[] {
  return g.context.instructions.filter((i) => i.action === 'stroke')
}

/** Pontos do `poly` do path de uma instrução (fill ou stroke). */
function polyPoints(instruction: Instruction | undefined): { x: number; y: number }[] {
  if (instruction === undefined || (instruction.action !== 'fill' && instruction.action !== 'stroke')) throw new Error('instrução sem path')
  const poly = instruction.data.path.instructions.find((i) => i.action === 'poly')
  const flat = (poly?.data[0] ?? []) as number[]
  const points: { x: number; y: number }[] = []
  for (let i = 0; i < flat.length; i += 2) points.push({ x: flat[i], y: flat[i + 1] })
  return points
}

function extent(points: { x: number; y: number }[]) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
    cx: (Math.max(...xs) + Math.min(...xs)) / 2,
    cy: (Math.max(...ys) + Math.min(...ys)) / 2,
  }
}

/** O alinhamento ao pixel físico anda cada borda no máximo meio pixel (câmera a 1x, tela de densidade 1). */
const MEIO_PIXEL = 0.5

describe('drawPropSilhouettes — móvel do mestre como silhueta chapada na tela do jogador', () => {
  it('cada objeto vira UM retângulo chapado no lugar dele, com o tamanho do mestre', () => {
    const g = new Graphics()
    const desenhados = drawPropSilhouettes(g, [objeto()], 1, 1)

    expect(desenhados).toBe(1)
    const [preenchimento] = fills(g)
    const pontos = polyPoints(preenchimento)
    expect(pontos).toHaveLength(4)
    const caixa = extent(pontos)
    expect(caixa.w).toBeCloseTo(80, 6)
    expect(caixa.h).toBeCloseTo(40, 6)
    expect(Math.abs(caixa.cx - 250)).toBeLessThanOrEqual(MEIO_PIXEL)
    expect(Math.abs(caixa.cy - 180)).toBeLessThanOrEqual(MEIO_PIXEL)

    // Chapada: uma cor lisa, sem gradiente, textura ou padrão (nada de hachura).
    if (preenchimento?.action !== 'fill') throw new Error('esperava fill')
    expect(preenchimento.data.style.color).toBe(PROP_SILHOUETTE_FILL_COLOR)
    expect(preenchimento.data.style.alpha).toBe(PROP_SILHOUETTE_FILL_ALPHA)
    expect(preenchimento.data.style.fill).toBeNull()
  })

  it('girado 90°, o retângulo deita no mesmo centro, reto (sem a sobra de 6e-17 do cosseno)', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [objeto({ rotation: 90 })], 1, 1)

    const pontos = polyPoints(fills(g)[0])
    const caixa = extent(pontos)
    expect(caixa.w).toBeCloseTo(40, 6)
    expect(caixa.h).toBeCloseTo(80, 6)
    expect(Math.abs(caixa.cx - 250)).toBeLessThanOrEqual(MEIO_PIXEL)
    expect(Math.abs(caixa.cy - 180)).toBeLessThanOrEqual(MEIO_PIXEL)
    // Reto de verdade: só dois x e dois y distintos. Com o cosseno de
    // `Math.cos(π/2)` os cantos caíam em pixels vizinhos e o móvel entortava.
    expect(new Set(pontos.map((p) => p.x)).size).toBe(2)
    expect(new Set(pontos.map((p) => p.y)).size).toBe(2)
  })

  it('girado 30°, gira no sentido horário em volta do centro, como o sprite do editor, sem arredondar', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [objeto({ rotation: 30 })], 1, 1)

    const rad = (30 * Math.PI) / 180
    const canto = (u: number, v: number) => ({ x: 250 + u * Math.cos(rad) - v * Math.sin(rad), y: 180 + u * Math.sin(rad) + v * Math.cos(rad) })
    const esperados = [canto(-40, -20), canto(40, -20), canto(40, 20), canto(-40, 20)]
    const pontos = polyPoints(fills(g)[0])
    expect(pontos).toHaveLength(4)
    pontos.forEach((p, i) => {
      expect(p.x).toBeCloseTo(esperados[i].x, 6)
      expect(p.y).toBeCloseTo(esperados[i].y, 6)
    })
  })

  it('contorno fino e claro, mais fraco que a parede interna: móvel nunca lê como parede', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [objeto()], 2, 1)

    const [contorno] = strokes(g)
    if (contorno?.action !== 'stroke') throw new Error('esperava stroke')
    expect(strokes(g)).toHaveLength(1)
    expect(PROP_SILHOUETTE_EDGE_COLOR).toBe(WALL_COLOR)
    expect(contorno.data.style.color).toBe(WALL_COLOR)
    expect(contorno.data.style.alpha).toBe(PROP_SILHOUETTE_EDGE_ALPHA)
    expect(PROP_SILHOUETTE_EDGE_ALPHA).toBeLessThan(WALL_INTERIOR_ALPHA)
    // 1 px de TELA em qualquer zoom: com a câmera a 2x, meio px de mundo.
    expect(contorno.data.style.width).toBeCloseTo(0.5, 6)
    // O mesmo retângulo do preenchimento.
    expect(polyPoints(contorno)).toEqual(polyPoints(fills(g)[0]))
  })

  it('mais claro que a névoa do "já visto" no padrão do jogador: móvel na visão não lê como pedaço fora dela', () => {
    // A névoa do explorado é preto com opacidade 1 − brilho (PlayerView.redrawFog).
    const opacidadeDaNevoa = 1 - DEFAULT_PLAYER_SETTINGS.exploredBrightness
    expect(PROP_SILHOUETTE_FILL_ALPHA).toBeLessThan(opacidadeDaNevoa)
  })

  it('tela de alta densidade: o contorno tem 1 px de tela, não 1 px físico', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [objeto()], 1, 2)
    const [contorno] = strokes(g)
    if (contorno?.action !== 'stroke') throw new Error('esperava stroke')
    expect(contorno.data.style.width).toBeCloseTo(1, 6)
  })

  it('objeto alinhado aos eixos encosta a borda no pixel físico, sem borrão de meio pixel', () => {
    const g = new Graphics()
    const escala = 1.5
    const resolucao = 1.25
    drawPropSilhouettes(g, [objeto({ x: 250.3, y: 180.7 })], escala, resolucao)

    const pxPorMundo = escala * resolucao
    for (const p of polyPoints(fills(g)[0])) {
      // Traço de 1 px físico centrado no MEIO do pixel: coordenada física = inteiro + 0,5.
      const fx = p.x * pxPorMundo - 0.5
      const fy = p.y * pxPorMundo - 0.5
      expect(Math.abs(fx - Math.round(fx))).toBeLessThan(1e-6)
      expect(Math.abs(fy - Math.round(fy))).toBeLessThan(1e-6)
    }
  })

  it('geometria sem medida (tamanho zero ou negativo, número não finito) não desenha e não derruba a tela', () => {
    const g = new Graphics()
    const quebrados = [
      objeto({ id: 'zero', width: 0 }),
      objeto({ id: 'negativo', height: -5 }),
      objeto({ id: 'nan', x: Number.NaN }),
      objeto({ id: 'infinito', y: Number.POSITIVE_INFINITY }),
    ]
    expect(drawPropSilhouettes(g, quebrados, 1, 1)).toBe(0)
    expect(g.context.instructions).toHaveLength(0)
  })

  it('redesenhar apaga o anterior: objeto que saiu da visão some da tela', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [objeto({ id: 'cama' }), objeto({ id: 'bau', x: 600 })], 1, 1)
    expect(fills(g)).toHaveLength(2)

    expect(drawPropSilhouettes(g, [objeto({ id: 'cama' })], 1, 1)).toBe(1)
    expect(fills(g)).toHaveLength(1)

    expect(drawPropSilhouettes(g, [], 1, 1)).toBe(0)
    expect(g.context.instructions).toHaveLength(0)
  })
})
