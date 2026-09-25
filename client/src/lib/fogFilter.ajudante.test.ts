/**
 * AJUDANTE CONTRATADO, lado do RECORTE: a ficha emprestada chega ao jogador
 * que a segura com o acordo (`contrato`), com o nome PÚBLICO do NPC e — salvo
 * quando o mestre marcou "vê com os olhos dele" — sem gerar visão, sem abrir
 * cartão de Sala. Quem não segura a ficha nunca lê o acordo, e `contrato`
 * gravado no mapa do mestre nunca atravessa.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Region, Token, TokenContract } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const RAIO = 300
const ACORDO: TokenContract = { tarefa: 'levar o recado ao Bartô', ate: 1_800_000, visao: false }

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
}

/** Duda (arco, x=100) e o Tiziu longe dela (x=1300), com um vigia ao lado dele que só os olhos do Tiziu alcançam. */
function porto(extraTiziu: Partial<Token> = {}, regions: Region[] = []): MapData {
  return {
    ...createEmptyMap('m-porto', 'Porto', 30, 10, 50),
    tokens: [
      ficha('arco', 'Arco', 100),
      ficha('tiziu', 'Tiziu espião', 1300, { publicName: 'Menino', npc: true, ...extraTiziu }),
      ficha('vigia', 'Vigia', 1420),
    ],
    regions,
  }
}

const POSSE = { duda: ['arco', 'tiziu'], bruno: [] as string[] }
const EMPRESTIMOS = new Map([['tiziu', ACORDO]])

function tokenDe(view: ReturnType<typeof filterMapForPlayer>, id: string): Token | undefined {
  return view.map.tokens.find((t) => t.id === id)
}

describe('recorte do ajudante contratado', () => {
  it('sem "vê com os olhos dele": só a ficha da própria Duda gera visão e o vigia ao lado do Tiziu não chega', () => {
    const view = filterMapForPlayer(porto(), 'duda', POSSE, RAIO, undefined, undefined, undefined, undefined, EMPRESTIMOS)
    expect(view.vision).toHaveLength(1)
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['arco', 'tiziu'])
    expect(tokenDe(view, 'vigia')).toBeUndefined()
  })

  it('com "vê com os olhos dele": o Tiziu enxerga e o vigia chega', () => {
    const comOlhos = new Map([['tiziu', { ...ACORDO, visao: true }]])
    const view = filterMapForPlayer(porto(), 'duda', POSSE, RAIO, undefined, undefined, undefined, undefined, comOlhos)
    expect(view.vision).toHaveLength(2)
    expect(tokenDe(view, 'vigia')?.name).toBe('Vigia')
  })

  it('a Duda recebe o acordo e o nome público do NPC, nunca o de trabalho', () => {
    const view = filterMapForPlayer(porto(), 'duda', POSSE, RAIO, undefined, undefined, undefined, undefined, EMPRESTIMOS)
    const tiziu = tokenDe(view, 'tiziu')
    expect(tiziu?.contrato).toEqual(ACORDO)
    expect(tiziu?.name).toBe('Menino')
    expect(JSON.stringify(view.map)).not.toContain('espião')
  })

  it('a ficha própria da Duda sai sem contrato e com o nome real', () => {
    const view = filterMapForPlayer(porto(), 'duda', POSSE, RAIO, undefined, undefined, undefined, undefined, EMPRESTIMOS)
    const arco = tokenDe(view, 'arco')
    expect(arco?.name).toBe('Arco')
    expect(arco !== undefined && 'contrato' in arco).toBe(false)
  })

  it('quem vê o Tiziu sem segurá-lo não lê o acordo', () => {
    const map = porto()
    const bruno = { ...POSSE, bruno: ['machado'] }
    const comMachado: MapData = { ...map, tokens: [...map.tokens, ficha('machado', 'Machado', 1250)] }
    const view = filterMapForPlayer(comMachado, 'bruno', bruno, RAIO, undefined, undefined, undefined, undefined, EMPRESTIMOS)
    const tiziu = tokenDe(view, 'tiziu')
    expect(tiziu?.name).toBe('Menino')
    expect(tiziu !== undefined && 'contrato' in tiziu).toBe(false)
    expect(JSON.stringify(view.map)).not.toContain('Bartô')
  })

  it('contrato gravado no mapa do mestre nunca atravessa, nem para quem segura a ficha', () => {
    const torto: TokenContract = { tarefa: 'SEGREDO-DO-ARQUIVO', ate: null, visao: true }
    const view = filterMapForPlayer(porto({ contrato: torto }), 'duda', POSSE, RAIO)
    const tiziu = tokenDe(view, 'tiziu')
    expect(tiziu?.name).toBe('Tiziu espião')
    expect(tiziu !== undefined && 'contrato' in tiziu).toBe(false)
    expect(JSON.stringify(view.map)).not.toContain('SEGREDO-DO-ARQUIVO')
  })

  it('ajudante sem olhos dentro de uma Sala com texto não abre o cartão dela', () => {
    const cais: Region = {
      id: 'cais',
      points: [
        { x: 1200, y: 0 },
        { x: 1450, y: 0 },
        { x: 1450, y: 250 },
        { x: 1200, y: 250 },
      ],
      tag: '',
      fillColor: '#3a7ad0',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'Cais', textoAoEntrar: 'Um barco sem remos.' },
    }
    const semOlhos = filterMapForPlayer(porto({}, [cais]), 'duda', POSSE, RAIO, undefined, undefined, undefined, undefined, EMPRESTIMOS)
    expect(semOlhos.occupiedRooms).toEqual([])
    const comOlhos = new Map([['tiziu', { ...ACORDO, visao: true }]])
    const vendo = filterMapForPlayer(porto({}, [cais]), 'duda', POSSE, RAIO, undefined, undefined, undefined, undefined, comOlhos)
    expect(vendo.occupiedRooms).toEqual(['cais'])
  })
})
