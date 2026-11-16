import { beforeEach, describe, expect, it } from 'vitest'
import type { Carimbo } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import { createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { caixaDoCarimbo, carimboPorId, lerCarimbos, radianosDoImportado } from '../lib/carimbos'
import { alcaDeGirarDoCarimbo, centroDoCarimbo, faixaDoTamanhoDoCarimbo } from '../lib/alcasDoCarimbo'
import { unidadeDoRelevo } from '../lib/relevo'
import { tamanhoNaturalDoTipo } from '../carimbos/catalogo'
import { createCarimboAlcaGesture } from './carimboAlcaGesture'
import { createRoomRotateGesture } from './roomRotateGesture'

/**
 * ALÇAS DO CARIMBO (16/11/2026): o canto muda o tamanho e a bolinha gira,
 * como no objeto, e cada arrasto vira UM Ctrl+Z. Sem Pixi — o PixiCanvas só
 * repassa os eventos para os dois gestos.
 */

const pinheiro: Carimbo = { id: 'c1', tipo: 'pinheiro', x: 400, y: 400, tamanho: 40, giro: 0 }

const atual = (): Carimbo => {
  const c = carimboPorId(useMapStore.getState().map.carimbos, 'c1')
  if (c === undefined) throw new Error('o carimbo sumiu')
  return c
}

beforeEach(() => {
  useMapStore.setState({ map: { ...createEmptyMap('m', 'Mata', 30, 30, 40), carimbos: [pinheiro] }, selection: EMPTY_SELECTION, past: [], future: [] })
})

describe('alças do carimbo', () => {
  it('puxar o canto para fora cresce o carimbo a partir do pé, e um Ctrl+Z desfaz o arrasto inteiro', () => {
    const gesto = createCarimboAlcaGesture()
    const quina = { x: caixaDoCarimbo(pinheiro).maxX, y: caixaDoCarimbo(pinheiro).minY }
    expect(gesto.begin('c1', quina, 1)).toBe(true)
    // Dois quadros na reta pé-canto: 1,2x e depois 1,5x a distância do canto de antes.
    const naReta = (fator: number) => ({ x: pinheiro.x + (quina.x - pinheiro.x) * fator, y: pinheiro.y + (quina.y - pinheiro.y) * fator })
    gesto.move(naReta(1.2))
    const feedback = gesto.move(naReta(1.5))
    gesto.finish()

    const map = useMapStore.getState().map
    const faixa = faixaDoTamanhoDoCarimbo(tamanhoNaturalDoTipo('pinheiro', unidadeDoRelevo(map), map.grid), pinheiro.tamanho)
    const esperado = Math.round(Math.min(faixa.max, pinheiro.tamanho * 1.5) * 10) / 10
    expect(atual().tamanho).toBe(esperado)
    expect(atual().tamanho).toBeGreaterThan(pinheiro.tamanho)
    // O pé não andou: a árvore fica plantada onde estava.
    expect({ x: atual().x, y: atual().y }).toEqual({ x: 400, y: 400 })
    expect(feedback?.label).toMatch(/^\d+%$/)
    expect(useMapStore.getState().past).toHaveLength(1)

    useMapStore.getState().undo()
    expect(atual().tamanho).toBe(pinheiro.tamanho)
  })

  it('a bolinha gira o da biblioteca de 45 em 45 graus, e um Ctrl+Z volta ao giro de antes', () => {
    const gesto = createRoomRotateGesture()
    const alca = alcaDeGirarDoCarimbo(pinheiro, 1)
    if (alca === null) throw new Error('sem alça de girar')
    const centro = centroDoCarimbo(pinheiro)
    const raio = Math.hypot(alca.knob.x - centro.x, alca.knob.y - centro.y)
    /** Ponto no arco da bolinha, `graus` no sentido horário a partir de "em cima". */
    const noArco = (graus: number) => {
      const a = (graus * Math.PI) / 180
      return { x: centro.x + raio * Math.sin(a), y: centro.y - raio * Math.cos(a) }
    }
    expect(gesto.beginCarimbo('c1', alca.knob, 1)).toBe(true)
    // 20 graus não chega ao desenho seguinte: o giro fica onde estava.
    gesto.move(noArco(20), false)
    expect(atual().giro).toBe(0)
    gesto.move(noArco(50), false)
    expect(atual().giro).toBe(45)
    gesto.move(noArco(100), false)
    expect(atual().giro).toBe(90)
    gesto.finish()
    expect(useMapStore.getState().past).toHaveLength(1)

    useMapStore.getState().undo()
    expect(atual().giro).toBe(0)
  })

  it('o importado de antes só inclina; a bolinha liga o giro livre, e um Ctrl+Z volta à inclinação', () => {
    // Giro sorteado pelo spray de antes: a imagem inclinava uns graus, nunca 137.
    const antigo: Carimbo = { id: 'c2', tipo: 'importado:seta', x: 400, y: 400, tamanho: 40, giro: 137 }
    useMapStore.setState({ map: { ...useMapStore.getState().map, carimbos: [antigo] } })
    expect(Math.abs(radianosDoImportado(antigo))).toBeLessThanOrEqual(0.09)

    const gesto = createRoomRotateGesture()
    const alca = alcaDeGirarDoCarimbo(antigo, 1)
    if (alca === null) throw new Error('sem alça de girar')
    const centro = centroDoCarimbo(antigo)
    const raio = Math.hypot(alca.knob.x - centro.x, alca.knob.y - centro.y)
    expect(gesto.beginCarimbo('c2', alca.knob, 1)).toBe(true)
    gesto.move({ x: centro.x + raio * Math.sin(Math.PI / 3), y: centro.y - raio * Math.cos(Math.PI / 3) }, false)
    gesto.finish()

    const girado = carimboPorId(useMapStore.getState().map.carimbos, 'c2')
    expect(girado).toMatchObject({ giro: 60, giroLivre: true })
    if (girado === undefined) throw new Error('o carimbo sumiu')
    expect(radianosDoImportado(girado)).toBeCloseTo(Math.PI / 3)
    expect(useMapStore.getState().past).toHaveLength(1)

    useMapStore.getState().undo()
    expect(carimboPorId(useMapStore.getState().map.carimbos, 'c2')).toEqual(antigo)
  })

  it('o arquivo guarda o giro livre só no importado e só quando é true', () => {
    const lidos = lerCarimbos([
      { id: 'a', tipo: 'importado:seta', x: 0, y: 0, tamanho: 10, giro: 60, giroLivre: true },
      { id: 'b', tipo: 'importado:seta', x: 0, y: 0, tamanho: 10, giro: 60, giroLivre: 'sim' },
      { id: 'c', tipo: 'pinheiro', x: 0, y: 0, tamanho: 10, giro: 60, giroLivre: true },
      { id: 'd', tipo: 'importado:seta', x: 0, y: 0, tamanho: 10, giro: 60 },
    ])
    expect(lidos?.map((c) => c.giroLivre)).toEqual([true, undefined, undefined, undefined])
    expect(lidos?.map((c) => 'giroLivre' in c)).toEqual([true, false, false, false])
  })
})
