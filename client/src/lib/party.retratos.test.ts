/**
 * ONDE ESTÁ O GRUPO (lista de cenas, ideia 2): cada jogador na linha da cena
 * vira um retrato — a foto embutida da ficha, ou a inicial na cor dele — com
 * os nomes ao lado; na pasta recolhida, "lá dentro".
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { HostWorld } from '../net/hostSession'
import type { Token } from '../types/map'
import { peopleByScene, type PartyMember } from './party'
import { letraClara, nomesDaLinha } from '../components/RetratosDaCena'

const FOTO = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4IAYAAAAwAQCdASo='

function ficha(id: string, extra: Partial<Token>): Token {
  return { id, characterId: null, name: id, x: 100, y: 100, size: 1, image: null, ...extra }
}

const MUNDO: HostWorld = {
  open: {
    sceneId: 's-praca',
    name: 'Praça',
    map: {
      ...createEmptyMap('m-praca', 'Praça', 10, 10, 50),
      tokens: [ficha('t-bira', { imageData: FOTO }), ficha('t-lia', { image: 'C:/disco/do/mestre/lia.png' })],
    },
  },
  background: [{ sceneId: 's-sotao', name: 'Sótão', map: createEmptyMap('m-sotao', 'Sótão', 10, 10, 50) }],
}

function membro(playerId: string, sceneId: string): PartyMember {
  return { playerId, name: playerId, connected: true, sceneId, sceneName: null, token: { id: `t-${playerId}`, color: '#79a9cc', x: 100, y: 100 }, travelPending: false, mochila: [] }
}

describe('retratos da lista de cenas', () => {
  it('a foto vem da cópia embutida da ficha; caminho de disco e ficha sem foto ficam com a inicial', () => {
    const porCena = peopleByScene([membro('bira', 's-praca'), membro('lia', 's-praca'), membro('nanda', 's-sotao')], MUNDO)
    const praca = porCena.get('s-praca')?.people ?? []
    expect(praca.map((p) => [p.playerId, p.photo])).toEqual([
      ['bira', FOTO],
      ['lia', undefined],
    ])
    expect(porCena.get('s-sotao')?.people[0]?.photo).toBeUndefined()
    // Sem o mundo (sala sem mapas servidos), nenhuma foto: o jeito de antes.
    expect(peopleByScene([membro('bira', 's-praca')]).get('s-praca')?.people[0]?.photo).toBeUndefined()
  })

  it('os nomes ao lado dizem "lá dentro" só quando todos estão nas cenas de dentro; a letra clareia na cor escura', () => {
    expect(nomesDaLinha([])).toBe('')
    expect(nomesDaLinha([{ playerId: 'b', name: 'Bira', color: '#d98b5f' }, { playerId: 'l', name: 'Lia', color: '#79a9cc' }])).toBe('Bira, Lia')
    expect(nomesDaLinha([{ playerId: 'n', name: 'Nanda', color: '#ab93d6', where: 'Casa da Ferreira' }])).toBe('Nanda, lá dentro')
    expect(nomesDaLinha([{ playerId: 'b', name: 'Bira', color: '#d98b5f' }, { playerId: 'n', name: 'Nanda', color: '#ab93d6', where: 'Sótão' }])).toBe('Bira, Nanda')
    expect(letraClara('#1b2a4a')).toBe(true)
    expect(letraClara('#3cff00')).toBe(false)
    expect(letraClara('lixo')).toBe(false)
  })
})
