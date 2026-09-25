import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Light, MapData, Token } from '../types/map'
import { createHostSession, HIDE_REQUEST_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'
import { parsePlayerMessage, type HostMessage } from './protocol'

/**
 * ESCONDER-SE no host: o "Esconder" do jogador vira PEDIDO ao mestre; só com
 * o "Deixar" a ficha fica oculta para jogadores (`secret`), e de todos. O dono
 * continua recebendo a própria ficha (marcada, para a tela dele esmaecer); os
 * outros não recebem nem o id, nem a tocha presa nela. Andar não desfaz.
 */

const CODE = 'AB12CD'
const RADIUS = 700

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 200, size: 1, image: null, ...extra }
}

const TOCHA_DA_DUDA: Light = { id: 'tocha-duda', x: 250, y: 200, radius: 100, color: '#ffcc66', intensity: 1, attachedTokenId: 'ficha-duda' }

function porto(): MapData {
  return {
    ...createEmptyMap('mapa-porto', 'Porto', 40, 10, 50),
    tokens: [ficha('ficha-duda', 'Duda', 250), ficha('ficha-enzo', 'Enzo', 350), ficha('guarda', 'Guarda', 450)],
    lights: [TOCHA_DA_DUDA],
  }
}

function welcomeOf(result: HostResult): string {
  const first = result.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

function snapshotDe(result: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = result.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

/**
 * Duda e Enzo no Porto. `emFundo` põe o Porto como cena de FUNDO (o mestre
 * olha outra). O mapa do mestre muda à mão, igual ao `hideToken`/`applyMove` do App.
 */
function mesa(emFundo = false) {
  let n = 0
  let at = 1_000_000
  let map = porto()
  const world = (): HostWorld =>
    emFundo
      ? { open: { sceneId: 'cena-taverna', name: 'Taverna', map: createEmptyMap('mapa-taverna', 'Taverna', 40, 10, 50) }, background: [{ sceneId: 'cena-porto', name: 'Porto', map }] }
      : { open: { sceneId: 'cena-porto', name: 'Porto', map }, background: [] }
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => at,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const duda = welcomeOf(s.handleMessage('c-duda', { type: 'join', code: CODE, name: 'Duda' }, world()))
  const enzo = welcomeOf(s.handleMessage('c-enzo', { type: 'join', code: CODE, name: 'Enzo' }, world()))
  s.assignToken(duda, 'ficha-duda')
  s.assignToken(enzo, 'ficha-enzo')
  const patchToken = (tokenId: string, patch: Partial<Token>) => {
    map = { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, ...patch } : t)) }
  }
  const esperar = (ms: number) => {
    at += ms
  }
  /** Segunda ficha da Duda: perder a primeira não a manda de volta à espera. */
  const assignSegunda = () => {
    map = { ...map, tokens: [...map.tokens, ficha('cavalo-duda', 'Cavalo', 150)] }
    s.assignToken(duda, 'cavalo-duda')
  }
  const tirarFicha = (tokenId: string) => {
    map = { ...map, tokens: map.tokens.filter((t) => t.id !== tokenId) }
  }
  return { s, world, duda, enzo, patchToken, esperar, assignSegunda, tirarFicha }
}

const pedir = (m: ReturnType<typeof mesa>, clientId = 'c-duda', tokenId = 'ficha-duda') =>
  m.s.handleMessage(clientId, { type: 'token.hide.request', tokenId }, m.world())

describe('protocolo: token.hide.request', () => {
  it('aceita só o id da ficha; forma torta cai inteira', () => {
    expect(parsePlayerMessage({ type: 'token.hide.request', tokenId: 'ficha-duda', extra: 1 })).toEqual({ type: 'token.hide.request', tokenId: 'ficha-duda' })
    expect(parsePlayerMessage({ type: 'token.hide.request' })).toBeNull()
    expect(parsePlayerMessage({ type: 'token.hide.request', tokenId: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'token.hide.request', tokenId: 7 })).toBeNull()
    expect(parsePlayerMessage({ type: 'token.hide.request', tokenId: 'x'.repeat(65) })).toBeNull()
  })
})

