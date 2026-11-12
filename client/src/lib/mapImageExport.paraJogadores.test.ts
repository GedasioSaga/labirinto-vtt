/**
 * A IMAGEM PARA OS JOGADORES (caça de 12/11/2026, P-NEVOA "Exportada"): sem
 * "Incluir objetos só do mestre", a imagem é igual com e sem o que o jogador
 * nunca recebe. (a) Camada escondida dos jogadores: o barril e a parede dela
 * saíam. (b) Decisão 31 do mestre: a casa de teto fechado sai com o telhado
 * cheio, sem o interior (o canvas desenha o telhado; aqui, o mapa da imagem).
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Prop, Region, Token, Wall } from '../types/map'
import { CAMADAS_PADRAO } from './camadas/padrao'
import { createEmptyMap } from './mapFactory'
import { mapForImageExport } from './mapImageExport'

const G = 50
const LIVRE = 'livre_0a1b2c3d'
const SEM_MESTRE = { grid: false, masterOnly: false }
const COM_MESTRE = { grid: false, masterOnly: true }

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1: x1 * G, y1: y1 * G, x2: x2 * G, y2: y2 * G, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function movel(id: string, mobilia: Prop['mobilia'], x: number, y: number, extra: Partial<Prop> = {}): Prop {
  return { id, src: '', x: x * G, y: y * G, width: 0.8 * G, height: 0.8 * G, linkedMapPath: null, mobilia, ...extra }
}

function cena(patch: Partial<MapData>): MapData {
  return {
    ...createEmptyMap('m', 'Montagem A', 34, 22, G),
    versaoDasCamadas: 2,
    modeloCamadas: { ordem: [...CAMADAS_PADRAO.map((id) => ({ id })), { id: LIVRE, nome: 'Segredo do mestre' }] },
    ocultasDoJogador: [LIVRE],
    ...patch,
  }
}

describe('imagem para os jogadores', () => {
  it('camada escondida dos jogadores: o barril, a parede e a tocha presa nela não saem (igual à cena sem eles); com a opção do mestre, saem', () => {
    // A tocha presa na parede lisa (comum) fica; a presa na parede da camada escondida, a 1,35 px dela, sai.
    const tochaNaLisa = movel('tocha-lisa', 'tochaDeParede', 20, 3, { width: 0.4 * G, height: 0.5 * G, y: 3 * G - 1.35 })
    const comum = { walls: [parede('lisa', 17, 3, 23, 3)], props: [movel('barril-comum', 'barril', 6, 3.5), tochaNaLisa] }
    const com = cena({
      walls: [...comum.walls, parede('parede-camada', 24, 1.5, 28, 1.5, { camada: LIVRE })],
      props: [
        ...comum.props,
        movel('barril-camada', 'barril', 10, 3.5, { camada: LIVRE }),
        movel('tocha-camada', 'tochaDeParede', 26, 1.5, { width: 0.4 * G, height: 0.5 * G, y: 1.5 * G - 1.35 }),
      ],
    })
    expect(mapForImageExport(com, SEM_MESTRE)).toEqual(mapForImageExport(cena(comum), SEM_MESTRE))
    expect(mapForImageExport(com, SEM_MESTRE).props.map((p) => p.id)).toEqual(['barril-comum', 'tocha-lisa'])
    const doMestre = mapForImageExport(com, COM_MESTRE)
    expect(doMestre.walls.map((w) => w.id)).toContain('parede-camada')
    expect(doMestre.props.map((p) => p.id)).toEqual(['barril-comum', 'tocha-lisa', 'barril-camada', 'tocha-camada'])
  })

  it('casa de teto fechado: o interior não sai (baú, cadeira, ficha, pino, divisória e a tocha com o centro na parede de fora); o telhado e o contorno ficam', () => {
    const casa: Region = {
      id: 'casa',
      points: [
        { x: 26 * G, y: 16 * G },
        { x: 31 * G, y: 16 * G },
        { x: 31 * G, y: 20 * G },
        { x: 26 * G, y: 20 * G },
      ],
      tag: '',
      fillColor: '#333',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'Casa', roof: true },
    }
    const contorno = [parede('c0', 26, 16, 31, 16, { regionId: 'casa' }), parede('c1', 31, 16, 31, 20, { regionId: 'casa' }), parede('c2', 31, 20, 26, 20, { regionId: 'casa' }), parede('c3', 26, 20, 26, 16, { regionId: 'casa' })]
    const fora: Token = { id: 'fora', characterId: null, name: 'Fora', x: 24 * G, y: 18 * G, size: 1, image: null }
    // Encostado na parede de fora, sem ponta lá dentro: fica.
    const vizinho = movel('barril-encostado', 'barril', 25.6, 18)
    const sem = cena({ regions: [casa], walls: contorno, tokens: [fora], props: [vizinho] })
    const com = cena({
      regions: [casa],
      walls: [...contorno, parede('divisoria', 28.5, 16, 28.5, 20)],
      tokens: [fora, { id: 'dentro', characterId: null, name: 'Dentro', x: 27 * G, y: 18 * G, size: 1, image: null }],
      props: [vizinho, movel('bau', 'bau', 28, 18.2), movel('cadeira', 'cadeira', 29.5, 19), movel('tocha', 'tochaDeParede', 28.5, 16, { width: 0.4 * G, height: 0.5 * G })],
      pins: [{ id: 'pino', x: 30 * G, y: 17 * G, kind: 'exclamacao', description: 'no quarto', image: null }],
    })
    const imagem = mapForImageExport(com, SEM_MESTRE)
    expect(imagem).toEqual(mapForImageExport(sem, SEM_MESTRE))
    expect(imagem.regions.find((r) => r.id === 'casa')?.room?.roof).toBe(true)
    expect(imagem.props.map((p) => p.id)).toEqual(['barril-encostado'])
    expect(mapForImageExport(com, COM_MESTRE).props.map((p) => p.id).sort()).toEqual(['barril-encostado', 'bau', 'cadeira', 'tocha'])
  })
})
