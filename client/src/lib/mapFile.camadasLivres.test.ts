// REVISÃO DA FATIA 7 (23/10/2026): o id de camada livre do formato de antes
// vira o MESMO hexa em todo campo do map.json e no modelo do adventure.json,
// e ida e volta não muda nada; arquivo de terceiros com 100 mil ids abre rápido.
import { describe, expect, it } from 'vitest'
import { buildRoomFromDraft } from './drawingFactory'
import { addRoom, createEmptyMap, setRoomRoof } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { parseAdventure } from './adventure'
import { contextoDeCamadas } from './camadas/consulta'
import { idDeCamadaDoArquivo, lerListaDeCamadas, lerModeloDeCamadas } from './camadas/arquivo'
import { MAX_CAMADAS_LIVRES } from './camadas/modelo'
import { CAMADAS_PADRAO, ehCamadaPadrao } from './camadas/padrao'
import type { MapData } from '../types/map'

const DE_ANTES = 'livre_Segredo_do_Lich'

function mapaComSala(): MapData {
  const sala = buildRoomFromDraft('r1', ['w1', 'w2', 'w3', 'w4'], { x: 0, y: 0 }, { x: 256, y: 256 }, undefined, undefined, 'Salão')
  return setRoomRoof(addRoom(createEmptyMap('m', 'Mapa', 10, 10, 64), sala.region, sala.walls), 'r1', true)
}

describe('id de antes: o mesmo hexa em todo campo, ida e volta', () => {
  it('parede, telhado da sala, olho do mestre, olho dos jogadores, cadeado, opacidade e o modelo da aventura', () => {
    const bruto = JSON.parse(serializeMap(mapaComSala()))
    bruto.versaoDasCamadas = 2
    bruto.walls[0].camada = DE_ANTES
    bruto.regions[0].room.camadaDoTelhado = DE_ANTES
    bruto.hiddenLayers = [DE_ANTES]
    bruto.lockedLayers = [DE_ANTES]
    bruto.ocultasDoJogador = [DE_ANTES]
    bruto.opacidadeDasCamadas = { [DE_ANTES]: 0.5 }
    const id = idDeCamadaDoArquivo(DE_ANTES)
    if (id === undefined) throw new Error('não converteu')
    const lido = deserializeMap(JSON.stringify(bruto))
    const aventura = parseAdventure(
      JSON.stringify({ version: 1, id: 'adv_t', name: 'T', startSceneId: 's', scenes: [{ id: 's', name: 'S', file: 'map.json' }], camadas: { ordem: [...CAMADAS_PADRAO.map((c) => ({ id: c })), { id: DE_ANTES, nome: 'Cripta' }] } }),
    )
    expect(aventura.camadas?.ordem.at(-1)).toEqual({ id, nome: 'Cripta' })
    const campos = (m: MapData) => [m.walls[0].camada, m.regions[0].room?.camadaDoTelhado, m.hiddenLayers, m.lockedLayers, m.ocultasDoJogador, m.opacidadeDasCamadas]
    expect(campos(lido)).toEqual([id, id, [id], [id], [id], { [id]: 0.5 }])
    const comModelo: MapData = { ...lido, modeloCamadas: aventura.camadas }
    expect(contextoDeCamadas(comModelo).camadaDe('parede', comModelo.walls[0])).toBe(id)
    expect(contextoDeCamadas(comModelo).travada(id)).toBe(true)
    // Ida e volta: nada muda, e o texto de antes não volta ao disco.
    const texto = serializeMap(lido)
    expect(texto).not.toContain('Segredo')
    expect(campos(deserializeMap(texto))).toEqual(campos(lido))
  })
})

describe('arquivo de terceiros com 100 mil ids', () => {
  it('nas listas do mapa e no modelo: abre em menos de 500 ms, o modelo para no teto, e os primeiros escondidos continuam escondidos', () => {
    const ids = Array.from({ length: 100_000 }, (_, i) => `livre_${i.toString(16).padStart(8, '0')}`)
    const bruto = JSON.parse(serializeMap(mapaComSala()))
    bruto.versaoDasCamadas = 2
    bruto.hiddenLayers = ids
    bruto.lockedLayers = ids
    bruto.ocultasDoJogador = ids
    const texto = JSON.stringify(bruto)
    const ordem = ids.map((id) => ({ id, nome: 'X' }))
    const inicio = performance.now()
    const map = deserializeMap(texto)
    const modelo = lerModeloDeCamadas({ ordem })
    const lista = lerListaDeCamadas(ids)
    const ms = performance.now() - inicio
    expect(ms).toBeLessThan(500)
    expect(modelo?.ordem.filter((c) => !ehCamadaPadrao(c.id))).toHaveLength(MAX_CAMADAS_LIVRES)
    expect(lista?.length).toBeLessThanOrEqual(1024)
    expect(map.ocultasDoJogador?.slice(0, 3)).toEqual(ids.slice(0, 3))
    expect(map.hiddenLayers.length).toBeLessThanOrEqual(1024)
  }, 180_000)
})
