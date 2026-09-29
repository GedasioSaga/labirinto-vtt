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
import { contornoDeLado, LADOS_DA_ELIPSE, tracosDoGlifo } from '../lib/mobilia'

/**
 * MOBÍLIA DESENHADA na tela do jogador: o móvel com tipo ganha, por cima da
 * silhueta chapada, os traços finos do glifo (travesseiro do catre, tampo da
 * mesa, tampa e fecho do baú) — no mesmo fio claro e fino do contorno, nunca
 * preenchimento, hachura ou imagem.
 */

type Instruction = Graphics['context']['instructions'][number]

function strokes(g: Graphics): Instruction[] {
  return g.context.instructions.filter((i) => i.action === 'stroke')
}

function fills(g: Graphics): Instruction[] {
  return g.context.instructions.filter((i) => i.action === 'fill')
}

/** Pontos de cada `moveTo`/`lineTo` do path de um traço, na ordem. */
function pathPoints(instruction: Instruction | undefined, action: 'moveTo' | 'lineTo'): { x: number; y: number }[] {
  if (instruction === undefined || instruction.action !== 'stroke') throw new Error('esperava stroke')
  return instruction.data.path.instructions
    .filter((i) => i.action === action)
    .map((i) => {
      // `PathInstruction.data` é `any[]` no Pixi: conferido aqui em vez de confiado.
      const [x, y]: unknown[] = i.data
      if (typeof x !== 'number' || typeof y !== 'number') throw new Error(`${action} sem ponto`)
      return { x, y }
    })
}

/** Vértices do polígono da silhueta (o `poly` do primeiro traço). */
function silhouettePoints(g: Graphics): { x: number; y: number }[] {
  const contorno = strokes(g)[0]
  if (contorno?.action !== 'stroke') throw new Error('esperava stroke')
  const poly = contorno.data.path.instructions.find((i) => i.action === 'poly')
  const plano: unknown = poly?.data[0]
  if (!Array.isArray(plano)) throw new Error('silhueta sem poly')
  const pontos: { x: number; y: number }[] = []
  for (let i = 0; i + 1 < plano.length; i += 2) {
    const [x, y]: unknown[] = [plano[i], plano[i + 1]]
    if (typeof x !== 'number' || typeof y !== 'number') throw new Error('poly sem ponto')
    pontos.push({ x, y })
  }
  return pontos
}

function movel(extra: Partial<Prop> = {}): Prop {
  return { id: 'catre', src: '', x: 250, y: 200, width: 40, height: 80, linkedMapPath: null, mobilia: 'catre', ...extra }
}

describe('drawPropSilhouettes — glifo da mobília', () => {
  it('catre: silhueta de sempre e mais UM traço fino com o desenho do catre', () => {
    const g = new Graphics()
    expect(drawPropSilhouettes(g, [movel()], 1, 1)).toBe(1)

    expect(fills(g)).toHaveLength(1)
    const tracos = strokes(g)
    expect(tracos).toHaveLength(2)
    const glifo = tracos[1]
    if (glifo?.action !== 'stroke') throw new Error('esperava stroke')
    expect(glifo.data.style.color).toBe(PROP_SILHOUETTE_EDGE_COLOR)
    expect(glifo.data.style.alpha).toBe(PROP_SILHOUETTE_EDGE_ALPHA)
    expect(glifo.data.style.width).toBeCloseTo(1, 6)

    // Um segmento por traço do glifo, no lugar do móvel (centro 250,200).
    const esperado = tracosDoGlifo('catre', 40, 80)
    const inicios = pathPoints(glifo, 'moveTo')
    expect(inicios).toHaveLength(esperado.length)
    inicios.forEach((p, i) => {
      expect(p.x).toBeCloseTo(250 + esperado[i].x1, 6)
      expect(p.y).toBeCloseTo(200 + esperado[i].y1, 6)
    })
  })

  it('girado 90°, o glifo gira junto no sentido horário', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ rotation: 90 })], 1, 1)
    const esperado = tracosDoGlifo('catre', 40, 80)
    const inicios = pathPoints(strokes(g)[1], 'moveTo')
    expect(inicios.length).toBe(esperado.length)
    expect(inicios.length).toBeGreaterThan(0)
    // Horário na tela (y para baixo): (u, v) vira (−v, u).
    inicios.forEach((p, i) => {
      expect(p.x).toBeCloseTo(250 - esperado[i].y1, 6)
      expect(p.y).toBeCloseTo(200 + esperado[i].x1, 6)
    })
  })

  it('mesa e baú têm desenhos diferentes do catre', () => {
    const contar = (mobilia: Prop['mobilia']): number => {
      const g = new Graphics()
      drawPropSilhouettes(g, [movel({ mobilia, width: 60, height: 60 })], 1, 1)
      return pathPoints(strokes(g)[1], 'moveTo').length
    }
    expect(contar('mesa')).toBe(tracosDoGlifo('mesa', 60, 60).length)
    expect(contar('bau')).toBe(tracosDoGlifo('bau', 60, 60).length)
    expect(tracosDoGlifo('mesa', 60, 60)).not.toEqual(tracosDoGlifo('catre', 60, 60))
  })

  it('caixa e cadeira: silhueta retangular e o glifo de cada uma', () => {
    for (const mobilia of ['caixa', 'cadeira'] as const) {
      const g = new Graphics()
      drawPropSilhouettes(g, [movel({ mobilia, width: 32, height: 32 })], 1, 1)
      expect(silhouettePoints(g)).toHaveLength(4)
      expect(pathPoints(strokes(g)[1], 'moveTo')).toHaveLength(tracosDoGlifo(mobilia, 32, 32).length)
    }
  })

  it('barril: silhueta redonda, cada ponto na elipse inscrita no retângulo', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ mobilia: 'barril', width: 28, height: 28 })], 1, 1)
    const pontos = silhouettePoints(g)
    expect(pontos).toHaveLength(LADOS_DA_ELIPSE)
    for (const p of pontos) expect(Math.hypot(p.x - 250, p.y - 200)).toBeCloseTo(14, 6)
    expect(fills(g)).toHaveLength(1)
    // A tampa vai por cima, no mesmo fio fino.
    expect(pathPoints(strokes(g)[1], 'moveTo')).toHaveLength(tracosDoGlifo('barril', 28, 28).length)
  })

  it('objeto comum (sem tipo) continua só com o contorno', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ mobilia: undefined })], 1, 1)
    expect(strokes(g)).toHaveLength(1)
  })
})

