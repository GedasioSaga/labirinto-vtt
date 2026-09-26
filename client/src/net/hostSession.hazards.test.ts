/**
 * ZONA DE PERIGO pela REDE. A ficha de jogador que entra no perigo — andando
 * ou porque o perigo avançou sobre ela — faz o host mandar UM aviso ao dono
 * dela (e só a ele) e contar ao mestre (`hazardEntries`). O snapshot leva o
 * perigo só onde o jogador enxerga; quem está em outra sala ou em outra cena
 * não recebe nada dele.
 */
import { describe, expect, it } from 'vitest'
import { ficha, torre, zona } from '../lib/__fixtures__/hazardTower'
import { advanceHazard } from '../lib/hazards'
import type { MapData } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'PERIGO'

/** Ana (c1) fica com a ficha `ana`, Bia (c2) com a `bia`. */
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

function avisos(r: HostResult, clientId: string) {
  return mensagensPara(r, clientId).filter((m) => m.type === 'hazard.entered')
}

describe('zona de perigo — aviso de quem entra', () => {
  it('Ana entra no fogo: só ela recebe o aviso, o mestre fica sabendo, e não repete', () => {
    const fogo = [zona('fogo-1', 'fogo', ['sala-c'])]
    const antes = torre({ hazards: fogo, tokens: [ficha('ana', 250, 200), ficha('bia', 750, 200)] })
    const s = mesa(antes)
    const primeiro = s.broadcast(antes)
    expect(avisos(primeiro, 'c1')).toEqual([])
    expect(primeiro.hazardEntries ?? []).toEqual([])

    const dentro = torre({ abertaBC: true, hazards: fogo, tokens: [ficha('ana', 1250, 200), ficha('bia', 750, 200)] })
    const r = s.broadcast(dentro)
    expect(avisos(r, 'c1')).toEqual([{ type: 'hazard.entered', kind: 'fogo' }])
    expect(avisos(r, 'c2')).toEqual([])
    expect(r.hazardEntries).toEqual([{ playerName: 'Ana', tokenName: 'ficha-ana', kind: 'fogo' }])
    // O aviso sai DEPOIS do snapshot: a tela já desenha o fogo quando o texto aparece.
    expect(mensagensPara(r, 'c1').map((m) => m.type)).toEqual(['snapshot', 'hazard.entered'])

    const deNovo = s.broadcast(dentro)
    expect(avisos(deNovo, 'c1')).toEqual([])
    expect(deNovo.hazardEntries ?? []).toEqual([])
  })

  it('o fogo avança sobre Bia parada: ela recebe o aviso', () => {
    const antes = torre({ hazards: [zona('fogo-1', 'fogo', ['sala-a'])], tokens: [ficha('ana', 250, 200), ficha('bia', 750, 200)] })
    const s = mesa(antes)
    const r0 = s.broadcast(antes)
    // Ana já estava no fogo quando a mesa começou: é avisada na primeira vez.
    expect(avisos(r0, 'c1')).toEqual([{ type: 'hazard.entered', kind: 'fogo' }])
    const r = s.broadcast(advanceHazard(antes, 'fogo-1'))
    expect(avisos(r, 'c2')).toEqual([{ type: 'hazard.entered', kind: 'fogo' }])
    expect(avisos(r, 'c1')).toEqual([])
  })

  it('fogo em sala "Oculta para jogadores": o mestre lê, Ana não recebe aviso nem o tipo', () => {
    // "Oculta para jogadores" (`hidden`): a sala SECRETA abre para quem está
    // dentro dela (DENTRO DA SALA SECRETA), e aí o fogo é dela de ver; a
    // oculta pelo mestre continua escondida mesmo com a Ana lá dentro.
    const regions = torre().regions.map((r) => (r.id === 'sala-c' ? { ...r, hidden: true } : r))
    const fora = torre({ regions, hazards: [zona('fogo-1', 'fogo', ['sala-c'])], tokens: [ficha('ana', 250, 200), ficha('bia', 300, 200)] })
    const s = mesa(fora)
    s.broadcast(fora)
    const dentro = torre({ regions, abertaBC: true, hazards: [zona('fogo-1', 'fogo', ['sala-c'])], tokens: [ficha('ana', 1250, 200), ficha('bia', 300, 200)] })
    const r = s.broadcast(dentro)
    expect(r.hazardEntries).toEqual([{ playerName: 'Ana', tokenName: 'ficha-ana', kind: 'fogo' }])
    expect(avisos(r, 'c1')).toEqual([])
    expect(JSON.stringify(mensagensPara(r, 'c1'))).not.toContain('fogo')
  })

  it('ficha de NPC no fogo: ninguém é avisado', () => {
    const map = torre({ hazards: [zona('fogo-1', 'fogo', ['sala-a'])], tokens: [ficha('ogro', 250, 200), ficha('ana', 1250, 200), ficha('bia', 1300, 200)] })
    const r = mesa(map).broadcast(map)
    expect(r.hazardEntries ?? []).toEqual([])
  })

  it('snapshot: Ana vê o fogo da sala dela; Bia, atrás da porta fechada, não recebe nada do fogo', () => {
    const map = torre({ hazards: [zona('fogo-segredo', 'fogo', ['sala-a'])], tokens: [ficha('ana', 250, 200), ficha('bia', 1250, 200)] })
    const r = mesa(map).broadcast(map)
    const deAna = mensagensPara(r, 'c1').find((m) => m.type === 'snapshot')
    if (deAna?.type !== 'snapshot') throw new Error('esperava o snapshot da Ana')
    expect(deAna.hazards?.map((h) => h.kind)).toEqual(['fogo'])
    const deBia = mensagensPara(r, 'c2').find((m) => m.type === 'snapshot')
    if (deBia?.type !== 'snapshot') throw new Error('esperava o snapshot da Bia')
    expect(deBia.hazards).toBeUndefined()
    expect(JSON.stringify(mensagensPara(r, 'c2'))).not.toContain('fogo')
    expect(JSON.stringify(r.outbound)).not.toContain('fogo-segredo')
  })

  it('perigo em OUTRA cena da aventura: nada chega a quem está nesta', () => {
    const salao = torre({ tokens: [ficha('ana', 250, 200), ficha('bia', 300, 200)] }, 'm-salao')
    const cripta = torre({ hazards: [zona('fogo-cripta', 'fogo', ['sala-a'])], tokens: [ficha('lich', 250, 200)] }, 'm-cripta')
    const mundo: HostWorld = {
      open: { sceneId: 's-salao', name: 'Salão', map: salao },
      background: [{ sceneId: 's-cripta', name: 'Cripta', map: cripta }],
    }
    const r = mesa(mundo).broadcast(mundo)
    expect(JSON.stringify(r.outbound)).not.toContain('fogo')
    expect(r.hazardEntries ?? []).toEqual([])
  })

  it('jogador em cena de FUNDO entra no fogo: o mestre lê em que cena foi', () => {
    const salao = torre({ tokens: [ficha('bia', 250, 200)] }, 'm-salao')
    const cripta = (x: number) => torre({ hazards: [zona('fogo-cripta', 'fogo', ['sala-c'])], tokens: [ficha('ana', x, 200)] }, 'm-cripta')
    const mundo = (x: number): HostWorld => ({
      open: { sceneId: 's-salao', name: 'Salão', map: salao },
      background: [{ sceneId: 's-cripta', name: 'Cripta', map: cripta(x) }],
    })
    const s = mesa(mundo(250))
    s.broadcast(mundo(250))
    const r = s.broadcast(mundo(1250))
    expect(r.hazardEntries).toEqual([{ playerName: 'Ana', tokenName: 'ficha-ana', kind: 'fogo', sceneName: 'Cripta' }])
    expect(avisos(r, 'c1')).toEqual([{ type: 'hazard.entered', kind: 'fogo' }])
    expect(avisos(r, 'c2')).toEqual([])
  })
})
