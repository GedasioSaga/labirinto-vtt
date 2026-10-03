/**
 * CHAT DOS JOGADORES na ponte do mestre (fatia D): a fala de um jogador chega
 * à tela do mestre (`onMasterChatChange`), e a do mestre sai pelo `net_send`
 * a toda a mesa com `fromMaster`. Fatia B: a conversa vai para o disco
 * (`loadChat`, `appendChat`, `deleteChat`) e volta quando a sala reabre.
 */
import { describe, expect, it, vi } from 'vitest'
import { createChatStore, readChatLines, type ChatFs } from '../lib/chatStore'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Token } from '../types/map'
import type { MasterChatState } from './hostSession'
import { CHAT_LOAD_FAILED_TEXT, CHAT_SAVE_FAILED_TEXT, createHostBridge, type HostBridgeDeps } from './hostBridge'
import type { ChatEntry } from './protocol'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, x: number): Token {
  return { id, characterId: null, name: id, x, y: 100, size: 1, image: null }
}

type Envio = { clientId: string; msg: { type: string; [key: string]: unknown } }

async function salaComDois() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onMasterChatChange = vi.fn<(chat: MasterChatState) => void>()
  const mapa = { ...createEmptyMap('m', 'M', 10, 10, 50), tokens: [ficha('lanterna', 100), ficha('machado', 200)] }
  const bridge = createHostBridge({ invoke, listen, getMap: () => mapa, applyMove: vi.fn(), applyDoor: vi.fn(), onMasterChatChange, now: () => 0 })
  await bridge.start()
  const emit = (payload: unknown) => handlers.get('net:message')?.({ payload })
  const enviados = (): Envio[] =>
    invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1] as Envio)
  const idDe = (clientId: string): string => {
    const welcome = enviados().find((e) => e.clientId === clientId && e.msg.type === 'welcome')
    if (welcome === undefined) throw new Error(`sem welcome de ${clientId}`)
    return String(welcome.msg.playerId)
  }
  emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  emit({ clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bruno' } })
  await Promise.resolve()
  bridge.assignToken(idDe('c1'), 'lanterna')
  bridge.assignToken(idDe('c2'), 'machado')
  invoke.mockClear()
  const chat = () => enviados().filter((e) => e.msg.type === 'chat.msg')
  const apagados = () => enviados().filter((e) => e.msg.type === 'chat.delete')
  return { bridge, emit, chat, apagados, onMasterChatChange }
}

describe('hostBridge: chat do mestre', () => {
  it('a fala de Ana chega à tela do mestre, com a cena e o Global', async () => {
    const t = await salaComDois()
    t.emit({ clientId: 'c1', msg: { type: 'chat.send', reqId: 'r1', channel: 'cena', text: '@mestre posso?', mentions: ['mestre'] } })
    await Promise.resolve()
    expect(t.onMasterChatChange).toHaveBeenCalledTimes(1)
    const lido = t.onMasterChatChange.mock.calls[0]?.[0]
    expect(lido?.scenes).toEqual([{ key: 'm', name: 'M', messages: [{ id: expect.any(String), at: 0, from: 'Ana', text: '@mestre posso?', mentions: ['mestre'] }] }])
  })

  it('o mestre fala no Global: sai a todos com fromMaster e a tela dele relê', async () => {
    const t = await salaComDois()
    expect(t.bridge.masterChatSend('Pausa de 5 minutos')).toBe(true)
    await Promise.resolve()
    expect(t.chat().map((e) => e.clientId).sort()).toEqual(['c1', 'c2'])
    expect(t.chat()[0]?.msg).toMatchObject({ channel: 'global', msg: { from: 'Mestre', text: 'Pausa de 5 minutos', fromMaster: true } })
    expect(t.onMasterChatChange.mock.calls.at(-1)?.[0].global).toHaveLength(1)
    expect(t.bridge.masterChatSend('   ')).toBe(false)
  })

  it('o mestre apaga: chat.delete sai a quem tem a lista e a tela dele relê sem a linha', async () => {
    const t = await salaComDois()
    t.emit({ clientId: 'c2', msg: { type: 'chat.send', reqId: 'r1', channel: 'global', text: 'palavrão', mentions: [] } })
    await Promise.resolve()
    const id = t.onMasterChatChange.mock.calls.at(-1)?.[0].global[0]?.id ?? ''
    expect(t.bridge.masterChatDelete(null, id)).toBe(true)
    await Promise.resolve()
    expect(t.apagados().map((e) => e.clientId).sort()).toEqual(['c1', 'c2'])
    expect(t.onMasterChatChange.mock.calls.at(-1)?.[0].global).toEqual([])
    expect(t.bridge.masterChatDelete(null, id)).toBe(false)
  })

  it('sala fechada: não manda nem apaga nada', () => {
    const bridge = createHostBridge({ invoke: vi.fn(), listen: vi.fn(), getMap: () => createEmptyMap('m', 'M', 10, 10, 50), applyMove: vi.fn(), applyDoor: vi.fn() })
    expect(bridge.masterChatSend('oi')).toBe(false)
    expect(bridge.masterChatDelete(null, 'x')).toBe(false)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// CHAT SALVO (fatia B): o disco entra pela ponte (loadChat, appendChat, deleteChat)
// ───────────────────────────────────────────────────────────────────────────

/** Disco de memória no contrato do Tauri, para o `createChatStore` de verdade. */
function discoDeMemoria(): { fs: ChatFs; arquivos: Map<string, string> } {
  const arquivos = new Map<string, string>()
  const pastas = new Set<string>()
  const fs: ChatFs = {
    baseDir: async () => 'C:/appdata',
    join: async (...parts) => parts.join('/'),
    exists: async (path) => arquivos.has(path) || pastas.has(path),
    ensureDir: async (path) => {
      pastas.add(path)
    },
    readTextFile: async (path) => arquivos.get(path) ?? '',
    writeTextFile: async (path, data, append) => {
      arquivos.set(path, append ? (arquivos.get(path) ?? '') + data : data)
    },
    listFiles: async (path) => [...arquivos.keys()].filter((p) => p.startsWith(`${path}/`)).map((p) => p.slice(path.length + 1)),
  }
  return { fs, arquivos }
}

const GLOBAL_JSONL = 'C:/appdata/chat/adv_vale/global.jsonl'
const CENA_JSONL = 'C:/appdata/chat/adv_vale/cena-m.jsonl'

async function salaSalva(disco: Partial<Pick<HostBridgeDeps, 'loadChat' | 'appendChat' | 'deleteChat'>>) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onMasterChatChange = vi.fn<(chat: MasterChatState) => void>()
  const mapa = { ...createEmptyMap('m', 'M', 10, 10, 50), tokens: [ficha('lanterna', 100), ficha('machado', 200)] }
  const bridge = createHostBridge({ invoke, listen, getMap: () => mapa, applyMove: vi.fn(), applyDoor: vi.fn(), onMasterChatChange, now: () => 0, ...disco })
  const emit = (payload: unknown) => handlers.get('net:message')?.({ payload })
  const enviados = (): Envio[] => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1] as Envio)
  /** Entra com o nome e recebe a ficha: é quando a história do Global chega. */
  const senta = async (clientId: string, nome: string, tokenId: string) => {
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name: nome } })
    await Promise.resolve()
    const welcome = enviados().filter((e) => e.clientId === clientId && e.msg.type === 'welcome').at(-1)
    if (welcome === undefined) throw new Error(`sem welcome de ${clientId}`)
    bridge.assignToken(String(welcome.msg.playerId), tokenId)
  }
  const historias = (clientId: string, channel: 'global' | 'cena') =>
    enviados().filter((e) => e.clientId === clientId && e.msg.type === 'chat.history' && e.msg.channel === channel)
  return { bridge, invoke, emit, enviados, senta, historias, onMasterChatChange }
}

