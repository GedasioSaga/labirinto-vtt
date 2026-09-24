import { describe, expect, it } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import {
  createRoomNamesRenderer,
  findRoomLabelAt,
  roomLabelBounds,
  roomLabelPositionAvoidingTokens,
  tokenLabelObstacles,
  type LabelObstacle,
} from './drawRoomNames'
import type { Region, RegionPoint } from '../types/map'

/*
 * FICHA NO PONTO DO NOME — simulação de 7 jogadores, cenário vila*: o Ladino
 * parado no meio do Quarto do Prefeito cobria o nome da sala (a ficha é
 * desenhada por cima da plaquinha), e "Quarto do Prefeito" virava um borrão
 * saindo dos dois lados do disco. Com ficha em cima do nome, ele sobe para a
 * borda de cima da sala, por dentro da parede; sem ficha, fica no meio.
 */

const GRADE = 40
/** O Quarto do Prefeito: 10 x 7 quadrados, centróide em (400, 340). */
const QUARTO: RegionPoint[] = [
  { x: 200, y: 200 },
  { x: 600, y: 200 },
  { x: 600, y: 480 },
  { x: 200, y: 480 },
]
const CENTRO = { x: 400, y: 340 }
const TOPO_DO_QUARTO = 200

function quarto(extra: Partial<NonNullable<Region['room']>> = {}): Region {
  return {
    id: 'quarto',
    points: QUARTO,
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Quarto do Prefeito', ...extra },
  }
}

/**
 * O que o Ladino ocupa parado em `p`, na grade de 40: o disco (raio 20) e o
 * nome embaixo dele. Caixas escritas à mão, e não por `tokenLabelObstacles`,
 * para a prova do lugar do nome não depender da conta que ela mesma usa.
 */
function ladino(p: { x: number; y: number }): LabelObstacle[] {
  return [
    { minX: p.x - 20, minY: p.y - 20, maxX: p.x + 20, maxY: p.y + 20 },
    { minX: p.x - 23, minY: p.y + 22, maxX: p.x + 23, maxY: p.y + 40 },
  ]
}

function sobrepoe(a: LabelObstacle, b: LabelObstacle): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}

function caixaDoNome(region: Region, obstaculos: readonly LabelObstacle[]): LabelObstacle {
  const caixa = roomLabelBounds(region, GRADE, 1, [region], obstaculos)
  if (caixa === null) throw new Error('esperava caixa de rótulo')
  return caixa
}

function meio(caixa: LabelObstacle): { x: number; y: number } {
  return { x: (caixa.minX + caixa.maxX) / 2, y: (caixa.minY + caixa.maxY) / 2 }
}

