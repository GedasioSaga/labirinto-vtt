import { describe, expect, it } from 'vitest'
import { fitCamera, MIN_SCALE, type Bounds, type Camera, type Point } from '../pixi/world'
import type { Token } from '../types/map'
import { arrivalCamera, centeredCamera, coverBounds, firstOwnToken } from './playerCamera'

// A mesa da régua task-jornada-mapa-livre-do-painel: 40 x 12 casas de 50 px,
// notebook 1280 x 800 e o painel do jogador aberto no canto de cima à esquerda.
const TELA = { width: 1280, height: 800 }
const MAPA: Bounds = { minX: 0, minY: 0, maxX: 2000, maxY: 600 }
const PAINEL: Bounds = { minX: 12, minY: 12, maxX: 260, maxY: 620 }
/** O mesmo FIT_MARGIN de PlayerView.tsx. */
const MARGEM = 24
const CENTRO_LIVRE: Point = { x: (PAINEL.maxX + TELA.width) / 2, y: TELA.height / 2 }

function naTela(camera: Camera, p: Point): Point {
  return { x: p.x * camera.scale + camera.x, y: p.y * camera.scale + camera.y }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

describe('arrivalCamera: ao entrar ou trocar de cena, a própria ficha nunca nasce debaixo do painel', () => {
  const enquadrado = fitCamera(MAPA, TELA, MARGEM)

  it('ficha na borda esquerda, sob o painel no enquadramento do mapa inteiro, vai ao centro da área livre no mesmo zoom', () => {
    // Pré-condição: é o defeito da régua — o mapa inteiro põe a ficha em x≈85, sob o painel.
    const antes = naTela(enquadrado, { x: 100, y: 150 })
    expect(antes.x).toBeLessThan(PAINEL.maxX)

    const camera = arrivalCamera(enquadrado, { x: 100, y: 150, radius: 25 }, TELA, [PAINEL])

    expect(camera.scale).toBe(enquadrado.scale)
    const depois = naTela(camera, { x: 100, y: 150 })
    expect(depois.x).toBeCloseTo(CENTRO_LIVRE.x, 6)
    expect(depois.y).toBeCloseTo(CENTRO_LIVRE.y, 6)
  })

  it('ficha que já aparece inteira fora do painel: o enquadramento do mapa inteiro fica exatamente como era', () => {
    const camera = arrivalCamera(enquadrado, { x: 900, y: 440, radius: 25 }, TELA, [PAINEL])
    expect(camera).toEqual(enquadrado)
  })

  it('ficha só encostando no painel (metade do disco debaixo dele) também é centrada', () => {
    // x da tela = 24 + 400·0,616 ≈ 270: o centro está fora, a borda esquerda do disco não.
    const camera = arrivalCamera(enquadrado, { x: 400, y: 300, radius: 25 }, TELA, [PAINEL])
    const depois = naTela(camera, { x: 400, y: 300 })
    expect(depois.x).toBeCloseTo(CENTRO_LIVRE.x, 6)
  })

  it('mapa enorme no zoom mínimo, com a ficha fora da tela: centra nela', () => {
    const gigante: Bounds = { minX: 0, minY: 0, maxX: 40_000, maxY: 30_000 }
    const longe = fitCamera(gigante, TELA, MARGEM)
    expect(longe.scale).toBe(MIN_SCALE)
    const camera = arrivalCamera(longe, { x: 39_000, y: 1_000, radius: 25 }, TELA, [])
    const depois = naTela(camera, { x: 39_000, y: 1_000 })
    expect(depois.x).toBeCloseTo(TELA.width / 2, 6)
    expect(depois.y).toBeCloseTo(TELA.height / 2, 6)
  })

  it('painel recolhido não cobre nada: a ficha na borda esquerda, visível, fica onde o mapa inteiro a pôs', () => {
    const recolhido: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    const camera = arrivalCamera(enquadrado, { x: 100, y: 150, radius: 25 }, TELA, [recolhido])
    expect(camera).toEqual(enquadrado)
  })

  it('sem ficha própria nesta cena: enquadra o mapa inteiro, como sempre', () => {
    expect(arrivalCamera(enquadrado, null, TELA, [PAINEL])).toEqual(enquadrado)
  })
})

describe('centeredCamera: "Minha ficha" e "Centralizar" põem a ficha no meio do que o painel deixa livre', () => {
  it('com o painel aberto, o centro é o da área livre; o zoom não muda', () => {
    const camera = centeredCamera(1.7, { x: 320, y: 90 }, TELA, [PAINEL])
    expect(camera.scale).toBe(1.7)
    const p = naTela(camera, { x: 320, y: 90 })
    expect(p.x).toBeCloseTo(CENTRO_LIVRE.x, 6)
    expect(p.y).toBeCloseTo(CENTRO_LIVRE.y, 6)
  })

  it('sem nada por cima do mapa, o centro é o da tela', () => {
    const p = naTela(centeredCamera(0.5, { x: 320, y: 90 }, TELA, []), { x: 320, y: 90 })
    expect(p).toEqual({ x: 640, y: 400 })
  })
})

describe('firstOwnToken: a ficha que "Minha ficha" procura', () => {
  it('é a primeira de ownTokens que está no mapa, a mesma que o painel lista primeiro', () => {
    const tokens = [ficha('npc', 0, 0), ficha('b', 10, 10), ficha('a', 20, 20)]
    expect(firstOwnToken(tokens, ['sumida', 'a', 'b'])?.id).toBe('a')
  })

  it('nenhuma ficha própria no mapa: null', () => {
    expect(firstOwnToken([ficha('npc', 0, 0)], ['a'])).toBeNull()
    expect(firstOwnToken([ficha('npc', 0, 0)], [])).toBeNull()
  })
})

describe('coverBounds: o que cobre o mapa, lido na hora do pedido', () => {
  /** jsdom não faz layout: a caixa vem do teste, no formato que o navegador devolveria. */
  function caixa(el: HTMLElement, left: number, top: number, width: number, height: number): void {
    const rect = { left, top, width, height, x: left, y: top, right: left + width, bottom: top + height }
    el.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect })
  }

  it('painel aberto: a caixa dele (a barra mora dentro do cabeçalho do painel)', () => {
    const painel = document.createElement('aside')
    const barra = document.createElement('div')
    caixa(painel, 12, 12, 248, 608)
    caixa(barra, 25, 25, 200, 44)
    expect(coverBounds(painel, barra)).toEqual([{ minX: 12, minY: 12, maxX: 260, maxY: 620 }])
  })

  it('painel recolhido: só a barra, sozinha no canto', () => {
    const painel = document.createElement('aside')
    painel.hidden = true
    const barra = document.createElement('div')
    caixa(painel, 12, 12, 248, 608)
    caixa(barra, 25, 25, 200, 44)
    expect(coverBounds(painel, barra)).toEqual([{ minX: 25, minY: 25, maxX: 225, maxY: 69 }])
  })

  it('sem elementos, ou com caixa vazia, nada cobre o mapa', () => {
    const vazio = document.createElement('div')
    expect(coverBounds(null, null)).toEqual([])
    expect(coverBounds(null, vazio)).toEqual([])
  })
})
