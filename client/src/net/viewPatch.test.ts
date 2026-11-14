/**
 * O patch da tela do jogador tem de ser a MESMA tela do snapshot inteiro:
 * `applyMapPatch(antes, diffMap(antes, depois))` igual a `depois`, no JSON que
 * viaja. E o que não mudou não viaja — a foto da ficha que só andou, acima de tudo.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { TerrenoAlto } from '../lib/terrenoAlto'
import type { AlturaDoPiso, MapData, RegionPoint, Token } from '../types/map'
import { applyAltoPatch, applyMapPatch, applyViewPatch, diffMap, diffView, isEmptyMapPatch, isEmptyViewPatch, type MapPatch, type PlayerViewContent } from './viewPatch'

const FOTO = `data:image/webp;base64,${'A'.repeat(50_000)}`

function ficha(id: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y: 100, size: 1, image: null, imageData: FOTO, ...extra }
}

function mapa(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'M', 30, 30, 40), tokens }
}

/** Ida e volta pelo fio: é o que o jogador recebe. */
function peloFio<T>(valor: T): unknown {
  return JSON.parse(JSON.stringify(valor))
}

function aplicado(antes: MapData, patch: MapPatch | null): MapData {
  if (patch === null) throw new Error('esperava patch')
  const depois = applyMapPatch(antes, patch)
  if (depois === null) throw new Error('patch não encaixou')
  return depois
}

describe('diffMap / applyMapPatch', () => {
  it('ficha que andou: o patch leva só x, sem a foto, e remonta o mapa igual', () => {
    const antes = mapa([ficha('a', 100), ficha('b', 200)])
    const depois = { ...antes, tokens: antes.tokens.map((t) => (t.id === 'a' ? { ...t, x: 140 } : t)) }

    const patch = diffMap(antes, depois)

    expect(patch).toEqual({ set: {}, tokens: { change: [{ id: 'a', set: { x: 140 } }], remove: [] } })
    expect(JSON.stringify(patch)).not.toContain('data:image')
    expect(peloFio(aplicado(antes, patch))).toEqual(peloFio(depois))
  })

  it('ficha nova, ficha que saiu e ordem trocada: a ordem de desenho do mestre chega', () => {
    const antes = mapa([ficha('a', 100), ficha('b', 200), ficha('c', 300)])
    const depois = mapa([ficha('c', 300), ficha('novo', 50), ficha('a', 100)])

    const patch = diffMap(antes, depois)

    expect(patch?.tokens?.remove).toEqual(['b'])
    expect(patch?.tokens?.order).toEqual(['c', 'novo', 'a'])
    expect(patch?.tokens?.change).toEqual([{ id: 'novo', token: ficha('novo', 50) }])
    expect(peloFio(aplicado(antes, patch))).toEqual(peloFio(depois))
  })

  it('campo que sumiu da ficha (rotação desfeita) vai com a ficha inteira', () => {
    const antes = mapa([ficha('a', 100, { rotation: 90 })])
    const depois = mapa([ficha('a', 100)])

    const patch = diffMap(antes, depois)

    expect(patch?.tokens?.change).toEqual([{ id: 'a', token: ficha('a', 100) }])
    expect(peloFio(aplicado(antes, patch))).toEqual(peloFio(depois))
  })

  it('campo de topo que mudou vai inteiro; o que não mudou mantém a referência', () => {
    const antes = mapa([ficha('a', 100)])
    const depois = { ...antes, walls: [{ id: 'w', x1: 0, y1: 0, x2: 40, y2: 0, blocksLight: true, blocksMove: true, door: null }] }

    const patch = diffMap(antes, depois)

    expect(patch).toEqual({ set: { walls: depois.walls } })
    const remontado = aplicado(antes, patch)
    expect(remontado.tokens).toBe(antes.tokens)
    expect(remontado.floor).toBe(antes.floor)
    expect(peloFio(remontado)).toEqual(peloFio(depois))
  })

  it('campo de topo que sumiu não cabe num patch: null (vai o snapshot inteiro)', () => {
    const antes = { ...mapa([]), gridOffset: { x: 5, y: 5 } }
    const { gridOffset, ...depois } = antes
    expect(gridOffset).toEqual({ x: 5, y: 5 })
    expect(diffMap(antes, depois)).toBeNull()
  })

  it('id de ficha repetido: as fichas vão inteiras, no campo de topo', () => {
    const antes = mapa([ficha('a', 100)])
    const depois = mapa([ficha('a', 100), ficha('a', 200)])
    const patch = diffMap(antes, depois)
    expect(patch).toEqual({ set: { tokens: depois.tokens } })
    expect(peloFio(aplicado(antes, patch))).toEqual(peloFio(depois))
  })

  it('mapa igual (mesmo conteúdo, objetos novos): patch vazio', () => {
    const antes = mapa([ficha('a', 100)])
    const patch = diffMap(antes, structuredClone(antes))
    expect(patch).toEqual({ set: {} })
    expect(patch !== null && isEmptyMapPatch(patch)).toBe(true)
  })

  it('patch de outra tela (campos de uma ficha que não existe aqui) não encaixa', () => {
    const antes = mapa([ficha('a', 100)])
    expect(applyMapPatch(antes, { set: {}, tokens: { change: [{ id: 'fantasma', set: { x: 1 } }], remove: [] } })).toBeNull()
    expect(applyMapPatch(antes, { set: {}, tokens: { change: [], remove: [], order: ['a', 'fantasma'] } })).toBeNull()
  })
})

