import { describe, expect, it } from 'vitest'
import type { MapData, Region, RoomMeta, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap, setRoomRoofStyle } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { PALETA_DO_TETO, type ModeloDoTeto } from './telhado/paletas'

/**
 * ARDÓSIA, METAL E TABUINHAS (12/11/2026) no ARQUIVO e na REDE, como a palha
 * (`telhadoPalha.rede.test.ts`): antes deles, um modelo fora da lista SAÍA na
 * leitura do arquivo (virava telha e se perdia ao salvar). Agora atravessam o
 * arquivo e o recorte do jogador iguais, e o painel troca para a cor padrão
 * do modelo novo.
 */

const NOVOS: readonly ModeloDoTeto[] = ['ardosia', 'metal', 'tabuinhas']
const CASA: Region['points'] = [
  { x: 100, y: 100 },
  { x: 400, y: 100 },
  { x: 400, y: 400 },
  { x: 100, y: 400 },
]

function mapa(room: Partial<RoomMeta>): MapData {
  const casa: Region = { id: 'casa', points: CASA, tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Casa', roof: true, ...room } }
  const tokens: Token[] = [{ id: 'heroi', characterId: null, name: 'heroi', x: 250, y: 600, size: 1, image: null }]
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), regions: [casa], tokens }
}

/** O que o jogador recebe: o recorte dele, passado por JSON como na rede. */
function doJogador(map: MapData): RoomMeta | undefined {
  const recorte = filterMapForPlayer(map, 'p1', { p1: ['heroi'] }, 700).map
  const pelaRede: MapData = JSON.parse(JSON.stringify(recorte))
  return pelaRede.regions.find((r) => r.id === 'casa')?.room
}

describe('ardósia, metal e tabuinhas no arquivo e na rede', () => {
  it('salvar e reabrir mantém o modelo e a cor (com os mesmos bytes), e o jogador recebe o mesmo telhado', () => {
    for (const modelo of NOVOS) {
      const arquivo = serializeMap(mapa({ modeloDoTeto: modelo, corDoTeto: PALETA_DO_TETO[modelo][3].hex }))
      const reaberto = deserializeMap(arquivo)
      expect(reaberto.regions[0].room?.modeloDoTeto, modelo).toBe(modelo)
      expect(reaberto.regions[0].room?.corDoTeto, modelo).toBe(PALETA_DO_TETO[modelo][3].hex)
      expect(serializeMap(reaberto), modelo).toBe(arquivo)
      const doArquivo = doJogador(deserializeMap(serializeMap(mapa({ modeloDoTeto: modelo, corDoTeto: '#123456' }))))
      expect(doArquivo?.modeloDoTeto, modelo).toBe(modelo)
      expect(doArquivo?.corDoTeto, modelo).toBe('#123456')
    }
  })

  it('o painel grava o modelo novo; a cor da paleta de antes vira a padrão dele (ausente), a cor livre fica', () => {
    for (const modelo of NOVOS) {
      const daPaleta = setRoomRoofStyle(mapa({ corDoTeto: PALETA_DO_TETO.telhas[2].hex }), 'casa', { modelo }).regions[0].room
      expect(daPaleta?.modeloDoTeto, modelo).toBe(modelo)
      expect(daPaleta !== undefined && 'corDoTeto' in daPaleta, modelo).toBe(false)
      const livre = setRoomRoofStyle(mapa({ corDoTeto: '#123456' }), 'casa', { modelo }).regions[0].room
      expect(livre?.corDoTeto, modelo).toBe('#123456')
    }
  })
})
