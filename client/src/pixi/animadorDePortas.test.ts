import { describe, expect, it } from 'vitest'
import { Graphics, Ticker } from 'pixi.js'
import { createAnimadorDePortas, type MovimentoDasPortas } from './animadorDePortas'
import { drawDoors } from './drawDoors'
import { DESLIZAR_DURACAO_MS, GIRAR_DURACAO_MS } from '../portas/animacoesDePorta'
import type { DoorState, Wall } from '../types/map'

/**
 * PORTA ANIMADA NO MAPA: a porta que troca `open` anda de um estado ao outro
 * no relógio; no fim o desenho é IDÊNTICO ao de sempre. Sem animação, com
 * reduzir movimento ou na primeira carga, vai direto ao estado final.
 */
function porta(door: Partial<DoorState> = {}, id = 'p'): Wall {
  return { id, x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal', animacao: 'deslizar', ...door } }
}

type Instruction = Graphics['context']['instructions'][number]

function fills(g: Graphics): Instruction[] {
  return g.context.instructions.filter((i) => i.action === 'fill')
}

function pontos(instruction: Instruction): number[] {
  if (instruction.action !== 'fill' && instruction.action !== 'stroke') throw new Error('instrução sem path')
  const poly = instruction.data.path.instructions.find((i) => i.action === 'poly')
  if (poly === undefined || poly.action !== 'poly') throw new Error('sem poly')
  const [flat] = poly.data
  if (!Array.isArray(flat)) throw new Error('poly sem lista de números')
  return flat.filter((v): v is number => typeof v === 'number')
}

function faixa(instruction: Instruction, eixo: 'x' | 'y'): { min: number; max: number } {
  const valores = pontos(instruction).filter((_, i) => i % 2 === (eixo === 'x' ? 0 : 1))
  return { min: Math.min(...valores), max: Math.max(...valores) }
}

/** O desenho inteiro, comparável: ação + pontos de cada instrução. */
function desenho(g: Graphics): { acao: string; pontos: number[] }[] {
  return g.context.instructions.map((i) => ({ acao: i.action, pontos: i.action === 'fill' || i.action === 'stroke' ? pontos(i) : [] }))
}

function referencia(wall: Wall): ReturnType<typeof desenho> {
  const g = new Graphics()
  drawDoors(g, [wall])
  return desenho(g)
}

/** Relógio de mentira: `quadro(ms)` anda o tempo e emite um quadro do Ticker real do Pixi (molde de tokensRenderer.iniciativa.test.ts). */
function relogio(reduzido = false) {
  const ticker = new Ticker()
  let agora = 1000
  const movimento: MovimentoDasPortas = { ticker, reducedMotion: () => reduzido, now: () => agora }
  return {
    ticker,
    movimento,
    quadro(ms: number) {
      agora += ms
      ticker.update(agora)
    },
  }
}

describe('animadorDePortas — quando anima', () => {
  it('primeira carga não anima: a porta já aberta sai aberta e o relógio fica parado', () => {
    const { movimento, ticker } = relogio()
    const g = new Graphics()
    createAnimadorDePortas(movimento).desenhar(g, [porta({ open: true })])
    expect(desenho(g)).toEqual(referencia(porta({ open: true })))
    expect(ticker.count).toBe(0)
  })

  it('sem animação escolhida: troca na hora, igual a hoje, sem relógio', () => {
    const { movimento, ticker } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ animacao: undefined })])
    animador.desenhar(g, [porta({ animacao: undefined, open: true })])
    expect(desenho(g)).toEqual(referencia(porta({ animacao: undefined, open: true })))
    expect(ticker.count).toBe(0)
  })

  it('id que o app não conhece (pacote não baixado) = sem animação', () => {
    const { movimento, ticker } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ animacao: 'nao-instalada' })])
    animador.desenhar(g, [porta({ animacao: 'nao-instalada', open: true })])
    expect(desenho(g)).toEqual(referencia(porta({ animacao: 'nao-instalada', open: true })))
    expect(ticker.count).toBe(0)
  })

  it('reduzir movimento: estado final na hora', () => {
    const { movimento, ticker } = relogio(true)
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    expect(desenho(g)).toEqual(referencia(porta({ open: true })))
    expect(ticker.count).toBe(0)
  })

  it('sem relógio (exportação de imagem, testes antigos): nunca anima', () => {
    const g = new Graphics()
    const animador = createAnimadorDePortas()
    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    expect(desenho(g)).toEqual(referencia(porta({ open: true })))
  })

  it('porta secreta não anima: aberta ou fechada ela é a mesma tracejada', () => {
    const { movimento, ticker } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ secret: true })])
    animador.desenhar(g, [porta({ secret: true, open: true })])
    expect(desenho(g)).toEqual(referencia(porta({ secret: true, open: true })))
    expect(ticker.count).toBe(0)
  })
})