/** Cor e alfa de uma instrução de fill ou stroke. */
function estilo(instruction: Instruction | undefined): { color: number; alpha: number } {
  if (instruction === undefined || instruction.action === 'texture') throw new Error('esperava fill ou stroke')
  return { color: instruction.data.style.color, alpha: instruction.data.style.alpha }
}

describe('drawPropSilhouettes — preencher e cor do móvel', () => {
  it('sem os campos, a aparência de sempre: fundo escuro translúcido, fio claro', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel()], 1, 1)
    expect(estilo(fills(g)[0])).toEqual({ color: PROP_SILHOUETTE_FILL_COLOR, alpha: PROP_SILHOUETTE_FILL_ALPHA })
    for (const traco of strokes(g)) expect(estilo(traco)).toEqual({ color: PROP_SILHOUETTE_EDGE_COLOR, alpha: PROP_SILHOUETTE_EDGE_ALPHA })
  })

  it('"Preencher" desligado: nenhum fill, só o contorno e o glifo', () => {
    const g = new Graphics()
    expect(drawPropSilhouettes(g, [movel({ mobiliaPreenchido: false })], 1, 1)).toBe(1)
    expect(fills(g)).toHaveLength(0)
    expect(strokes(g)).toHaveLength(2)
    // O contorno continua sendo a silhueta inteira.
    expect(silhouettePoints(g)).toHaveLength(4)
  })

  it('cor própria: o fundo fica chapado nessa cor, o fio continua o de sempre', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ mobiliaCor: '#8b4513' })], 1, 1)
    expect(fills(g)).toHaveLength(1)
    expect(estilo(fills(g)[0])).toEqual({ color: 0x8b4513, alpha: 1 })
    for (const traco of strokes(g)) expect(estilo(traco)).toEqual({ color: PROP_SILHOUETTE_EDGE_COLOR, alpha: PROP_SILHOUETTE_EDGE_ALPHA })
  })

  it('cor da linha própria: contorno E glifo nessa cor, na mesma espessura fina', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ mobiliaCorDaLinha: '#c0392b' })], 1, 1)
    const tracos = strokes(g)
    expect(tracos).toHaveLength(2)
    for (const traco of tracos) {
      expect(estilo(traco)).toEqual({ color: 0xc0392b, alpha: 1 })
      if (traco?.action !== 'stroke') throw new Error('esperava stroke')
      expect(traco.data.style.width).toBeCloseTo(1, 6)
    }
    expect(estilo(fills(g)[0])).toEqual({ color: PROP_SILHOUETTE_FILL_COLOR, alpha: PROP_SILHOUETTE_FILL_ALPHA })
  })

  it('sem preencher e com cor da linha: só o fio colorido', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ mobiliaPreenchido: false, mobiliaCor: '#8b4513', mobiliaCorDaLinha: '#c0392b' })], 1, 1)
    expect(fills(g)).toHaveLength(0)
    for (const traco of strokes(g)) expect(estilo(traco).color).toBe(0xc0392b)
  })

  it('cor torta (não é #rrggbb) não derruba o desenho: vale a aparência de sempre', () => {
    const g = new Graphics()
    expect(() => drawPropSilhouettes(g, [movel({ mobiliaCor: 'vermelho', mobiliaCorDaLinha: 'url(x)' })], 1, 1)).not.toThrow()
    expect(estilo(fills(g)[0])).toEqual({ color: PROP_SILHOUETTE_FILL_COLOR, alpha: PROP_SILHOUETTE_FILL_ALPHA })
    for (const traco of strokes(g)) expect(estilo(traco)).toEqual({ color: PROP_SILHOUETTE_EDGE_COLOR, alpha: PROP_SILHOUETTE_EDGE_ALPHA })
  })

  it('#rgb curto vale como a cor longa', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ mobiliaCor: '#A50' })], 1, 1)
    expect(estilo(fills(g)[0]).color).toBe(0xaa5500)
  })

  it('objeto comum ignora os campos do móvel: silhueta de sempre, sem glifo', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ mobilia: undefined, mobiliaPreenchido: false, mobiliaCor: '#8b4513' })], 1, 1)
    expect(estilo(fills(g)[0])).toEqual({ color: PROP_SILHOUETTE_FILL_COLOR, alpha: PROP_SILHOUETTE_FILL_ALPHA })
    expect(strokes(g)).toHaveLength(1)
  })
})

