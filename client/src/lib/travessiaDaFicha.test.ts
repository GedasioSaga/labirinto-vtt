import { describe, expect, it } from 'vitest'
import type { Light, MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { chegadaDaTravessia, planoDaTravessia, saidaDaTravessia, travessiaDaFicha, type SceneHistory } from './travessiaDaFicha'

/**
 * A TRAVESSIA DA FICHA, pura: o que `adventureStore.transferToken` grava nas
 * stores e a Visão de jogador grava na camada de teste. Sem store nenhuma aqui.
 */

const GRADE = 50

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function tocha(id: string, presaEm: string, x: number, y: number): Light {
  return { id, x, y, radius: 100, color: '#ffcc66', intensity: 1, attachedTokenId: presaEm }
}

function cena(id: string, extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap(id, id, 20, 20, GRADE), ...extra }
}

const historia = (map: MapData, past: MapData[] = [], future: MapData[] = []): SceneHistory => ({ map, past, future })

/** Id previsível: o teste lê qual id ganhou quem. */
const novoId = (idAntigo: string) => `${idAntigo}-novo`

const idsDe = (map: MapData) => map.tokens.map((t) => t.id)

describe('travessiaDaFicha', () => {
  it('a ficha sai de TODO passo do desfazer da origem e entra em todo passo do destino, no ponto e no piso de chegada', () => {
    const ana = ficha('ana', 125, 125)
    const antes = cena('vale', { tokens: [ana] })
    const origem = historia(antes, [antes], [antes])
    const destino = historia(cena('cripta'), [cena('cripta')])

    const feita = travessiaDaFicha(origem, destino, { tokenId: 'ana', x: 475, y: 325, piso: 2 }, novoId)

    expect(feita).not.toBeNull()
    expect([feita?.origem.map, ...(feita?.origem.past ?? []), ...(feita?.origem.future ?? [])].map((m) => m && idsDe(m))).toEqual([[], [], []])
    expect(feita?.destino.map.tokens).toEqual([{ ...ana, x: 475, y: 325, piso: 2 }])
    expect(feita?.destino.past.map(idsDe)).toEqual([['ana']])
    expect(feita?.renamedResidents.size).toBe(0)
  })

  it('a ficha que não está na origem não atravessa', () => {
    expect(travessiaDaFicha(historia(cena('vale')), historia(cena('cripta')), { tokenId: 'ana', x: 0, y: 0 }, novoId)).toBeNull()
    expect(planoDaTravessia(cena('vale'), cena('cripta'), { tokenId: 'ana', x: 0, y: 0 })).toBeNull()
  })

  it('a tocha presa vai junto, no mesmo afastamento, e não fica acesa na origem', () => {
    const origem = historia(cena('vale', { tokens: [ficha('ana', 125, 125)], lights: [tocha('luz', 'ana', 150, 125)] }))
    const feita = travessiaDaFicha(origem, historia(cena('cripta')), { tokenId: 'ana', x: 475, y: 325 }, novoId)
    expect(feita?.origem.map.lights).toEqual([])
    expect(feita?.destino.map.lights.map((l) => [l.id, l.x, l.y, l.attachedTokenId])).toEqual([['luz', 500, 325, 'ana']])
  })

  it('VEÍCULO: quem está a bordo atravessa junto e chega ainda a bordo', () => {
    const bote = ficha('bote', 225, 225, { veiculo: { lugares: 2, passageiros: ['gui'] } })
    const gui = ficha('gui', 275, 225)
    const feita = travessiaDaFicha(historia(cena('rio', { tokens: [bote, gui] })), historia(cena('margem')), { tokenId: 'bote', x: 525, y: 525 }, novoId)
    expect(feita?.origem.map.tokens).toEqual([])
    expect(idsDe(feita?.destino.map ?? cena('vazia'))).toEqual(['bote', 'gui'])
    expect(feita?.destino.map.tokens.find((t) => t.id === 'bote')?.veiculo?.passageiros).toEqual(['gui'])
  })

  it('ID REPETIDO: quem já estava no destino ganha o id que `novoId` der, e quem chega guarda o dele', () => {
    const destino = historia(cena('cripta', { tokens: [ficha('ana', 325, 325, { name: 'Ana da Cripta' })] }))
    const feita = travessiaDaFicha(historia(cena('vale', { tokens: [ficha('ana', 125, 125)] })), destino, { tokenId: 'ana', x: 475, y: 325 }, novoId)
    expect(feita?.renamedResidents).toEqual(new Map([['ana', 'ana-novo']]))
    expect(feita?.destino.map.tokens.map((t) => [t.id, t.name])).toEqual([
      ['ana-novo', 'Ana da Cripta'],
      ['ana', 'ana'],
    ])
  })

  it('os três passos separados (o que a camada de teste guarda, um em cada cena) dão o mesmo que a travessia inteira, e de novo a cada vez', () => {
    const origem = cena('vale', { tokens: [ficha('ana', 125, 125), ficha('bia', 325, 325)], lights: [tocha('luz', 'ana', 150, 125)] })
    const chegada = cena('cripta', { tokens: [ficha('ana', 325, 325, { name: 'Ana da Cripta' })] })
    const pedido = { tokenId: 'ana', x: 475, y: 325 }
    const inteira = travessiaDaFicha(historia(origem), historia(chegada), pedido, novoId)
    const plano = planoDaTravessia(origem, chegada, pedido)
    if (plano === null || inteira === null) throw new Error('a Ana deveria atravessar')

    // Reaplicar sobre o MESMO mapa dá o mesmo resultado: a camada reaplica a cada leitura.
    for (let vez = 0; vez < 2; vez += 1) {
      expect(saidaDaTravessia(historia(origem), plano).map).toEqual(inteira.origem.map)
      expect(chegadaDaTravessia(historia(chegada), plano, novoId).history.map).toEqual(inteira.destino.map)
    }
    // A origem continua com quem não atravessou.
    expect(idsDe(inteira.origem.map)).toEqual(['bia'])
  })
})