describe('nome da sala com uma ficha em cima', () => {
  it('Ladino parado no meio: o nome sobe para a borda de cima, por dentro da parede, e sai de baixo da ficha e do nome dela', () => {
    const obstaculos = ladino(CENTRO)
    const caixa = caixaDoNome(quarto(), obstaculos)

    for (const obstaculo of obstaculos) expect(sobrepoe(caixa, obstaculo)).toBe(false)
    // Na mesma coluna do meio da sala, encostado na parede de cima sem cobrir o traço.
    expect(meio(caixa).x).toBeCloseTo(CENTRO.x, 6)
    expect(caixa.minY).toBeGreaterThan(TOPO_DO_QUARTO)
    expect(caixa.minY - TOPO_DO_QUARTO).toBeLessThan(10)

    // CONTROLE: a mesma sala sem ficha nenhuma tem o nome no meio, onde o Ladino estava.
    const semFicha = meio(caixaDoNome(quarto(), []))
    expect(semFicha.x).toBeCloseTo(CENTRO.x, 6)
    expect(semFicha.y).toBeCloseTo(CENTRO.y, 6)
    expect(obstaculos.some((obstaculo) => sobrepoe(caixaDoNome(quarto(), []), obstaculo))).toBe(true)
  })

  it('ficha num canto, longe do nome: o nome fica no meio da sala', () => {
    const posicao = roomLabelPositionAvoidingTokens(quarto(), [quarto()], GRADE, ladino({ x: 260, y: 420 }))
    expect(posicao).toEqual(CENTRO)
  })

  it('ficha só encostada na ponta da plaquinha, sem cobrir letra: o nome não pula para cima', () => {
    // O disco (290..330) entra 1 px na folga da pílula e para antes da primeira letra.
    const posicao = roomLabelPositionAvoidingTokens(quarto(), [quarto()], GRADE, ladino({ x: 310, y: 340 }))
    expect(posicao).toEqual(CENTRO)
  })

  it('nome arrastado pelo mestre fica onde ele soltou, com ficha em cima ou sem', () => {
    const arrastado = quarto({ labelOffset: { x: -80, y: 60 } })
    const ondeSoltou = { x: CENTRO.x - 80, y: CENTRO.y + 60 }
    expect(roomLabelPositionAvoidingTokens(arrastado, [arrastado], GRADE, ladino(ondeSoltou))).toEqual(ondeSoltou)
  })

  it('ficha no meio E outra encostada na borda de cima: o nome vai para o lugar livre mais perto de lá, dentro da sala', () => {
    const obstaculos = [...ladino(CENTRO), ...ladino({ x: 400, y: 225 })]
    const caixa = caixaDoNome(quarto(), obstaculos)

    for (const obstaculo of obstaculos) expect(sobrepoe(caixa, obstaculo)).toBe(false)
    expect(caixa.minX).toBeGreaterThanOrEqual(200)
    expect(caixa.maxX).toBeLessThanOrEqual(600)
    expect(caixa.minY).toBeGreaterThanOrEqual(TOPO_DO_QUARTO)
    // Continua na faixa de cima: acima do Ladino do meio, e não no pé da sala.
    expect(caixa.maxY).toBeLessThan(CENTRO.y - 20)
  })

  it('o toque segue o nome: acha a sala onde o nome foi parar, e não mais embaixo da ficha', () => {
    const obstaculos = ladino(CENTRO)
    const sala = quarto()
    const ondeEsta = meio(caixaDoNome(sala, obstaculos))

    expect(findRoomLabelAt([sala], ondeEsta, GRADE, 1, obstaculos)?.id).toBe('quarto')
    expect(findRoomLabelAt([sala], CENTRO, GRADE, 1, obstaculos)).toBeNull()
    // Sem fichas (o editor do mestre), o nome continua no meio.
    expect(findRoomLabelAt([sala], CENTRO, GRADE, 1)?.id).toBe('quarto')
  })

  it('renderer: com a ficha no meio, nome e plaquinha vão juntos para a borda de cima; a ficha sai e voltam ao meio no mesmo Text', () => {
    const container = new Container()
    const renderer = createRoomNamesRenderer()
    const sala = quarto()

    renderer.draw(container, [sala], GRADE, 1, ladino(CENTRO))
    const [texto] = container.children.filter((filho): filho is Text => filho instanceof Text)
    const [placa] = container.children.filter((filho): filho is Graphics => filho instanceof Graphics)
    expect(texto.text).toBe('Quarto do Prefeito')
    expect(texto.position.x).toBeCloseTo(CENTRO.x, 6)
    expect(texto.position.y).toBeLessThan(CENTRO.y - 20 - 11)
    expect(texto.position.y).toBeGreaterThan(TOPO_DO_QUARTO)
    expect(placa.position.x).toBe(texto.position.x)
    expect(placa.position.y).toBe(texto.position.y)

    renderer.draw(container, [sala], GRADE, 1, [])
    const [depois] = container.children.filter((filho): filho is Text => filho instanceof Text)
    expect(depois).toBe(texto)
    expect(depois.position.x).toBe(CENTRO.x)
    expect(depois.position.y).toBe(CENTRO.y)
    expect(placa.position.y).toBe(CENTRO.y)
  })
})

describe('tokenLabelObstacles', () => {
  it('a ficha ocupa o disco e a faixa do nome embaixo dele; sem nome, só o disco', () => {
    const comNome = tokenLabelObstacles({ x: 400, y: 340, radius: 20, name: 'Ladino', nameFontSize: 12, nameTop: 22, nameBottom: 49 })
    expect(comNome).toHaveLength(2)
    expect(comNome[0]).toEqual({ minX: 380, minY: 320, maxX: 420, maxY: 360 })
    const [, nome] = comNome
    expect(nome.minY).toBe(362)
    expect(nome.maxY).toBe(389)
    // Largura estimada do nome, centrada na ficha e mais larga que o texto real (erra sobrando).
    expect(nome.maxX - nome.minX).toBeGreaterThan('Ladino'.length * 12 * 0.5)
    expect(nome.minX + nome.maxX).toBeCloseTo(800, 6)

    const semNome = tokenLabelObstacles({ x: 400, y: 340, radius: 20, name: '  ', nameFontSize: 12, nameTop: 22, nameBottom: 49 })
    expect(semNome).toEqual([{ minX: 380, minY: 320, maxX: 420, maxY: 360 }])
  })
})