/** As promessas do disco (fila do store) andam até o fim. */
const discoTermina = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('hostBridge: chat salvo no disco', () => {
  it('ida e volta: conversa, fecha a sala, reabre, e quem volta recebe a história; a apagada não volta', async () => {
    const disco = discoDeMemoria()
    const store = createChatStore(disco.fs, 'adv_vale')
    const t = await salaSalva({ loadChat: () => store.load(), appendChat: (k, e) => store.append(k, e), deleteChat: (k, id) => store.remove(k, id) })
    await t.bridge.start()
    await t.senta('c1', 'Ana', 'lanterna')
    t.emit({ clientId: 'c1', msg: { type: 'chat.send', reqId: 'r1', channel: 'cena', text: 'porta trancada', mentions: [] } })
    t.emit({ clientId: 'c1', msg: { type: 'chat.send', reqId: 'r2', channel: 'global', text: 'palavrão', mentions: [] } })
    await Promise.resolve()
    expect(t.bridge.masterChatSend('Pausa de 5 minutos')).toBe(true)
    const apagar = t.onMasterChatChange.mock.calls.at(-1)?.[0].global.find((e) => e.text === 'palavrão')?.id ?? ''
    expect(t.bridge.masterChatDelete(null, apagar)).toBe(true)
    await discoTermina()
    expect(readChatLines(disco.arquivos.get(GLOBAL_JSONL) ?? '').map((e) => e.text)).toEqual(['Pausa de 5 minutos'])
    expect(readChatLines(disco.arquivos.get(CENA_JSONL) ?? '').map((e) => e.text)).toEqual(['porta trancada'])

    await t.bridge.stop()
    t.invoke.mockClear()
    t.onMasterChatChange.mockClear()
    await t.bridge.start()
    // O mestre já vê a conversa ao abrir, marcada como já lida, e nada sai como fala nova.
    const aberto = t.onMasterChatChange.mock.calls.at(-1)?.[0]
    expect(aberto?.global.map((e) => e.text)).toEqual(['Pausa de 5 minutos'])
    expect(aberto?.scenes.map((s) => s.messages.map((e) => e.text))).toEqual([['porta trancada']])
    const ids = [...(aberto?.global ?? []), ...(aberto?.scenes[0]?.messages ?? [])].map((e) => e.id).sort()
    expect([...(aberto?.restoredIds ?? [])].sort()).toEqual(ids)
    await t.senta('c9', 'Ana', 'lanterna')
    expect(t.historias('c9', 'global').at(-1)?.msg.messages).toEqual([expect.objectContaining({ text: 'Pausa de 5 minutos', fromMaster: true })])
    expect(t.historias('c9', 'cena').at(-1)?.msg.messages).toEqual([expect.objectContaining({ text: 'porta trancada', from: 'Ana' })])
    expect(t.enviados().filter((e) => e.msg.type === 'chat.msg')).toEqual([])
  })

  it('cada envio, do jogador e do mestre, é gravado no canal certo', async () => {
    const appendChat = vi.fn(async (_sceneKey: string | null, _entry: ChatEntry) => undefined)
    const t = await salaSalva({ appendChat })
    await t.bridge.start()
    await t.senta('c1', 'Ana', 'lanterna')
    t.emit({ clientId: 'c1', msg: { type: 'chat.send', reqId: 'r1', channel: 'cena', text: 'na cena', mentions: [] } })
    t.emit({ clientId: 'c1', msg: { type: 'chat.send', reqId: 'r2', channel: 'global', text: 'no global', mentions: [] } })
    await Promise.resolve()
    t.bridge.masterChatSend('do mestre')
    expect(appendChat.mock.calls.map(([key, entry]) => [key, entry.text, entry.fromMaster ?? false])).toEqual([
      ['m', 'na cena', false],
      [null, 'no global', false],
      [null, 'do mestre', true],
    ])
    // Recusado (texto vazio) não grava nada.
    t.bridge.masterChatSend('   ')
    expect(appendChat).toHaveBeenCalledTimes(3)
  })

  it('apagar chama o disco com o canal e o id; linha que não existe não chama', async () => {
    const deleteChat = vi.fn(async (_sceneKey: string | null, _id: string) => undefined)
    const t = await salaSalva({ deleteChat })
    await t.bridge.start()
    await t.senta('c1', 'Ana', 'lanterna')
    t.emit({ clientId: 'c1', msg: { type: 'chat.send', reqId: 'r1', channel: 'cena', text: 'oi', mentions: [] } })
    await Promise.resolve()
    const id = t.onMasterChatChange.mock.calls.at(-1)?.[0].scenes[0]?.messages[0]?.id ?? ''
    expect(t.bridge.masterChatDelete('m', id)).toBe(true)
    expect(deleteChat).toHaveBeenCalledWith('m', id)
    expect(t.bridge.masterChatDelete('m', id)).toBe(false)
    expect(deleteChat).toHaveBeenCalledTimes(1)
  })

  it('disco cheio ou sem permissão: o chat segue em memória e o mestre vê UM aviso curto', async () => {
    useToastStore.setState({ toasts: [] })
    const appendChat = vi.fn(async () => {
      throw new Error('ENOSPC: disco cheio')
    })
    const deleteChat = vi.fn((): Promise<void> => {
      throw new Error('os error 5: acesso negado')
    })
    const t = await salaSalva({ appendChat, deleteChat })
    await t.bridge.start()
    await t.senta('c1', 'Ana', 'lanterna')
    await t.senta('c2', 'Bruno', 'machado')
    t.emit({ clientId: 'c1', msg: { type: 'chat.send', reqId: 'r1', channel: 'global', text: 'um', mentions: [] } })
    await discoTermina()
    t.emit({ clientId: 'c2', msg: { type: 'chat.send', reqId: 'r2', channel: 'global', text: 'dois', mentions: [] } })
    expect(t.bridge.masterChatSend('três')).toBe(true)
    await discoTermina()
    // As três falas chegaram a Ana, e o envio dela foi confirmado.
    const falas = t.enviados().filter((e) => e.msg.type === 'chat.msg' && e.clientId === 'c1')
    expect(falas.map((e) => (e.msg.msg as ChatEntry).text)).toEqual(['um', 'dois', 'três'])
    expect(t.enviados().some((e) => e.clientId === 'c1' && e.msg.type === 'chat.send.result' && e.msg.ok === true)).toBe(true)
    // Apagar com o disco lançando na hora: some da tela mesmo assim.
    const id = t.onMasterChatChange.mock.calls.at(-1)?.[0].global[0]?.id ?? ''
    expect(t.bridge.masterChatDelete(null, id)).toBe(true)
    expect(t.onMasterChatChange.mock.calls.at(-1)?.[0].global.map((e) => e.text)).toEqual(['dois', 'três'])
    await discoTermina()
    expect(appendChat).toHaveBeenCalledTimes(3)
    expect(useToastStore.getState().toasts.filter((toast) => toast.text === CHAT_SAVE_FAILED_TEXT)).toHaveLength(1)
  })

  it('histórico que não abre: a sala abre sem ele, com aviso', async () => {
    useToastStore.setState({ toasts: [] })
    const t = await salaSalva({
      loadChat: async () => {
        throw new Error('os error 5: acesso negado')
      },
    })
    await expect(t.bridge.start()).resolves.toEqual(ROOM)
    expect(t.onMasterChatChange).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts.map((toast) => toast.text)).toContain(CHAT_LOAD_FAILED_TEXT)
  })
})
