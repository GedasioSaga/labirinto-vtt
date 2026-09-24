/**
 * GATILHO DE ÁREA pela REDE. A ficha de jogador que ENTRA numa área marcada
 * faz o host contar ao MESTRE (`triggerEntries`: jogador, ficha, tipo, área e
 * cena). O jogador não recebe mensagem nenhuma por ter entrado, e o snapshot
 * dele só leva o gatilho que o mestre revelou.
 */
import { describe, expect, it } from 'vitest'
import { ficha, torre } from '../lib/__fixtures__/hazardTower'
import type { AreaTrigger, MapData } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'ARMADI'

function mesa(source: MapData | HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const jogadores: [clientId: string, name: string, tokenId: string][] = [
    ['c1', 'Ana', 'ana'],
    ['c2', 'Bia', 'bia'],
  ]
  for (const [clientId, name, tokenId] of jogadores) {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, source).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
  }
  return s
}

function mensagensPara(r: HostResult, clientId: string) {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

const armadilhaNaC = (revealed: boolean): AreaTrigger => ({ id: 'g-segredo', kind: 'armadilha', regionId: 'sala-c', revealed })

/** Ana em `xAna`; a porta B|C aberta, para ela poder andar até a sala C. */
function andar(xAna: number, gatilhos: AreaTrigger[], id = 'm-torre'): MapData {
  return { ...torre({ abertaBC: true, tokens: [ficha('ana', xAna, 200), ficha('bia', 300, 200)] }, id), gatilhos }
}

describe('gatilho de área — aviso ao mestre', () => {
  it('Ana entra na armadilha: o mestre lê jogador, ficha, tipo e área; Ana não recebe nada; não repete', () => {
    const s = mesa(andar(250, [armadilhaNaC(false)]))
    const primeiro = s.broadcast(andar(250, [armadilhaNaC(false)]))
    expect(primeiro.triggerEntries ?? []).toEqual([])

    const r = s.broadcast(andar(1250, [armadilhaNaC(false)]))
    expect(r.triggerEntries).toEqual([{ playerName: 'Ana', tokenName: 'ficha-ana', kind: 'armadilha', areaName: 'nome-sala-c' }])
    // O jogador só recebe o snapshot de sempre: nenhuma mensagem de gatilho, nenhum rastro dele.
    expect(mensagensPara(r, 'c1').map((m) => m.type)).toEqual(['snapshot'])
    const tudo = JSON.stringify(r.outbound)
    expect(tudo).not.toContain('armadilha')
    expect(tudo).not.toContain('g-segredo')
    expect(tudo).not.toContain('gatilhos')

    expect(s.broadcast(andar(1250, [armadilhaNaC(false)])).triggerEntries ?? []).toEqual([])
  })

  it('revelado: o snapshot de quem conhece a área leva o tipo e o polígono, sem id', () => {
    const map = andar(1250, [armadilhaNaC(true)])
    const r = mesa(map).broadcast(map)
    const deAna = mensagensPara(r, 'c1').find((m) => m.type === 'snapshot')
    if (deAna?.type !== 'snapshot') throw new Error('esperava o snapshot da Ana')
    expect(deAna.gatilhos?.map((g) => g.kind)).toEqual(['armadilha'])
    expect(JSON.stringify(deAna)).not.toContain('g-segredo')
    expect('gatilhos' in deAna.map).toBe(false)
  })

  it('gatilho em cena de FUNDO: o mestre lê em que cena foi; ninguém da outra cena recebe nada', () => {
    const salao = torre({ tokens: [ficha('bia', 250, 200)] }, 'm-salao')
    const mundo = (x: number): HostWorld => ({
      open: { sceneId: 's-salao', name: 'Salão', map: salao },
      background: [{ sceneId: 's-cripta', name: 'Cripta', map: { ...torre({ abertaBC: true, tokens: [ficha('ana', x, 200)] }, 'm-cripta'), gatilhos: [{ id: 'g-c', kind: 'alarme', regionId: 'sala-c', revealed: false }] } }],
    })
    const s = mesa(mundo(250))
    s.broadcast(mundo(250))
    const r = s.broadcast(mundo(1250))
    expect(r.triggerEntries).toEqual([{ playerName: 'Ana', tokenName: 'ficha-ana', kind: 'alarme', areaName: 'nome-sala-c', sceneName: 'Cripta' }])
    expect(JSON.stringify(r.outbound)).not.toContain('alarme')
  })
})
