/**
 * VULTO NO ESCURO, lado do RECORTE. Na rodada 10 a ficha disfarçada de outra
 * jogadora aparecia com o rótulo a 700 px, no escuro, e o nome entregava quem
 * era. Ficha de OUTRO JOGADOR vista de longe (além da metade do raio de visão
 * de quem olha) e fora de toda luz chega como vulto: sem nome, sem cor e sem
 * foto. Perto, ou dentro de uma luz, chega inteira. NPC não muda.
 */
import { describe, expect, it } from 'vitest'
import type { Light, MapData, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const RAIO = 700
const FOTO = 'data:image/png;base64,AAAA'

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
}

function luz(id: string, x: number, radius: number): Light {
  return { id, x, y: 100, radius, color: '#ffcc66', intensity: 1 }
}

function mapaCom(tokens: Token[], lights: Light[] = []): MapData {
  return { ...createEmptyMap('m', 'Porto', 30, 10, 50), tokens, lights }
}

/** Neve é dona de "neve"; Fabi é dona de "fabi", disfarçada de "Contínua do 9". */
const posse = { neve: ['neve'], fabi: ['fabi'] }
const disfarce = { color: '#aa3322', imageData: FOTO }

function fichasDaNeve(tokens: Token[], lights: Light[] = []): Token[] {
  return filterMapForPlayer(mapaCom(tokens, lights), 'neve', posse, RAIO).map.tokens
}

describe('recorte: ficha de outro jogador vista de longe no escuro', () => {
  it('a 600 px (além da metade do raio) e sem luz: chega a ficha, mas sem nome, sem cor e sem foto', () => {
    const recebidas = fichasDaNeve([ficha('neve', 'Neve', 100), ficha('fabi', 'Contínua do 9', 700, disfarce)])
    const fabi = recebidas.find((t) => t.id === 'fabi')
    expect(fabi).toBeDefined()
    expect(fabi?.name).toBe('')
    expect(fabi?.color ?? null).toBeNull()
    expect(fabi?.imageData ?? null).toBeNull()
    expect(fabi?.x).toBe(700)
    const json = JSON.stringify(recebidas)
    expect(json).not.toContain('Contínua')
    expect(json).not.toContain('#aa3322')
    expect(json).not.toContain(FOTO)
  })

  it('perto (200 px): o rótulo, a cor e a foto chegam como sempre', () => {
    const recebidas = fichasDaNeve([ficha('neve', 'Neve', 100), ficha('fabi', 'Contínua do 9', 300, disfarce)])
    const fabi = recebidas.find((t) => t.id === 'fabi')
    expect(fabi?.name).toBe('Contínua do 9')
    expect(fabi?.color).toBe('#aa3322')
    expect(fabi?.imageData).toBe(FOTO)
  })

  it('longe mas dentro de uma luz (a tocha dela): o nome aparece', () => {
    const recebidas = fichasDaNeve([ficha('neve', 'Neve', 100), ficha('fabi', 'Contínua do 9', 700, disfarce)], [luz('tocha', 700, 150)])
    expect(recebidas.find((t) => t.id === 'fabi')?.name).toBe('Contínua do 9')
  })

  it('longe e com uma luz que não a alcança: continua vulto', () => {
    const recebidas = fichasDaNeve([ficha('neve', 'Neve', 100), ficha('fabi', 'Contínua do 9', 700, disfarce)], [luz('tocha', 300, 150)])
    expect(recebidas.find((t) => t.id === 'fabi')?.name).toBe('')
  })

  it('a própria ficha da Neve nunca vira vulto, e NPC longe continua com o nome', () => {
    const recebidas = fichasDaNeve([ficha('neve', 'Neve', 100), ficha('npc', 'Estivador', 700)])
    expect(recebidas.find((t) => t.id === 'neve')?.name).toBe('Neve')
    expect(recebidas.find((t) => t.id === 'npc')?.name).toBe('Estivador')
  })

  it('o mapa do mestre não é tocado pelo recorte', () => {
    const fabi = ficha('fabi', 'Contínua do 9', 700, disfarce)
    const mapa = mapaCom([ficha('neve', 'Neve', 100), fabi])
    filterMapForPlayer(mapa, 'neve', posse, RAIO)
    expect(mapa.tokens[1]).toEqual(fabi)
  })
})
