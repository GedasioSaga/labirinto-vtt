import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import type { Drawing, Region } from '../types/map'
import { FORCA_PADRAO, TAMANHO_DO_PINCEL_MAX, TAMANHO_DO_PINCEL_MIN } from '../lib/texturas'

/** A ferramenta Texturas no store: um Ctrl+Z por gesto, nenhum para gesto que não muda nada. */
describe('mapStore — Texturas', () => {
  const ilha: Region = {
    id: 'ilha',
    tag: 'region',
    fillColor: '#a8776a',
    fillPattern: 'solid',
    data: {},
    points: [
      { x: 100, y: 100 },
      { x: 900, y: 100 },
      { x: 900, y: 500 },
      { x: 100, y: 500 },
    ],
  }
  const mata: Drawing = {
    id: 'mata',
    kind: 'polygon',
    points: [
      { x: 200, y: 200 },
      { x: 400, y: 200 },
      { x: 400, y: 400 },
      { x: 200, y: 400 },
    ],
    color: '#177c5c',
    width: 0,
    filled: true,
    fillAlpha: 1,
  }
  const IMAGEM = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAA='

  beforeEach(() => {
    useMapStore.getState().loadMap({ ...mapFactory.createEmptyMap('m', 'M', 20, 12, 50), continente: true, regions: [ilha], drawings: [mata] })
    useMapStore.getState().setTexturaModo('pincel')
    useMapStore.getState().setTexturaEscolhida('floresta')
    useMapStore.getState().setTexturaForca(FORCA_PADRAO)
  })

  it('preferências da ferramenta ficam na faixa (e fora do mapa)', () => {
    const s = useMapStore.getState()
    s.setTexturaTamanho(9999)
    expect(useMapStore.getState().texturaTamanho).toBe(TAMANHO_DO_PINCEL_MAX)
    s.setTexturaTamanho(0)
    expect(useMapStore.getState().texturaTamanho).toBe(TAMANHO_DO_PINCEL_MIN)
    s.setTexturaForca(3)
    expect(useMapStore.getState().texturaForca).toBe(1)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('uma pincelada vira UM passo no desfazer; o desfazer tira o campo', () => {
    expect(useMapStore.getState().pintarTextura({ tipo: 'pincel', textura: 'floresta', forca: 0.8, raio: 30, pontos: [{ x: 150, y: 150 }, { x: 250, y: 150 }] })).toBe('pintou')
    expect(useMapStore.getState().map.texturas).toHaveLength(1)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.texturas).toBeUndefined()
  })

  it('borracha no vazio não gasta desfazer e diz por quê', () => {
    expect(useMapStore.getState().pintarTextura({ tipo: 'borracha', forca: 1, raio: 30, pontos: [{ x: 600, y: 300 }] })).toBe('nada-a-apagar')
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('o balde enche o desenho pintado debaixo do clique; fora da terra diz por quê; o mesmo balde de novo não muda nada', () => {
    expect(useMapStore.getState().encherComTextura({ x: 300, y: 300 })).toBe('pintou')
    expect(useMapStore.getState().map.texturas?.[0]).toMatchObject({ tipo: 'balde', textura: 'floresta', alvo: { tipo: 'desenho', id: 'mata' } })
    expect(useMapStore.getState().encherComTextura({ x: 300, y: 300 })).toBe('igual')
    expect(useMapStore.getState().encherComTextura({ x: 950, y: 590 })).toBe('fora-de-forma')
    expect(useMapStore.getState().past).toHaveLength(1)
    // Fora da mata, a ilha.
    useMapStore.getState().setTexturaEscolhida('areia')
    useMapStore.getState().encherComTextura({ x: 700, y: 300 })
    expect(useMapStore.getState().map.texturas?.[1]).toMatchObject({ alvo: { tipo: 'regiao', id: 'ilha' } })
    // A borracha que passa pela caixa do balde vale.
    expect(useMapStore.getState().pintarTextura({ tipo: 'borracha', forca: 1, raio: 30, pontos: [{ x: 300, y: 300 }] })).toBe('pintou')
  })

  it('importar acrescenta a textura e já a escolhe; remover tira o que ela pintou, com desfazer', () => {
    const id = useMapStore.getState().importarTextura('  Musgo ', IMAGEM)
    expect(id.startsWith('importada:')).toBe(true)
    expect(useMapStore.getState().texturaEscolhida).toBe(id)
    expect(useMapStore.getState().map.texturasImportadas).toEqual([{ id, nome: 'Musgo', imagem: IMAGEM }])
    useMapStore.getState().pintarTextura({ tipo: 'pincel', textura: id, forca: 1, raio: 30, pontos: [{ x: 150, y: 150 }] })
    useMapStore.getState().removerTexturaImportada(id)
    expect(useMapStore.getState().map.texturasImportadas).toBeUndefined()
    expect(useMapStore.getState().map.texturas).toBeUndefined()
    expect(useMapStore.getState().texturaEscolhida).toBe('floresta')
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.texturas).toHaveLength(1)
    expect(useMapStore.getState().map.texturasImportadas).toHaveLength(1)
  })

  it('Ctrl+Z da importação: a escolhida volta para a Floresta, não fica apontando para a importada que sumiu', () => {
    useMapStore.getState().importarTextura('Musgo', IMAGEM)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.texturasImportadas).toBeUndefined()
    expect(useMapStore.getState().texturaEscolhida).toBe('floresta')
  })

  it('trocar para uma cena sem a importada escolhida volta para a Floresta; a da biblioteca continua', () => {
    useMapStore.getState().importarTextura('Musgo', IMAGEM)
    useMapStore.getState().loadMap(mapFactory.createEmptyMap('outra', 'Outra', 10, 10, 50))
    expect(useMapStore.getState().texturaEscolhida).toBe('floresta')
    useMapStore.getState().setTexturaEscolhida('neve')
    useMapStore.getState().loadMap(mapFactory.createEmptyMap('mais', 'Mais', 10, 10, 50))
    expect(useMapStore.getState().texturaEscolhida).toBe('neve')
  })

  it('pincel e balde com textura que não existe nesta cena: não grava passo órfão, avisa e volta para a Floresta', () => {
    useMapStore.getState().setTexturaEscolhida('importada:sumiu')
    expect(useMapStore.getState().encherComTextura({ x: 300, y: 300 })).toBe('textura-ausente')
    expect(useMapStore.getState().texturaEscolhida).toBe('floresta')
    expect(
      useMapStore.getState().pintarTextura({ tipo: 'pincel', textura: 'pacote-que-sumiu', forca: 1, raio: 30, pontos: [{ x: 150, y: 150 }] }),
    ).toBe('textura-ausente')
    expect(useMapStore.getState().map.texturas).toBeUndefined()
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('mapa com pisos: o balde e a borracha olham só as formas do piso em edição', () => {
    // A mata do piso de cima cobre o ponto; no térreo, o balde acerta a ilha.
    useMapStore.getState().loadMap({
      ...mapFactory.createEmptyMap('m', 'M', 20, 12, 50),
      continente: true,
      regions: [ilha],
      drawings: [{ ...mata, piso: 1 }],
    })
    expect(useMapStore.getState().encherComTextura({ x: 300, y: 300 })).toBe('pintou')
    expect(useMapStore.getState().map.texturas?.[0]).toMatchObject({ tipo: 'balde', alvo: { tipo: 'regiao', id: 'ilha' } })
    // No piso de cima, o balde na mata; no térreo, a borracha ali não acha a mata de cima para apagar.
    useMapStore.setState({ pisoAtivo: 1 })
    useMapStore.getState().setTexturaEscolhida('pantano')
    expect(useMapStore.getState().encherComTextura({ x: 300, y: 300 })).toBe('pintou')
    expect(useMapStore.getState().map.texturas?.[1]).toMatchObject({ alvo: { tipo: 'desenho', id: 'mata' } })
    useMapStore.setState({ pisoAtivo: 0 })
    useMapStore.getState().apagarTodasAsTexturas()
    useMapStore.setState({ pisoAtivo: 1 })
    useMapStore.getState().encherComTextura({ x: 300, y: 300 })
    useMapStore.setState({ pisoAtivo: 0 })
    expect(useMapStore.getState().pintarTextura({ tipo: 'borracha', forca: 1, raio: 30, pontos: [{ x: 300, y: 300 }] })).toBe('nada-a-apagar')
  })

  it('"Apagar todas as texturas" limpa os passos (as importadas ficam), com desfazer', () => {
    useMapStore.getState().importarTextura('Musgo', IMAGEM)
    useMapStore.getState().encherComTextura({ x: 300, y: 300 })
    useMapStore.getState().apagarTodasAsTexturas()
    expect(useMapStore.getState().map.texturas).toBeUndefined()
    expect(useMapStore.getState().map.texturasImportadas).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.texturas).toHaveLength(1)
  })
})
