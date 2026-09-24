/**
 * MINHAS FICHAS EM OUTRAS CENAS — o jogador com fichas em mais de uma cena vê
 * todas no painel e escolhe por qual olha. O host manda, no snapshot, só as
 * fichas DELE que estão em outra cena, cada uma com o nome e a Sala onde ela
 * está (o nome que o recorte daquela cena mostraria, '' quando não mostra).
 * Nunca o nome nem o id da cena, nunca a posição, nunca ficha de outro jogador,
 * nunca ficha que o mestre escondeu. `view.switch` troca a cena vista.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, RoomMeta, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import { parsePlayerMessage, type HostMessage } from './protocol'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function sala(id: string, x: number, y: number, w: number, h: number, room: Partial<RoomMeta> = {}, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    tag: '',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Sala', ...room },
    ...extra,
  }
}

function mapa(id: string, nome: string, tokens: Token[], regions: Region[] = []): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens, regions }
}

/**
 * Ana tem 'heroi' no Salão (cena aberta) e 'batedor' dentro do Poço na Cripta
 * (fundo). Na Cripta também está 'rival', de Bruno, e o Tesouro (sala secreta)
 * ao lado. Na Torre, 'sombra' é de Ana, mas o mestre a escondeu.
 */
function mundoPadrao(): HostWorld {
  const salao = mapa('m-salao', 'Salao Norte', [ficha('heroi', 100, 100)])
  const cripta = mapa(
    'm-cripta',
    'Cripta Rubra',
    [ficha('batedor', 250, 250), ficha('rival', 900, 250)],
    [sala('poco', 100, 100, 300, 300, { name: 'Poço de corda' }), sala('tesouro', 1100, 100, 200, 200, { name: 'Tesouro Proibido' }, { secret: true })],
  )
  const torre = mapa('m-torre', 'Torre Alta', [ficha('sombra', 100, 100, { hidden: true })])
  return {
    open: { sceneId: 's-a', name: 'Salao Norte', map: salao },
    background: [
      { sceneId: 's-b', name: 'Cripta Rubra', map: cripta },
      { sceneId: 's-c', name: 'Torre Alta', map: torre },
    ],
  }
}

function mesa(mundo: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string): string => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return welcome.playerId
  }
  const ana = entra('c1', 'Ana')
  const bruno = entra('c2', 'Bruno')
  s.assignToken(ana, 'heroi')
  s.assignToken(ana, 'batedor')
  s.assignToken(ana, 'sombra')
  s.assignToken(bruno, 'rival')
  return { s, ana, bruno }
}

type Snapshot = Extract<HostMessage, { type: 'snapshot' }>

function snapshotPara(r: HostResult, clientId: string): Snapshot | null {
  for (const o of r.outbound) {
    if (o.clientId === clientId && o.msg.type === 'snapshot') return o.msg
  }
  return null
}

function textoPara(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

describe('o snapshot lista as minhas fichas em outras cenas', () => {
  it('a ficha da Cripta vem com nome e Sala, sem cena, sem posição, sem ficha alheia nem escondida', () => {
    const mundo = mundoPadrao()
    const { s } = mesa(mundo)
    const r = s.broadcast(mundo)
    const snap = snapshotPara(r, 'c1')
    expect(snap?.map.id).toBe('m-salao')
    expect(snap?.elsewhere).toEqual([{ tokenId: 'batedor', name: 'ficha-batedor', room: 'Poço de corda' }])
    const texto = textoPara(r, 'c1')
    // Nome e id da cena, ficha de outro jogador, sala secreta e ficha escondida: nada disso chega.
    for (const proibido of ['Cripta Rubra', 'm-cripta', 's-b', 'Torre Alta', 'm-torre', 's-c', 'rival', 'Tesouro Proibido', 'sombra']) {
      expect(texto).not.toContain(proibido)
    }
  })

  it('Bruno, com ficha numa cena só, não recebe lista nenhuma', () => {
    const mundo = mundoPadrao()
    const { s } = mesa(mundo)
    const snap = snapshotPara(s.broadcast(mundo), 'c2')
    expect(snap?.map.id).toBe('m-cripta')
    expect(snap).not.toBeNull()
    expect(snap?.elsewhere).toBeUndefined()
  })

  it('Sala com nome escondido do jogador, ou ficha dentro de sala secreta: a Sala vem vazia', () => {
    const base = mundoPadrao()
    const [cripta, torre] = base.background
    if (cripta === undefined || torre === undefined) throw new Error('mundo sem cenas de fundo')
    const escondido: HostWorld = {
      ...base,
      background: [
        { ...cripta, map: { ...cripta.map, regions: [sala('poco', 100, 100, 300, 300, { name: 'Poço de corda', nameHiddenFromPlayers: true })] } },
        { ...torre, map: { ...torre.map, tokens: [ficha('sombra', 150, 150)], regions: [sala('cofre', 100, 100, 200, 200, { name: 'Cofre Secreto' }, { secret: true })] } },
      ],
    }
    const { s } = mesa(escondido)
    const r = s.broadcast(escondido)
    expect(snapshotPara(r, 'c1')?.elsewhere).toEqual([
      { tokenId: 'batedor', name: 'ficha-batedor', room: '' },
      { tokenId: 'sombra', name: 'ficha-sombra', room: '' },
    ])
    const texto = textoPara(r, 'c1')
    expect(texto).not.toContain('Poço de corda')
    expect(texto).not.toContain('Cofre Secreto')
  })

  it('mapa solto: sem aventura, sem lista', () => {
    const solto = mapa('m-solto', 'Casa', [ficha('heroi', 100, 100)])
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const welcome = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, solto).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, 'heroi')
    const snap = snapshotPara(s.broadcast(solto), 'c1')
    expect(snap?.map.id).toBe('m-solto')
    expect(snap?.elsewhere).toBeUndefined()
  })
})

