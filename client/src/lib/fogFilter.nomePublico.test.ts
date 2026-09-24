/**
 * NOME PÚBLICO DA FICHA, lado do RECORTE. O mestre chama o NPC de "Capataz
 * traidor" para se organizar; a mesa não pode ler isso embaixo da ficha.
 * `Token.publicName`: ausente = "O mesmo" (mapa antigo), texto = "Outro",
 * `null` = "Nenhum". O dono da ficha sempre recebe o nome real, e o campo
 * `publicName` em si nunca viaja — nem para o dono.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const RAIO = 700

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
}

function mapaCom(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'Porto', 30, 10, 50), tokens }
}

/** Duda é dona de "arco"; o NPC está a 200 px dela, dentro da visão. */
const posse = { duda: ['arco'] }

function tokensDaDuda(tokens: Token[]): Token[] {
  return filterMapForPlayer(mapaCom(tokens), 'duda', posse, RAIO).map.tokens
}

describe('recorte: nome público da ficha', () => {
  it('"O mesmo" (ficha sem o campo, mapa antigo): o nome de trabalho chega como sempre', () => {
    const recebidas = tokensDaDuda([ficha('arco', 'Arco', 100), ficha('npc', 'Capataz traidor', 300)])
    expect(recebidas.map((t) => t.name).sort()).toEqual(['Arco', 'Capataz traidor'])
  })

  it('"Outro: Estivador": a Duda recebe "Estivador" e o nome de trabalho não sai em campo nenhum', () => {
    const recebidas = tokensDaDuda([ficha('arco', 'Arco', 100), ficha('npc', 'Capataz traidor', 300, { publicName: 'Estivador' })])
    expect(recebidas.find((t) => t.id === 'npc')?.name).toBe('Estivador')
    expect(JSON.stringify(recebidas)).not.toContain('traidor')
    expect(recebidas.every((t) => !('publicName' in t))).toBe(true)
  })

  it('"Nenhum": a ficha chega sem rótulo e sem o nome de trabalho', () => {
    const recebidas = tokensDaDuda([ficha('arco', 'Arco', 100), ficha('npc', 'Capataz traidor', 300, { publicName: null })])
    expect(recebidas.find((t) => t.id === 'npc')?.name).toBe('')
    expect(JSON.stringify(recebidas)).not.toContain('traidor')
  })

  it('a dona vê o nome real da própria ficha, e a máscara dela não viaja nem para ela', () => {
    const recebidas = tokensDaDuda([ficha('arco', 'Arco', 100, { publicName: 'Mascarado' }), ficha('npc', 'Capataz traidor', 300)])
    expect(recebidas.find((t) => t.id === 'arco')?.name).toBe('Arco')
    expect(JSON.stringify(recebidas)).not.toContain('Mascarado')
  })

  it('os outros jogadores veem a máscara da ficha da Duda', () => {
    const tokens = [ficha('arco', 'Arco', 100, { publicName: 'Mascarado' }), ficha('lanca', 'Lança', 300)]
    const doBruno = filterMapForPlayer(mapaCom(tokens), 'bruno', { duda: ['arco'], bruno: ['lanca'] }, RAIO).map.tokens
    expect(doBruno.find((t) => t.id === 'arco')?.name).toBe('Mascarado')
    expect(JSON.stringify(doBruno)).not.toContain('"Arco"')
  })

  it('o mapa do mestre não é tocado pelo recorte', () => {
    const npc = ficha('npc', 'Capataz traidor', 300, { publicName: 'Estivador' })
    const mapa = mapaCom([ficha('arco', 'Arco', 100), npc])
    filterMapForPlayer(mapa, 'duda', posse, RAIO)
    expect(mapa.tokens[1]).toEqual(npc)
  })
})
