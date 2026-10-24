/**
 * SONS AO VIVO, fatia F5 (contrato em `docs/planos/sons-f5-plano-tecnico-2026-10-23.md`,
 * seção 2): cada `net_send` leva a lista `liberar` dos áudios que AQUELA
 * mensagem entrega àquela conexão. O servidor da sala só serve `/sons/<id>` a
 * quem foi liberado; o liberado sai junto da mensagem, na ordem por cliente.
 * Quem não recebe o som não ganha a liberação; a tela da mesa entra no "Todos".
 * A ponte e a sessão são as de verdade; só o transporte é falso.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostBridge } from './hostBridge'
import type { HostWorld } from './hostSession'
import type { FonteDeSomNaRede } from './protocol'

const ROOM = { code: 'L1B3RA', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const ID_GRITO = `${'a'.repeat(64)}.mp3`
const ID_CHUVA = `${'b'.repeat(64)}.ogg`
const ID_SINO = `${'c'.repeat(64)}.wav`
const GRITO: FonteDeSomNaRede = { tipo: 'arquivo', midia: ID_GRITO }
const CHUVA: FonteDeSomNaRede = { tipo: 'arquivo', midia: ID_CHUVA }
const TAVERNA = 's-taverna'
const CRIPTA = 's-cripta'

interface Enviado {
  clientId: string
  msg: { type: string; [campo: string]: unknown }
  liberar?: unknown
}

const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 100, size: 1, image: null })

function mundo(): HostWorld {
  const mapa = (id: string, nome: string, fichas: string[]): MapData => ({ ...createEmptyMap(id, nome, 30, 10, 50), tokens: fichas.map((f, i) => ficha(f, 100 + i * 100)) })
  return {
    open: { sceneId: TAVERNA, name: 'Taverna', map: mapa('m-taverna', 'Taverna', ['t-ana']) },
    background: [{ sceneId: CRIPTA, name: 'Cripta', map: mapa('m-cripta', 'Cripta', ['t-caio']) }],
  }
}

/** Ana na Taverna, Caio na Cripta e a TV mostrando a Taverna. */
async function mesa() {
  const agora = mundo()
  const ouvintes = new Map<string, (event: { payload: unknown }) => void>()
  const enviados: Enviado[] = []
  const invoke = vi.fn(async (cmd: string, args?: unknown) => {
    if (cmd === 'net_start_room') return ROOM
    if (cmd === 'net_send') enviados.push(JSON.parse(JSON.stringify(args)))
    return undefined
  })
  const listen = vi.fn(async (nome: string, handler: (event: { payload: unknown }) => void) => {
    ouvintes.set(nome, handler)
    return () => undefined
  })
  const bridge = createHostBridge({ invoke, listen, getMap: () => agora.open.map, getWorld: () => agora, applyMove: vi.fn(), applyDoor: vi.fn() })
  await bridge.start()
  const emit = (nome: string, payload: unknown) => ouvintes.get(nome)?.({ payload })
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  }
  entra('c-ana', 'Ana', 't-ana')
  entra('c-caio', 'Caio', 't-caio')
  const tableKey = bridge.tableKey()
  if (tableKey === null) throw new Error('sala sem chave da tela')
  emit('net:message', { clientId: 'tv', msg: { type: 'join', code: ROOM.code, name: 'Tela da mesa', role: 'table', tableKey } })
  bridge.setTableScene(TAVERNA)
  enviados.length = 0
  const para = (clientId: string) => enviados.filter((e) => e.clientId === clientId)
  return { bridge, enviados, para }
}

/** Os ids liberados nos `net_send` a esta conexão, na ordem. */
const liberadosA = (enviados: Enviado[]): unknown[] => enviados.flatMap((e) => (Array.isArray(e.liberar) ? e.liberar : []))

describe('hostBridge: net_send libera o áudio só a quem recebe a mensagem', () => {
  it('"Só a cena": Ana e a TV (que mostra a cena) ganham a liberação junto do som.tocar; Caio, na Cripta, nunca', async () => {
    const { bridge, enviados, para } = await mesa()
    expect(bridge.tocarSomAoVivo({ instancia: 'som-1', fonte: GRITO, volume: 0.8, loop: false }, { tipo: 'cena', sceneId: TAVERNA })).toEqual({ ok: true, enviados: 2 })
    // Depois, um som só para a Cripta: o envio de Caio leva o sino, nunca o grito que ele não recebeu.
    bridge.tocarSomAoVivo({ instancia: 'som-2', fonte: { tipo: 'arquivo', midia: ID_SINO }, volume: 0.8, loop: false }, { tipo: 'cena', sceneId: CRIPTA })
    await vi.waitFor(() => expect(para('c-caio').length).toBeGreaterThan(0))
    for (const clientId of ['c-ana', 'tv']) {
      const tocar = para(clientId).find((e) => e.msg.type === 'som.tocar')
      expect(tocar?.liberar, `liberação para ${clientId}`).toEqual([ID_GRITO])
      expect(liberadosA(para(clientId)), clientId).toEqual([ID_GRITO])
    }
    expect(liberadosA(para('c-caio'))).toEqual([ID_SINO])
    // Mensagem que não é de som não leva o campo (o Rust de hoje ignora; o da F5a só lê quando há).
    expect(enviados.filter((e) => !e.msg.type.startsWith('som.')).every((e) => !('liberar' in e))).toBe(true)
  })

  it('"Todos" inclui a tela da mesa; parar e volume não liberam nada', async () => {
    const { bridge, enviados, para } = await mesa()
    bridge.tocarSomAoVivo({ instancia: 'som-chuva', fonte: CHUVA, volume: 0.6, loop: true }, { tipo: 'todos' })
    bridge.volumeDoSom('som-chuva', 0.3)
    bridge.pararSomAoVivo('som-chuva')
    await vi.waitFor(() => expect(para('tv').filter((e) => e.msg.type.startsWith('som.'))).toHaveLength(3))
    for (const clientId of ['c-ana', 'c-caio', 'tv']) expect(liberadosA(para(clientId)), clientId).toEqual([ID_CHUVA])
    expect(enviados.filter((e) => e.msg.type === 'som.parar' || e.msg.type === 'som.volume').every((e) => !('liberar' in e))).toBe(true)
  })

  it('a pré-carga libera só à audiência dela', async () => {
    const { bridge, para } = await mesa()
    expect(bridge.precarregarSonsAoVivo([ID_SINO, ID_GRITO], { tipo: 'cena', sceneId: CRIPTA })).toBe(1)
    await vi.waitFor(() => expect(para('c-caio').some((e) => e.msg.type === 'som.precarregar')).toBe(true))
    expect(para('c-caio').find((e) => e.msg.type === 'som.precarregar')?.liberar).toEqual([ID_SINO, ID_GRITO])
    expect(liberadosA(para('c-ana'))).toEqual([])
    expect(liberadosA(para('tv'))).toEqual([])
  })
})
