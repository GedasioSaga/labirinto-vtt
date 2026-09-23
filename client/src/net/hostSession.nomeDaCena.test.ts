/**
 * O nome do mapa é o nome da CENA (a aventura cria cada cena com
 * `createEmptyMap(id, nomeDaCena, …)`), e nome de cena é do mestre: o jogador
 * descobre onde está pelo que vê. Achado do testador (22/09): depois de uma
 * viagem, o snapshot levava `"map":{"name":"Cripta Rubra"}`.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

function mesaCom(source: MapData | HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entrou = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, source)
  const welcome = entrou.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'heroi')
  return { s, playerId: welcome.playerId }
}

function textoPara(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

describe('o nome da cena nunca vai ao jogador', () => {
  it('mapa solto: o snapshot sai com o nome vazio', () => {
    const solto = mapa('m-solto', 'Cripta Rubra', [ficha('heroi', 100, 100)])
    const { s } = mesaCom(solto)
    const r = s.broadcast(solto)
    const msg = r.outbound[0]?.msg
    expect(msg?.type === 'snapshot' ? msg.map.name : null).toBe('')
    expect(textoPara(r, 'c1')).not.toContain('Cripta Rubra')
  })

  it('aventura: nem a cena aberta nem a de fundo, antes e depois do "Mandar para…"', () => {
    const salao = mapa('m-salao', 'Salao Norte', [ficha('heroi', 100, 100)])
    const cripta = mapa('m-cripta', 'Cripta Rubra', [])
    const mundo: HostWorld = { open: { sceneId: 's-a', name: 'Salao Norte', map: salao }, background: [{ sceneId: 's-b', name: 'Cripta Rubra', map: cripta }] }
    const { s, playerId } = mesaCom(mundo)
    expect(textoPara(s.broadcast(mundo), 'c1')).not.toContain('Salao Norte')

    const envio = s.sendPlayer(playerId, 's-b', null, mundo)
    // O mestre lê o nome no aviso dele; o jogador só recebe `scene.changed`.
    expect(envio.applyTransfer?.toSceneName).toBe('Cripta Rubra')
    expect(textoPara(envio, 'c1')).not.toContain('Cripta Rubra')

    const depois: HostWorld = {
      open: { sceneId: 's-a', name: 'Salao Norte', map: { ...salao, tokens: [] } },
      background: [{ sceneId: 's-b', name: 'Cripta Rubra', map: { ...cripta, tokens: [ficha('heroi', 750, 250)] } }],
    }
    const r = s.broadcast(depois)
    const msg = r.outbound[0]?.msg
    expect(msg?.type === 'snapshot' ? [msg.map.id, msg.map.name] : null).toEqual(['m-cripta', ''])
    expect(textoPara(r, 'c1')).not.toContain('Cripta Rubra')
  })
})

describe('sendPlayer (o mestre leva o jogador sem pedido)', () => {
  const salao = mapa('m-salao', 'Salao', [ficha('heroi', 100, 100), ficha('outra', 200, 100)])
  const escada: Pin = { id: 'escada', x: 700, y: 200, kind: 'viagem', description: 'Escada', image: null, destino: null }
  const cripta: MapData = { ...mapa('m-cripta', 'Cripta', []), pins: [escada] }
  const mundo: HostWorld = { open: { sceneId: 's-a', name: 'Salao', map: salao }, background: [{ sceneId: 's-b', name: 'Cripta', map: cripta }] }

  it('devolve a transferência da ficha dele e o scene.changed marcado do mestre', () => {
    const { s, playerId } = mesaCom(mundo)
    const r = s.sendPlayer(playerId, 's-b', 'escada', mundo)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed', by: 'master' } }])
    // Casa livre ao lado da escada (700, 200), não a casa dela: a cabeça do pino fica tocável.
    expect(r.applyTransfer).toEqual({ tokenId: 'heroi', playerId, playerName: 'Ana', fromSceneId: 's-a', toSceneId: 's-b', toSceneName: 'Cripta', x: 675, y: 225 })
  })

  it('recusa: cena que não existe, a própria cena, pino que não é de viagem da cena de destino, jogador desconhecido', () => {
    const { s, playerId } = mesaCom(mundo)
    expect(s.sendPlayer(playerId, 's-x', null, mundo)).toEqual({ outbound: [] })
    expect(s.sendPlayer(playerId, 's-a', null, mundo)).toEqual({ outbound: [] })
    expect(s.sendPlayer(playerId, 's-b', 'nao-existe', mundo)).toEqual({ outbound: [] })
    expect(s.sendPlayer('fantasma', 's-b', null, mundo)).toEqual({ outbound: [] })
  })

  it('jogador desconectado ainda é levado (a ficha muda), mas não há a quem mandar o aviso', () => {
    const { s, playerId } = mesaCom(mundo)
    s.disconnect('c1')
    const r = s.sendPlayer(playerId, 's-b', null, mundo)
    expect(r.outbound).toEqual([])
    expect(r.applyTransfer?.toSceneId).toBe('s-b')
  })
})
