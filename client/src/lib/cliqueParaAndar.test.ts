/**
 * CLICAR PARA ANDAR (CAMINHOS F2): a chave da cena (ausente = ligada, mapa de
 * antes abre e salva idêntico), o plano do clique (destino ocupado para na casa
 * livre mais próxima) e a conferência do host de que o trecho fica no que o
 * jogador conhece.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { cliqueParaAndarLigado, comCliqueParaAndar, planejarCaminhada, trechoNoConhecido } from './cliqueParaAndar'
import type { KnownArea } from './knownPath'
import type { MapData, RegionPoint, Token } from '../types/map'

const GRID = 50

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function retangulo(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

/** 20 x 12 casas; a ficha da Ana no meio da esquerda. */
function mapa(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m-clique', 'Clique', 20, 12, GRID), tokens: [ficha('ana', 125, 125)], ...extra }
}

/** O jogador conhece só a metade de cima do mapa (a visão de agora). */
const CONHECE_EM_CIMA: KnownArea = { explored: undefined, vision: [retangulo(0, 0, 1000, 300)], concealed: [] }

describe('chave da cena', () => {
  it('ausente = ligada; só false desliga', () => {
    expect(cliqueParaAndarLigado(mapa())).toBe(true)
    expect(cliqueParaAndarLigado(mapa({ cliqueParaAndar: true }))).toBe(true)
    expect(cliqueParaAndarLigado(mapa({ cliqueParaAndar: false }))).toBe(false)
  })

  it('desligar grava false; religar TIRA o campo (o mapa volta ao de antes); o mesmo valor devolve o mesmo mapa', () => {
    const antes = mapa()
    const desligado = comCliqueParaAndar(antes, false)
    expect(desligado.cliqueParaAndar).toBe(false)
    expect(comCliqueParaAndar(desligado, false)).toBe(desligado)
    const religado = comCliqueParaAndar(desligado, true)
    expect('cliqueParaAndar' in religado).toBe(false)
    expect(religado).toEqual(antes)
    expect(comCliqueParaAndar(antes, true)).toBe(antes)
  })

  it('mapa antigo (sem o campo) abre e salva idêntico; desligado volta desligado', () => {
    const antigo = mapa()
    const texto = serializeMap(antigo)
    const lido = deserializeMap(texto)
    expect('cliqueParaAndar' in lido).toBe(false)
    expect(serializeMap(lido)).toBe(texto)
    const desligado = deserializeMap(serializeMap(comCliqueParaAndar(antigo, false)))
    expect(desligado.cliqueParaAndar).toBe(false)
    expect(cliqueParaAndarLigado(desligado)).toBe(false)
  })

  it('valor torto no arquivo (editado à mão) abre sem o campo, ligado', () => {
    const lido = deserializeMap(JSON.stringify({ ...JSON.parse(serializeMap(mapa())), cliqueParaAndar: 'sim' }))
    expect('cliqueParaAndar' in lido).toBe(false)
  })
})

describe('plano do clique', () => {
  it('chave desligada: aviso, nenhum trecho', () => {
    const m = mapa({ cliqueParaAndar: false })
    expect(planejarCaminhada(m, ficha('ana', 125, 125), { x: 525, y: 125 }, CONHECE_EM_CIMA)).toEqual({ tipo: 'aviso', motivo: 'caminhada_desligada' })
  })

  it('chão conhecido: os trechos até o ponto e a marca no ponto', () => {
    const plano = planejarCaminhada(mapa(), ficha('ana', 125, 125), { x: 525, y: 125 }, CONHECE_EM_CIMA)
    expect(plano).toEqual({ tipo: 'andar', trechos: [{ x: 525, y: 125 }], destino: { x: 525, y: 125 } })
  })

  it('no escuro: aviso de caminho desconhecido', () => {
    expect(planejarCaminhada(mapa(), ficha('ana', 125, 125), { x: 525, y: 525 }, CONHECE_EM_CIMA)).toEqual({ tipo: 'aviso', motivo: 'caminho_desconhecido' })
  })

  it('destino ocupado (fichas ocupam espaço): para na casa livre mais próxima, em vez de recusar', () => {
    const m = mapa({ movement: { tokensOccupy: true }, tokens: [ficha('ana', 125, 125), ficha('bia', 525, 125)] })
    const plano = planejarCaminhada(m, ficha('ana', 125, 125), { x: 530, y: 120 }, CONHECE_EM_CIMA)
    if (plano.tipo !== 'andar') throw new Error(`esperava andar, veio ${JSON.stringify(plano)}`)
    // A casa vizinha da Bia mais perto do clique (à esquerda dela, no caminho de quem vem da esquerda, ou acima/abaixo/direita: a 1 casa).
    expect(Math.hypot(plano.destino.x - 525, plano.destino.y - 125)).toBeCloseTo(GRID, 5)
    expect(plano.trechos.at(-1)).toEqual(plano.destino)
  })

  it('destino ocupado sem a regra de ocupação: vai ao ponto pedido', () => {
    const m = mapa({ tokens: [ficha('ana', 125, 125), ficha('bia', 525, 125)] })
    const plano = planejarCaminhada(m, ficha('ana', 125, 125), { x: 525, y: 125 }, CONHECE_EM_CIMA)
    expect(plano).toEqual({ tipo: 'andar', trechos: [{ x: 525, y: 125 }], destino: { x: 525, y: 125 } })
  })

  it('cercado (toda casa livre a até 2 casas no escuro ou ocupada): aviso de lugar ocupado', () => {
    // Bia na quina de baixo à direita do conhecido; as 8 casas conhecidas a até 2 dela, ocupadas.
    const vizinhas = [875, 925, 975].flatMap((x) => [175, 225, 275].map((y) => ({ x, y }))).filter((p) => p.x !== 975 || p.y !== 275)
    const tokens = [ficha('ana', 125, 125), ficha('bia', 975, 275), ...vizinhas.map((p, i) => ficha(`f${i}`, p.x, p.y))]
    const m = mapa({ movement: { tokensOccupy: true }, tokens })
    expect(planejarCaminhada(m, ficha('ana', 125, 125), { x: 975, y: 275 }, CONHECE_EM_CIMA)).toEqual({ tipo: 'aviso', motivo: 'occupied' })
  })
})

describe('trecho no conhecido (a conferência do host)', () => {
  it('trecho todo no conhecido passa; trecho que entra no escuro não', () => {
    const m = mapa()
    expect(trechoNoConhecido(m, { x: 125, y: 125 }, { x: 525, y: 125 }, CONHECE_EM_CIMA)).toBe(true)
    expect(trechoNoConhecido(m, { x: 125, y: 125 }, { x: 125, y: 525 }, CONHECE_EM_CIMA)).toBe(false)
  })

  it('zona oculta no meio do trecho: escuro, mesmo que vista', () => {
    const m = mapa()
    const comOculta: KnownArea = { ...CONHECE_EM_CIMA, concealed: [retangulo(300, 100, 350, 150)] }
    expect(trechoNoConhecido(m, { x: 125, y: 125 }, { x: 525, y: 125 }, comOculta)).toBe(false)
  })

  it('coordenada torta não vira laço nem passa', () => {
    const m = mapa()
    expect(trechoNoConhecido(m, { x: 125, y: 125 }, { x: Number.NaN, y: 125 }, CONHECE_EM_CIMA)).toBe(false)
    expect(trechoNoConhecido(m, { x: 125, y: 125 }, { x: 1e12, y: 125 }, CONHECE_EM_CIMA)).toBe(false)
  })
})
