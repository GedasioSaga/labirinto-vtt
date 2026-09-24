/**
 * PAUSA POR CENA (G12) no host: o mestre congela quem está numa cena. A cena
 * de cada jogador é a da ficha DELE (`sceneFor`). Quem está na cena pausada
 * não move, não abre porta e não pede passagem; quem está em outra continua
 * jogando e não recebe NADA da pausa (nem o frame: saber que "alguma cena
 * pausou" já diria que existe outro grupo em outro lugar).
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino']): Pin {
  return { id, x, y, kind: 'viagem', description: id, image: null, destino }
}

function mapa(id: string, nome: string, tokens: Token[], pins: Pin[] = []): MapData {
  return { ...createEmptyMap(id, nome, 40, 10, 50), tokens, pins }
}

const SALAO: HostScene = {
  sceneId: 's-salao',
  name: 'Salao Norte',
  map: mapa('m-salao', 'Salao Norte', [ficha('lanterna', 200, 200)], [viagem('alcapao', 400, 200, { sceneId: 's-cripta', pinId: 'fundo' })]),
}
const CRIPTA: HostScene = {
  sceneId: 's-cripta',
  name: 'Cripta Rubra',
  map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 200, 200)], [viagem('fundo', 1000, 250, { sceneId: 's-salao', pinId: 'alcapao' })]),
}

/** Salão (aberto no editor) com a ficha de Ana; Cripta (de fundo) com a de Bruno. */
const mundo: HostWorld = { open: SALAO, background: [CRIPTA] }

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, w: HostWorld = mundo): { playerId: string; r: HostResult } {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, w)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return { playerId: welcome.playerId, r }
}

function mesa() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000_000, randomId: () => `id-${(n += 1)}` })
  const ana = entra(s, 'c1', 'Ana').playerId
  const bruno = entra(s, 'c2', 'Bruno').playerId
  s.assignToken(ana, 'lanterna')
  s.assignToken(bruno, 'machado')
  s.broadcast(mundo)
  return { s, ana, bruno }
}

const mover = (s: ReturnType<typeof createHostSession>, clientId: string, tokenId: string, x: number, reqId = 'r1'): HostResult =>
  s.handleMessage(clientId, { type: 'token.move', reqId, tokenId, x, y: 200 }, mundo)

/** Só o `scene.paused` de cada conexão, na ordem em que saiu. */
function pausas(r: HostResult): { clientId: string; paused: boolean }[] {
  return r.outbound.flatMap((o) => (o.msg.type === 'scene.paused' ? [{ clientId: o.clientId, paused: o.msg.paused }] : []))
}

