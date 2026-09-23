import { describe, expect, it } from 'vitest'
import { Container, Text } from 'pixi.js'
import { createRoomNamesRenderer, findRoomLabelAt, roomLabelAnchor } from './drawRoomNames'
import type { Region, RegionPoint } from '../types/map'

/*
 * Dor medida na cidade-torre (cena a09-blocos, 2.828 salas): achar as filhas
 * de CADA sala nomeada varrendo a cena inteira custa N² leituras por
 * redesenho, e o redesenho roda a cada seleção, arrasto e troca de cena.
 *
 * O teste não cronometra (relógio em máquina carregada mente): conta quantas
 * vezes alguém pergunta `parentId` a uma sala. Custo linear dobra quando a
 * cena dobra; custo quadrático quadruplica.
 */

const GRID = 64
const LADO = 128
/** Distância entre salas vizinhas: folga para um rótulo não encostar no outro. */
const PASSO = 400
/** A cada quantas salas uma tem um quarto dentro — o desvio precisa ser exercitado. */
const MAE_A_CADA = 5
/** Linear dobra (×2) quando a cena dobra; quadrático quadruplica (×4). 3 separa os dois com folga. */
const TETO_DE_CRESCIMENTO_AO_DOBRAR = 3

function quadrado(x: number, y: number, lado: number): RegionPoint[] {
  return [
    { x, y },
    { x: x + lado, y },
    { x: x + lado, y: y + lado },
    { x, y: y + lado },
  ]
}

interface Contador {
  leituras: number
}

/** Sala cujo `parentId` conta quem o lê. */
function salaContada(id: string, nome: string, points: RegionPoint[], contador: Contador, parentId?: string): Region {
  const sala: Region = {
    id,
    points,
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
  }
  Object.defineProperty(sala, 'parentId', {
    enumerable: true,
    get() {
      contador.leituras++
      return parentId
    },
  })
  return sala
}

/** Cena com `total` salas nomeadas; uma em cada `MAE_A_CADA` ganha um quarto
 *  (que também conta no total) no canto de cima, onde cai o centróide dela. */
function cidade(total: number, contador: Contador): Region[] {
  const cena: Region[] = []
  for (let i = 0; cena.length < total; i++) {
    const x = i * PASSO
    const id = `sala-${i}`
    cena.push(salaContada(id, `Sala ${i}`, quadrado(x, 0, LADO * 2), contador))
    if (i % MAE_A_CADA === 0 && cena.length < total) {
      cena.push(salaContada(`quarto-${i}`, `Quarto ${i}`, quadrado(x, 0, LADO + 20), contador, id))
    }
  }
  return cena
}

function leiturasParaDesenhar(total: number): number {
  const contador: Contador = { leituras: 0 }
  const cena = cidade(total, contador)
  createRoomNamesRenderer().draw(new Container(), cena, GRID, 1)
  return contador.leituras
}

function leiturasParaAcharRotulo(total: number): number {
  const contador: Contador = { leituras: 0 }
  const cena = cidade(total, contador)
  // Clique longe de tudo: o hit-test percorre a cena inteira sem achar nada.
  expect(findRoomLabelAt(cena, { x: -10_000, y: -10_000 }, GRID)).toBeNull()
  return contador.leituras
}

describe('nomes de sala numa cena grande', () => {
  it('desenhar os nomes: custo cresce linear com o número de salas, não quadrático', () => {
    const pequena = leiturasParaDesenhar(200)
    const dobro = leiturasParaDesenhar(400)
    expect(pequena).toBeGreaterThan(0)
    expect(dobro / pequena).toBeLessThan(TETO_DE_CRESCIMENTO_AO_DOBRAR)
    // Cada sala é consultada um número constante de vezes, não uma vez por vizinha.
    expect(dobro).toBeLessThanOrEqual(2 * 400)
  })

  it('achar o nome sob o clique: custo cresce linear com o número de salas', () => {
    const pequena = leiturasParaAcharRotulo(200)
    const dobro = leiturasParaAcharRotulo(400)
    expect(pequena).toBeGreaterThan(0)
    expect(dobro / pequena).toBeLessThan(TETO_DE_CRESCIMENTO_AO_DOBRAR)
    expect(dobro).toBeLessThanOrEqual(2 * 400)
  })

  it('redesenhar a MESMA cena (seleção, zoom) reaproveita o índice: nenhuma sala é consultada de novo', () => {
    const contador: Contador = { leituras: 0 }
    const cena = cidade(300, contador)
    const renderer = createRoomNamesRenderer()
    const container = new Container()

    renderer.draw(container, cena, GRID, 1)
    const depoisDoPrimeiro = contador.leituras
    renderer.draw(container, cena, GRID, 1)
    renderer.draw(container, cena, GRID, 2)

    expect(depoisDoPrimeiro).toBeGreaterThan(0)
    expect(contador.leituras).toBe(depoisDoPrimeiro)
  })

  it('quando as salas mudam (quarto novo), o nome da mãe sai de cima do quarto: índice não fica velho', () => {
    const contador: Contador = { leituras: 0 }
    const maePontos = quadrado(0, 0, LADO * 4)
    const mae = salaContada('mae', 'Sala 1', maePontos, contador)
    const renderer = createRoomNamesRenderer()
    const container = new Container()
    const textoDaMae = (): Text => {
      const texto = container.children.find((c): c is Text => c instanceof Text && c.text === 'Sala 1')
      if (!texto) throw new Error('esperava o nome da mãe desenhado')
      return texto
    }

    renderer.draw(container, [mae], GRID, 1)
    const centroide = roomLabelAnchor(maePontos)
    expect(textoDaMae().position.x).toBeCloseTo(centroide.x)
    expect(textoDaMae().position.y).toBeCloseTo(centroide.y)

    // Mestre desenha um quarto em cima do centróide: cena nova (array novo).
    const quarto = salaContada('quarto', 'Sala 2', quadrado(0, 0, LADO * 2 + 20), contador, 'mae')
    renderer.draw(container, [mae, quarto], GRID, 1)
    const depois = textoDaMae().position
    expect(depois.x !== centroide.x || depois.y !== centroide.y).toBe(true)

    // E o quarto apagado devolve o nome ao centróide.
    renderer.draw(container, [mae], GRID, 1)
    expect(textoDaMae().position.x).toBeCloseTo(centroide.x)
    expect(textoDaMae().position.y).toBeCloseTo(centroide.y)
  })

  it('cena sem nenhum campo opcional (sem parentId, sem nome, sem ponto) não quebra', () => {
    const crua: Region = { id: 'crua', points: [], tag: '', fillColor: '#333', fillPattern: 'solid', data: {} }
    const container = new Container()
    createRoomNamesRenderer().draw(container, [crua], GRID)
    expect(container.children.length).toBe(0)
    expect(findRoomLabelAt([crua], { x: 0, y: 0 }, GRID)).toBeNull()
    createRoomNamesRenderer().draw(container, [], GRID)
    expect(findRoomLabelAt([], { x: 0, y: 0 }, GRID)).toBeNull()
  })
})
