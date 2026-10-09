/**
 * MAPA DE CONTINENTE na TELA DE QUEM JOGA: a ficha que chega com `pino` (só o
 * recorte o escreve, só em ficha de jogador numa cena Continente) é desenhada
 * como o pino — sem disco, vida, condições nem anel da vez —, e o toque cobre
 * o pino inteiro. A ficha sem `pino` (NPC, cena Normal) continua a de sempre.
 */
import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Rectangle } from 'pixi.js'
import type { Token } from '../types/map'
import { MARCADOR_LABEL } from '../pixi/vistaDoMarcador'
import { AREA_DE_TOQUE } from '../pixi/drawMarcadorDeContinente'
import {
  createTokenView,
  girarMarcadores,
  paintTokenView,
  sizeTokenView,
  syncFacing,
  syncOwnerRing,
  tokenViewKey,
} from './PlayerView'
import { createTokenTurns } from './tokenTurn'

const GRADE = 50

function ficha(extra: Partial<Token> = {}): Token {
  return { id: 'ana', characterId: null, name: 'Ana', x: 625, y: 325, size: 1, image: null, ...extra }
}

function marcadorDe(view: ReturnType<typeof createTokenView>): Container | undefined {
  return view.wrapper.children.find((c) => c.label === MARCADOR_LABEL)
}

function desenhado(g: unknown): boolean {
  return g instanceof Graphics && g.context.instructions.length > 0
}

describe('jogador — ficha de jogador no mapa de continente', () => {
  it('chega com `pino`: vira o pino, sem disco, vida, condição nem anel da vez', () => {
    const view = createTokenView(ficha({ pino: '#64b5f6', health: { current: 2, max: 9, shownToPlayers: true }, conditions: ['caido'] }), GRADE, true, true)
    const marcador = marcadorDe(view)
    expect(marcador?.visible).toBe(true)
    expect(desenhado(view.body)).toBe(false)
    expect(desenhado(view.bar)).toBe(false)
    expect(desenhado(view.marks)).toBe(false)
    expect(view.photo.visible).toBe(false)
  })

  it('o toque cobre o pino inteiro: a área é a do pino, com a cabeça acima do ponto da ficha', () => {
    const marcador = marcadorDe(createTokenView(ficha({ pino: '#64b5f6' }), GRADE, true))
    const area = marcador?.hitArea
    expect(area).toBeInstanceOf(Rectangle)
    if (!(area instanceof Rectangle)) return
    expect(area.y).toBe(AREA_DE_TOQUE.y)
    expect(area.contains(0, -40)).toBe(true)
  })

  it('sem `pino` (NPC, cena Normal): a ficha de sempre, sem pino', () => {
    const view = createTokenView(ficha(), GRADE, false)
    expect(marcadorDe(view)).toBeUndefined()
    expect(desenhado(view.body)).toBe(true)
  })

  it('a cena vira Normal: a chave muda, a repintura esconde o pino e o disco volta', () => {
    const comPino = ficha({ pino: '#64b5f6' })
    const view = createTokenView(comPino, GRADE, true)
    const semPino = ficha()
    expect(tokenViewKey(semPino, GRADE, true)).not.toBe(tokenViewKey(comPino, GRADE, true))
    paintTokenView(view, semPino, GRADE, true)
    expect(marcadorDe(view)?.visible).toBe(false)
    expect(desenhado(view.body)).toBe(true)
  })

  it('a cor do pino entra na chave: trocar a cor repinta', () => {
    expect(tokenViewKey(ficha({ pino: '#64b5f6' }), GRADE, true)).not.toBe(tokenViewKey(ficha({ pino: '#e57373' }), GRADE, true))
  })

  it('no laço de fichas: o nome da ficha e o aro do dono somem; o nome do pino segue a chave de nomes', () => {
    const view = createTokenView(ficha({ pino: '#64b5f6' }), GRADE, true)
    sizeTokenView(view, 1, true)
    syncOwnerRing(view, 1)
    const rotulo = view.marcador?.rotulo
    expect(view.label.visible).toBe(false)
    // Sem etiqueta de companheiro: `placeCompanionLabel` só a mostra com texto e com o nome à vista.
    expect(view.companionLabel.text).toBe('')
    expect(rotulo?.visible).toBe(true)
    expect(rotulo?.text).toBe('Ana')
    expect(desenhado(view.ring)).toBe(false)
    sizeTokenView(view, 1, false)
    expect(rotulo?.visible).toBe(false)
    expect(view.label.visible).toBe(false)
  })

  it('ficha com frente: o pino não tem bico', () => {
    const token = ficha({ pino: '#64b5f6', rotation: 90 })
    const view = createTokenView(token, GRADE, true)
    syncFacing(view, token, createTokenTurns(), { shown: null, now: 0, animate: false, cameraScale: 1 })
    expect(view.facingNib.visible).toBe(false)
    // A mesma ficha numa cena Normal ganha o bico de volta.
    const normal = ficha({ rotation: 90 })
    paintTokenView(view, normal, GRADE, true)
    syncFacing(view, normal, createTokenTurns(), { shown: null, now: 0, animate: false, cameraScale: 1 })
    expect(view.facingNib.visible).toBe(true)
  })
})

describe('jogador — o quadro do pino girando (girarMarcadores)', () => {
  function cenaComPino() {
    const view = createTokenView(ficha({ pino: '#64b5f6' }), GRADE, true)
    const giro = view.marcador?.giro
    if (giro === undefined) throw new Error('sem a pirâmide')
    return { views: new Map([['ana', view]]), view, giro }
  }

  it('conjunto vazio (cena Normal): não toca em view nenhuma', () => {
    const { views, giro } = cenaComPino()
    const refazer = vi.spyOn(giro, 'clear')
    girarMarcadores(views, new Set(), 1000, false)
    expect(refazer).not.toHaveBeenCalled()
  })

  it('movimento reduzido: a pirâmide não é redesenhada', () => {
    const { views, giro } = cenaComPino()
    const refazer = vi.spyOn(giro, 'clear')
    girarMarcadores(views, new Set(['ana']), 1000, true)
    expect(refazer).not.toHaveBeenCalled()
  })

  it('dois quadros refazem a pirâmide duas vezes, e só ela', () => {
    const { views, view, giro } = cenaComPino()
    const refazer = vi.spyOn(giro, 'clear')
    const refazerCorpo = view.marcador === null ? undefined : vi.spyOn(view.marcador.corpo, 'clear')
    const conjunto = new Set(['ana'])
    girarMarcadores(views, conjunto, 1000, false)
    girarMarcadores(views, conjunto, 1016, false)
    expect(refazer).toHaveBeenCalledTimes(2)
    expect(refazerCorpo).not.toHaveBeenCalled()
  })

  it('a ficha que saiu da visão (view escondida) ou sumiu sai do conjunto e não é animada', () => {
    const { views, view, giro } = cenaComPino()
    const refazer = vi.spyOn(giro, 'clear')
    view.wrapper.visible = false
    const conjunto = new Set(['ana', 'fantasma'])
    girarMarcadores(views, conjunto, 1000, false)
    expect(conjunto.size).toBe(0)
    expect(refazer).not.toHaveBeenCalled()
  })
})
