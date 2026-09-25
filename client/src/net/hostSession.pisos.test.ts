import { describe, expect, it } from 'vitest'
import { decodeExploration, isPointExplored, type Exploration } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Region, Stair, Token, Wall } from '../types/map'
import { createHostSession, type HostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PISOS NA MESMA CENA no host. Um prédio de dois pisos EMPILHADOS: o térreo e o
 * 1º piso ocupam o mesmo lugar do plano. A escada fica no meio; a Lia (Ana)
 * começa no térreo, o Caio (Bia) no 1º piso.
 */
const CODE = 'PISO01'
const RADIUS = 700

type Snapshot = Extract<HostMessage, { type: 'snapshot' }>

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function sala(id: string, name: string, extra: Partial<Region> = {}): Region {
  const points = [
    { x: 40, y: 40 },
    { x: 960, y: 40 },
    { x: 960, y: 960 },
    { x: 40, y: 960 },
  ]
  return { id, points, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name }, ...extra }
}

const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 500, y1: 460, x2: 500, y2: 540 }], stepWidth: 40, levaAoPiso: 1 }

/** Ponto no térreo que a Lia vê da escada, mas não de (850, 500): lá ele fica além do raio. */
const CANTO = { x: 100, y: 900 }

function predio(extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('predio', 'Prédio', 25, 25, 40),
    walls: [wall('muro-norte', 40, 40, 960, 40), wall('divisoria-primeiro', 700, 40, 700, 960, { piso: 1 })],
    regions: [sala('hall', 'Hall de entrada'), sala('biblioteca', 'Biblioteca proibida', { piso: 1 })],
    tokens: [token('lia', 500, 500), token('caio', 300, 300, { piso: 1 })],
    stairs: [ESCADA],
    ...extra,
  }
}

function comFicha(map: MapData, tokenId: string, patch: Partial<Token>): MapData {
  return { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, ...patch } : t)) }
}

function mesa() {
  let n = 0
  let agora = 0
  const s: HostSession = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => agora, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string, map: MapData): string => {
    const first = s.handleMessage(clientId, { type: 'join', code: CODE, name }, map).outbound[0]?.msg
    if (first?.type !== 'welcome') throw new Error('esperava welcome')
    return first.playerId
  }
  const snapshotPara = (clientId: string, map: MapData): Snapshot => {
    const msg = s.broadcast(map).outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
    if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
    return msg
  }
  const passa = (ms: number): void => {
    agora += ms
  }
  return { s, entra, snapshotPara, passa }
}

function exploradoDe(snap: Snapshot): Exploration {
  const exp = decodeExploration(snap.explored)
  if (exp === null) throw new Error('explored inválido')
  return exp
}