describe('hostSession: pausa por cena', () => {
  it('pausar avisa só quem está na cena pausada, sem id nem nome de cena', () => {
    const { s } = mesa()
    const r = s.setScenePaused('s-salao', true, mundo)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.paused', paused: true } }])
    const texto = JSON.stringify(r.outbound)
    expect(texto).not.toContain('s-salao')
    expect(texto).not.toContain('Salao Norte')
    expect(texto).not.toContain('sceneId')
    // Bruno, na Cripta, não recebe nem o frame.
    expect(r.outbound.some((o) => o.clientId === 'c2')).toBe(false)
    expect(s.isScenePaused('s-salao')).toBe(true)
    expect(s.isScenePaused('s-cripta')).toBe(false)
  })

  it('com a cena pausada, o movimento é recusado com `paused` e nada chega ao mapa do mestre', () => {
    const { s } = mesa()
    s.setScenePaused('s-salao', true, mundo)
    const r = mover(s, 'c1', 'lanterna', 350)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.rejected', reqId: 'r1', reason: 'paused' } }])
    expect(r.applyMove).toBeUndefined()
  })

  it('quem está em OUTRA cena continua movendo', () => {
    const { s } = mesa()
    s.setScenePaused('s-salao', true, mundo)
    const r = mover(s, 'c2', 'machado', 350)
    expect(r.outbound[0]?.msg.type).toBe('token.move.accepted')
    expect(r.applyMove).toMatchObject({ tokenId: 'machado', sceneId: 's-cripta' })
  })

  it('despausar avisa de novo só quem está lá, e o movimento volta a valer', () => {
    const { s } = mesa()
    s.setScenePaused('s-salao', true, mundo)
    const r = s.setScenePaused('s-salao', false, mundo)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.paused', paused: false } }])
    expect(s.isScenePaused('s-salao')).toBe(false)
    const move = mover(s, 'c1', 'lanterna', 350)
    expect(move.outbound[0]?.msg.type).toBe('token.move.accepted')
    expect(move.applyMove).toMatchObject({ tokenId: 'lanterna' })
  })

  it('pausar de novo a mesma cena não repete o aviso', () => {
    const { s } = mesa()
    s.setScenePaused('s-salao', true, mundo)
    expect(s.setScenePaused('s-salao', true, mundo)).toEqual({ outbound: [] })
  })

  it('porta e pedido de passagem também param na cena pausada', () => {
    const { s } = mesa()
    // Controle: sem pausa, porta inexistente responde `not_visible` e o pino vira pedido ao mestre.
    const portaSolta = s.handleMessage('c1', { type: 'door.toggle', wallId: 'nao-existe' }, mundo)
    expect(portaSolta.outbound[0]?.msg.type).toBe('door.toggle.rejected')

    s.setScenePaused('s-salao', true, mundo)
    // Pausada, a porta morre em silêncio (o aviso fixo da pausa já explica).
    expect(s.handleMessage('c1', { type: 'door.toggle', wallId: 'nao-existe' }, mundo)).toEqual({ outbound: [] })
    const pedido = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'alcapao' }, mundo)
    expect(pedido.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.travel.rejected', reason: 'unavailable' } }])
    expect(pedido.travelRequest).toBeUndefined()
    expect(pedido.applyTransfer).toBeUndefined()

    // Despausada, o mesmo pedido chega ao mestre (a recusa da pausa não gastou o limite).
    s.setScenePaused('s-salao', false, mundo)
    expect(s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'alcapao' }, mundo).travelRequest).toMatchObject({ toSceneId: 's-cripta' })
  })

  it('quem volta (resume) para a cena pausada já chega com o aviso, depois do mapa', () => {
    const { s } = mesa()
    const caio = s.handleMessage('c9', { type: 'join', code: CODE, name: 'Caio' }, mundo).outbound[0]?.msg
    if (caio?.type !== 'welcome') throw new Error('esperava welcome')
    // Caio fica com a ficha do Salão (sai de Ana, que volta a aguardar).
    s.assignToken(caio.playerId, 'lanterna')
    s.setScenePaused('s-salao', true, mundo)
    s.disconnect('c9')
    // Tela nova (outra conexão): precisa receber o aviso de novo.
    const volta = s.handleMessage('c10', { type: 'join', code: CODE, name: 'Caio', resume: caio.resumeToken }, mundo)
    expect(volta.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'snapshot', 'scene.paused'])
    expect(pausas(volta)).toEqual([{ clientId: 'c10', paused: true }])

    // Quem entra sem ficha (aguardando) não recebe pausa nenhuma.
    expect(pausas(s.handleMessage('c11', { type: 'join', code: CODE, name: 'Dora' }, mundo))).toEqual([])
  })

  it('quem troca de cena recebe a pausa da cena NOVA pelo broadcast', () => {
    const { s } = mesa()
    s.setScenePaused('s-cripta', true, mundo)
    // Ana passa do Salão (solto) para a Cripta (pausada).
    const anaNaCripta: HostWorld = {
      open: { ...SALAO, map: { ...SALAO.map, tokens: [] } },
      background: [{ ...CRIPTA, map: { ...CRIPTA.map, tokens: [ficha('machado', 200, 200), ficha('lanterna', 250, 200)] } }],
    }
    expect(pausas(s.broadcast(anaNaCripta))).toEqual([{ clientId: 'c1', paused: true }])
    // E volta: o aviso sai.
    expect(pausas(s.broadcast(mundo))).toEqual([{ clientId: 'c1', paused: false }])
  })

  it('quem aguarda sem ficha não recebe a pausa', () => {
    const { s } = mesa()
    entra(s, 'c3', 'Dora')
    const r = s.setScenePaused('s-salao', true, mundo)
    expect(r.outbound.some((o) => o.clientId === 'c3')).toBe(false)
  })

  it('mapa solto (sem aventura) nunca fica pausado', () => {
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const solto: HostWorld = { open: { sceneId: null, name: 'Mapa', map: mapa('m-solto', 'Mapa', [ficha('lanterna', 200, 200)]) }, background: [] }
    const welcome = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, solto).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, 'lanterna')
    s.setScenePaused('', true, solto)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'lanterna', x: 300, y: 200 }, solto)
    expect(r.outbound[0]?.msg.type).toBe('token.move.accepted')
  })
})
