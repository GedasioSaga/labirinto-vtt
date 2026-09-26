import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { followDecision, shouldRecenter } from './follow'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { Token } from '../types/map'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, color: '#3cff00' }
}

function mundo(salao: Token[], cripta: Token[]): HostWorld {
  return {
    open: { sceneId: 's-a', name: 'Salao', map: { ...createEmptyMap('m-a', 'Salao', 30, 10, 50), tokens: salao } },
    background: [{ sceneId: 's-b', name: 'Cripta', map: { ...createEmptyMap('m-b', 'Cripta', 30, 10, 50), tokens: cripta } }],
  }
}

function ana(over: Partial<PlayerInfo> = {}): PlayerInfo {
  return { clientId: 'c', playerId: 'ana', name: 'Ana', status: 'playing', connected: true, tokenIds: ['lanterna'], visionRadius: 700, visionFactor: 1, sceneId: 's-a', ...over }
}

describe('followDecision', () => {
  it('acha a ficha na cena em que a sessão vê o jogador', () => {
    expect(followDecision('ana', [ana()], mundo([ficha('lanterna', 120, 80)], []))).toEqual({ kind: 'target', target: { sceneId: 's-a', x: 120, y: 80 } })
  })

  it('na viagem a ponte ainda diz a cena velha, mas a ficha já está na nova: segue a ficha', () => {
    expect(followDecision('ana', [ana({ sceneId: 's-a' })], mundo([], [ficha('lanterna', 550, 450)]))).toEqual({
      kind: 'target',
      target: { sceneId: 's-b', x: 550, y: 450 },
    })
  })

  it('com a ficha em duas cenas, vale a da cena do jogador', () => {
    const decisao = followDecision('ana', [ana({ sceneId: 's-b' })], mundo([ficha('lanterna', 1, 1)], [ficha('lanterna', 2, 2)]))
    expect(decisao).toEqual({ kind: 'target', target: { sceneId: 's-b', x: 2, y: 2 } })
  })

  it('PISOS: a ficha no 1º piso leva o piso junto (o editor vai a ele); no térreo, sem o campo', () => {
    expect(followDecision('ana', [ana()], mundo([{ ...ficha('lanterna', 120, 80), piso: 1 }], []))).toEqual({
      kind: 'target',
      target: { sceneId: 's-a', x: 120, y: 80, piso: 1 },
    })
    const terreo = followDecision('ana', [ana()], mundo([ficha('lanterna', 120, 80)], []))
    expect(terreo.kind === 'target' && 'piso' in terreo.target).toBe(false)
  })

  it('ficha em trânsito (sumiu de toda cena) espera, sem desligar', () => {
    expect(followDecision('ana', [ana()], mundo([], []))).toEqual({ kind: 'wait' })
  })

  it('desliga quando o jogador sai, cai, volta a esperar ou fica sem ficha', () => {
    const cheio = mundo([ficha('lanterna', 1, 1)], [])
    expect(followDecision('ana', [], cheio).kind).toBe('stop')
    expect(followDecision('ana', [ana({ connected: false })], cheio).kind).toBe('stop')
    expect(followDecision('ana', [ana({ status: 'waiting' })], cheio).kind).toBe('stop')
    expect(followDecision('ana', [ana({ tokenIds: [] })], cheio).kind).toBe('stop')
  })
})

describe('shouldRecenter', () => {
  const aqui = { sceneId: 's-a', x: 100, y: 100 }

  it('acabou de ligar: centra já', () => {
    expect(shouldRecenter(null, aqui)).toBe(true)
  })

  it('a ficha não andou: não puxa a câmera', () => {
    expect(shouldRecenter(aqui, { ...aqui })).toBe(false)
  })

  it('a ficha andou ou trocou de cena: centra de novo', () => {
    expect(shouldRecenter(aqui, { ...aqui, x: 150 })).toBe(true)
    expect(shouldRecenter(aqui, { ...aqui, y: 150 })).toBe(true)
    expect(shouldRecenter(aqui, { ...aqui, sceneId: 's-b' })).toBe(true)
  })

  it('PISOS: subir a escada (mesmo ponto, outro piso) centra de novo — senão o editor ficava no piso de baixo', () => {
    expect(shouldRecenter(aqui, { ...aqui, piso: 1 })).toBe(true)
    expect(shouldRecenter({ ...aqui, piso: 1 }, aqui)).toBe(true)
    // Térreo sem o campo e térreo com 0 são o mesmo lugar.
    expect(shouldRecenter(aqui, { ...aqui, piso: 0 })).toBe(false)
  })
})