describe('hostSession — pisos na mesma cena', () => {
  it('cada jogador recebe só o piso da ficha dele', () => {
    const t = mesa()
    const map = predio()
    t.s.assignToken(t.entra('c1', 'Ana', map), 'lia')
    t.s.assignToken(t.entra('c2', 'Bia', map), 'caio')
    const ana = JSON.stringify(t.snapshotPara('c1', map))
    expect(ana).toContain('Hall de entrada')
    expect(ana).not.toContain('Biblioteca proibida')
    expect(ana).not.toContain('nome-caio')
    const bia = JSON.stringify(t.snapshotPara('c2', map))
    expect(bia).toContain('Biblioteca proibida')
    expect(bia).not.toContain('Hall de entrada')
    expect(bia).not.toContain('nome-lia')
  })

  it('subir pela escada: o host devolve o piso novo da ficha, sem trocar de cena', () => {
    const t = mesa()
    const map = predio()
    t.s.assignToken(t.entra('c1', 'Ana', map), 'lia')
    t.snapshotPara('c1', map)
    const result = t.s.handleMessage('c1', { type: 'token.piso', tokenId: 'lia', stairId: 'escada' }, map)
    expect(result.applyPiso).toEqual({ tokenId: 'lia', piso: 1 })
    expect(result.applyTransfer).toBeUndefined()
    // O integrador aplica: agora a Lia vê o 1º piso e não mais o térreo.
    const emCima = comFicha(map, 'lia', { piso: 1 })
    const snap = JSON.stringify(t.snapshotPara('c1', emCima))
    expect(snap).toContain('Biblioteca proibida')
    expect(snap).not.toContain('Hall de entrada')
    // E descer pela mesma escada leva de volta ao térreo.
    t.passa(1000)
    expect(t.s.handleMessage('c1', { type: 'token.piso', tokenId: 'lia', stairId: 'escada' }, emCima).applyPiso).toEqual({ tokenId: 'lia', piso: 0 })
  })

  it('pedido que não vale morre em silêncio: longe da escada, ficha de outro, escada de enfeite ou secreta', () => {
    const t = mesa()
    const map = predio()
    t.s.assignToken(t.entra('c1', 'Ana', map), 'lia')
    t.s.assignToken(t.entra('c2', 'Bia', map), 'caio')
    t.snapshotPara('c1', map)
    const pede = (clientId: string, source: MapData, tokenId = 'lia', stairId = 'escada') => {
      t.passa(1000)
      return t.s.handleMessage(clientId, { type: 'token.piso', tokenId, stairId }, source)
    }
    const longe = comFicha(map, 'lia', { x: 200, y: 800 })
    expect(pede('c1', longe).applyPiso).toBeUndefined()
    expect(pede('c1', longe).outbound).toEqual([])
    // Ficha do colega, mesmo em cima da escada no piso dele.
    expect(pede('c2', map, 'lia').applyPiso).toBeUndefined()
    const enfeite = predio({ stairs: [{ ...ESCADA, levaAoPiso: undefined }] })
    expect(pede('c1', enfeite).applyPiso).toBeUndefined()
    const secreta = predio({ stairs: [{ ...ESCADA, secret: true }] })
    expect(pede('c1', secreta).applyPiso).toBeUndefined()
    expect(pede('c1', map, 'lia', 'nao-existe').applyPiso).toBeUndefined()
    // Pré-condição: o pedido certo vale.
    expect(pede('c1', map).applyPiso).toEqual({ tokenId: 'lia', piso: 1 })
  })

  it('memória separada por piso: o térreo explorado não vira explorado no 1º piso, e volta ao descer', () => {
    const t = mesa()
    const map = predio()
    t.s.assignToken(t.entra('c1', 'Ana', map), 'lia')
    expect(isPointExplored(exploradoDe(t.snapshotPara('c1', map)), CANTO)).toBe(true)
    // Sobe e anda para (850, 500): de lá o canto está fora do raio, em qualquer piso.
    const emCima = comFicha(map, 'lia', { piso: 1, x: 850, y: 500 })
    expect(isPointExplored(exploradoDe(t.snapshotPara('c1', emCima)), CANTO)).toBe(false)
    // Desce no mesmo ponto: o canto não está à vista, então só a memória do térreo o traz.
    const deVolta = comFicha(map, 'lia', { x: 850, y: 500 })
    const snap = t.snapshotPara('c1', deVolta)
    expect(isPointExplored(exploradoDe(snap), CANTO)).toBe(true)
    expect(JSON.stringify(snap)).toContain('Hall de entrada')
  })

  it('mover: só a parede do piso da ficha segura o passo', () => {
    const t = mesa()
    const map = predio()
    t.s.assignToken(t.entra('c1', 'Ana', map), 'lia')
    t.snapshotPara('c1', map)
    // A divisória do 1º piso fica em x=700: no térreo ela não existe.
    const result = t.s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'lia', x: 850, y: 500 }, map)
    expect(result.applyMove).toEqual({ tokenId: 'lia', x: 850, y: 500 })
    // No 1º piso ela segura.
    const emCima = comFicha(map, 'lia', { piso: 1 })
    t.snapshotPara('c1', emCima)
    const barrado = t.s.handleMessage('c1', { type: 'token.move', reqId: 'r2', tokenId: 'lia', x: 850, y: 500 }, emCima)
    expect(barrado.applyMove).toBeUndefined()
    expect(barrado.outbound[0]?.msg.type).toBe('token.move.rejected')
  })

  it('pino de viagem: a ficha chega no piso do pino par da outra cena; par no térreo, sem campo', () => {
    const alcapao: Pin = { id: 'alcapao', x: 500, y: 500, kind: 'viagem', description: 'Alçapão', image: null, destino: { sceneId: 'torre', pinId: 'topo' }, passagem: 'livre' }
    const topo: Pin = { id: 'topo', x: 300, y: 300, kind: 'viagem', description: 'Topo', image: null, destino: { sceneId: 'porao', pinId: 'alcapao' }, piso: 4 }
    const mundo = (topoDaTorre: Pin): HostWorld => ({
      open: { sceneId: 'porao', name: 'Porão', map: predio({ pins: [alcapao] }) },
      background: [{ sceneId: 'torre', name: 'Torre', map: { ...createEmptyMap('torre', 'Torre', 25, 25, 40), pins: [topoDaTorre] } }],
    })
    const t = mesa()
    const noQuarto = mundo(topo)
    t.s.assignToken(t.entra('c1', 'Ana', noQuarto.open.map), 'lia')
    t.s.broadcast(noQuarto)
    const vai = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'alcapao' }, noQuarto)
    expect(vai.applyTransfer).toMatchObject({ tokenId: 'lia', toSceneId: 'torre', piso: 4 })

    const t2 = mesa()
    const noTerreo = mundo({ ...topo, piso: undefined })
    t2.s.assignToken(t2.entra('c1', 'Ana', noTerreo.open.map), 'lia')
    t2.s.broadcast(noTerreo)
    const chega = t2.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'alcapao' }, noTerreo).applyTransfer
    expect(chega?.toSceneId).toBe('torre')
    expect(chega !== undefined && 'piso' in chega).toBe(false)
  })

  it('sinal de quem está em outro piso não chega', () => {
    const t = mesa()
    const map = predio()
    t.s.assignToken(t.entra('c1', 'Ana', map), 'lia')
    t.s.assignToken(t.entra('c2', 'Bia', map), 'caio')
    t.snapshotPara('c1', map)
    t.snapshotPara('c2', map)
    const result = t.s.handleMessage('c2', { type: 'signal', x: 500, y: 500 }, map)
    expect(result.outbound.map((o) => o.clientId)).toEqual(['c2'])
    // Pré-condição: no mesmo piso, o sinal chegaria.
    const juntos = comFicha(map, 'caio', { piso: 0 })
    t.snapshotPara('c1', juntos)
    t.passa(5000)
    const mesmoPiso = t.s.handleMessage('c2', { type: 'signal', x: 500, y: 500 }, juntos)
    expect(mesmoPiso.outbound.map((o) => o.clientId).sort()).toEqual(['c1', 'c2'])
  })
})
