/**
 * DADOS INTERNOS DA SALA NÃO VÃO AO JOGADOR — pela rede. O mestre guarda em
 * cada região o `endereco` do cômodo (em `data`), um rótulo próprio (`tag`) e a
 * trava do editor (`locked`). Nada disso aparece na tela do jogador, então nada
 * disso sai em mensagem nenhuma: nem no snapshot de quem está dentro, nem no de
 * quem vê de fora, nem ao reconectar. A planta da sala continua chegando.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, Token } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'

const CODE = 'AB12CD'
const ENDERECO = 'A05-D07-Q01-P10-C6'
const ROTULO = 'Fosso-com-estacas'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function sala(id: string, nome: string, x: number, y: number, w: number, h: number, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    tag: ROTULO,
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: { endereco: ENDERECO, andar: 7 },
    locked: true,
    room: { shape: 'rect', name: nome },
    ...extra,
  }
}

/** Albergue (100..400) com endereço, rótulo e trava; Carla dentro, Enzo no corredor vendo de fora. */
function mapa(): MapData {
  return {
    ...createEmptyMap('m-torre', 'Torre', 1500, 600, 50),
    tokens: [ficha('carla', 250, 250), ficha('enzo', 700, 250)],
    regions: [sala('albergue', 'Albergue Santa Balaustrada', 100, 100, 300, 300)],
  }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, map: MapData): string {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, map).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function para(r: HostResult, clientId: string) {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function mesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  s.assignToken(entra(s, 'c-carla', 'Carla', map), 'carla')
  s.assignToken(entra(s, 'c-enzo', 'Enzo', map), 'enzo')
  return s
}

function semInternos(pacote: string): void {
  expect(pacote).not.toContain(ENDERECO)
  expect(pacote).not.toContain('endereco')
  expect(pacote).not.toContain(ROTULO)
  expect(pacote).not.toContain('"locked":true')
}

describe('dados internos da sala pela rede', () => {
  it('snapshot de quem está dentro e de quem vê de fora: a sala chega, os internos não', () => {
    const map = mapa()
    const r = mesa(map).broadcast(map)
    for (const cliente of ['c-carla', 'c-enzo']) {
      const snap = para(r, cliente).find((m) => m.type === 'snapshot')
      const regioes = snap?.type === 'snapshot' ? snap.map.regions : []
      expect(regioes.map((reg) => [reg.id, reg.room?.name])).toEqual([['albergue', 'Albergue Santa Balaustrada']])
      expect(regioes[0]?.data).toEqual({})
      semInternos(JSON.stringify(para(r, cliente)))
    }
  })

  it('reconectar: o snapshot de volta também sai sem os internos', () => {
    const map = mapa()
    const s = mesa(map)
    s.broadcast(map)
    s.disconnect('c-carla')
    // id-2 é o resumeToken da Carla (id-1 é o playerId dela).
    const volta = s.handleMessage('c-carla-2', { type: 'join', code: CODE, name: 'Carla', resume: 'id-2' }, map)
    const snap = volta.outbound.map((o) => o.msg).find((m) => m.type === 'snapshot')
    expect(snap?.type === 'snapshot' ? snap.map.regions.map((reg) => reg.id) : []).toEqual(['albergue'])
    semInternos(JSON.stringify(volta.outbound))
  })

  it('o mestre continua com tudo: o mapa dele não perde endereço, rótulo nem trava', () => {
    const map = mapa()
    mesa(map).broadcast(map)
    expect(map.regions[0]?.data).toEqual({ endereco: ENDERECO, andar: 7 })
    expect(map.regions[0]?.tag).toBe(ROTULO)
    expect(map.regions[0]?.locked).toBe(true)
  })
})
