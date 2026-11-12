/**
 * "FORA DO CHÃO: LIVRE" (`MapData.offFloor`) no FIO: o pacote de verdade que a
 * sessão do mestre entrega e o passo que ela aceita.
 *
 * SEGURANÇA: com a cena livre a visão da ficha passa da borda do Chão e chega
 * ao esconderijo do mestre (`lib/__fixtures__/foraDoChao.ts`). Nada de dentro
 * dele pode sair no pacote, e a memória do explorado não pode marcar o lugar.
 * `lib/fogFilter.foraDoChao.test.ts` prova que o recorte é o da cena sem Chão.
 */
import { describe, expect, it } from 'vitest'
import { DENTRO, ESCONDERIJOS, ESCONDIDOS, LA_FORA, cenaLivreComEsconderijo } from '../lib/__fixtures__/foraDoChao'
import { decodeExploration, isPointExplored } from '../lib/exploration'
import type { MapData } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'

function mesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const welcome = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'heroi')
  return s
}

function snapshotPara(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

describe('SEGURANÇA: cena com Chão e Fora do Chão LIVRE, pela rede', () => {
  it.each(ESCONDERIJOS)('%s: nada de dentro chega ao jogador e o explorado não marca o lugar', (tipo) => {
    const cena = cenaLivreComEsconderijo(tipo)
    const snap = snapshotPara(mesa(cena).broadcast(cena), 'c1')

    const json = JSON.stringify(snap)
    for (const escondido of ESCONDIDOS) expect(json, `vazou ${escondido}`).not.toContain(escondido)
    // A prova de que a cena está livre: a ficha de fora do Chão chega, e a opção também.
    expect(snap.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'la-fora'])
    expect(snap.map.offFloor).toBe('free')

    const explorado = decodeExploration(snap.explored)
    expect(explorado).not.toBeNull()
    if (explorado === null) return
    // Controle: fora do Chão, à vista, a névoa levantou...
    expect(isPointExplored(explorado, LA_FORA)).toBe(true)
    // ...dentro do esconderijo, não.
    expect(isPointExplored(explorado, DENTRO)).toBe(false)
  })
})

describe('Fora do Chão LIVRE: o host aceita o passo', () => {
  const pedido = { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: LA_FORA.x, y: LA_FORA.y } as const

  it('arrasto para fora do Chão é aceito; na cena bloqueada (campo ausente) continua recusado', () => {
    const livre = cenaLivreComEsconderijo('zona oculta')
    const aceito = mesa(livre).handleMessage('c1', pedido, livre)
    expect(aceito.outbound[0]?.msg.type).toBe('token.move.accepted')
    expect(aceito.applyMove).toEqual({ tokenId: 'heroi', x: LA_FORA.x, y: LA_FORA.y })

    const { offFloor: _livre, ...antiga } = livre
    const recusado = mesa(antiga).handleMessage('c1', pedido, antiga).outbound[0]?.msg
    if (recusado?.type !== 'token.move.rejected') throw new Error(`esperava rejected, veio ${String(recusado?.type)}`)
    expect(recusado.reason).toBe('outside_floor')
  })
})
