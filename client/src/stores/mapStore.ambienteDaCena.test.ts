/**
 * AMBIENTE DA CENA (Luz L4c) no desfazer: cada mudança do painel é UM Ctrl+Z,
 * como as outras propriedades da cena ("Cena externa", "Cena escura"). O
 * arrasto da força anda ao vivo (sem passo por quadro) e vira um passo só no
 * fim (`commitDragHistory`, o `liveSliderChange` do App). A cor emenda os
 * quadros do seletor nativo pela chave do campo.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { useMapStore } from './mapStore'

const atual = (): MapData => useMapStore.getState().map
const passos = (): number => useMapStore.getState().past.length

beforeEach(() => {
  useMapStore.getState().loadMap(createEmptyMap('m', 'Vila', 20, 20, 50))
})

describe('Ambiente da cena no Ctrl+Z', () => {
  it('período fixo: um passo, e o desfazer tira o campo', () => {
    useMapStore.getState().setPeriodoFixo('noite')
    expect(atual().periodoFixo).toBe('noite')
    expect(passos()).toBe(1)
    useMapStore.getState().setPeriodoFixo('noite')
    expect(passos()).toBe(1)
    useMapStore.getState().undo()
    expect('periodoFixo' in atual()).toBe(false)
  })

  it('arrasto da força: 30 quadros ao vivo viram um passo só', () => {
    const antes = atual()
    for (let i = 1; i <= 30; i++) useMapStore.getState().setAmbienteDaCenaLive('noite', { forca: i / 30 })
    expect(passos()).toBe(0)
    expect(atual().ambientePorPeriodo?.noite?.forca).toBe(1)
    useMapStore.getState().commitDragHistory(antes)
    expect(passos()).toBe(1)
    useMapStore.getState().undo()
    expect(atual().ambientePorPeriodo).toBeUndefined()
  })

  it('cor pelo seletor nativo: os quadros da mesma chave são um passo', () => {
    for (const cor of ['#101010', '#202020', '#303030']) useMapStore.getState().setAmbienteDaCena('tarde', { cor }, 'ambiente:tarde:cor')
    expect(passos()).toBe(1)
    expect(atual().ambientePorPeriodo?.tarde?.cor).toBe('#303030')
    useMapStore.getState().undo()
    expect(atual().ambientePorPeriodo).toBeUndefined()
  })

  it('visão em casas, atalho e voltar ao padrão: um passo cada', () => {
    useMapStore.getState().setVisaoDoPeriodo('noite', 4)
    useMapStore.getState().aplicarAtalhoDaNoite('escuridao-total')
    useMapStore.getState().voltarAoPadraoDoPeriodo('noite')
    expect(passos()).toBe(3)
    expect(atual().visaoPorPeriodo).toBeUndefined()
    useMapStore.getState().undo()
    expect(atual().visaoPorPeriodo).toEqual({ noite: 0 })
    useMapStore.getState().undo()
    expect(atual().visaoPorPeriodo).toEqual({ noite: 4 })
  })

  it('nada mudou, nada entra no desfazer', () => {
    useMapStore.getState().voltarAoPadraoDoPeriodo('tarde')
    useMapStore.getState().setVisaoDoPeriodo('tarde', undefined)
    useMapStore.getState().setPeriodoFixo(undefined)
    expect(passos()).toBe(0)
  })
})
