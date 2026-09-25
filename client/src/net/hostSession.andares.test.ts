/**
 * MAPA POR ANDARES — o jogador numa cena marcada como andar de um prédio
 * recebe, junto do snapshot, os OUTROS andares desse prédio onde ele já esteve,
 * cada um só com o que ELE explorou lá. Nunca: nome de cena, nome do prédio,
 * andar onde ele nunca pisou, ficha de quem está lá agora, nem o que a zona
 * oculta esconde.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { decodeExploration, isPointExplored } from '../lib/exploration'
import type { MapData, Pin, SceneFloor, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const MANSAO = 'Mansao Spencer'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function pino(id: string, x: number, y: number, description: string): Pin {
  return { id, x, y, kind: 'exclamacao', description, image: null }
}

function cena(sceneId: string, nome: string, andar: SceneFloor | undefined, extra: Partial<MapData> = {}): HostScene {
  const map: MapData = { ...createEmptyMap(`m-${sceneId}`, nome, 30, 10, 50), ...extra }
  return { sceneId, name: nome, map: andar === undefined ? map : { ...map, andar } }
}

/** As cenas da aventura, com as fichas de cada uma trocadas por `fichas[sceneId]`. */
function mundo(abertaId: string, cenas: HostScene[], fichas: Record<string, Token[]>): HostWorld {
  const comFichas = cenas.map((c) => ({ ...c, map: { ...c.map, tokens: [...c.map.tokens, ...(fichas[c.sceneId ?? ''] ?? [])] } }))
  const aberta = comFichas.find((c) => c.sceneId === abertaId)
  if (aberta === undefined) throw new Error('cena aberta ausente')
  return { open: aberta, background: comFichas.filter((c) => c !== aberta) }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, nome: string, tokenId: string, source: HostWorld): string {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, source)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, tokenId)
  return welcome.playerId
}

