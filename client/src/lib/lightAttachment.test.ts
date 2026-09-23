import { describe, expect, it } from 'vitest'
import type { Light, MapData, Token } from '../types/map'
import { moveAreaSelection } from './areaSelection'
import { moveTokenCarryingLights } from './lightAttachment'
import { createEmptyMap, removeToken, setLightAttachment, setTokenPosition } from './mapFactory'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function light(id: string, x: number, y: number, extra: Partial<Light> = {}): Light {
  return { id, x, y, radius: 110, color: '#ff0000', intensity: 1, ...extra }
}

/** Ficha "Lanterna" em (725,325) com a tocha presa a 300 px à esquerda; outra luz solta. */
function cena(): MapData {
  return {
    ...createEmptyMap('m', 'M', 20, 12, 50),
    tokens: [token('lanterna', 725, 325), token('outra', 100, 100)],
    lights: [light('tocha', 425, 325, { attachedTokenId: 'lanterna' }), light('solta', 900, 500)],
  }
}

describe('tocha presa na ficha', () => {
  it('mover a ficha leva a luz presa com o mesmo deslocamento e deixa a solta onde está', () => {
    const next = setTokenPosition(cena(), 'lanterna', 575, 340)
    expect(next.tokens.find((t) => t.id === 'lanterna')).toMatchObject({ x: 575, y: 340 })
    expect(next.lights.find((l) => l.id === 'tocha')).toMatchObject({ x: 275, y: 340, attachedTokenId: 'lanterna' })
    expect(next.lights.find((l) => l.id === 'solta')).toMatchObject({ x: 900, y: 500 })
  })

  it('mover ficha sem luz presa não recria a lista de luzes (o editor não redesenha à toa)', () => {
    const antes = cena()
    const next = setTokenPosition(antes, 'outra', 150, 150)
    expect(next.lights).toBe(antes.lights)
  })

  it('moveTokenCarryingLights é a mesma regra usada pela tela do jogador', () => {
    const next = moveTokenCarryingLights(cena(), 'lanterna', 725, 425)
    expect(next.lights.find((l) => l.id === 'tocha')).toMatchObject({ x: 425, y: 425 })
  })

  it('ficha inexistente não mexe em nada', () => {
    const antes = cena()
    expect(moveTokenCarryingLights(antes, 'nao-existe', 1, 1)).toBe(antes)
  })

  it('prender e soltar pelo mapFactory', () => {
    const solta = setLightAttachment(cena(), 'solta', 'outra')
    expect(solta.lights.find((l) => l.id === 'solta')?.attachedTokenId).toBe('outra')
    const soltou = setLightAttachment(solta, 'tocha', null)
    const tocha = soltou.lights.find((l) => l.id === 'tocha')
    expect(tocha).toBeDefined()
    expect(tocha !== undefined && 'attachedTokenId' in tocha).toBe(false)
    // Solta: a ficha anda sozinha e a luz fica.
    const andou = setTokenPosition(soltou, 'lanterna', 575, 325)
    expect(andou.lights.find((l) => l.id === 'tocha')).toMatchObject({ x: 425, y: 325 })
  })

  it('prender põe a luz no centro da ficha: a tocha vai na mão de quem a carrega', () => {
    // Luz solta a 300 px da ficha (a geometria da régua e2e). Presa com o
    // afastamento, a 3 casas de passo ela saía da área livre do editor e o
    // halo ficava atrás do painel; na mão da ficha, anda por onde a ficha anda.
    const antes: MapData = { ...cena(), lights: [light('tocha', 425, 325), light('solta', 900, 500)] }
    const presa = setLightAttachment(antes, 'tocha', 'lanterna')
    expect(presa.lights.find((l) => l.id === 'tocha')).toEqual(light('tocha', 725, 325, { attachedTokenId: 'lanterna' }))
    expect(presa.lights.find((l) => l.id === 'solta')).toEqual(light('solta', 900, 500))
    const andou = setTokenPosition(presa, 'lanterna', 575, 325)
    expect(andou.lights.find((l) => l.id === 'tocha')).toMatchObject({ x: 575, y: 325, attachedTokenId: 'lanterna' })
  })

  it('soltar deixa a luz onde está (no lugar da ficha), sem voltar para o ponto de antes de prender', () => {
    const antes: MapData = { ...cena(), lights: [light('tocha', 425, 325)] }
    const soltou = setLightAttachment(setLightAttachment(antes, 'tocha', 'lanterna'), 'tocha', null)
    expect(soltou.lights).toEqual([light('tocha', 725, 325)])
  })

  it('prender numa ficha que não existe não prende', () => {
    const antes = cena()
    expect(setLightAttachment(antes, 'solta', 'fantasma')).toBe(antes)
  })

  it('apagar a ficha solta a luz que ela carregava (a luz fica no lugar)', () => {
    const next = removeToken(cena(), 'lanterna')
    const tocha = next.lights.find((l) => l.id === 'tocha')
    expect(tocha).toMatchObject({ x: 425, y: 325 })
    expect(tocha !== undefined && 'attachedTokenId' in tocha).toBe(false)
  })

  it('mover a seleção em grupo com a ficha leva a luz presa junto, sem mover duas vezes se a luz também está selecionada', () => {
    const vazia = { walls: [], regions: [], stairs: [], lights: [], tokens: [], props: [], drawings: [] }
    const soFicha = moveAreaSelection(cena(), { ...vazia, tokens: ['lanterna'] }, -150, 0)
    expect(soFicha.lights.find((l) => l.id === 'tocha')).toMatchObject({ x: 275, y: 325 })
    const ambas = moveAreaSelection(cena(), { ...vazia, tokens: ['lanterna'], lights: ['tocha'] }, -150, 0)
    expect(ambas.lights.find((l) => l.id === 'tocha')).toMatchObject({ x: 275, y: 325 })
    expect(ambas.lights.find((l) => l.id === 'solta')).toMatchObject({ x: 900, y: 500 })
  })
})
