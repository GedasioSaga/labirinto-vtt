import { Graphics } from 'pixi.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import { useFerramentaDaAgua } from '../stores/ferramentaDaAgua'
import type { Agua } from '../types/map'
import { criarGestoDaAgua, type GestoDaAgua } from './aguaNoEditor'

/**
 * Os gestos da ferramenta Água no editor (MAR MAIS FÁCIL, 13/11/2026), no mapa
 * de 20 x 20 casas de 40 px: as formas novas presas na borda, as bolinhas da
 * escolhida (um arrasto = um passo do desfazer) e os dois pincéis.
 */
const G = 40
const casa = (x: number, y: number) => ({ x: x * G, y: y * G })
let gesto: GestoDaAgua
let avisos: string[]

const aguas = (): readonly Agua[] => useMapStore.getState().map.aguas ?? []
const primeira = (): Agua => {
  const a = aguas()[0]
  if (a === undefined) throw new Error('sem água no mapa')
  return a
}

beforeEach(() => {
  useMapStore.getState().loadMap(createEmptyMap('m', 'M', 20, 20, G))
  useMapStore.setState({ activeTool: 'agua', camera: { x: 0, y: 0, scale: 1 } })
  useFerramentaDaAgua.setState({ tipo: 'mar', forma: 'mao', escolhida: null, pincel: null, modoDaAgua: 'mais', modoDaAreia: 'tirar', tamanho: 2 })
  avisos = []
  gesto = criarGestoDaAgua({ rascunho: new Graphics(), avisar: (t) => avisos.push(t) })
})

afterEach(() => gesto.destruir())

describe('formas novas', () => {
  it('o retângulo que passa da borda nasce reto e preso no mapa', () => {
    useFerramentaDaAgua.setState({ forma: 'retangulo' })
    gesto.comecar(casa(15, 12), false)
    gesto.mover(casa(30, -4))
    gesto.soltar(casa(30, -4))
    expect(primeira().pontos).toEqual([casa(15, 0), casa(20, 0), casa(20, 12), casa(15, 12)])
    expect(primeira().reto).toBe(true)
    expect(useFerramentaDaAgua.getState().escolhida).toBe(primeira().id)
  })

  it('o ponto a ponto com 2 cantos avisa e espera; com 3 fecha reto', () => {
    useFerramentaDaAgua.setState({ forma: 'pontos' })
    for (const p of [casa(2, 2), casa(8, 2)]) {
      gesto.comecar(p, false)
      gesto.soltar(p)
    }
    gesto.fecharPontoAPonto()
    expect(aguas()).toHaveLength(0)
    expect(avisos[0]).toContain('3 cantos')
    gesto.comecar(casa(8, 9), false)
    gesto.soltar(casa(8, 9))
    gesto.fecharPontoAPonto()
    expect(primeira().pontos).toEqual([casa(2, 2), casa(8, 2), casa(8, 9)])
    expect(primeira().reto).toBe(true)
    expect(gesto.cantosDoTracado()).toBe(0)
  })
})

describe('rio ponto a ponto', () => {
  it('o rio segue a ordem dos cliques, em curva suave (sem reto), e termina com 2 pontos', () => {
    useFerramentaDaAgua.setState({ tipo: 'rio', forma: 'pontos' })
    gesto.comecar(casa(3, 3), false)
    gesto.soltar(casa(3, 3))
    gesto.fecharPontoAPonto()
    expect(aguas()).toHaveLength(0)
    expect(avisos[0]).toContain('2 pontos')
    for (const p of [casa(9, 4), casa(25, 6)]) {
      gesto.comecar(p, false)
      gesto.soltar(p)
    }
    gesto.fecharPontoAPonto()
    expect(primeira().tipo).toBe('rio')
    expect(primeira().pontos).toEqual([casa(3, 3), casa(9, 4), casa(20, 6)])
    expect(primeira().reto).toBeUndefined()
  })
})

describe('bolinhas e pincéis na escolhida', () => {
  const quadrado = (): Agua => ({ id: 'q', tipo: 'mar', pontos: [casa(4, 4), casa(12, 4), casa(12, 12), casa(4, 12)], cor: '#2d5f8c', reto: true })

  beforeEach(() => {
    useMapStore.getState().loadMap({ ...createEmptyMap('m', 'M', 20, 20, G), aguas: [quadrado()] })
    useMapStore.setState({ activeTool: 'agua', camera: { x: 0, y: 0, scale: 1 } })
    useFerramentaDaAgua.getState().escolher('q')
  })

  it('arrastar a bolinha é um passo só do desfazer; Alt+clique tira a bolinha', () => {
    const passos = useMapStore.getState().past.length
    gesto.comecar(casa(12, 4), false)
    gesto.mover(casa(14, 3))
    gesto.mover(casa(16, 2))
    gesto.soltar(casa(16, 2))
    expect(primeira().pontos[1]).toEqual(casa(16, 2))
    expect(useMapStore.getState().past.length).toBe(passos + 1)
    useMapStore.getState().undo()
    expect(primeira().pontos[1]).toEqual(casa(12, 4))
    gesto.comecar(casa(12, 12), true)
    gesto.soltar(casa(12, 12))
    expect(primeira().pontos).toEqual([casa(4, 4), casa(12, 4), casa(4, 12)])
  })

  it('na água à mão, apertar a linha longe das bolinhas dobra a água (não nasce rio), num passo do desfazer', () => {
    // Costa reta de 16 casas com um ponto a cada meia casa: só as pontas seguram a forma.
    const costa = Array.from({ length: 33 }, (_, i) => casa(2 + i * 0.5, 15))
    const mar: Agua = { id: 'c', tipo: 'mar', pontos: [...costa, casa(18, 19), casa(2, 19)], cor: '#2d5f8c' }
    useMapStore.getState().loadMap({ ...createEmptyMap('m', 'M', 20, 20, G), aguas: [mar] })
    useMapStore.setState({ activeTool: 'agua', camera: { x: 0, y: 0, scale: 1 } })
    useFerramentaDaAgua.setState({ tipo: 'rio', escolhida: 'c', pincel: null })
    const passos = useMapStore.getState().past.length
    gesto.comecar(casa(9.2, 15), false)
    gesto.mover(casa(9.2, 13))
    gesto.mover(casa(9.2, 12))
    gesto.soltar(casa(9.2, 12))
    expect(aguas().map((a) => a.tipo)).toEqual(['mar'])
    expect(Math.min(...primeira().pontos.map((p) => p.y))).toBeLessThan(12.5 * G)
    expect(useMapStore.getState().past.length).toBe(passos + 1)
  })

  it('Mais água cresce o mar e o deixa curva suave; Tirar areia entra na lista do mar', () => {
    useFerramentaDaAgua.setState({ pincel: 'agua' })
    gesto.comecar(casa(12, 6), false)
    gesto.mover(casa(12, 10))
    gesto.soltar(casa(12, 10))
    const xs = primeira().pontos.map((p) => p.x)
    expect(Math.max(...xs)).toBeGreaterThan(12.8 * G)
    expect(primeira().reto).toBeUndefined()
    useFerramentaDaAgua.setState({ pincel: 'areia' })
    gesto.comecar(casa(4, 6), true)
    gesto.mover(casa(4, 9))
    gesto.soltar(casa(4, 9))
    expect(primeira().areia).toEqual([{ modo: 'por', raio: G, pontos: expect.arrayContaining([casa(4, 6), casa(4, 9)]) }])
  })
})
