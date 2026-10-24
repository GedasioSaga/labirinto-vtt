import { describe, expect, it } from 'vitest'
import type { MapData, Region, RoomMeta, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap, setRoomRoofStyle } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { PALETA_DO_TETO } from './telhado/paletas'

/**
 * TELHADO DE PALHA (fatia MT6) no ARQUIVO e na REDE: antes dela a palha era
 * modelo desconhecido e virava telha ao salvar e reabrir. Agora ela atravessa
 * o arquivo e o recorte do jogador como palha, e o mapa antigo (sem modelo,
 * telha ou madeira) sai do arquivo com os mesmos bytes.
 */

const CASA: Region['points'] = [
  { x: 100, y: 100 },
  { x: 400, y: 100 },
  { x: 400, y: 400 },
  { x: 100, y: 400 },
]
const FORA = { x: 250, y: 600 }

function mapa(room: Partial<RoomMeta>): MapData {
  const casa: Region = { id: 'casa', points: CASA, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Casa', roof: true, ...room } }
  const tokens: Token[] = [{ id: 'heroi', characterId: null, name: 'heroi', x: FORA.x, y: FORA.y, size: 1, image: null }]
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), regions: [casa], tokens }
}

/** O que o jogador recebe: o recorte dele, passado por JSON como na rede. */
function doJogador(map: MapData): RoomMeta | undefined {
  const recorte = filterMapForPlayer(map, 'p1', { p1: ['heroi'] }, 700).map
  const pelaRede: MapData = JSON.parse(JSON.stringify(recorte))
  return pelaRede.regions.find((r) => r.id === 'casa')?.room
}

describe('palha no arquivo e na rede', () => {
  it('salvar e reabrir mantém a palha e a cor (antes virava telha)', () => {
    const volta = deserializeMap(serializeMap(mapa({ modeloDoTeto: 'palha', corDoTeto: PALETA_DO_TETO.palha[3].hex })))
    expect(volta.regions[0].room?.modeloDoTeto).toBe('palha')
    expect(volta.regions[0].room?.corDoTeto).toBe(PALETA_DO_TETO.palha[3].hex)
  })

  it('a palha reaberta do arquivo chega ao jogador como palha, com a cor livre', () => {
    const doArquivo = deserializeMap(serializeMap(mapa({ modeloDoTeto: 'palha', corDoTeto: '#123456' })))
    const room = doJogador(doArquivo)
    expect(room?.roof).toBe(true)
    expect(room?.modeloDoTeto).toBe('palha')
    expect(room?.corDoTeto).toBe('#123456')
  })

  it('o painel grava palha; a cor da paleta de antes vira a padrão da palha (ausente)', () => {
    const comArdosia = mapa({ corDoTeto: PALETA_DO_TETO.telhas[2].hex })
    const room = setRoomRoofStyle(comArdosia, 'casa', { modelo: 'palha' }).regions[0].room
    expect(room?.modeloDoTeto).toBe('palha')
    expect(room !== undefined && 'corDoTeto' in room).toBe(false)
  })

  it('mapa antigo (sem modelo, telha, madeira) sai do arquivo com os mesmos bytes', () => {
    for (const room of [{}, { modeloDoTeto: 'telhas' as const }, { modeloDoTeto: 'madeira' as const, corDoTeto: '#4d5f4f' }, { corDoTeto: '#123456' }]) {
      const arquivo = serializeMap(mapa(room))
      expect(serializeMap(deserializeMap(arquivo))).toBe(arquivo)
    }
  })
})
