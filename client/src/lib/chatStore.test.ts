/**
 * CHAT SALVO (fatia B de docs/plano-chat.md): um JSONL por canal em
 * `$APPDATA/chat/<tableId>/`, gravado em fila e lido de volta ao abrir a sala.
 */
import { describe, expect, it } from 'vitest'
import type { ChatEntry } from '../net/protocol'
import { CHAT_HISTORY_MAX } from './chat'
import { chatChannelFile, chatLine, createChatStore, readChatLines, sceneKeyOfFile, withoutChatLine, type ChatFs } from './chatStore'

const BASE = 'C:/appdata'
const MESA = 'adv_vale'
const PASTA = `${BASE}/chat/${MESA}`

function linha(id: string, text = `fala ${id}`, extra: Partial<ChatEntry> = {}): ChatEntry {
  return { id, at: 1000, from: 'Ana', text, mentions: [], ...extra }
}

/** Disco de memória com o mesmo contrato do Tauri; `quebrar` faz a próxima escrita lançar. */
function discoDeMemoria() {
  const arquivos = new Map<string, string>()
  const pastas = new Set<string>()
  const falha = { escrita: null as Error | null, leitura: null as Error | null }
  const escritas: { path: string; append: boolean }[] = []
  const fs: ChatFs = {
    baseDir: async () => BASE,
    join: async (...parts) => parts.join('/'),
    exists: async (path) => arquivos.has(path) || pastas.has(path),
    ensureDir: async (path) => {
      pastas.add(path)
    },
    readTextFile: async (path) => {
      if (falha.leitura !== null) throw falha.leitura
      const texto = arquivos.get(path)
      if (texto === undefined) throw new Error(`não existe: ${path}`)
      return texto
    },
    writeTextFile: async (path, data, append) => {
      if (falha.escrita !== null) throw falha.escrita
      escritas.push({ path, append })
      arquivos.set(path, append ? (arquivos.get(path) ?? '') + data : data)
    },
    listFiles: async (path) =>
      [...arquivos.keys()].filter((p) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes('/')).map((p) => p.slice(path.length + 1)),
  }
  return { fs, arquivos, pastas, falha, escritas }
}

describe('chatStore: a linha e o arquivo', () => {
  it('a linha leva só {id, at, from, fromMaster?, text, mentions}, uma por linha', () => {
    const comLixo = { ...linha('a'), cena: 'scene_x' } as ChatEntry
    expect(chatLine(comLixo)).toBe('{"id":"a","at":1000,"from":"Ana","text":"fala a","mentions":[]}\n')
    expect(chatLine(linha('m', 'oi', { from: 'Mestre', fromMaster: true }))).toBe('{"id":"m","at":1000,"from":"Mestre","fromMaster":true,"text":"oi","mentions":[]}\n')
  })

  it('ida e volta: o que foi escrito volta igual, a quebra de linha do texto inclusive', () => {
    const entradas = [linha('a', 'linha 1\nlinha 2', { mentions: ['Bruno'] }), linha('b', 'oi', { from: 'Mestre', fromMaster: true })]
    expect(readChatLines(entradas.map(chatLine).join(''))).toEqual(entradas)
  })

  it('linha quebrada é pulada e o resto fica', () => {
    const texto = `${chatLine(linha('a'))}{"id":"b","at":10${'\n'}não é json\n{"id":"c"}\n\n${chatLine(linha('d'))}`
    expect(readChatLines(texto).map((e) => e.id)).toEqual(['a', 'd'])
  })

  it('teto: ficam as últimas 200, na ordem do arquivo', () => {
    const texto = Array.from({ length: CHAT_HISTORY_MAX + 50 }, (_, i) => chatLine(linha(`m${i}`))).join('')
    const lidas = readChatLines(texto)
    expect(lidas).toHaveLength(CHAT_HISTORY_MAX)
    expect(lidas[0]?.id).toBe('m50')
    expect(lidas.at(-1)?.id).toBe(`m${CHAT_HISTORY_MAX + 49}`)
  })

  it('apagar tira só aquela linha (e a quebrada, que ninguém leria)', () => {
    const texto = `${chatLine(linha('a'))}lixo\n${chatLine(linha('b'))}${chatLine(linha('c'))}`
    expect(withoutChatLine(texto, 'b')).toBe(`${chatLine(linha('a'))}${chatLine(linha('c'))}`)
  })

  it('nome de arquivo: sceneKey com "..", barra ou contrabarra é recusado', () => {
    expect(chatChannelFile(null)).toBe('global.jsonl')
    expect(chatChannelFile('map_cripta')).toBe('cena-map_cripta.jsonl')
    for (const ruim of ['..', '../x', 'a/b', 'a\\b', '', 'a.b', 'x'.repeat(65)]) expect(chatChannelFile(ruim)).toBeNull()
    expect(sceneKeyOfFile('cena-map_cripta.jsonl')).toBe('map_cripta')
    expect(sceneKeyOfFile('global.jsonl')).toBeNull()
    expect(sceneKeyOfFile('cena-...jsonl')).toBeNull()
  })
})

