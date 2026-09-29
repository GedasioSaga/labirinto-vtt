import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import { criarMovel } from '../lib/mobilia'
import type { Prop } from '../types/map'

/**
 * PROPRIEDADES DO MÓVEL no desfazer: trocar o tipo é um passo; arrastar no
 * seletor de cor é um passo só (não um por cor que passou embaixo do dedo);
 * "Preencher" e "Padrão" são um passo cada. O que não muda nada não entra.
 */

const GRADE = 50

const MESA: Prop = { ...criarMovel('mesa', { x: 300, y: 200 }, GRADE, 'm1'), rotation: 90, layer: 'decoracao' }

function prepararMapa(props: Prop[] = [MESA]): void {
  const { map } = useMapStore.getState()
  useMapStore.setState({
    map: { ...map, grid: GRADE, props, hiddenLayers: [], lockedLayers: [] },
    selection: [],
    past: [],
    future: [],
    pisoAtivo: 0,
  })
}

const movel = (): Prop | undefined => useMapStore.getState().map.props[0]
const passos = (): number => useMapStore.getState().past.length

beforeEach(() => prepararMapa())

describe('Móvel: trocar o tipo', () => {
  it('a mesa vira baú no mesmo centro e giro, no tamanho do baú, num passo do desfazer', () => {
    useMapStore.getState().trocarTipoDoMovel('m1', 'bau')
    expect(movel()).toEqual({ ...MESA, mobilia: 'bau', width: GRADE, height: 0.6 * GRADE })
    expect(passos()).toBe(1)

    useMapStore.getState().undo()
    expect(movel()).toEqual(MESA)
  })

  it('o mesmo tipo, objeto de imagem ou id que não existe: nada muda e nada entra no desfazer', () => {
    const deImagem: Prop = { id: 'img', src: 'x.png', x: 0, y: 0, width: 50, height: 50, linkedMapPath: null }
    prepararMapa([MESA, deImagem])
    const antes = useMapStore.getState().map

    useMapStore.getState().trocarTipoDoMovel('m1', 'mesa')
    useMapStore.getState().trocarTipoDoMovel('img', 'bau')
    useMapStore.getState().trocarTipoDoMovel('sumiu', 'bau')
    expect(useMapStore.getState().map).toBe(antes)
    expect(passos()).toBe(0)
  })
})

describe('Móvel: "Preencher" e cores no desfazer', () => {
  it('arrastar no seletor de cor é um passo só, e o desfazer volta à cor de antes do arrasto', () => {
    for (const cor of ['#100000', '#200000', '#300000', '#8b4513']) useMapStore.getState().setAparenciaDoMovel('m1', { cor })
    expect(movel()?.mobiliaCor).toBe('#8b4513')
    expect(passos()).toBe(1)

    useMapStore.getState().undo()
    expect(movel()).toEqual(MESA)
  })

  it('cor e cor da linha são passos separados', () => {
    useMapStore.getState().setAparenciaDoMovel('m1', { cor: '#8b4513' })
    useMapStore.getState().setAparenciaDoMovel('m1', { corDaLinha: '#c0392b' })
    useMapStore.getState().setAparenciaDoMovel('m1', { corDaLinha: '#c0392c' })
    expect(passos()).toBe(2)
  })

  it('"Preencher" é um passo a cada clique', () => {
    useMapStore.getState().setAparenciaDoMovel('m1', { preenchido: false })
    expect(movel()?.mobiliaPreenchido).toBe(false)
    useMapStore.getState().setAparenciaDoMovel('m1', { preenchido: true })
    expect(passos()).toBe(2)
    expect(movel()).toEqual(MESA)
  })

  it('"Padrão" é um passo próprio, mesmo logo depois do arrasto de cor', () => {
    useMapStore.getState().setAparenciaDoMovel('m1', { cor: '#8b4513' })
    useMapStore.getState().setAparenciaDoMovel('m1', { cor: null })
    expect(movel()).toEqual(MESA)
    expect(passos()).toBe(2)

    useMapStore.getState().undo()
    expect(movel()?.mobiliaCor).toBe('#8b4513')
  })

  it('cor torta, "Preencher" já ligado ou "Padrão" sem cor própria: nada entra no desfazer', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().setAparenciaDoMovel('m1', { cor: 'url(javascript:x)' })
    useMapStore.getState().setAparenciaDoMovel('m1', { preenchido: true })
    useMapStore.getState().setAparenciaDoMovel('m1', { cor: null })
    expect(useMapStore.getState().map).toBe(antes)
    expect(passos()).toBe(0)
  })
})