describe('animadorDePortas — o caminho', () => {
  it('"Deslizar" ao abrir: parte da fechada, no meio do tempo metade da folha entrou na parede, no fim é a aberta de sempre', () => {
    const { movimento, ticker, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    const parada = new Graphics()
    drawDoors(parada, [porta()])
    const fechada = faixa(fills(parada)[0], 'x')

    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    expect(ticker.count).toBe(1)
    // Começo: a folha inteira no vão, por cima do batente — a cara da fechada.
    expect(fills(g)).toHaveLength(1)
    expect(faixa(fills(g)[0], 'x').min).toBeCloseTo(fechada.min, 9)
    expect(faixa(fills(g)[0], 'x').max).toBeCloseTo(fechada.max, 9)

    // Meio do tempo: a curva passa por 0,5 — sobra a metade presa à ponta de (x2,y2).
    quadro(DESLIZAR_DURACAO_MS / 2)
    const meio = faixa(fills(g)[0], 'x')
    expect(meio.max).toBeCloseTo(fechada.max, 9)
    expect(meio.min).toBeCloseTo(fechada.min + (fechada.max - fechada.min) / 2, 9)

    quadro(DESLIZAR_DURACAO_MS / 2)
    expect(desenho(g)).toEqual(referencia(porta({ open: true })))
    expect(ticker.count).toBe(0)
  })

  it('"Deslizar" ao fechar: o caminho ao contrário, e o fim é a fechada de sempre', () => {
    const { movimento, ticker, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ open: true })])
    animador.desenhar(g, [porta()])
    // Começo do fechar = aberta: só o batente, folha nenhuma.
    expect(fills(g)).toHaveLength(0)
    quadro(DESLIZAR_DURACAO_MS)
    expect(desenho(g)).toEqual(referencia(porta()))
    expect(ticker.count).toBe(0)
  })

  it('"Girar na dobradiça": no meio a folha sai da linha da parede; no fim é a aberta de sempre', () => {
    const { movimento, ticker, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ animacao: 'girar' })])
    animador.desenhar(g, [porta({ animacao: 'girar', open: true })])
    quadro(GIRAR_DURACAO_MS / 2)
    // A 45° a folha de 60 cobre ~42 de altura; parada ela tem só a espessura (5).
    const altura = faixa(fills(g)[0], 'y')
    expect(altura.max - altura.min).toBeGreaterThan(30)
    quadro(GIRAR_DURACAO_MS / 2)
    expect(desenho(g)).toEqual(referencia(porta({ animacao: 'girar', open: true })))
    expect(ticker.count).toBe(0)
  })

  it('inverter no meio: fecha DE ONDE ESTAVA, no tempo que falta', () => {
    const { movimento, ticker, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    quadro(DESLIZAR_DURACAO_MS / 2)
    const noMeio = faixa(fills(g)[0], 'x')

    animador.desenhar(g, [porta()])
    // Sem salto: a folha continua onde estava no quadro da inversão.
    expect(faixa(fills(g)[0], 'x').min).toBeCloseTo(noMeio.min, 9)
    // Faltava metade do caminho: metade da duração basta para chegar.
    quadro(DESLIZAR_DURACAO_MS / 2)
    expect(desenho(g)).toEqual(referencia(porta()))
    expect(ticker.count).toBe(0)
  })

  it('porta que some no meio esquece o estado: o relógio solta e, de volta, ela não anima', () => {
    const { movimento, ticker } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    expect(ticker.count).toBe(1)

    animador.desenhar(g, [])
    expect(ticker.count).toBe(0)
    expect(g.context.instructions).toHaveLength(0)

    // Volta já fechada (o mestre fechou enquanto ela estava fora): primeira vez de novo, sem animar.
    animador.desenhar(g, [porta()])
    expect(desenho(g)).toEqual(referencia(porta()))
    expect(ticker.count).toBe(0)
  })

  it('só a porta que mudou anda; a vizinha fica parada no desenho de sempre', () => {
    const { movimento, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    const vizinha = { ...porta({}, 'v'), x1: 200, x2: 300 }
    animador.desenhar(g, [porta(), vizinha])
    animador.desenhar(g, [porta({ open: true }), vizinha])
    quadro(DESLIZAR_DURACAO_MS / 4)
    const fillsDaVizinha = fills(g).filter((f) => faixa(f, 'x').min >= 200)
    expect(fillsDaVizinha).toHaveLength(1)
    const sozinha = new Graphics()
    drawDoors(sozinha, [vizinha])
    expect(pontos(fillsDaVizinha[0])).toEqual(pontos(fills(sozinha)[0]))
  })

  it('cancelar (desmonte) solta o relógio no meio do caminho', () => {
    const { movimento, ticker } = relogio()
    const animador = createAnimadorDePortas(movimento)
    const g = new Graphics()
    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    expect(ticker.count).toBe(1)
    animador.cancelar()
    expect(ticker.count).toBe(0)
  })
})
