/**
 * VULTO — "Rostos só de perto: N casas", lado do RECORTE. Com a opção ligada na
 * cena, a ficha que não é do jogador e está além de N casas de todas as fichas
 * dele sai do recorte como "Vulto": sem nome (nem o de trabalho, nem o público),
 * sem foto, sem cor, sem marca de companheiro e sem ficha de personagem. Dentro
 * de N casas, sai como sempre saiu. Sem a opção, nada muda.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, MeasurementMode, Token, TokenCompanion } from '../types/map'
import { filterMapForPlayer, type CompanionMarks } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { signalColor } from './signals'
import { VULTO_COLOR, VULTO_NAME } from './tokenVulto'

const FOTO = 'data:image/png;base64,QUJDRA=='
const VERMELHO = '#d6452f'

function ficha(id: string, name: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, ...extra }
}

const MARCAS: CompanionMarks = new Map<string, TokenCompanion>([
  ['p1', { name: 'Duda', color: signalColor('p1') }],
  ['p2', { name: 'Caio', color: signalColor('p2') }],
])

const POSSE: Record<string, string[]> = { p1: ['duda'], p2: ['caio'] }

/** Salão aberto de 20 x 20 casas de 50 px, sem parede: a Duda (p1) enxerga até 700 px. */
function salao(tokens: Token[], faceRangeCells?: number, measurementMode?: MeasurementMode): MapData {
  const base = createEmptyMap('m-salao', 'Salão', 20, 20, 50)
  return { ...base, tokens, faceRangeCells, measurementMode: measurementMode ?? base.measurementMode }
}

function recorte(map: MapData, posse: Record<string, string[]> = POSSE) {
  // `companions` é o 17º parâmetro (a lista cresceu com as junções).
  return filterMapForPlayer(map, 'p1', posse, 700, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, MARCAS)
}

function fichaNoRecorte(map: MapData, id: string, posse?: Record<string, string[]>): Token | undefined {
  return recorte(map, posse).map.tokens.find((t) => t.id === id)
}

/** A ficha do Caio com tudo que a identifica: nome de trabalho, foto, cor, ficha de personagem e frente. */
const caioEm = (x: number, y: number, extra: Partial<Token> = {}): Token =>
  ficha('caio', 'Ladino', x, y, { imageData: FOTO, color: VERMELHO, characterId: 'char-caio', rotation: 90, ...extra })