describe('hostSession: esconder-se é pedido ao mestre', () => {
  it('Duda pede: o mestre recebe quem e qual ficha; nada sai para ninguém e a ficha continua à vista', () => {
    const m = mesa()
    const r = pedir(m)
    expect(r.outbound).toEqual([])
    const id = r.hideRequest?.requestId ?? ''
    expect(r.hideRequest).toEqual({ requestId: id, playerId: m.duda, playerName: 'Duda', tokenName: 'Duda' })
    expect(id).not.toBe('')
    expect(r.applyHide).toBeUndefined()
    expect(m.s.isHidePending(id)).toBe(true)
    // Pedir não esconde: só o "Deixar" do mestre.
    expect(snapshotDe(m.s.broadcast(m.world()), 'c-enzo').map.tokens.map((t) => t.id)).toContain('ficha-duda')
  })

  it('ficha que não é dela, que não existe ou que já está escondida: recusa genérica, sem aviso ao mestre', () => {
    const m = mesa()
    for (const tokenId of ['ficha-enzo', 'guarda', 'nao-existe']) {
      const r = pedir(m, 'c-duda', tokenId)
      expect(r.hideRequest).toBeUndefined()
      expect(r.outbound).toEqual([{ clientId: 'c-duda', msg: { type: 'token.hide.rejected', reason: 'unavailable' } }])
      m.esperar(HIDE_REQUEST_MIN_INTERVAL_MS)
    }
    m.patchToken('ficha-duda', { secret: true })
    const jaEscondida = pedir(m)
    expect(jaEscondida.hideRequest).toBeUndefined()
    expect(jaEscondida.outbound).toEqual([{ clientId: 'c-duda', msg: { type: 'token.hide.rejected', reason: 'unavailable' } }])
  })

  it('quem nem entrou recebe not_joined; na cena pausada o pedido não chega ao mestre', () => {
    const m = mesa()
    expect(m.s.handleMessage('c-estranho', { type: 'token.hide.request', tokenId: 'ficha-duda' }, m.world()).outbound).toEqual([
      { clientId: 'c-estranho', msg: { type: 'error', reason: 'not_joined' } },
    ])
    m.s.setScenePaused('cena-porto', true, m.world())
    const pausada = pedir(m)
    expect(pausada.hideRequest).toBeUndefined()
    expect(pausada.outbound).toEqual([{ clientId: 'c-duda', msg: { type: 'token.hide.rejected', reason: 'unavailable' } }])
  })

  it('segundo pedido com um esperando: "pending"; insistir antes do intervalo: "too_soon"', () => {
    const m = mesa()
    const id = pedir(m).hideRequest?.requestId ?? ''
    expect(m.s.isHidePending(id)).toBe(true)
    m.esperar(HIDE_REQUEST_MIN_INTERVAL_MS)
    const denovo = pedir(m)
    expect(denovo.hideRequest).toBeUndefined()
    expect(denovo.outbound).toEqual([{ clientId: 'c-duda', msg: { type: 'token.hide.rejected', reason: 'pending' } }])

    m.s.denyHide(id)
    const cedo = pedir(m)
    expect(cedo.hideRequest).toBeUndefined()
    expect(cedo.outbound).toEqual([{ clientId: 'c-duda', msg: { type: 'token.hide.rejected', reason: 'too_soon' } }])
  })

  it('"Não" do mestre: Duda lê a recusa e o pedido morre', () => {
    const m = mesa()
    const id = pedir(m).hideRequest?.requestId ?? ''
    expect(m.s.denyHide(id).outbound).toEqual([{ clientId: 'c-duda', msg: { type: 'token.hide.rejected', reason: 'denied' } }])
    expect(m.s.isHidePending(id)).toBe(false)
    expect(m.s.approveHide(id, m.world())).toEqual({ outbound: [] })
  })

  it('"Deixar": o integrador recebe qual ficha esconder; a cena de fundo vai junto', () => {
    const aberta = mesa()
    const idAberta = pedir(aberta).hideRequest?.requestId ?? ''
    expect(aberta.s.approveHide(idAberta, aberta.world())).toEqual({ outbound: [], applyHide: { tokenId: 'ficha-duda' } })
    expect(aberta.s.isHidePending(idAberta)).toBe(false)

    const fundo = mesa(true)
    const pedidoFundo = pedir(fundo).hideRequest
    // O mestre olha a Taverna: o aviso diz em que cena ela está.
    expect(pedidoFundo?.sceneName).toBe('Porto')
    expect(fundo.s.approveHide(pedidoFundo?.requestId ?? '', fundo.world())).toEqual({ outbound: [], applyHide: { tokenId: 'ficha-duda', sceneId: 'cena-porto' } })
  })

  it('SEGURANÇA — aceito: some do pacote do Enzo (sem id, sem nome, sem a tocha), esmaecida só no dela; andar não desfaz', () => {
    const m = mesa()
    const id = pedir(m).hideRequest?.requestId ?? ''
    const hide = m.s.approveHide(id, m.world()).applyHide
    if (hide === undefined) throw new Error('esperava a ficha escondida')
    m.patchToken(hide.tokenId, { secret: true })

    const b = m.s.broadcast(m.world())
    const doEnzo = snapshotDe(b, 'c-enzo')
    expect(doEnzo.map.tokens.map((t) => t.id)).toEqual(['ficha-enzo', 'guarda'])
    expect(doEnzo.map.lights.map((l) => l.id)).not.toContain('tocha-duda')
    expect(JSON.stringify(doEnzo)).not.toContain('ficha-duda')
    expect(JSON.stringify(doEnzo)).not.toContain('tocha-duda')
    expect(doEnzo.partyTokens ?? []).not.toContain('ficha-duda')
    const daDuda = snapshotDe(b, 'c-duda')
    expect(daDuda.map.tokens.find((t) => t.id === 'ficha-duda')).toMatchObject({ id: 'ficha-duda', name: 'Duda', secret: true })
    expect(daDuda.ownTokens).toEqual(['ficha-duda'])

    // Duda anda: o host move e a ficha continua escondida.
    const move = m.s.handleMessage('c-duda', { type: 'token.move', reqId: 'r1', tokenId: 'ficha-duda', x: 300, y: 250 }, m.world())
    expect(move.applyMove).toMatchObject({ tokenId: 'ficha-duda', x: 300, y: 250 })
    m.patchToken('ficha-duda', { x: 300, y: 250 })
    const depois = m.s.broadcast(m.world())
    expect(snapshotDe(depois, 'c-enzo').map.tokens.map((t) => t.id)).toEqual(['ficha-enzo', 'guarda'])
    expect(JSON.stringify(snapshotDe(depois, 'c-enzo'))).not.toContain('ficha-duda')
    expect(snapshotDe(depois, 'c-duda').map.tokens.find((t) => t.id === 'ficha-duda')).toMatchObject({ x: 300, y: 250, secret: true })

    // "Revelar para todos" do mestre: `secret` desligado devolve a ficha ao Enzo.
    m.patchToken('ficha-duda', { secret: false })
    expect(snapshotDe(m.s.broadcast(m.world()), 'c-enzo').map.tokens.map((t) => t.id)).toContain('ficha-duda')
  })

  it('pedido de quem saiu morre com a conexão; aprovar depois não esconde nada', () => {
    const m = mesa()
    const id = pedir(m).hideRequest?.requestId ?? ''
    m.s.disconnect('c-duda')
    expect(m.s.isHidePending(id)).toBe(false)
    expect(m.s.approveHide(id, m.world())).toEqual({ outbound: [] })
  })

  it('a ficha trocou de dono entre o pedido e o "Deixar": nada é escondido', () => {
    const m = mesa()
    const id = pedir(m).hideRequest?.requestId ?? ''
    m.s.assignToken(m.enzo, 'ficha-duda')
    const r = m.s.approveHide(id, m.world())
    expect(r.applyHide).toBeUndefined()
    expect(m.s.isHidePending(id)).toBe(false)
  })

  it('a ficha sumiu do mapa antes do "Deixar": Duda lê a recusa genérica', () => {
    const m = mesa()
    m.assignSegunda()
    const id = pedir(m).hideRequest?.requestId ?? ''
    m.tirarFicha('ficha-duda')
    const r = m.s.approveHide(id, m.world())
    expect(r.applyHide).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c-duda', msg: { type: 'token.hide.rejected', reason: 'unavailable' } }])
  })
})