describe('chatStore: o disco', () => {
  it('ida e volta pelo disco: global e cena em arquivos separados da mesa', async () => {
    const d = discoDeMemoria()
    const store = createChatStore(d.fs, MESA)
    await store.append(null, linha('g1'))
    await store.append('map_cripta', linha('c1', 'escuro'))
    await store.append(null, linha('g2', 'pausa', { from: 'Mestre', fromMaster: true }))
    expect([...d.arquivos.keys()].sort()).toEqual([`${PASTA}/cena-map_cripta.jsonl`, `${PASTA}/global.jsonl`])
    expect(d.escritas.every((e) => e.append)).toBe(true)
    const lido = await createChatStore(d.fs, MESA).load()
    expect(lido.global.map((e) => e.id)).toEqual(['g1', 'g2'])
    expect(lido.global[1]?.fromMaster).toBe(true)
    expect(lido.scenes).toEqual([{ key: 'map_cripta', messages: [linha('c1', 'escuro')] }])
  })

  it('outra mesa não vê a conversa desta', async () => {
    const d = discoDeMemoria()
    await createChatStore(d.fs, MESA).append(null, linha('g1'))
    expect(await createChatStore(d.fs, 'adv_outra').load()).toEqual({ global: [], scenes: [] })
  })

  it('sem pasta ainda: histórico vazio, sem erro', async () => {
    expect(await createChatStore(discoDeMemoria().fs, MESA).load()).toEqual({ global: [], scenes: [] })
  })

  it('arquivo com linha quebrada no meio: carrega o resto', async () => {
    const d = discoDeMemoria()
    d.pastas.add(PASTA)
    d.arquivos.set(`${PASTA}/global.jsonl`, `${chatLine(linha('a'))}{"id":"cortad\n${chatLine(linha('b'))}`)
    expect((await createChatStore(d.fs, MESA).load()).global.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('sceneKey com ".." é recusada: nada é escrito fora da pasta', async () => {
    const d = discoDeMemoria()
    const store = createChatStore(d.fs, MESA)
    await expect(store.append('..', linha('x'))).rejects.toThrow(/Cena sem nome/)
    await expect(store.append('../../evil', linha('x'))).rejects.toThrow(/Cena sem nome/)
    expect(d.arquivos.size).toBe(0)
    // Mesa com nome ruim também não vira caminho.
    await expect(createChatStore(d.fs, '../maps').load()).rejects.toThrow(/Mesa sem nome/)
  })

  it('arquivo estranho na pasta (cena-...jsonl, outra coisa) não vira canal', async () => {
    const d = discoDeMemoria()
    d.pastas.add(PASTA)
    d.arquivos.set(`${PASTA}/cena-...jsonl`, chatLine(linha('a')))
    d.arquivos.set(`${PASTA}/notas.txt`, 'x')
    expect((await createChatStore(d.fs, MESA).load()).scenes).toEqual([])
  })

  it('apagar reescreve o arquivo do canal sem a linha, mesmo logo depois de gravá-la', async () => {
    const d = discoDeMemoria()
    const store = createChatStore(d.fs, MESA)
    void store.append(null, linha('a'))
    void store.append(null, linha('b'))
    // Sem esperar: a fila garante que o apagar vem depois das duas gravações.
    await store.remove(null, 'a')
    expect(d.arquivos.get(`${PASTA}/global.jsonl`)).toBe(chatLine(linha('b')))
    expect(d.escritas.at(-1)).toEqual({ path: `${PASTA}/global.jsonl`, append: false })
    expect((await store.load()).global.map((e) => e.id)).toEqual(['b'])
  })

  it('apagar em canal sem arquivo, ou id que não está lá: nada é escrito', async () => {
    const d = discoDeMemoria()
    const store = createChatStore(d.fs, MESA)
    await store.remove('map_cripta', 'x')
    await store.append(null, linha('a'))
    const antes = d.escritas.length
    await store.remove(null, 'nao-existe')
    expect(d.escritas.length).toBe(antes)
  })

  it('disco recusou uma gravação: ela rejeita e as seguintes continuam na ordem', async () => {
    const d = discoDeMemoria()
    const store = createChatStore(d.fs, MESA)
    d.falha.escrita = new Error('ENOSPC: disco cheio')
    const falhou = store.append(null, linha('a'))
    await expect(falhou).rejects.toThrow(/disco cheio/)
    d.falha.escrita = null
    await store.append(null, linha('b'))
    expect(readChatLines(d.arquivos.get(`${PASTA}/global.jsonl`) ?? '').map((e) => e.id)).toEqual(['b'])
  })

  it('a linha sai como estava ao pedir, não quando a fila chega nela', async () => {
    const d = discoDeMemoria()
    const store = createChatStore(d.fs, MESA)
    const entrada = linha('a', 'original')
    const gravando = store.append(null, entrada)
    entrada.text = 'mudou depois'
    await gravando
    expect(readChatLines(d.arquivos.get(`${PASTA}/global.jsonl`) ?? '')[0]?.text).toBe('original')
  })

  it('leitura negada: load rejeita (a ponte avisa e abre sem histórico)', async () => {
    const d = discoDeMemoria()
    const store = createChatStore(d.fs, MESA)
    await store.append(null, linha('a'))
    d.falha.leitura = new Error('os error 5: acesso negado')
    await expect(store.load()).rejects.toThrow(/acesso negado/)
  })
})
