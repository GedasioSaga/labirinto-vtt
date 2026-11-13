/**
 * FORA DO CHÃO DE VOLTA A BLOQUEADO COM ÁGUA QUE ELE NÃO RECEBE (FX-NEVOA2-062).
 * A água conta como Chão, mas a lembrança que sobra fora do Chão segue a régua
 * da visão enviada (`aguasDaVisaoDoJogador`): a água secreta e a da camada Chão
 * escondida dele não seguram lembrança. Contadas, o cinza lembrado ficava no
 * formato exato da água que ele nunca recebe.
 */
import { describe, expect, it } from 'vitest'
import { decodeExploration, isPointExplored } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { Agua, FloorPiece, MapData, RegionPoint } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const GRADE = 40
/** O meio do lago, fora do Chão (à direita dele), à vista da ficha com a cena livre. */
const NO_LAGO: RegionPoint = { x: 700, y: 300 }

const chao: FloorPiece = { id: 'chao', shape: { kind: 'rect', cx: 250, cy: 300, w: 500, h: 600 }, op: 'add', modifiers: {} }
const lago = (extra: Partial<Agua>): Agua => ({
  id: 'lago',
  tipo: 'lago',
  pontos: [
    { x: 620, y: 220 },
    { x: 780, y: 220 },
    { x: 780, y: 380 },
    { x: 620, y: 380 },
  ],
  cor: '#2f7f8f',
  ...extra,
})

function cena(aguas: Agua[], extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m', 'M', 30, 20, GRADE),
    offFloor: 'free',
    floor: [chao],
    aguas,
    tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 400, y: 300, size: 1, image: null }],
    ...extra,
  }
}

function snapshotPara(r: HostResult): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot')
  return msg
}

/** Livre (ele vê o lago), depois Bloqueado: o explorado no meio do lago. */
function lembraOLago(livre: MapData): boolean {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const welcome = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, livre).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'heroi')
  const antes = decodeExploration(snapshotPara(s.broadcast(livre)).explored)
  if (antes === null || !isPointExplored(antes, NO_LAGO)) throw new Error('controle: com a cena livre ele devia ver o lago')
  const bloqueada: MapData = { ...livre, offFloor: 'blocked' }
  const depois = decodeExploration(snapshotPara(s.broadcast(bloqueada)).explored)
  if (depois === null) throw new Error('explorado ilegível')
  return isPointExplored(depois, NO_LAGO)
}

describe('Fora do Chão de volta a Bloqueado: a lembrança fora do Chão', () => {
  it('a água secreta e a da camada Chão escondida não seguram lembrança; a que ele recebe segura', () => {
    expect(lembraOLago(cena([lago({})])), 'o lago comum conta como Chão').toBe(true)
    expect(lembraOLago(cena([])), 'controle sem água').toBe(false)
    expect(lembraOLago(cena([lago({ secret: true })])), 'lago secreto').toBe(false)
    // Com a camada Chão escondida, o Chão não limita a visão dele: a lembrança é a da mesma cena sem a água.
    const escondida: Partial<MapData> = { versaoDasCamadas: 2, ocultasDoJogador: ['chao'] }
    expect(lembraOLago(cena([lago({})], escondida)), 'lago da camada Chão escondida').toBe(lembraOLago(cena([], escondida)))
  })
})