function snapshotPara(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot, veio ${msg?.type ?? 'nada'}`)
  return msg
}

function textoPara(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

// Porão: um zumbi do mestre, a Chave dentro de uma zona oculta e o mapa na parede, à vista.
const porao = cena('s-porao', 'Porao Umido', { predio: MANSAO, rotulo: 'B1' }, {
  pins: [pino('mapa-da-parede', 300, 150, 'Mapa rasgado'), pino('chave', 1300, 250, 'Chave Vermelha')],
  concealZones: [{ id: 'z1', name: 'Cofre do Umbrella', revealed: false, points: [{ x: 1200, y: 150 }, { x: 1450, y: 150 }, { x: 1450, y: 350 }, { x: 1200, y: 350 }] }],
})
const salao = cena('s-salao', 'Salao Nobre', { predio: MANSAO, rotulo: '1F' })
const sotao = cena('s-sotao', 'Sotao Escuro', { predio: MANSAO, rotulo: '2F' })
const delegacia = cena('s-delegacia', 'Delegacia Raccoon', { predio: 'Delegacia Raccoon', rotulo: 'B2' })
const jardim = cena('s-jardim', 'Jardim de Inverno', undefined)
const CENAS = [porao, salao, sotao, delegacia, jardim]

function mesa() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  return s
}

describe('mapa por andares: o que o jogador recebe dos outros andares', () => {
  it('só os andares do MESMO prédio onde ele já esteve, só pelo rótulo, com a memória dele e sem ficha nenhuma', () => {
    const s = mesa()
    // 1) Ana começa na delegacia (outro prédio), 2) desce ao porão da mansão, 3) sobe ao salão.
    const naDelegacia = mundo('s-delegacia', CENAS, { 's-delegacia': [ficha('heroi', 100, 100)] })
    entra(s, 'c1', 'Ana', 'heroi', naDelegacia)
    s.broadcast(naDelegacia)
    const noPorao = mundo('s-porao', CENAS, { 's-porao': [ficha('heroi', 100, 100), ficha('zumbi', 250, 100)] })
    s.broadcast(noPorao)

    // Bruno fica no porão; Ana sobe ao salão. O zumbi continua lá embaixo.
    const noSalao = mundo('s-salao', CENAS, { 's-salao': [ficha('heroi', 100, 100)], 's-porao': [ficha('zumbi', 250, 100), ficha('bruno', 200, 100)] })
    entra(s, 'c2', 'Bruno', 'bruno', noSalao)
    const r = s.broadcast(noSalao)
    const snap = snapshotPara(r, 'c1')

    expect(snap.andares?.atual).toBe('1F')
    // Nem o 2F (nunca subiu), nem o B2 (outro prédio).
    expect(snap.andares?.outros.map((o) => o.rotulo)).toEqual(['B1'])
    const b1 = snap.andares?.outros[0]
    expect(b1?.map.id).toBe('m-s-porao')
    // Memória, não visão: nenhuma ficha (nem a do Bruno, nem o zumbi, que ela viu lá).
    expect(b1?.map.tokens).toEqual([])
    // O mapa da parede ela viu; a chave está na zona oculta.
    expect(b1?.map.pins.map((p) => p.id)).toEqual(['mapa-da-parede'])
    expect(b1?.concealed).toHaveLength(1)

    const explorado = decodeExploration(b1?.explored)
    expect(explorado).not.toBeNull()
    if (explorado === null) return
    expect(isPointExplored(explorado, { x: 100, y: 100 })).toBe(true)
    expect(isPointExplored(explorado, { x: 1450, y: 480 })).toBe(false)

    const texto = textoPara(r, 'c1')
    for (const segredo of ['Porao Umido', 'Salao Nobre', 'Sotao Escuro', 'Delegacia Raccoon', MANSAO, 'zumbi', 'bruno', 'Chave Vermelha', 'Cofre do Umbrella', '"2F"', '"B2"']) {
      expect(texto, segredo).not.toContain(segredo)
    }
    // Nem o prédio escondido no mapa da cena atual.
    expect(snap.map.andar).toBeUndefined()
  })

  it('cada jogador recebe os andares DELE: quem nunca desceu ao porão não ganha a aba B1', () => {
    const s = mesa()
    const noPorao = mundo('s-porao', CENAS, { 's-porao': [ficha('heroi', 100, 100)] })
    entra(s, 'c1', 'Ana', 'heroi', noPorao)
    s.broadcast(noPorao)
    const noSalao = mundo('s-salao', CENAS, { 's-salao': [ficha('heroi', 100, 100), ficha('bruno', 300, 100)] })
    entra(s, 'c2', 'Bruno', 'bruno', noSalao)
    const r = s.broadcast(noSalao)

    expect(snapshotPara(r, 'c1').andares?.outros.map((o) => o.rotulo)).toEqual(['B1'])
    const doBruno = snapshotPara(r, 'c2')
    expect(doBruno.andares).toBeUndefined()
    expect(textoPara(r, 'c2')).not.toContain('"B1"')
    expect(textoPara(r, 'c2')).not.toContain('"1F"')
  })

  it('cena que não é andar, ou andar sem outro andar visitado, não leva o campo', () => {
    const s = mesa()
    const noJardim = mundo('s-jardim', CENAS, { 's-jardim': [ficha('heroi', 100, 100)] })
    entra(s, 'c1', 'Ana', 'heroi', noJardim)
    const noJardimSnap = snapshotPara(s.broadcast(noJardim), 'c1')
    expect(noJardimSnap.andares).toBeUndefined()
    expect(noJardimSnap.map.id).toBe('m-s-jardim')

    const noSalao = mundo('s-salao', CENAS, { 's-salao': [ficha('heroi', 100, 100)] })
    const r = s.broadcast(noSalao)
    expect(snapshotPara(r, 'c1').andares).toBeUndefined()
    expect(textoPara(r, 'c1')).not.toContain('"1F"')
  })

  it('"Esconder planta" de todas as cenas tira os outros andares junto', () => {
    const s = mesa()
    const noPorao = mundo('s-porao', CENAS, { 's-porao': [ficha('heroi', 100, 100)] })
    const ana = entra(s, 'c1', 'Ana', 'heroi', noPorao)
    s.broadcast(noPorao)
    const noSalao = mundo('s-salao', CENAS, { 's-salao': [ficha('heroi', 100, 100)] })
    expect(snapshotPara(s.broadcast(noSalao), 'c1').andares?.outros).toHaveLength(1)

    s.hidePlan(ana)
    const depois = snapshotPara(s.broadcast(noSalao), 'c1')
    expect(depois.andares).toBeUndefined()
    expect(depois.map.id).toBe('m-s-salao')
  })
})
