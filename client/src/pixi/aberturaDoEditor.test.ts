import { describe, expect, it, vi } from 'vitest'
import { mapaSintetico } from '../../desempenho/mapaSintetico'
import { buildFloorOutline, mapFloorClip } from '../lib/floorContour'
import type { MapData } from '../types/map'
import { preaquecerContornoDoChao, proximaTarefa } from './aberturaDoEditor'

vi.mock('../lib/floorContour', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/floorContour')>()
  return { ...real, buildFloorOutline: vi.fn(real.buildFloorOutline) }
})

/**
 * ABRIR O MAPA (F8): o contorno do chão sai numa tarefa própria antes da
 * primeira pintura, e a pintura acha o MESMO objeto guardado (os bytes são os
 * do cálculo de sempre, só muda a tarefa em que ele roda).
 */
describe('preaquecer o contorno do chão ao abrir', () => {
  it('a primeira pintura (mesma lista, passo e recorte de paintFloor) recebe o contorno já guardado', async () => {
    const map = mapaSintetico({ lado: 50 })
    const calculo = vi.mocked(buildFloorOutline)
    calculo.mockClear()
    await expect(preaquecerContornoDoChao(() => map)).resolves.toBe(true)
    // Os MESMOS argumentos de paintFloor (PixiCanvas): a lista do mapa, o passo do estilo e o recorte do mapa.
    expect(calculo).toHaveBeenCalledTimes(1)
    expect(calculo.mock.calls[0][0]).toBe(map.floor)
    expect(calculo.mock.calls[0][1]).toEqual({ step: map.floorStyle.sampleStep, clip: mapFloorClip(map) })
    const guardado = calculo.mock.results[0].value
    // A pintura recebe o objeto guardado (cache da F5 pela lista), sem recalcular.
    expect(buildFloorOutline(map.floor, { step: map.floorStyle.sampleStep, clip: mapFloorClip(map) })).toBe(guardado)
    expect(guardado.length).toBeGreaterThan(0)
  })

  it('calcula numa tarefa nova (setTimeout), não na de quem chamou', async () => {
    const map = mapaSintetico({ lado: 50 })
    const calculo = vi.mocked(buildFloorOutline)
    calculo.mockClear()
    const promessa = preaquecerContornoDoChao(() => map)
    expect(calculo).not.toHaveBeenCalled()
    await promessa
    expect(calculo).toHaveBeenCalledTimes(1)
  })

  it('render fiel (raster), chão vazio ou leitura que lança: resolve false, na hora, sem calcular nada', async () => {
    const map = mapaSintetico({ lado: 50 })
    vi.mocked(buildFloorOutline).mockClear()
    const raster: MapData = { ...map, floorStyle: { ...map.floorStyle, renderMode: 'raster' } }
    const vazio: MapData = { ...map, floor: [] }
    await expect(preaquecerContornoDoChao(() => raster)).resolves.toBe(false)
    await expect(preaquecerContornoDoChao(() => vazio)).resolves.toBe(false)
    await expect(
      preaquecerContornoDoChao(() => {
        throw new Error('sem mapa')
      }),
    ).resolves.toBe(false)
    expect(buildFloorOutline).not.toHaveBeenCalled()
  })

  it('proximaTarefa espera uma volta do relógio', async () => {
    const ordem: string[] = []
    const espera = proximaTarefa().then(() => ordem.push('tarefa'))
    await Promise.resolve()
    ordem.push('microtarefa')
    await espera
    expect(ordem).toEqual(['microtarefa', 'tarefa'])
  })
})