describe('filterMapForPlayer: vulto além de N casas', () => {
  it('sem a opção na cena, a ficha do Caio a 10 casas chega com nome, foto, cor e marca, como sempre', () => {
    const caio = fichaNoRecorte(salao([ficha('duda', 'Duda', 100, 100), caioEm(600, 100)]), 'caio')
    expect(caio?.name).toBe('Ladino')
    expect(caio?.imageData).toBe(FOTO)
    expect(caio?.color).toBe(VERMELHO)
    expect(caio?.companion).toEqual({ name: 'Caio', color: signalColor('p2') })
  })

  it('com 3 casas, o Caio a 4 casas chega como Vulto: sem nome, foto, cor, marca nem ficha de personagem', () => {
    const view = recorte(salao([ficha('duda', 'Duda', 100, 100), caioEm(300, 100)], 3))
    const caio = view.map.tokens.find((t) => t.id === 'caio')
    expect(caio?.name).toBe(VULTO_NAME)
    expect(caio?.image).toBeNull()
    expect(caio?.imageData).toBeNull()
    expect(caio?.color).toBe(VULTO_COLOR)
    expect(caio?.characterId).toBeNull()
    expect(caio !== undefined && 'companion' in caio).toBe(false)
  })

  it('o que o vulto esconde NÃO chega por lugar nenhum do recorte', () => {
    const texto = JSON.stringify(recorte(salao([ficha('duda', 'Duda', 100, 100), caioEm(300, 100)], 3)))
    expect(texto).toContain(VULTO_NAME)
    expect(texto).not.toContain('Ladino')
    expect(texto).not.toContain('Caio')
    expect(texto).not.toContain(signalColor('p2'))
    expect(texto).not.toContain(VERMELHO)
    expect(texto).not.toContain(FOTO)
    expect(texto).not.toContain('char-caio')
  })

  it('o vulto continua no lugar, do tamanho e virado para onde está: só o rosto some', () => {
    const caio = fichaNoRecorte(salao([ficha('duda', 'Duda', 100, 100), caioEm(300, 100, { size: 2 })], 3), 'caio')
    expect(caio).toMatchObject({ id: 'caio', x: 300, y: 100, size: 2, rotation: 90 })
  })

  it('com 3 casas, o Caio a 2 casas chega com o rosto: nome, foto, cor e marca', () => {
    const caio = fichaNoRecorte(salao([ficha('duda', 'Duda', 100, 100), caioEm(200, 100)], 3), 'caio')
    expect(caio?.name).toBe('Ladino')
    expect(caio?.imageData).toBe(FOTO)
    expect(caio?.color).toBe(VERMELHO)
    expect(caio?.companion).toEqual({ name: 'Caio', color: signalColor('p2') })
  })

  it('exatamente N casas ainda é perto: o rosto aparece', () => {
    const caio = fichaNoRecorte(salao([ficha('duda', 'Duda', 100, 100), caioEm(250, 100)], 3), 'caio')
    expect(caio?.name).toBe('Ladino')
  })

  it('NPC longe vira vulto: nem o nome de trabalho nem o "Nome para os jogadores" saem', () => {
    const madre = ficha('madre', 'Capataz traidor', 600, 100, { publicName: 'Madre Clara', npc: true, color: VERMELHO })
    const view = recorte(salao([ficha('duda', 'Duda', 100, 100), madre], 3))
    const npc = view.map.tokens.find((t) => t.id === 'madre')
    expect(npc?.name).toBe(VULTO_NAME)
    expect(npc !== undefined && 'npc' in npc).toBe(false)
    const texto = JSON.stringify(view)
    expect(texto).not.toContain('Madre Clara')
    expect(texto).not.toContain('Capataz traidor')
  })

  it('a ficha do próprio jogador nunca vira vulto, nem longe da outra ficha dele', () => {
    const posse = { ...POSSE, p1: ['duda', 'corvo'] }
    const corvo = fichaNoRecorte(salao([ficha('duda', 'Duda', 100, 100), ficha('corvo', 'Corvo', 600, 100, { color: VERMELHO })], 3), 'corvo', posse)
    expect(corvo?.name).toBe('Corvo')
    expect(corvo?.color).toBe(VERMELHO)
  })

  it('perto de QUALQUER ficha do jogador basta: o Caio longe da Duda mas colado no corvo dela mostra o rosto', () => {
    const posse = { ...POSSE, p1: ['duda', 'corvo'] }
    const map = salao([ficha('duda', 'Duda', 100, 100), ficha('corvo', 'Corvo', 600, 100), caioEm(650, 100)], 3)
    expect(fichaNoRecorte(map, 'caio', posse)?.name).toBe('Ladino')
  })

  it('a distância segue o modo de medição da cena: diagonal de 3 casas é perto no tabuleiro e longe em Manhattan', () => {
    const tokens = [ficha('duda', 'Duda', 100, 100), caioEm(250, 250)]
    expect(fichaNoRecorte(salao(tokens, 3, 'chessboard'), 'caio')?.name).toBe('Ladino')
    expect(fichaNoRecorte(salao(tokens, 3, 'manhattan'), 'caio')?.name).toBe(VULTO_NAME)
  })

  it('valor torto na opção (0, negativo, fração, NaN) não liga nada: a ficha sai como sempre', () => {
    for (const torto of [0, -2, 2.5, Number.NaN]) {
      const caio = fichaNoRecorte(salao([ficha('duda', 'Duda', 100, 100), caioEm(600, 100)], torto), 'caio')
      expect(caio?.name, `faceRangeCells: ${torto}`).toBe('Ladino')
    }
  })

  it('a ficha que a névoa esconde continua não saindo: vulto não traz ninguém de volta', () => {
    const view = recorte(salao([ficha('duda', 'Duda', 100, 100), caioEm(950, 950)], 3))
    expect(view.map.tokens.map((t) => t.id)).toEqual(['duda'])
  })
})