/** Contorno de lado do tipo, centrado na origem (o teste falha alto se vier nulo). */
function contornoDe(tipo: 'cadeira' | 'bau', largura: number, altura: number): { x: number; y: number }[] {
  const contorno = contornoDeLado(tipo, largura, altura)
  if (contorno === null) throw new Error(`${tipo} devia ter contorno de lado`)
  return contorno
}

/** `p` a no máximo meio pixel de (x, y): o contorno de lado encosta no pixel como o retângulo. */
function pertoDe(p: { x: number; y: number }, x: number, y: number): boolean {
  return Math.abs(p.x - x) <= 0.5 + 1e-9 && Math.abs(p.y - y) <= 0.5 + 1e-9
}

describe('drawPropSilhouettes — vista de lado', () => {
  it('cadeira de lado: o contorno é o perfil em L e as pernas vêm do glifo de lado', () => {
    const g = new Graphics()
    expect(drawPropSilhouettes(g, [movel({ mobilia: 'cadeira', mobiliaVista: 'lado', width: 32, height: 48 })], 1, 1)).toBe(1)

    const esperado = contornoDe('cadeira', 32, 48)
    const pontos = silhouettePoints(g)
    expect(pontos).toHaveLength(esperado.length)
    pontos.forEach((p, i) => expect(pertoDe(p, 250 + esperado[i].x, 200 + esperado[i].y), `ponto ${i}`).toBe(true))

    const pernas = tracosDoGlifo('cadeira', 32, 48, 'lado')
    const inicios = pathPoints(strokes(g)[1], 'moveTo')
    expect(inicios).toHaveLength(pernas.length)
    inicios.forEach((p, i) => {
      expect(p.x).toBeCloseTo(250 + pernas[i].x1, 6)
      expect(p.y).toBeCloseTo(200 + pernas[i].y1, 6)
    })
  })

  it('a cadeira sem vista continua o retângulo de sempre', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ mobilia: 'cadeira', width: 32, height: 48 })], 1, 1)
    expect(silhouettePoints(g)).toHaveLength(4)
  })

  it('baú de lado: a tampa em arco sobe até o meio do topo, e o glifo é o de lado', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ mobilia: 'bau', mobiliaVista: 'lado', width: 36, height: 36 })], 1, 1)
    const pontos = silhouettePoints(g)
    expect(pontos).toHaveLength(contornoDe('bau', 36, 36).length)
    expect(pontos.some((p) => pertoDe(p, 250, 182))).toBe(true)
    expect(pathPoints(strokes(g)[1], 'moveTo')).toHaveLength(tracosDoGlifo('bau', 36, 36, 'lado').length)
  })

  it('girada 90°, a cadeira de lado gira junto no sentido horário', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ mobilia: 'cadeira', mobiliaVista: 'lado', width: 32, height: 48, rotation: 90 })], 1, 1)
    const esperado = contornoDe('cadeira', 32, 48)
    const pontos = silhouettePoints(g)
    expect(pontos).toHaveLength(esperado.length)
    // Horário na tela (y para baixo): (u, v) vira (−v, u).
    pontos.forEach((p, i) => expect(pertoDe(p, 250 - esperado[i].y, 200 + esperado[i].x), `ponto ${i}`).toBe(true))
  })

  it('de longe (zoom pequeno) o arco do baú não repete ponto seguido: o traço do Pixi divide pelo tamanho do segmento', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ mobilia: 'bau', mobiliaVista: 'lado', width: 38.4, height: 38.4 })], 0.1, 1)
    const pontos = silhouettePoints(g)
    expect(pontos.length).toBeGreaterThanOrEqual(3)
    pontos.forEach((p, i) => {
      const seguinte = pontos[(i + 1) % pontos.length]
      expect(p.x === seguinte.x && p.y === seguinte.y, `ponto ${i}`).toBe(false)
    })
  })

  it('mesa com vista de lado no arquivo: a vista não vale, retângulo e glifo de frente', () => {
    const g = new Graphics()
    drawPropSilhouettes(g, [movel({ mobilia: 'mesa', mobiliaVista: 'lado', width: 60, height: 40 })], 1, 1)
    expect(silhouettePoints(g)).toHaveLength(4)
    expect(pathPoints(strokes(g)[1], 'moveTo')).toHaveLength(tracosDoGlifo('mesa', 60, 40).length)
  })
})