describe('view.switch: olhar por outra ficha minha', () => {
  it('troca a cena vista para a da ficha, com rev novo, e a lista passa a mostrar a outra', () => {
    const mundo = mundoPadrao()
    const { s } = mesa(mundo)
    const antes = snapshotPara(s.broadcast(mundo), 'c1')
    const r = s.handleMessage('c1', { type: 'view.switch', tokenId: 'batedor' }, mundo)
    const snap = snapshotPara(r, 'c1')
    expect(snap?.map.id).toBe('m-cripta')
    expect(snap?.rev).toBeGreaterThan(antes?.rev ?? Number.POSITIVE_INFINITY)
    expect(snap?.ownTokens).toEqual(['batedor'])
    expect(snap?.elsewhere).toEqual([{ tokenId: 'heroi', name: 'ficha-heroi', room: '' }])
    // Só quem trocou recebe algo.
    expect(r.outbound.every((o) => o.clientId === 'c1')).toBe(true)
    expect(textoPara(r, 'c1')).not.toContain('Cripta Rubra')
    // A troca fica: o broadcast seguinte continua na Cripta, e mover o batedor vale lá.
    expect(snapshotPara(s.broadcast(mundo), 'c1')?.map.id).toBe('m-cripta')
    const mov = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'batedor', x: 300, y: 250 }, mundo)
    expect(mov.applyMove).toEqual({ tokenId: 'batedor', x: 300, y: 250, sceneId: 's-b' })
  })

  it('ficha de outro jogador, escondida pelo mestre, inexistente ou da própria cena: nada sai e a cena não muda', () => {
    const mundo = mundoPadrao()
    const { s } = mesa(mundo)
    s.broadcast(mundo)
    for (const tokenId of ['rival', 'sombra', 'nao-existe', 'heroi']) {
      expect(s.handleMessage('c1', { type: 'view.switch', tokenId }, mundo)).toEqual({ outbound: [] })
    }
    expect(snapshotPara(s.broadcast(mundo), 'c1')?.map.id).toBe('m-salao')
  })

  it('quem ainda não entrou recebe not_joined', () => {
    const mundo = mundoPadrao()
    const { s } = mesa(mundo)
    const r = s.handleMessage('c9', { type: 'view.switch', tokenId: 'batedor' }, mundo)
    expect(r.outbound).toEqual([{ clientId: 'c9', msg: { type: 'error', reason: 'not_joined' } }])
  })
})

describe('parsePlayerMessage view.switch', () => {
  it('aceita só o id da ficha, em texto curto', () => {
    expect(parsePlayerMessage({ type: 'view.switch', tokenId: 'batedor', sceneId: 's-b' })).toEqual({ type: 'view.switch', tokenId: 'batedor' })
    expect(parsePlayerMessage({ type: 'view.switch', tokenId: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'view.switch', tokenId: 7 })).toBeNull()
    expect(parsePlayerMessage({ type: 'view.switch', tokenId: 'x'.repeat(65) })).toBeNull()
  })
})
