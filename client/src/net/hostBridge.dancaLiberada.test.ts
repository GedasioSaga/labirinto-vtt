import { describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import { minigamePadrao } from '../lib/pins'
import type { MinigameDanca, MusicaDaDanca, NotaDaDanca } from '../minigames/danca/tipos'
import type { MapData, Token } from '../types/map'
import { createHostBridge } from './hostBridge'
import { midiasDaMensagem } from './liberacaoDosSons'

/**
 * SONS F5d, lado do mestre: a música importada da dança sai pela rota com
 * chave (`/sons/<id>`), e o servidor só a entrega à conexão a quem o host a
 * liberou. A liberação vai no MESMO `net_send` do `danca.convite` (o jogador
 * baixa a música assim que o convite chega, bem antes do `danca.comecar`), e
 * só a quem foi chamado. A faixa demo não libera nada.
 */

const ROOM = { code: 'D4NC4R', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const ID = `${'ab'.repeat(32)}.wav`
const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 200, size: 1, image: null })

function importada(notas: number): MusicaDaDanca {
  const coreografia: NotaDaDanca[] = Array.from({ length: notas }, (_, i) => ({ t: 1 + i * 0.25, lane: (i % 4) as NotaDaDanca['lane'], len: 0, sub: 4 })) // i % 4 cabe nas 4 trilhas
  return { tipo: 'arquivo', midia: `midia:${ID}`, nome: 'Funky', bpm: 120, primeiraBatida: 0.5, fase4: 0, duracaoS: 1 + notas * 0.25, coreografias: { diversao: coreografia, expert: coreografia } }
}

function mapa(musica: MusicaDaDanca): MapData {
  const minigame: MinigameDanca = { ...minigamePadrao(), musica }
  const pino = { ...buildPin('pino-danca', { x: 300, y: 300 }, 'minigame'), minigame }
  return { ...createEmptyMap('m', 'Salão', 1000, 1000, 50), pins: [pino], tokens: [ficha('ficha-gabi', 100), ficha('ficha-ana', 200), ficha('ficha-bia', 300)] }
}

type Envio = { clientId: string; tipo: unknown; liberar: unknown }

async function mesa(musica: MusicaDaDanca, aceitaGzip = false) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const map = mapa(musica)
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove: vi.fn(), applyDoor: vi.fn(), now: () => 0 })
  await bridge.start()
  const emit = (name: string, payload: unknown) => handlers.get(name)?.({ payload })
  const entra = (clientId: string, name: string, tokenId: string): string => {
    emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name, ...(aceitaGzip ? { accept: ['gzip'] } : {}) } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
    return player.playerId
  }
  const ids = { gabi: entra('c-gabi', 'Gabi', 'ficha-gabi'), ana: entra('c-ana', 'Ana', 'ficha-ana'), bia: entra('c-bia', 'Bia', 'ficha-bia') }
  /** Cada `net_send`: para quem, o tipo da mensagem (ou do envelope) e o que liberou. */
  const envios = (): Envio[] =>
    invoke.mock.calls
      .filter(([cmd]) => cmd === 'net_send')
      .map(([, args]) => {
        const carga: unknown = Reflect.get(Object(args), 'msg')
        return { clientId: String(Reflect.get(Object(args), 'clientId')), tipo: Reflect.get(Object(carga), 'type') ?? (Reflect.has(Object(carga), 'gz') ? 'gz' : null), liberar: Reflect.get(Object(args), 'liberar') }
      })
  /** Deixa a fila de saída (a compressão é assíncrona) esvaziar. */
  const assentar = async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return { bridge, emit, invoke, envios, assentar, ...ids }
}

describe('hostBridge: a música da dança é liberada no convite (F5d)', () => {
  it('o danca.convite libera a música só a quem foi chamado, no mesmo net_send, antes do danca.comecar', async () => {
    const { bridge, emit, invoke, envios, gabi, ana } = await mesa(importada(8))
    invoke.mockClear()
    const convite = bridge.convidarParaDanca('pino-danca', [gabi, ana])
    if (convite === null || !convite.ok) throw new Error('o convite devia ter saído')
    const convites = envios().filter((e) => e.tipo === 'danca.convite')
    expect(convites.map((e) => e.clientId).sort()).toEqual(['c-ana', 'c-gabi'])
    for (const e of convites) expect(e.liberar).toEqual([ID])
    // Quem não foi chamado não recebe convite nem liberação.
    expect(envios().filter((e) => e.clientId === 'c-bia')).toEqual([])
    // Nada além do convite libera: o resto da dança sai sem o campo.
    for (const clientId of ['c-gabi', 'c-ana']) emit('net:message', { clientId, msg: { type: 'danca.pronto', sessao: convite.sessao, dificuldade: 'diversao' } })
    expect(bridge.comecarDanca()).toBe(true)
    const todos = envios()
    const primeiroComecar = todos.findIndex((e) => e.tipo === 'danca.comecar')
    expect(primeiroComecar).toBeGreaterThan(-1)
    expect(todos.findIndex((e) => e.tipo === 'danca.convite' && e.clientId === 'c-gabi')).toBeLessThan(primeiroComecar)
    expect(todos.filter((e) => e.tipo !== 'danca.convite').every((e) => e.liberar === undefined)).toBe(true)
  })

  it('a faixa demo não libera nada', async () => {
    const { bridge, invoke, envios, gabi } = await mesa({ tipo: 'demo' })
    invoke.mockClear()
    expect(bridge.convidarParaDanca('pino-danca', [gabi])?.ok).toBe(true)
    expect(envios().filter((e) => e.tipo === 'danca.convite')).toEqual([{ clientId: 'c-gabi', tipo: 'danca.convite', liberar: undefined }])
  })

  it('o convite grande vai comprimido (gzip) e a liberação vai junto, lida da mensagem e não do envelope', async () => {
    const { bridge, invoke, envios, assentar, gabi } = await mesa(importada(2500), true)
    await assentar()
    invoke.mockClear()
    expect(bridge.convidarParaDanca('pino-danca', [gabi])?.ok).toBe(true)
    await assentar()
    const paraGabi = envios().filter((e) => e.clientId === 'c-gabi')
    expect(paraGabi[0]).toEqual({ clientId: 'c-gabi', tipo: 'gz', liberar: [ID] })
  })
})

describe('midiasDaMensagem: o convite da dança', () => {
  it('libera a música importada pelo id (sem o prefixo midia:); demo, id torto e convite torto não liberam', () => {
    const convite = (musica: unknown) => ({
      type: 'danca.convite',
      sessao: 's',
      pinId: 'p',
      npc: 'Dona Ziza',
      fala: 'Dança comigo?',
      permitida: 'escolha',
      notaMin: 'B',
      premio: { tipo: 'nada', texto: '' },
      musica,
      participantes: [{ playerId: 'p1', nome: 'Gabi' }],
    })
    expect(midiasDaMensagem(convite(importada(4)))).toEqual([ID])
    expect(midiasDaMensagem(convite({ tipo: 'demo' }))).toEqual([])
    expect(midiasDaMensagem(convite({ ...importada(4), midia: 'midia:../../segredo.wav' }))).toEqual([])
    expect(midiasDaMensagem({ ...convite(importada(4)), sessao: 42 })).toEqual([])
  })
})
