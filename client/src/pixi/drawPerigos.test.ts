import { describe, expect, it } from 'vitest'
import { ADEGA, casa, CORREDOR, COZINHA, DESPENSA } from '../lib/perigoPlanta.fixture'
import { camadasDosPerigos, COR_DA_AGUA, COR_DA_CINZA, COR_DO_FOGO } from './drawPerigos'

/** PERIGO QUE SE ALASTRA — uma cor chapada por estado, com o polígono inteiro de cada sala. */
describe('camadas do desenho do perigo', () => {
  it('cinza embaixo, água, fogo por cima; cada sala com o polígono dela', () => {
    const map = casa()
    const camadas = camadasDosPerigos(map.regions, [
      { id: 'f', tipo: 'fogo', salas: [CORREDOR], cinzas: [COZINHA] },
      { id: 'a', tipo: 'agua', salas: [DESPENSA] },
    ])
    expect(camadas.map((c) => c.cor)).toEqual([COR_DA_CINZA, COR_DA_AGUA, COR_DO_FOGO])
    expect(camadas[2]?.poligonos).toEqual([map.regions.find((r) => r.id === CORREDOR)?.points])
    expect(camadas[0]?.poligonos).toHaveLength(1)
  })

  it('sala que não está no mapa (apagada, ou fora do recorte) não desenha nada', () => {
    const map = casa()
    const semAdega = map.regions.filter((r) => r.id !== ADEGA)
    expect(camadasDosPerigos(semAdega, [{ id: 'f', tipo: 'fogo', salas: [ADEGA] }])).toEqual([])
    expect(camadasDosPerigos(map.regions, [])).toEqual([])
  })
})