describe('diffView', () => {
  const explorado = { cell: 40, cols: 30, rows: 30, bits: 'AAAA', rings: '' }
  function tela(tokens: Token[], visao: number): PlayerViewContent {
    return { map: mapa(tokens), vision: [[{ x: 0, y: 0 }, { x: visao, y: 0 }, { x: visao, y: visao }]], explored: explorado, ownTokens: ['a'], concealed: [] }
  }

  it('só a visão e a ficha que andou; o resto fica fora', () => {
    const antes = tela([ficha('a', 100), ficha('b', 200)], 300)
    const depois = tela([ficha('a', 140), ficha('b', 200)], 340)

    const patch = diffView(antes, depois)

    expect(patch).toEqual({ map: { set: {}, tokens: { change: [{ id: 'a', set: { x: 140 } }], remove: [] } }, vision: depois.vision })
  })

  it('tela igual: patch vazio', () => {
    const patch = diffView(tela([ficha('a', 100)], 300), tela([ficha('a', 100)], 300))
    expect(patch).toEqual({})
    expect(patch !== null && isEmptyViewPatch(patch)).toBe(true)
  })
})

describe('terreno alto no patch (`alto`)', () => {
  const explorado = { cell: 40, cols: 30, rows: 30, bits: 'AAAA', rings: '' }
  const anel = (lado: number): RegionPoint[][] => [[{ x: 0, y: 0 }, { x: lado, y: 0 }, { x: lado, y: lado }]]
  function tela(alto: TerrenoAlto | undefined): PlayerViewContent {
    const base: PlayerViewContent = { map: mapa([ficha('a', 100)]), vision: anel(300), explored: explorado, ownTokens: ['a'], concealed: [] }
    return alto === undefined ? base : { ...base, alto }
  }
  const deBaixo = (xs: number[], altura: AlturaDoPiso = 'media', visao = 300): TerrenoAlto['abaixo'] => ({
    map: mapa(xs.map((x, i) => ficha(`baixo-${i}`, x))),
    vision: anel(visao),
    concealed: [],
    altura,
  })
  /** O que o jogador deve ter: `acima` vazia é o mesmo que nada de cima, e nada é nada (o host nem manda o campo). */
  function esperado(alto: TerrenoAlto | undefined): TerrenoAlto | null {
    if (alto === undefined) return null
    const { acima, ...resto } = alto
    const limpo: TerrenoAlto = acima === undefined || acima.length === 0 ? resto : alto
    return limpo.abaixo === undefined && limpo.acima === undefined ? null : limpo
  }

  it('applyViewPatch(antes, diffView(antes, depois)) é `depois` no fio, com e sem `abaixo`, `acima` vazia, aparecendo e sumindo', () => {
    const casos: [string, TerrenoAlto | undefined, TerrenoAlto | undefined][] = [
      ['subiu à muralha', undefined, { abaixo: deBaixo([100, 200]) }],
      ['desceu dela', { abaixo: deBaixo([100, 200]) }, undefined],
      ['ficha de baixo andou', { abaixo: deBaixo([100, 200]) }, { abaixo: deBaixo([140, 200]) }],
      ['altura e visão mudaram', { abaixo: deBaixo([100]) }, { abaixo: deBaixo([100], 'alta', 340) }],
      ['guarda apareceu em cima', undefined, { acima: [ficha('guarda', 300)] }],
      ['guarda andou em cima', { acima: [ficha('guarda', 300)] }, { acima: [ficha('guarda', 340)] }],
      ['acima ficou vazia', { acima: [ficha('guarda', 300)] }, { acima: [] }],
      ['de baixo e de cima juntos', { abaixo: deBaixo([100]) }, { abaixo: deBaixo([100]), acima: [ficha('guarda', 300)] }],
    ]
    for (const [nome, antes, depois] of casos) {
      const patch = diffView(tela(antes), tela(depois))
      if (patch === null) throw new Error(`${nome}: o terreno alto não coube num patch`)
      const montada = applyViewPatch(tela(antes), patch)
      expect(montada, nome).not.toBeNull()
      expect(peloFio(montada?.alto ?? null), nome).toEqual(peloFio(esperado(depois)))
    }
    // O passo da ficha de baixo leva só o x dela, sem foto e sem o mapa de baixo inteiro.
    const passo = diffView(tela({ abaixo: deBaixo([100, 200]) }), tela({ abaixo: deBaixo([140, 200]) }))
    expect(passo?.alto).toEqual({ mapaDeBaixo: { set: {}, tokens: { change: [{ id: 'baixo-0', set: { x: 140 } }], remove: [] } } })
    expect(JSON.stringify(passo)).not.toContain('data:image')
  })

  it('pedaço do piso de baixo para quem não o tem, ou ficha de cima que o jogador não tem: o patch não encaixa', () => {
    expect(applyAltoPatch(undefined, { altura: 'alta' })).toBeNull()
    expect(applyAltoPatch({ acima: [ficha('guarda', 300)] }, { mapaDeBaixo: { set: {} } })).toBeNull()
    expect(applyAltoPatch({ acima: [ficha('guarda', 300)] }, { acima: { change: [{ id: 'fantasma', set: { x: 1 } }], remove: [] } })).toBeNull()
    expect(applyViewPatch(tela(undefined), { alto: { visaoDeBaixo: anel(10) } })).toBeNull()
  })
})
