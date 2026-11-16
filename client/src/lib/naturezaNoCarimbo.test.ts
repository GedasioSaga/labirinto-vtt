import { beforeEach, describe, expect, it } from 'vitest'
import { carimboDoCatalogo } from '../carimbos/catalogo'
import { useMapStore } from '../stores/mapStore'
import type { Carimbo, Prop } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { NATUREZA_DO_OBJETO, carimboDaNatureza, foiParaOCarimbo } from './naturezaNoCarimbo'
import { ehMovelQueBarra } from './mobilia'
import { catalogoComOTipo, TIPOS_DO_OBJETO } from './mobilia/pecasNovas'
import type { TipoMobilia } from './mobilia/tipos'

/** A natureza no Carimbo (Fase 6, 16/11/2026): só o menu muda; o que está no mapa fica igual. */

const QUE_SAIRAM: TipoMobilia[] = ['pedrasERochas', 'tocoDeArvore', 'arvoreSeca']

describe('a natureza sai do catálogo do Objeto', () => {
  it('a pedra, o toco e a árvore seca saem; cada um aponta um carimbo que existe na biblioteca', () => {
    for (const tipo of QUE_SAIRAM) {
      expect(TIPOS_DO_OBJETO).not.toContain(tipo)
      const carimbo = carimboDaNatureza(tipo)
      expect(carimbo !== null && carimboDoCatalogo(carimbo) !== null).toBe(true)
    }
  })

  it('a sebe fica no Objeto até a arte dela existir; o canteiro e a laranjeira em canteiro são feitos pela mão e ficam', () => {
    for (const tipo of ['sebe', 'canteiroDeFlores', 'laranjeiraEmCanteiro', 'troncos'] as const) expect(TIPOS_DO_OBJETO).toContain(tipo)
    expect(foiParaOCarimbo('sebe')).toBe(false)
    expect(NATUREZA_DO_OBJETO.sebe?.arteQueFalta).toBeTruthy()
  })

  it('mapa antigo: a pedra posta como Objeto continua barrando, e a ficha dela ainda mostra o tipo', () => {
    expect(ehMovelQueBarra('pedrasERochas')).toBe(true)
    expect(catalogoComOTipo('pedrasERochas')).toContain('pedrasERochas')
    const pedra: Prop = { id: 'p1', src: '', linkedMapPath: null, x: 200, y: 200, width: 80, height: 60, rotation: 0, mobilia: 'pedrasERochas' }
    useMapStore.getState().loadMap({ ...createEmptyMap('m-natureza', 'Velho', 20, 20, 40), props: [pedra] })
    expect(useMapStore.getState().map.props.map((p) => p.mobilia)).toEqual(['pedrasERochas'])
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
