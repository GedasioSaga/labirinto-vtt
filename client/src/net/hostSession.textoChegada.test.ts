/**
 * TEXTO DE CHEGADA DA CENA no host: quem CHEGA numa cena com texto recebe o
 * texto uma vez, dentro do `scene.changed` dele — pela viagem aprovada, pelo
 * "Mandar para…", pelo "Reunir o grupo aqui" ou pelo desembarque da caravana.
 * Ninguém mais recebe: nem o colega que ficou, nem quem já estava na cena, nem
 * o próprio jogador de novo no snapshot seguinte.
 */
import { describe, expect, it } from 'vitest'
import { setArrivalText } from '../lib/arrivalText'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const TEXTO_CRIPTA = 'O frio da cripta morde os ossos.'
const TEXTO_SALAO = 'Tochas estalam no Salão.'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: id, image: null, destino, ...extra }
}

function salao(tokens: Token[]): MapData {
  const base: MapData = {
    ...createEmptyMap('m-salao', 'Salao', 30, 10, 50),
    tokens,
    pins: [viagem('porta', 400, 200, { sceneId: 's-cripta', pinId: 'escada' })],
  }
  return setArrivalText(base, TEXTO_SALAO)
}

function cripta(tokens: Token[], comTexto = true): MapData {
  const base: MapData = {
    ...createEmptyMap('m-cripta', 'Cripta', 30, 10, 50),
    tokens,
    pins: [viagem('escada', 700, 200, { sceneId: 's-salao', pinId: 'porta' })],
  }
  return comTexto ? setArrivalText(base, TEXTO_CRIPTA) : base
}

/** Ana e Bia no Salão (aberto no editor), Caio já na Cripta (de fundo). */
function mundo(comTexto = true): HostWorld {
  return {
    open: { sceneId: 's-salao', name: 'Salao', map: salao([ficha('ana', 350, 200), ficha('bia', 300, 200)]) },
    background: [{ sceneId: 's-cripta', name: 'Cripta', map: cripta([ficha('caio', 600, 200)], comTexto) }],
  }
}

function mesa(w: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000_000, randomId: () => `id-${(n += 1)}` })
  const entrar = (clientId: string, nome: string, tokenId: string): string => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, w).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
    return welcome.playerId
  }
  const ana = entrar('c1', 'Ana', 'ana')
  const bia = entrar('c2', 'Bia', 'bia')
  entrar('c3', 'Caio', 'caio')
  // O primeiro envio: o broadcast só manda de novo quando a tela de alguém muda.
  const inicial = s.broadcast(w)
  return { s, ana, bia, inicial }
}

function paraCliente(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function textoPara(r: HostResult, clientId: string): string {
  return JSON.stringify(paraCliente(r, clientId))
}

describe('texto de chegada: só quem chega, uma vez', () => {
  it('"Mandar para…": o scene.changed de quem foi levado traz o texto da cena de destino', () => {
    const w = mundo()
    const { s, ana } = mesa(w)
    const r = s.sendPlayer(ana, 's-cripta', null, w)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed', by: 'master', chegada: TEXTO_CRIPTA } }])
    // Nem a colega que ficou, nem quem já estava na cripta.
    expect(paraCliente(r, 'c2')).toEqual([])
    expect(paraCliente(r, 'c3')).toEqual([])
  })

  it('viagem aprovada pelo pino (a escada): o texto vem com o scene.changed', () => {
    const w = mundo()
    const { s } = mesa(w)
    const pedido = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'porta' }, w).travelRequest
    if (pedido === undefined) throw new Error('o pedido pela porta deveria chegar ao mestre')
    const r = s.approveTravel(pedido.requestId, w)
    expect(r.applyTransfer).toMatchObject({ tokenId: 'ana', toSceneId: 's-cripta' })
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed', chegada: TEXTO_CRIPTA } }])
  })

  it('"Reunir o grupo aqui": o texto vem junto do aviso da reunião', () => {
    const w = mundo()
    const { s, bia } = mesa(w)
    const r = s.sendPlayer(bia, 's-cripta', null, w, { x: 650, y: 200 })
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'scene.changed', by: 'gather', chegada: TEXTO_CRIPTA } }])
  })

  it('cena sem texto: o scene.changed sai sem o campo', () => {
    const w = mundo(false)
    const { s, ana } = mesa(w)
    const r = s.sendPlayer(ana, 's-cripta', null, w)
    const msg = paraCliente(r, 'c1')[0]
    expect(msg).toEqual({ type: 'scene.changed', by: 'master' })
    expect(msg !== undefined && 'chegada' in msg).toBe(false)
  })

  it('o snapshot nunca leva o texto: nem antes de ir, nem depois de chegar', () => {
    const w = mundo()
    const { s, ana, inicial: antes } = mesa(w)
    for (const c of ['c1', 'c2', 'c3']) {
      expect(paraCliente(antes, c).map((m) => m.type)).toContain('snapshot')
      expect(textoPara(antes, c)).not.toContain(TEXTO_SALAO)
      expect(textoPara(antes, c)).not.toContain(TEXTO_CRIPTA)
    }

    s.sendPlayer(ana, 's-cripta', null, w)
    // O integrador moveu a ficha: Ana e Caio na cripta, Bia no salão.
    const depois: HostWorld = {
      open: { sceneId: 's-salao', name: 'Salao', map: salao([ficha('bia', 300, 200)]) },
      background: [{ sceneId: 's-cripta', name: 'Cripta', map: cripta([ficha('caio', 600, 200), ficha('ana', 725, 225)]) }],
    }
    const r = s.broadcast(depois)
    const snap = paraCliente(r, 'c1').find((m) => m.type === 'snapshot')
    expect(snap?.type === 'snapshot' ? snap.map.id : null).toBe('m-cripta')
    for (const c of ['c1', 'c2', 'c3']) {
      expect(textoPara(r, c)).not.toContain(TEXTO_CRIPTA)
      expect(textoPara(r, c)).not.toContain(TEXTO_SALAO)
    }
  })

  it('desembarque da caravana: cada jogador que chega lê o texto da cidade, quem estava em outra cena não', () => {
    const porto = viagem('porto', 700, 250, { sceneId: 's-vila', pinId: 'cais' })
    const cais = viagem('cais', 300, 200, { sceneId: 's-mundo', pinId: 'porto' })
    const vila = setArrivalText({ ...createEmptyMap('m-vila', 'Vila', 20, 10, 50), pins: [cais] }, 'Gaivotas e sal.')
    const mapaMundi: MapData = { ...createEmptyMap('m-mundo', 'Mundo', 30, 10, 50), worldMap: true, tokens: [ficha('ana', 700, 250), ficha('bia', 700, 250)], pins: [porto] }
    const w: HostWorld = {
      open: { sceneId: 's-mundo', name: 'Mundo', map: mapaMundi },
      background: [
        { sceneId: 's-vila', name: 'Vila', map: vila },
        { sceneId: 's-cripta', name: 'Cripta', map: cripta([ficha('caio', 600, 200)]) },
      ],
    }
    const { s } = mesa(w)
    const chegadas = s.disembarkCaravan('s-mundo', w)
    expect(chegadas.flatMap((c) => c.outbound)).toEqual([
      { clientId: 'c1', msg: { type: 'scene.changed', by: 'master', chegada: 'Gaivotas e sal.' } },
      { clientId: 'c2', msg: { type: 'scene.changed', by: 'master', chegada: 'Gaivotas e sal.' } },
    ])
  })
})
