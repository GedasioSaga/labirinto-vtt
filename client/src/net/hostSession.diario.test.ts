/**
 * DIÁRIO DE VIAGENS (G15), lado da sessão: o "Desfazer" devolve a ficha à
 * cena e à CASA de onde ela saiu (`returnPlayer`). O jogador só recebe o
 * `scene.changed` do mestre — nada do diário, nenhum nome de cena, e ninguém
 * mais recebe nada.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

const ficha = (id: string, name: string, x: number, y: number): Token => ({ id, characterId: null, name, x, y, size: 1, image: null })
const mapa = (id: string, tokens: Token[]): MapData => ({ ...createEmptyMap(id, id, 30, 10, 50), tokens })

/** Ana foi à Cripta (a ficha dela já está lá); Bruno ficou no Salão. */
const depoisDaIda: HostWorld = {
  open: { sceneId: 's-a', name: 'Salao Norte', map: mapa('m-salao', [ficha('t-bruno', 'Bruno', 820, 300)]) },
  background: [{ sceneId: 's-b', name: 'Cripta Rubra', map: mapa('m-cripta', [ficha('t-ana', 'Ana', 1025, 275)]) }],
}

function mesa() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string, tokenId: string): string => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, depoisDaIda).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
    return welcome.playerId
  }
  const ana = entra('c1', 'Ana', 't-ana')
  const bruno = entra('c2', 'Bruno', 't-bruno')
  return { s, ana, bruno }
}

const texto = (r: HostResult): string => JSON.stringify(r.outbound)

describe('returnPlayer ("Desfazer" do diário)', () => {
  it('devolve a ficha à cena de origem, na casa de onde saiu, com o aviso do mestre só para a dona', () => {
    const { s, ana } = mesa()
    const r = s.returnPlayer(ana, 't-ana', { sceneId: 's-a', x: 700, y: 300 }, depoisDaIda)
    expect(r.applyTransfer).toEqual({ tokenId: 't-ana', playerId: ana, playerName: 'Ana', fromSceneId: 's-b', toSceneId: 's-a', toSceneName: 'Salao Norte', x: 700, y: 300 })
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed', by: 'master' } }])
  })

  it('nada do diário nem nome de cena vai pelo fio', () => {
    const { s, ana } = mesa()
    const r = s.returnPlayer(ana, 't-ana', { sceneId: 's-a', x: 700, y: 300 }, depoisDaIda)
    expect(texto(r)).not.toMatch(/Di[aá]rio/i)
    expect(texto(r)).not.toContain('Salao Norte')
    expect(texto(r)).not.toContain('Cripta Rubra')
    expect(r.outbound.every((o) => o.clientId === 'c1')).toBe(true)
  })

  it('depois de devolvida, o snapshot dela é o recorte do Salão, sem nome de cena', () => {
    const { s, ana } = mesa()
    s.returnPlayer(ana, 't-ana', { sceneId: 's-a', x: 700, y: 300 }, depoisDaIda)
    const voltou: HostWorld = {
      open: { ...depoisDaIda.open, map: mapa('m-salao', [ficha('t-bruno', 'Bruno', 820, 300), ficha('t-ana', 'Ana', 700, 300)]) },
      background: [{ ...depoisDaIda.background[0], map: mapa('m-cripta', []) }],
    }
    const msg = s.broadcast(voltou).outbound.find((o) => o.clientId === 'c1')?.msg
    expect(msg?.type === 'snapshot' ? [msg.map.id, msg.map.name] : null).toEqual(['m-salao', ''])
  })

  it('recusa sem mexer em nada: ficha que não está com ela, ficha que não está na cena dela, cena de volta sumida, a mesma cena, jogador desconhecido', () => {
    const { s, ana, bruno } = mesa()
    const volta = { sceneId: 's-a', x: 700, y: 300 }
    expect(s.returnPlayer(ana, 't-bruno', volta, depoisDaIda)).toEqual({ outbound: [] })
    expect(s.returnPlayer(bruno, 't-ana', volta, depoisDaIda)).toEqual({ outbound: [] })
    expect(s.returnPlayer(ana, 't-ana', { ...volta, sceneId: 's-x' }, depoisDaIda)).toEqual({ outbound: [] })
    expect(s.returnPlayer(ana, 't-ana', { ...volta, sceneId: 's-b' }, depoisDaIda)).toEqual({ outbound: [] })
    expect(s.returnPlayer('fantasma', 't-ana', volta, depoisDaIda)).toEqual({ outbound: [] })
  })

  it('pedido de passagem pendente de quem é devolvida morre junto (o pino ficou na outra cena)', () => {
    const { s, ana } = mesa()
    const comEscada: HostWorld = {
      open: {
        ...depoisDaIda.open,
        map: {
          ...depoisDaIda.open.map,
          pins: [{ id: 'escada-a', x: 900, y: 440, kind: 'viagem', description: 'Escada que desce', image: null, destino: { sceneId: 's-b', pinId: 'escada-b' } }],
        },
      },
      background: [
        {
          ...depoisDaIda.background[0],
          map: {
            ...mapa('m-cripta', [ficha('t-ana', 'Ana', 1025, 275)]),
            pins: [{ id: 'escada-b', x: 1000, y: 250, kind: 'viagem', description: 'Escada que sobe', image: null, destino: { sceneId: 's-a', pinId: 'escada-a' } }],
          },
        },
      ],
    }
    const pedido = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada-b' }, comEscada).travelRequest
    if (pedido === undefined) throw new Error('o pedido pela escada da Cripta deveria esperar o mestre')
    expect(s.isTravelPending(pedido.requestId)).toBe(true)
    s.returnPlayer(ana, 't-ana', { sceneId: 's-a', x: 700, y: 300 }, comEscada)
    expect(s.isTravelPending(pedido.requestId)).toBe(false)
  })
})
