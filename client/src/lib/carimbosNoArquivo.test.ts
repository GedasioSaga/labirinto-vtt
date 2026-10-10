/**
 * CARIMBOS no disco e na imagem exportada: os campos novos e opcionais
 * atravessam o salvar/abrir sem migração (mapa de antes abre igual), o objeto
 * torto sai; a "Exportar imagem" sem os itens do mestre não leva o objeto da
 * sala secreta nem da zona oculta, nem o nome do importado.
 */
import { describe, expect, it } from 'vitest'
import type { Carimbo, MapData, Region } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { mapForImageExport } from './mapImageExport'

const IMAGEM = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAA='
const objeto = (id: string, x: number, y: number, tipo = 'pinheiro'): Carimbo => ({ id, tipo, x, y, tamanho: 30, giro: 45 })

describe('carimbos no arquivo', () => {
  it('salvar e abrir devolve os objetos e os importados; o torto sai', () => {
    const mapa: MapData = {
      ...createEmptyMap('m', 'M', 10, 10, 50),
      carimbos: [objeto('a', 10, 20), objeto('b', 30, 40, 'importado:farol')],
      carimbosImportados: [{ id: 'importado:farol', nome: 'Farol', imagem: IMAGEM }],
    }
    const aberto = deserializeMap(serializeMap(mapa))
    expect(aberto.carimbos).toEqual(mapa.carimbos)
    expect(aberto.carimbosImportados).toEqual(mapa.carimbosImportados)
    const torto = JSON.parse(serializeMap(mapa)) as Record<string, unknown>
    torto.carimbos = [{ id: 'x', tipo: 'pinheiro', x: 'longe', y: 0, tamanho: 3 }, objeto('ok', 1, 1)]
    expect(deserializeMap(JSON.stringify(torto)).carimbos?.map((c) => c.id)).toEqual(['ok'])
  })

  it('mapa de antes dos carimbos abre sem os campos', () => {
    const aberto = deserializeMap(serializeMap(createEmptyMap('m', 'M', 10, 10, 50)))
    expect('carimbos' in aberto).toBe(false)
    expect('carimbosImportados' in aberto).toBe(false)
  })
})

describe('carimbos na imagem exportada', () => {
  const cofre: Region = {
    id: 'cofre',
    tag: 'region',
    fillColor: '#444444',
    fillPattern: 'solid',
    data: {},
    secret: true,
    room: { shape: 'rect', name: 'Cofre' },
    points: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ],
  }
  const mapa: MapData = {
    ...createEmptyMap('m', 'M', 20, 20, 50),
    regions: [cofre],
    concealZones: [{ id: 'z', name: 'Mata', revealed: false, points: [{ x: 400, y: 400 }, { x: 500, y: 400 }, { x: 500, y: 500 }, { x: 400, y: 500 }] }],
    carimbos: [objeto('fora', 600, 600, 'importado:farol'), objeto('no-cofre', 150, 150, 'importado:covil'), objeto('na-zona', 450, 450)],
    carimbosImportados: [
      { id: 'importado:farol', nome: 'Farol do mestre', imagem: IMAGEM },
      { id: 'importado:covil', nome: 'Covil', imagem: IMAGEM },
    ],
  }

  it('sem os itens do mestre: só o objeto de fora, e o importado dele sem o nome', () => {
    const imagem = mapForImageExport(mapa, { grid: false, masterOnly: false })
    expect(imagem.carimbos?.map((c) => c.id)).toEqual(['fora'])
    expect(imagem.carimbosImportados).toEqual([{ id: 'importado:farol', nome: 'Carimbo', imagem: IMAGEM }])
  })

  it('com os itens do mestre: tudo', () => {
    const imagem = mapForImageExport(mapa, { grid: false, masterOnly: true })
    expect(imagem.carimbos).toHaveLength(3)
    expect(imagem.carimbosImportados).toHaveLength(2)
  })
})
