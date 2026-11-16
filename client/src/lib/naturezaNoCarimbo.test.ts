import { beforeEach, describe, expect, it } from 'vitest'
import { carimboDoCatalogo } from '../carimbos/catalogo'
import { useMapStore } from '../stores/mapStore'
import type { Carimbo, Prop } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { NATUREZA_DO_OBJETO, carimboDaNatureza, foiParaOCarimbo } from './naturezaNoCarimbo'
import { ehMovelQueBarra, voltaDaCerca } from './mobilia'
import { catalogoComOTipo, TIPOS_DO_OBJETO } from './mobilia/pecasNovas'
import type { TipoMobilia } from './mobilia/tipos'

/** A natureza no Carimbo (Fase 6, 16/11/2026): só o menu muda; o que está no mapa fica igual. */

const QUE_SAIRAM: TipoMobilia[] = ['pedrasERochas', 'tocoDeArvore', 'arvoreSeca', 'sebe']

describe('a natureza sai do catálogo do Objeto', () => {
  it('a pedra, o toco, a árvore seca e a sebe saem; cada um aponta um carimbo que existe na biblioteca', () => {
    for (const tipo of QUE_SAIRAM) {
      expect(TIPOS_DO_OBJETO).not.toContain(tipo)
      const carimbo = carimboDaNatureza(tipo)
      expect(carimbo !== null && carimboDoCatalogo(carimbo) !== null).toBe(true)
    }
    expect(carimboDaNatureza('sebe')).toBe('sebe-aparada')
  })

  it('nenhuma peça natural ficou esperando arte; o canteiro, a laranjeira em canteiro e os troncos são feitos pela mão e ficam', () => {
    for (const tipo of ['canteiroDeFlores', 'laranjeiraEmCanteiro', 'troncos'] as const) expect(TIPOS_DO_OBJETO).toContain(tipo)
    expect(Object.values(NATUREZA_DO_OBJETO).filter((n) => n.carimbo === null)).toEqual([])
    expect(foiParaOCarimbo('sebe')).toBe(true)
  })

  it('mapa antigo: a pedra posta como Objeto continua barrando, e a ficha dela ainda mostra o tipo', () => {
    expect(ehMovelQueBarra('pedrasERochas')).toBe(true)
    expect(catalogoComOTipo('pedrasERochas')).toContain('pedrasERochas')
    const pedra: Prop = { id: 'p1', src: '', linkedMapPath: null, x: 200, y: 200, width: 80, height: 60, rotation: 0, mobilia: 'pedrasERochas' }
    useMapStore.getState().loadMap({ ...createEmptyMap('m-natureza', 'Velho', 20, 20, 40), props: [pedra] })
    expect(useMapStore.getState().map.props.map((p) => p.mobilia)).toEqual(['pedrasERochas'])
  })

  it('mapa antigo: a sebe posta como Objeto continua sebe, com a curva dela, e a ficha ainda mostra o tipo', () => {
    expect(catalogoComOTipo('sebe')).toContain('sebe')
    const sebe: Prop = { id: 's1', src: '', linkedMapPath: null, x: 200, y: 200, width: 160, height: 40, rotation: 0, mobilia: 'sebe', mobiliaCurva: 60 }
    useMapStore.getState().loadMap({ ...createEmptyMap('m-sebe-velha', 'Jardim', 20, 20, 40), props: [sebe] })
    expect(useMapStore.getState().map.props.map((p) => [p.mobilia, voltaDaCerca(p)])).toEqual([['sebe', 60]])
  })
})

describe('"Os próximos barram a passagem" no Carimbo', () => {
  const pedras = (id: string): Carimbo => ({ id, tipo: 'pedras', x: 100, y: 100, tamanho: 40, giro: 0 })

  beforeEach(() => {
    useMapStore.getState().loadMap(createEmptyMap('m-carimbo-barra', 'Mata', 20, 20, 40))
    useMapStore.getState().setCarimboBarra(false)
  })

  it('desligada (o padrão), o carimbo nasce sem o campo: igual ao de antes', () => {
    useMapStore.getState().carimbar([pedras('c1')])
    expect(useMapStore.getState().map.carimbos?.[0]).not.toHaveProperty('barra')
  })

  it('ligada, cada um que entra ganha "Barra a passagem"; o que já estava não muda', () => {
    useMapStore.getState().carimbar([pedras('c1')])
    useMapStore.getState().setCarimboBarra(true)
    useMapStore.getState().carimbar([pedras('c2'), pedras('c3')])
    const lista = useMapStore.getState().map.carimbos ?? []
    expect(lista.map((c) => [c.id, c.barra ?? null])).toEqual([
      ['c1', null],
      ['c2', true],
      ['c3', true],
    ])
  })
})
