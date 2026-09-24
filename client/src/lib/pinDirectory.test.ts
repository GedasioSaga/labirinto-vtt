import { describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { pinDirectory, searchPins, type PinDirectoryScene } from './pinDirectory'

/**
 * LISTA DE PINOS do mestre (cenário "crime"): sete "?" iguais espalhados por
 * duas cenas. O nome só do mestre ("Faca") é o que distingue um do outro na
 * lista, e a busca acha por pedaço do nome, sem acento e sem caixa.
 */

function pino(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 100, y: 200, kind: 'interrogacao', description: '', image: null, ...extra }
}

const CENAS: PinDirectoryScene[] = [
  {
    sceneId: 's-casa',
    sceneName: 'Casa do crime',
    pins: [pino('faca', { nome: 'Faca', description: 'Uma lâmina suja de sangue.' }), pino('bilhete', { nome: 'Bilhete rasgado' }), pino('mudo')],
  },
  { sceneId: 's-porao', sceneName: 'Porão', pins: [pino('pegada', { nome: 'Pegada', description: 'Barro fresco.' })] },
]

describe('pinDirectory: todos os pinos da aventura, com o nome do mestre', () => {
  it('lista cada pino com a cena dele; o rótulo é o nome e, sem nome, o resumo de sempre', () => {
    const lista = pinDirectory(CENAS)
    expect(lista.map((e) => [e.sceneId, e.pinId, e.label])).toEqual([
      ['s-casa', 'faca', 'Faca'],
      ['s-casa', 'bilhete', 'Bilhete rasgado'],
      ['s-casa', 'mudo', 'Ponto de interesse ?'],
      ['s-porao', 'pegada', 'Pegada'],
    ])
    expect(lista[0]).toMatchObject({ sceneName: 'Casa do crime', description: 'Uma lâmina suja de sangue.' })
  })

  it('o ponto de ir lá é o meio do desenho do pino, não a ponta cravada', () => {
    const [faca] = pinDirectory(CENAS)
    expect(faca.focus.x).toBe(100)
    expect(faca.focus.y).toBeLessThan(200)
    expect(faca.focus.y).toBeGreaterThan(150)
  })

  it('pino sem nenhum campo opcional (mapa antigo) entra na lista pelo resumo', () => {
    const lista = pinDirectory([{ sceneId: null, sceneName: 'Mapa', pins: [{ id: 'velho', x: 0, y: 0, kind: 'exclamacao', description: '', image: null }] }])
    expect(lista).toEqual([
      expect.objectContaining({ sceneId: null, pinId: 'velho', nome: '', label: 'Ponto de interesse !', description: '' }),
    ])
  })
})

describe('searchPins: busca por nome e descrição, com filtro por cena', () => {
  const lista = pinDirectory(CENAS)

  it('"fac" acha só a Faca', () => {
    expect(searchPins(lista, 'fac', null).map((e) => e.pinId)).toEqual(['faca'])
  })

  it('sem caixa e sem acento: "LAMINA" acha pela descrição', () => {
    expect(searchPins(lista, 'LAMINA', null).map((e) => e.pinId)).toEqual(['faca'])
  })

  it('busca vazia devolve tudo; o filtro de cena corta as outras', () => {
    expect(searchPins(lista, '   ', null)).toHaveLength(4)
    expect(searchPins(lista, '', 's-porao').map((e) => e.pinId)).toEqual(['pegada'])
    expect(searchPins(lista, 'fac', 's-porao')).toEqual([])
  })
})
