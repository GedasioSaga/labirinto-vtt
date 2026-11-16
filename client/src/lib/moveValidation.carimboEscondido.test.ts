/**
 * CARIMBO QUE BARRA e a REGRA DE OURO (auditoria de 16/11/2026, defeito 2). Com
 * "Barra a passagem", a ficha do jogador não atravessa a pegada do carimbo; mas o
 * carimbo que o recorte nunca entrega a ele (camada escondida dos jogadores, zona
 * oculta ativa, sala secreta) não pode segurar o passo: a recusa "Objeto no
 * caminho" contaria que ele existe. É o que o objeto e a água já fazem
 * (`objetoEscondidoDosJogadores`, `aguaEscondidaDosJogadores`).
 *
 * Geometria (px de mundo, mapa 25 x 25, grade 40, cena livre, sem Chão e sem parede):
 * a ficha em (300, 460); o pinheiro de tamanho 200 em (500, 460), pegada de 450 a
 * 550, no traço reto até (700, 460). Zona e sala de 380 a 620 em x, 340 a 580 em y.
 */
import { describe, expect, it } from 'vitest'
import type { Carimbo, ConcealZone, MapData, Prop, Region, RegionPoint, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { filterMapForPlayer } from './fogFilter'
import { validateTokenMove } from './moveValidation'

const GRADE = 40
const POSSE = { p1: ['heroi'] }
const HEROI: Token = { id: 'heroi', characterId: null, name: 'heroi', x: 300, y: 460, size: 1, image: null }
const PASSA = { ok: true, x: 700, y: 460 }
const OBJETO = { ok: false, reason: 'objeto' }

const rect = (x0: number, y0: number, x1: number, y1: number): RegionPoint[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]
const LUGAR = rect(380, 340, 620, 580)
const pinheiro = (extra: Partial<Carimbo> = {}): Carimbo => ({ id: 'arv', tipo: 'pinheiro', x: 500, y: 460, tamanho: 200, giro: 0, barra: true, ...extra })
const zona = (revealed = false): ConcealZone => ({ id: 'z', points: LUGAR, name: 'Z', revealed })
const salaSecreta: Region = {
  id: 'S',
  points: LUGAR,
  tag: 'region',
  fillColor: '#4d2f05',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Cofre' },
  secret: true,
}

function cena(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 25, 25, GRADE), offFloor: 'free', tokens: [HEROI], ...extra }
}

const arrastar = (map: MapData): ReturnType<typeof validateTokenMove> => validateTokenMove(map, { playerId: 'p1', tokenId: 'heroi', x: 700, y: 460 }, POSSE, {})
const noRecorte = (map: MapData): boolean => (filterMapForPlayer(map, 'p1', POSSE, 2000).map.carimbos ?? []).some((c) => c.id === 'arv')

describe('carimbo que barra e o que o jogador não recebe', () => {
  it('controle: à vista, barra; sem a chave, atravessa', () => {
    expect(arrastar(cena({ carimbos: [pinheiro()] }))).toEqual(OBJETO)
    expect(arrastar(cena({ carimbos: [pinheiro({ barra: undefined })] }))).toEqual(PASSA)
  })

  it('em zona oculta ativa: não chega no recorte e deixa passar, como a caixa no mesmo lugar', () => {
    const m = cena({ carimbos: [pinheiro()], concealZones: [zona()] })
    expect(noRecorte(m)).toBe(false)
    expect(arrastar(m)).toEqual(PASSA)
    const caixa: Prop = { id: 'cx', x: 460, y: 420, width: 80, height: 80, src: '', linkedMapPath: null, mobilia: 'caixa', barraPassagem: true }
    expect(arrastar(cena({ props: [caixa], concealZones: [zona()] })), 'a caixa na mesma zona').toEqual(PASSA)
  })

  it('zona revelada: o carimbo volta a barrar', () => {
    expect(arrastar(cena({ carimbos: [pinheiro()], concealZones: [zona(true)] }))).toEqual(OBJETO)
  })

  it('em sala secreta: não chega no recorte e deixa passar', () => {
    const m = cena({ carimbos: [pinheiro()], regions: [salaSecreta] })
    expect(noRecorte(m)).toBe(false)
    expect(arrastar(m)).toEqual(PASSA)
  })

  it('camada Terreno escondida dos jogadores: deixa passar', () => {
    expect(arrastar(cena({ carimbos: [pinheiro()], versaoDasCamadas: 2, ocultasDoJogador: ['terreno'] }))).toEqual(PASSA)
  })

  it('só o escondido sai: outro carimbo à vista no caminho continua barrando', () => {
    const fora = pinheiro({ id: 'arv2', x: 660, y: 460, tamanho: 60 })
    expect(arrastar(cena({ carimbos: [pinheiro(), fora], concealZones: [zona()] }))).toEqual(OBJETO)
  })
})
