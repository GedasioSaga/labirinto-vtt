import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import type { Carimbo } from '../types/map'
import {
  DENSIDADE_MAX,
  LARGURA_DO_SPRAY_MAX,
  LARGURA_DO_SPRAY_MIN,
  TAMANHO_DO_CARIMBO_MAX,
  TAMANHO_DO_CARIMBO_MIN,
  TETO_DE_CARIMBOS,
} from '../lib/carimbos'

/** A ferramenta Carimbos no store: um Ctrl+Z por gesto, nenhum para gesto que não muda nada. */
describe('mapStore — Carimbos', () => {
  const IMAGEM = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAA='
  const objeto = (id: string, x: number, y: number, tipo = 'pinheiro'): Carimbo => ({ id, tipo, x, y, tamanho: 40, giro: 90 })

  beforeEach(() => {
    useMapStore.getState().loadMap({ ...mapFactory.createEmptyMap('m', 'M', 20, 12, 50), continente: true })
    useMapStore.setState({ carimboModo: 'carimbo', carimboEscolhido: 'pinheiro' })
  })

  it('preferências da ferramenta ficam na faixa (e fora do mapa e do desfazer)', () => {
    const s = useMapStore.getState()
    s.setCarimboTamanho(9999)
    expect(useMapStore.getState().carimboTamanho).toBe(TAMANHO_DO_CARIMBO_MAX)
    s.setCarimboTamanho(1)
    expect(useMapStore.getState().carimboTamanho).toBe(TAMANHO_DO_CARIMBO_MIN)
    s.setCarimboLargura(-3)
    expect(useMapStore.getState().carimboLargura).toBe(LARGURA_DO_SPRAY_MIN)
    s.setCarimboLargura(10_000)
    expect(useMapStore.getState().carimboLargura).toBe(LARGURA_DO_SPRAY_MAX)
    s.setCarimboDensidade(4)
    expect(useMapStore.getState().carimboDensidade).toBe(DENSIDADE_MAX)
    s.setCarimboDensidade(Number.NaN)
    expect(useMapStore.getState().carimboDensidade).toBe(DENSIDADE_MAX)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('o gesto inteiro vira UM passo no desfazer; o desfazer tira o campo', () => {
    expect(useMapStore.getState().carimbar([objeto('a', 100, 100), objeto('b', 200, 100), objeto('c', 300, 100)])).toBe('carimbou')
    expect(useMapStore.getState().map.carimbos).toHaveLength(3)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.carimbos).toBeUndefined()
    useMapStore.getState().redo()
    expect(useMapStore.getState().map.carimbos?.map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('a borracha tira o que passa debaixo dela num passo; no vazio, nada e sem passo', () => {
    useMapStore.getState().carimbar([objeto('a', 100, 100), objeto('b', 500, 100)])
    expect(useMapStore.getState().apagarCarimbos([{ x: 800, y: 800 }], 30)).toBe('nada-a-apagar')
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(useMapStore.getState().apagarCarimbos([{ x: 90, y: 100 }, { x: 120, y: 100 }], 30)).toBe('apagou')
    expect(useMapStore.getState().map.carimbos?.map((c) => c.id)).toEqual(['b'])
    expect(useMapStore.getState().past).toHaveLength(2)
    // O último apagado tira o campo.
    useMapStore.getState().apagarCarimbos([{ x: 500, y: 100 }], 10)
    expect(useMapStore.getState().map.carimbos).toBeUndefined()
  })

  it('no teto da cena entra só o que cabe, e o resultado diz', () => {
    const quase = Array.from({ length: TETO_DE_CARIMBOS - 2 }, (_, i) => objeto(`o${i}`, i, 0))
    useMapStore.getState().loadMap({ ...useMapStore.getState().map, carimbos: quase })
    expect(useMapStore.getState().carimbar([objeto('x', 1, 1), objeto('y', 2, 2), objeto('z', 3, 3)])).toBe('teto')
    expect(useMapStore.getState().map.carimbos).toHaveLength(TETO_DE_CARIMBOS)
    expect(useMapStore.getState().carimbar([objeto('w', 4, 4)])).toBe('teto')
    expect(useMapStore.getState().map.carimbos).toHaveLength(TETO_DE_CARIMBOS)
  })

  it('carimbo que não existe nesta cena não grava objeto órfão e volta para o pinheiro', () => {
    useMapStore.setState({ carimboEscolhido: 'importado:sumiu' })
    expect(useMapStore.getState().carimbar([objeto('a', 1, 1, 'importado:sumiu')])).toBe('tipo-ausente')
    expect(useMapStore.getState().map.carimbos).toBeUndefined()
    expect(useMapStore.getState().carimboEscolhido).toBe('pinheiro')
  })

  it('importar deixa escolhido e no modo carimbo; desfazer a importação volta a escolha para o pinheiro', () => {
    useMapStore.getState().setCarimboModo('borracha')
    const id = useMapStore.getState().importarCarimbo('  Farol ', IMAGEM)
    expect(id.startsWith('importado:')).toBe(true)
    expect(useMapStore.getState().carimboEscolhido).toBe(id)
    expect(useMapStore.getState().carimboModo).toBe('carimbo')
    expect(useMapStore.getState().map.carimbosImportados).toEqual([{ id, nome: 'Farol', imagem: IMAGEM }])
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.carimbosImportados).toBeUndefined()
    expect(useMapStore.getState().carimboEscolhido).toBe('pinheiro')
  })

  it('remover o importado leva os objetos dele junto, num passo só', () => {
    const id = useMapStore.getState().importarCarimbo('Farol', IMAGEM)
    useMapStore.getState().carimbar([objeto('a', 1, 1, id), objeto('b', 2, 2)])
    const antes = useMapStore.getState().past.length
    useMapStore.getState().removerCarimboImportado(id)
    expect(useMapStore.getState().map.carimbos?.map((c) => c.id)).toEqual(['b'])
    expect(useMapStore.getState().map.carimbosImportados).toBeUndefined()
    expect(useMapStore.getState().past).toHaveLength(antes + 1)
  })

  it('apagar todos tira os objetos (os importados ficam) e o desfazer devolve', () => {
    useMapStore.getState().importarCarimbo('Farol', IMAGEM)
    useMapStore.getState().carimbar([objeto('a', 1, 1)])
    useMapStore.getState().apagarTodosOsCarimbos()
    expect(useMapStore.getState().map.carimbos).toBeUndefined()
    expect(useMapStore.getState().map.carimbosImportados).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.carimbos).toHaveLength(1)
    const passos = useMapStore.getState().past.length
    useMapStore.getState().apagarTodosOsCarimbos()
    useMapStore.getState().apagarTodosOsCarimbos()
    expect(useMapStore.getState().past).toHaveLength(passos + 1)
  })
})
