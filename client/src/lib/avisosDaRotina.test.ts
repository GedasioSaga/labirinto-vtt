/**
 * AVISO AO MESTRE, puro (caminhos, F0): de onde sai o aviso (falha do trecho
 * ou desistência), a porta dita para gente, um por NPC e porta, e o teto.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Region, Token, Wall } from '../types/map'
import { novoAndarilho } from './caminhamento/andarilho'
import type { ResultadoDoCaminho } from './caminhamento/busca'
import { avisosDePortaTrancada, type EstadoQueAvisa, mesmosAvisos, portasQueParam, rotuloDaPorta, TETO_DE_AVISOS, textoDoAviso } from './avisosDaRotina'
import { createEmptyMap } from './mapFactory'

const AQUI = { x: 100, y: 100 }

function porta(id: string, locked: boolean, extra: Partial<Wall> = {}): Wall {
  return { id, x1: 200, y1: 50, x2: 200, y2: 150, blocksLight: true, blocksMove: true, door: { open: false, locked, kind: 'normal' }, ...extra }
}

function npc(id: string, name: string): Token {
  return { id, characterId: null, name, x: AQUI.x, y: AQUI.y, size: 1, image: null, npc: true }
}

function sala(id: string, nome: string): Region {
  return {
    id,
    points: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ],
    tag: '',
    fillColor: '#000000',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
  }
}

function mapa(walls: Wall[], tokens: Token[], regions: Region[] = []): MapData {
  return { ...createEmptyMap('m', 'Mapa', 30, 20, 50), walls, tokens, regions }
}

/** O trecho que acabou de voltar sem caminho por `portas` trancadas (1ª falha, ainda vai tentar). */
function trechoBarrado(portas: string[]): EstadoQueAvisa {
  const ultimaFalha: Extract<ResultadoDoCaminho, { tipo: 'sem-caminho' }> = { tipo: 'sem-caminho', motivo: 'porta-trancada', portas, fichas: [] }
  return { andarilho: { ...novoAndarilho({ x: 300, y: 100 }, AQUI), falhas: 1, ultimaFalha } }
}

describe('portasQueParam', () => {
  it('a 1ª falha por porta trancada já avisa, sem esperar a desistência', () => {
    expect(portasQueParam(trechoBarrado(['porta']))).toEqual(['porta'])
  })

  it('trecho que achou caminho (falhas zeradas) não segura a falha velha', () => {
    const achou = trechoBarrado(['porta'])
    expect(portasQueParam({ andarilho: achou.andarilho === undefined ? undefined : { ...achou.andarilho, falhas: 0 } })).toEqual([])
  })

  it('desistência por porta trancada avisa; por ficha no caminho, não', () => {
    const base = { fichas: [], x: 300, y: 100, desde: 0 }
    expect(portasQueParam({ aviso: { motivo: 'porta-trancada', portas: ['a', 'b'], ...base } })).toEqual(['a', 'b'])
    expect(portasQueParam({ aviso: { motivo: 'ocupado', portas: [], ...base, fichas: ['heroi'] } })).toEqual([])
  })

  it('a mesma porta na falha e na desistência vale uma vez', () => {
    const barrado = trechoBarrado(['porta'])
    expect(portasQueParam({ ...barrado, aviso: { motivo: 'porta-trancada', portas: ['porta'], fichas: [], x: 300, y: 100, desde: 0 } })).toEqual(['porta'])
  })
})

describe('rotuloDaPorta', () => {
  it('pelo tipo e pela sala: a da borda, senão a que tem o meio da porta dentro', () => {
    const daBorda = porta('p', true, { regionId: 'r1' })
    expect(rotuloDaPorta(mapa([daBorda], [], [sala('r1', 'Cozinha')]), daBorda)).toBe('Porta da sala Cozinha')
    const solta = porta('p', true)
    expect(rotuloDaPorta(mapa([solta], [], [sala('r2', 'Salão')]), solta)).toBe('Porta da sala Salão')
    const grade: Wall = { ...solta, door: { open: false, locked: true, kind: 'gate' } }
    expect(rotuloDaPorta(mapa([grade], []), grade)).toBe('Grade')
  })

  it('a frase da tela', () => {
    expect(textoDoAviso({ porta: 'Porta dupla', npc: 'Guarda' })).toBe('Porta dupla trancada: Guarda parou')
  })
})

describe('avisosDePortaTrancada', () => {
  it('um por NPC e porta, só se a porta segue trancada no mapa da ficha', () => {
    const m = mapa([porta('a', true), { ...porta('b', false), y1: 300, y2: 400 }], [npc('t', 'Tobias'), npc('s', '  ')])
    const andando = new Map<string, EstadoQueAvisa>([
      ['t', trechoBarrado(['a', 'b'])],
      ['s', trechoBarrado(['a'])],
      ['fora', trechoBarrado(['a'])],
    ])
    expect(avisosDePortaTrancada('rotina', andando, () => m)).toEqual([
      { chave: 'rotina:t:a', origem: 'rotina', motivo: 'porta-trancada', tokenId: 't', portaId: 'a', npc: 'Tobias', porta: 'Porta' },
      { chave: 'rotina:s:a', origem: 'rotina', motivo: 'porta-trancada', tokenId: 's', portaId: 'a', npc: 'NPC sem nome', porta: 'Porta' },
    ])
  })

  it(`teto: 40 NPCs presos dão ${TETO_DE_AVISOS} avisos`, () => {
    const tokens = Array.from({ length: 40 }, (_, i) => npc(`n${i}`, `NPC ${i}`))
    const m = mapa([porta('a', true)], tokens)
    const andando = new Map(tokens.map((t) => [t.id, trechoBarrado(['a'])] as const))
    expect(avisosDePortaTrancada('patrulha', andando, () => m)).toHaveLength(TETO_DE_AVISOS)
  })

  it('mesmosAvisos compara chave e texto, na ordem', () => {
    const m = mapa([porta('a', true)], [npc('t', 'Tobias')])
    const um = avisosDePortaTrancada('rotina', new Map([['t', trechoBarrado(['a'])]]), () => m)
    const outro = avisosDePortaTrancada('rotina', new Map([['t', trechoBarrado(['a'])]]), () => m)
    expect(mesmosAvisos(um, outro)).toBe(true)
    expect(mesmosAvisos(um, [])).toBe(false)
    const renomeado = avisosDePortaTrancada('rotina', new Map([['t', trechoBarrado(['a'])]]), () => ({ ...m, tokens: [npc('t', 'Irmão Tobias')] }))
    expect(mesmosAvisos(um, renomeado)).toBe(false)
  })
})
