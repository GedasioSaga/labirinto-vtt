/**
 * CHAT SALVO (fatia B de `docs/plano-chat.md`): a conversa da mesa fica no PC
 * do mestre e volta quando a sala reabre.
 *
 * ONDE: `$APPDATA/chat/<tableId>/`, um JSONL por canal: `global.jsonl` e
 * `cena-<sceneKey>.jsonl` (`sceneKey` = `MapData.id` da cena). `tableId` é o
 * mesmo da mesa guardada (`currentTableId` em `App.tsx`: o id da aventura, ou
 * o do mapa solto), então o chat de uma aventura nunca aparece em outra, e a
 * pasta fica fora de `maps/<id>/`: exportar ou duplicar a aventura não leva a
 * conversa junto. É a raiz que o escopo de fs do app já libera (`$APPDATA/**`,
 * `desktop/src-tauri/capabilities/default.json`); a pasta da aventura pode
 * morar fora dela, escolhida pelo diálogo.
 *
 * NOME DE ARQUIVO nunca vem do jogador: a mesa e a cena são ids do mestre, e
 * mesmo assim só passam se casarem `CHAT_STORE_KEY` (sem `..`, sem barra) e o
 * caminho montado cair dentro da pasta da mesa (`assertPathWithinRoot`).
 *
 * A parte pura (linha, leitura, reescrita) é testada sem disco; o disco entra
 * por `ChatFs`. Todo acesso passa por UMA fila em ordem: a linha apagada logo
 * depois de gravada sai do arquivo, e duas falas nunca se embaralham.
 */
import { appDataDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { parseChatEntry, type ChatEntry } from '../net/protocol'
import { CHAT_HISTORY_MAX } from './chat'
import { assertPathWithinRoot, writeTextFileSafely } from './mapFileIO'

/** Mesa e cena que viram nome de arquivo: letras, números, `_` e `-`, até 64. */
export const CHAT_STORE_KEY = /^[A-Za-z0-9_-]{1,64}$/

/** A pasta de todas as mesas, dentro de `$APPDATA`. */
export const CHAT_ROOT_DIR = 'chat'

export const CHAT_GLOBAL_FILE = 'global.jsonl'

const SCENE_FILE_PREFIX = 'cena-'
const CHAT_FILE_SUFFIX = '.jsonl'

/** O que a sala reabre com: as últimas `CHAT_HISTORY_MAX` de cada canal, na ordem em que foram ditas. */
export interface ChatHistory {
  global: ChatEntry[]
  scenes: { key: string; messages: ChatEntry[] }[]
}

export const NO_CHAT_HISTORY: ChatHistory = { global: [], scenes: [] }

export function isChatStoreKey(key: string): boolean {
  return CHAT_STORE_KEY.test(key)
}

/** O arquivo do canal (`null` = Global), ou `null` quando a chave da cena não serve para nome de arquivo. */
export function chatChannelFile(sceneKey: string | null): string | null {
  if (sceneKey === null) return CHAT_GLOBAL_FILE
  return isChatStoreKey(sceneKey) ? `${SCENE_FILE_PREFIX}${sceneKey}${CHAT_FILE_SUFFIX}` : null
}

/** A cena do arquivo `cena-<chave>.jsonl` da pasta; qualquer outro nome (o Global também) dá `null`. */
export function sceneKeyOfFile(name: string): string | null {
  if (!name.startsWith(SCENE_FILE_PREFIX) || !name.endsWith(CHAT_FILE_SUFFIX)) return null
  const key = name.slice(SCENE_FILE_PREFIX.length, name.length - CHAT_FILE_SUFFIX.length)
  return isChatStoreKey(key) ? key : null
}

/** A linha do JSONL, com a quebra no fim: só os campos da linha, nessa ordem. */
export function chatLine(entry: ChatEntry): string {
  const { id, at, from, fromMaster, text, mentions } = entry
  const line = fromMaster === true ? { id, at, from, fromMaster, text, mentions } : { id, at, from, text, mentions }
  return `${JSON.stringify(line)}\n`
}

/** A linha do arquivo, ou `null` quando está quebrada (gravação cortada no meio, edição à mão). */
function parseChatLine(raw: string): ChatEntry | null {
  if (raw.trim() === '') return null
  try {
    return parseChatEntry(JSON.parse(raw))
  } catch {
    return null
  }
}

/** As últimas `max` linhas boas do arquivo, na ordem dele. A quebrada cai sozinha; o resto fica. */
export function readChatLines(text: string, max: number = CHAT_HISTORY_MAX): ChatEntry[] {
  const entries: ChatEntry[] = []
  for (const raw of text.split('\n')) {
    const entry = parseChatLine(raw)
    if (entry !== null) entries.push(entry)
  }
  return max <= 0 ? [] : entries.slice(-max)
}

/**
 * O arquivo sem a linha `id` (o mestre apagou). A linha quebrada também sai:
 * ninguém nunca a leria. Linha boa fica como estava escrita.
 */
export function withoutChatLine(text: string, id: string): string {
  const kept = text.split('\n').filter((raw) => {
    const entry = parseChatLine(raw)
    return entry !== null && entry.id !== id
  })
  return kept.map((raw) => `${raw}\n`).join('')
}

/** O pedaço do disco que o chat usa: o do Tauri no app, um de memória nos testes. */
export interface ChatFs {
  /** A pasta do app (`$APPDATA`). */
  baseDir(): Promise<string>
  join(...parts: string[]): Promise<string>
  exists(path: string): Promise<boolean>
  /** Cria a pasta e as de cima que faltarem. */
  ensureDir(path: string): Promise<void>
  readTextFile(path: string): Promise<string>
  /** `append` soma no fim (criando o arquivo); sem ele, troca o conteúdo inteiro. */
  writeTextFile(path: string, data: string, append: boolean): Promise<void>
  /** Os nomes dos arquivos da pasta. */
  listFiles(path: string): Promise<string[]>
}

export interface ChatStore {
  /** O histórico da mesa; pasta que não existe = vazio. Rejeita quando o disco não deixa ler. */
  load(): Promise<ChatHistory>
  /** Grava a linha nova no fim do canal (`null` = Global). Rejeita quando o disco recusa. */
  append(sceneKey: string | null, entry: ChatEntry): Promise<void>
  /** Tira a linha `id` do arquivo do canal, reescrevendo-o. Arquivo que não existe: nada. */
  remove(sceneKey: string | null, id: string): Promise<void>
}

export function createChatStore(fs: ChatFs, tableId: string): ChatStore {
  // Uma fila só: a próxima operação espera a anterior, e a falha de uma não para as seguintes.
  let tail: Promise<unknown> = Promise.resolve()
  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    const run = tail.then(work)
    tail = run.catch(() => undefined)
    return run
  }

  let tableDir: Promise<string> | null = null
  const dirOfTable = (): Promise<string> => {
    if (tableDir === null) {
      tableDir = (async () => {
        if (!isChatStoreKey(tableId)) throw new Error(`Mesa sem nome de pasta válido para o chat: "${tableId}"`)
        const root = await fs.join(await fs.baseDir(), CHAT_ROOT_DIR)
        const dir = await fs.join(root, tableId)
        assertPathWithinRoot(dir, root)
        return dir
      })()
      // Falhou (sem `$APPDATA`?): a próxima tentativa pergunta de novo.
      tableDir.catch(() => {
        tableDir = null
      })
    }
    return tableDir
  }

  const pathOf = async (sceneKey: string | null): Promise<string> => {
    const file = chatChannelFile(sceneKey)
    if (file === null) throw new Error(`Cena sem nome de arquivo válido para o chat: "${String(sceneKey)}"`)
    const dir = await dirOfTable()
    const path = await fs.join(dir, file)
    assertPathWithinRoot(path, dir)
    return path
  }

  const readChannel = async (path: string): Promise<ChatEntry[]> =>
    (await fs.exists(path)) ? readChatLines(await fs.readTextFile(path)) : []

  return {
    load: () =>
      enqueue(async () => {
        const dir = await dirOfTable()
        if (!(await fs.exists(dir))) return { global: [], scenes: [] }
        const global = await readChannel(await pathOf(null))
        const scenes: ChatHistory['scenes'] = []
        // Ordem estável entre aberturas: a da pasta varia com o sistema.
        const keys = (await fs.listFiles(dir)).map(sceneKeyOfFile).filter((key): key is string => key !== null).sort()
        for (const key of keys) {
          const messages = await readChannel(await pathOf(key))
          if (messages.length > 0) scenes.push({ key, messages })
        }
        return { global, scenes }
      }),

    append(sceneKey, entry) {
      // A linha sai do jeito que está AGORA, não quando a fila chegar nela.
      const line = chatLine(entry)
      return enqueue(async () => {
        const path = await pathOf(sceneKey)
        await fs.ensureDir(await dirOfTable())
        await fs.writeTextFile(path, line, true)
      })
    },

    remove: (sceneKey, id) =>
      enqueue(async () => {
        const path = await pathOf(sceneKey)
        if (!(await fs.exists(path))) return
        const before = await fs.readTextFile(path)
        const after = withoutChatLine(before, id)
        if (after !== before) await fs.writeTextFile(path, after, false)
      }),
  }
}

/** O disco de verdade: o escopo `$APPDATA/**` da capability do app. */
const tauriChatFs: ChatFs = {
  baseDir: () => appDataDir(),
  join: (...parts) => join(...parts),
  exists: (path) => exists(path),
  ensureDir: async (path) => {
    if (!(await exists(path))) await mkdir(path, { recursive: true })
  },
  readTextFile: (path) => readTextFile(path),
  // A reescrita (apagar) vai pelo `.tmp` + rename do mapa: cortada no meio, o arquivo velho fica.
  writeTextFile: (path, data, append) => (append ? writeTextFile(path, data, { append: true }) : writeTextFileSafely(path, data)),
  listFiles: async (path) => (await readDir(path)).filter((entry) => entry.isFile).map((entry) => entry.name),
}

/** O chat salvo da mesa `tableId` no disco do app. */
export function createTauriChatStore(tableId: string): ChatStore {
  return createChatStore(tauriChatFs, tableId)
}
