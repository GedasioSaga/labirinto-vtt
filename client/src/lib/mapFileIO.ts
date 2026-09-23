import { writeTextFile, mkdir, exists, readTextFile, readDir, stat, remove, copyFile, rename } from '@tauri-apps/plugin-fs'
import { save, open } from '@tauri-apps/plugin-dialog'
import { appDataDir, join, dirname } from '@tauri-apps/api/path'
import { invoke } from '@tauri-apps/api/core'
import type { MapData } from '../types/map'
import { serializeMap, deserializeMap } from './mapFile'
import {
  ADVENTURE_FILE,
  ADVENTURE_VERSION,
  baseName,
  clearLegacyPortals,
  fileSegments,
  isSafeRelativeFile,
  legacyPortalPaths,
  newSceneId,
  parseAdventure,
  samePath,
  sceneFileFor,
  serializeAdventure,
  type Adventure,
  type SceneEntry,
} from './adventure'

/** Sufixo do arquivo de rascunho da gravação atômica (ver `writeTextFileSafely`). */
const TEMP_WRITE_SUFFIX = '.tmp'

/**
 * `rename` está disponível? A resposta fica guardada pela sessão porque a
 * própria PERGUNTA pode lançar: o binding vem de um módulo que nem sempre
 * expõe o nome (build antiga do plugin, dublê de teste parcial), e nesse caso
 * a leitura estoura em vez de devolver `undefined`. Sem o try/catch, a
 * gravação "segura" morreria exatamente onde ela mais importa.
 *
 * `null` = ainda não perguntado; `false` também é gravado aqui quando o
 * `rename` existe mas o runtime recusa (permissão `fs:allow-rename` ausente
 * na capability do app) — daí em diante vale o plano B, em vez de deixar o
 * usuário sem conseguir salvar. Recusa passageira (arquivo em uso) usa o plano
 * B só naquela gravação; ver `isPermanentRenameRefusal`.
 */
let renameUsable: boolean | null = null

function canRename(): boolean {
  if (renameUsable === null) {
    try {
      renameUsable = typeof rename === 'function'
    } catch {
      renameUsable = false
    }
  }
  return renameUsable
}

/** Apagar sobra de `.tmp` é higiene, não requisito: falha aqui não interessa. */
async function removeQuietly(path: string): Promise<void> {
  try {
    await remove(path)
  } catch {
    // A sobra some na próxima gravação bem-sucedida no mesmo caminho.
  }
}

/**
 * A recusa do `rename` é da ACL do Tauri (permissão ausente na capability)?
 * Só essa é permanente — o texto vem de `tauri/src/ipc/authority.rs`
 * ("fs.rename not allowed. Permissions associated with this command: ...").
 * Arquivo em uso por antivírus ou OneDrive (os error 32/5 no Windows) passa
 * sozinho: desligar a gravação atômica pela sessão inteira por causa dele
 * deixaria todo salvamento seguinte truncando o arquivo no lugar.
 */
function isPermanentRenameRefusal(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /\bnot allowed\b/.test(message)
}

/** O que havia no caminho antes do plano B escrever por cima. */
interface PreviousFile {
  /** `true` também quando não deu para saber — na dúvida, nunca apagar. */
  existed: boolean
  /** Conteúdo para devolver se a escrita falhar; `null` = nada a devolver. */
  content: string | null
}

async function snapshotBeforeWrite(path: string): Promise<PreviousFile> {
  let existed: boolean
  try {
    existed = await exists(path)
  } catch {
    return { existed: true, content: null }
  }
  if (!existed) return { existed: false, content: null }
  try {
    const content = await readTextFile(path)
    return { existed: true, content: content.length > 0 ? content : null }
  } catch {
    return { existed: true, content: null }
  }
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    if (!(await exists(path))) return null
    const content = await readTextFile(path)
    return content.length > 0 ? content : null
  } catch {
    return null
  }
}

/**
 * Grava texto SEM destruir o que já estava no caminho.
 *
 * `writeTextFile` trunca o arquivo e só então escreve: falhar no meio (disco
 * cheio, app morto, pendrive removido) deixava o `map.json` que estava salvo e
 * válido como um pedaço de JSON — o mapa antigo morria junto com a tentativa
 * de salvar o novo.
 *
 * Caminho principal: escreve num `.tmp` ao lado e renomeia por cima (o rename
 * do SO troca o conteúdo de uma vez, ou não troca nada). Plano B, quando
 * renomear não está disponível: guarda o conteúdo anterior em memória antes de
 * escrever e o devolve se a escrita falhar — protege contra a escrita que
 * falha, não contra o processo que morre no meio, mas é melhor que truncar.
 */
export async function writeTextFileSafely(path: string, data: string): Promise<void> {
  if (canRename()) {
    const tempPath = `${path}${TEMP_WRITE_SUFFIX}`
    try {
      await writeTextFile(tempPath, data)
    } catch (error) {
      await removeQuietly(tempPath)
      throw error
    }
    try {
      await rename(tempPath, path)
      return
    } catch (error) {
      if (isPermanentRenameRefusal(error)) renameUsable = false
      await removeQuietly(tempPath)
    }
  }

  const previous = await snapshotBeforeWrite(path)
  try {
    await writeTextFile(path, data)
  } catch (error) {
    if (previous.content !== null) {
      // Devolver o conteúdo anterior é o que separa "não consegui salvar" de
      // "perdi o mapa que já estava salvo". Se nem isso der, o erro original
      // é o que interessa ao usuário — por isso o `catch` mudo só aqui.
      await writeTextFile(path, previous.content).catch(() => undefined)
    } else if (!previous.existed) {
      // Arquivo novo: o pedaço escrito apareceria na lista como mapa
      // danificado de um mapa que nunca chegou a ser salvo.
      await removeQuietly(path)
    }
    throw error
  }
}

function toPosix(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

/**
 * Reaponta um caminho de imagem que morava DENTRO de `sourceDir` para o mesmo
 * nome dentro de `destDir`. Caminho de fora da pasta do mapa (imagem que o
 * usuário deixou em `C:\imgs`) e caminho relativo ficam como estão — só o que
 * a cópia levou junto é reapontado.
 */
function rebasePath(path: string, sourceDir: string, destDir: string): string {
  if (path.length === 0) return path
  const prefix = `${toPosix(sourceDir)}/`
  const normalized = toPosix(path)
  // Windows não distingue maiúscula de minúscula em caminho; a comparação
  // exata deixaria "c:/users/..." escapar do reapontamento.
  if (!normalized.toLowerCase().startsWith(prefix.toLowerCase())) return path
  return `${toPosix(destDir)}/${normalized.slice(prefix.length)}`
}

/**
 * Devolve o mapa com fundo, imagem de token e prop reapontados de `sourceDir`
 * para `destDir` — ou o MESMO objeto, quando nada mudou.
 *
 * Copiar/exportar levava os arquivos de imagem mas mantinha no `map.json` o
 * caminho absoluto da máquina de origem: na mesma máquina ninguém percebia, na
 * outra o mapa compartilhado abria sem fundo e sem token.
 */
export function rebaseMapImagePaths(map: MapData, sourceDir: string, destDir: string): MapData {
  if (toPosix(sourceDir) === toPosix(destDir)) return map
  let changed = false
  const rebase = (path: string): string => {
    const next = rebasePath(path, sourceDir, destDir)
    if (next !== path) changed = true
    return next
  }

  const background = map.background.type === 'image' ? { ...map.background, src: rebase(map.background.src) } : map.background
  const tokens = map.tokens.map((token) => (token.image ? { ...token, image: rebase(token.image) } : token))
  const props = map.props.map((prop) => (prop.src ? { ...prop, src: rebase(prop.src) } : prop))

  return changed ? { ...map, background, tokens, props } : map
}

export async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true })
  }
}

export async function defaultMapsDir(): Promise<string> {
  const base = await appDataDir()
  return join(base, 'maps')
}

function normalizePathSegments(path: string): string {
  const stack: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      stack.pop()
      continue
    }
    stack.push(segment)
  }
  return stack.join('/')
}

/**
 * Garante que `resolvedPath` fica dentro de `root` mesmo depois de resolver
 * segmentos `..`/`.` — proteção contra path traversal quando o path é montado
 * a partir de conteúdo não confiável (ex.: `map.id` vindo de um `map.json`
 * externo). Uma checagem ingênua de `startsWith` sem resolver `..` primeiro
 * não pega esse ataque, porque `"<root>/../../x"` já começa literalmente com
 * `"<root>/"`.
 */
export function assertPathWithinRoot(resolvedPath: string, root: string): void {
  const normalizedRoot = normalizePathSegments(root.replace(/\\/g, '/'))
  const normalizedPath = normalizePathSegments(resolvedPath.replace(/\\/g, '/'))
  const isWithinRoot = normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`)
  if (!isWithinRoot) {
    throw new Error(`Caminho de mapa inválido: "${resolvedPath}" está fora da pasta de mapas esperada.`)
  }
}

export async function mapDirFor(mapId: string): Promise<string> {
  const base = await defaultMapsDir()
  const mapDir = await join(base, mapId)
  assertPathWithinRoot(mapDir, base)
  return mapDir
}

export async function saveMapToAppData(map: MapData): Promise<string> {
  const mapDir = await mapDirFor(map.id)
  await ensureDir(mapDir)
  const filePath = await join(mapDir, 'map.json')
  await writeTextFileSafely(filePath, serializeMap(map))
  return filePath
}

export async function loadMapFromDisk(path: string): Promise<MapData> {
  const dir = await dirname(path)
  await invoke('grant_fs_access', { path: dir })
  const content = await readTextFile(path)
  return deserializeMap(content)
}

export async function pickMapJsonToOpen(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Mapa Labirinto', extensions: ['json'] }],
  })
  return typeof selected === 'string' ? selected : null
}

export async function pickExportDestination(defaultName: string): Promise<string | null> {
  const selected = await save({ defaultPath: `${defaultName}.json` })
  return selected ?? null
}

export interface SavedMapEntry {
  path: string
  id: string
  name: string
  width: number
  height: number
  grid: number
  /** `FileInfo.mtime` de `map.json` em ms desde a época (`Date.getTime()`).
   *  `0` quando o SO não relata `mtime` (o campo é `Date | null` no plugin) —
   *  cai pro fim da lista ordenada por recência em vez de quebrar o sort. */
  mtimeMs: number
  /**
   * `true` quando o `map.json` daquela pasta não pôde ser lido (JSON
   * truncado, sem `id`, ilegível). A entrada CONTINUA na lista, com o caminho,
   * porque "meu map.json corrompeu" e "meu mapa foi apagado" eram a mesma tela
   * para o usuário — e sem o caminho ele não tinha nem por onde tentar
   * recuperar o arquivo. `id`/`name` caem no nome da pasta e as dimensões vão
   * a `0`: não há mapa lido de onde tirá-las.
   */
  damaged?: boolean
}

/**
 * Lista os mapas salvos em `%APPDATA%/maps`, para a tela "Carregar Mapa".
 * Ordenada por recência (mais recente primeiro) — item 23 do
 * PLANO-REFINAMENTO.md.
 *
 * Um `map.json` corrompido não pode derrubar a tela inteira — por isso cada
 * `deserializeMap` roda num `try/catch` individual. A entrada ruim NÃO é
 * omitida (era o que fazia o mapa danificado sumir da tela como se tivesse
 * sido apagado): ela entra marcada com `damaged: true`, com o caminho, ao lado
 * dos mapas bons.
 */
/** `mtime` em ms, ou `0` quando o SO não relata (ou o `stat` falha). */
async function mtimeMsOf(path: string): Promise<number> {
  try {
    const info = await stat(path)
    return info.mtime ? info.mtime.getTime() : 0
  } catch {
    return 0
  }
}

export async function listSavedMaps(): Promise<SavedMapEntry[]> {
  const mapsDir = await defaultMapsDir()
  if (!(await exists(mapsDir))) return []

  const entries = await readDir(mapsDir)
  const maps: SavedMapEntry[] = []

  for (const entry of entries) {
    if (!entry.isDirectory) continue

    const mapJsonPath = await join(mapsDir, entry.name, 'map.json')
    assertPathWithinRoot(mapJsonPath, mapsDir)
    if (!(await exists(mapJsonPath))) continue

    const mtimeMs = await mtimeMsOf(mapJsonPath)
    try {
      const content = await readTextFile(mapJsonPath)
      const map = deserializeMap(content)
      maps.push({
        path: mapJsonPath,
        id: map.id,
        name: map.name,
        width: map.width,
        height: map.height,
        grid: map.grid,
        mtimeMs,
      })
      // `damaged` fica AUSENTE no mapa bom, não `false`: a marca é exceção, e
      // quem lê a lista usa `entry.damaged ?? false`.
    } catch {
      // map.json inválido (JSON malformado ou sem "id"): entra marcado, com o
      // nome da pasta, para o usuário achar o arquivo em vez de achar que o
      // mapa foi apagado.
      maps.push({
        path: mapJsonPath,
        id: entry.name,
        name: `${entry.name} (arquivo danificado)`,
        width: 0,
        height: 0,
        grid: 0,
        mtimeMs,
        damaged: true,
      })
    }
  }

  maps.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return maps
}

/**
 * Caracteres proibidos em nome de arquivo no Windows (`< > : " / \ | ? *` +
 * controle 0x00–0x1F), mais ponto/espaço à direita (Windows os ignora, o que
 * pode confundir dois nomes que só diferem nisso).
 *
 * `MapData.name` hoje é só um campo de exibição — nunca vira segmento de
 * path: a pasta do mapa usa `map.id` (`map_${crypto.randomUUID()}`, nunca
 * texto do usuário; ver `App.tsx` `createEmptyMap` e `mapDirFor` abaixo), e
 * `renameMap`/`duplicateMap` só escrevem esse campo dentro do `map.json` já
 * resolvido via `mapDirFor`. Sanitizar aqui não fecha uma vulnerabilidade de
 * path traversal (não existe uma para esse campo neste fluxo) — é para que
 * `pickExportDestination`, que já usa um nome como `defaultPath` de arquivo,
 * nunca receba um nome de mapa com caractere inválido em Windows.
 */
const WINDOWS_INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g

/**
 * Remove caractere de controle (código de caractere abaixo de 0x20).
 * Checagem por código, não por classe de regex com faixa de escape unicode:
 * ao escrever esta função a faixa foi digitada dessa forma e saiu, na
 * ferramenta de edição, como os bytes de controle de verdade dentro do
 * arquivo-fonte em vez do texto do escape — comparar código evita reproduzir
 * o mesmo problema.
 */
function stripControlChars(value: string): string {
  let result = ''
  for (const ch of value) {
    if ((ch.codePointAt(0) ?? 0) >= 0x20) result += ch
  }
  return result
}

function stripTrailingDotsAndSpaces(value: string): string {
  let end = value.length
  while (end > 0 && (value[end - 1] === '.' || value[end - 1] === ' ')) {
    end -= 1
  }
  return value.slice(0, end)
}

export function sanitizeMapName(rawName: string): string {
  const withoutControlChars = stripControlChars(rawName)
  const withoutForbidden = withoutControlChars.replace(WINDOWS_INVALID_FILENAME_CHARS, '')
  const cleaned = stripTrailingDotsAndSpaces(withoutForbidden.trim())
  return cleaned.length > 0 ? cleaned : 'Mapa sem título'
}

/**
 * Garante que `baseName` não colide com nenhum nome em `existingNames`,
 * anexando " (2)", " (3)"... Nome duplicado não é erro de arquivo (cada mapa
 * mora na própria pasta, endereçada por `id`), mas duas entradas com o mesmo
 * nome na lista de "Carregar Mapa" confundem o usuário — usado por
 * `renameMap` e `duplicateMap`.
 */
export function uniqueMapName(baseName: string, existingNames: readonly string[]): string {
  if (!existingNames.includes(baseName)) return baseName
  let attempt = 2
  while (existingNames.includes(`${baseName} (${attempt})`)) {
    attempt += 1
  }
  return `${baseName} (${attempt})`
}

/**
 * Renomeia um mapa salvo: só reescreve o campo `name` dentro do `map.json`
 * (a pasta continua endereçada pelo `id`, imutável). Devolve o nome
 * efetivamente gravado — pode diferir de `newName` após `sanitizeMapName` e
 * `uniqueMapName`.
 */
export async function renameMap(id: string, newName: string): Promise<string> {
  const mapDir = await mapDirFor(id)
  const mapJsonPath = await join(mapDir, 'map.json')
  if (!(await exists(mapJsonPath))) {
    throw new Error(`Mapa "${id}" não encontrado em "${mapJsonPath}".`)
  }

  const content = await readTextFile(mapJsonPath)
  const map = deserializeMap(content)

  const otherNames = (await listSavedMaps()).filter((entry) => entry.id !== id).map((entry) => entry.name)
  const finalName = uniqueMapName(sanitizeMapName(newName), otherNames)

  await writeTextFileSafely(mapJsonPath, serializeMap({ ...map, name: finalName }))
  return finalName
}

/**
 * Copia recursivamente o conteúdo de `srcDir` para `destDir` (arquivos e
 * subpastas). Hoje `saveMapToAppData` só escreve `map.json` na pasta do
 * mapa, mas `duplicateMap` copia a pasta inteira, não só o `map.json`, para
 * não deixar de copiar um arquivo futuro que passe a morar ali. Symlink é
 * ignorado de propósito — segui-lo poderia copiar conteúdo de fora da pasta
 * de mapas, e não há caso de uso hoje para symlink dentro de `%APPDATA%/maps`.
 */
async function copyDirRecursive(srcDir: string, destDir: string): Promise<void> {
  await ensureDir(destDir)
  const entries = await readDir(srcDir)
  for (const entry of entries) {
    const srcPath = await join(srcDir, entry.name)
    const destPath = await join(destDir, entry.name)
    if (entry.isDirectory) {
      await copyDirRecursive(srcPath, destPath)
    } else if (entry.isFile) {
      await copyFile(srcPath, destPath)
    }
  }
}

/**
 * Duplica um mapa salvo: copia a pasta inteira para um novo `id` gerado
 * (`crypto.randomUUID()`, mesmo padrão de `App.tsx`), depois reescreve o
 * `map.json` da cópia com o `id` novo, um nome único ("<nome> (cópia)",
 * desambiguado por `uniqueMapName`) e os caminhos de imagem reapontados para a
 * pasta da cópia (`rebaseMapImagePaths`). Imagem que o usuário mantém FORA da
 * pasta do mapa continua com o caminho absoluto dela — só o que a cópia levou
 * junto é reapontado.
 */
export async function duplicateMap(id: string): Promise<SavedMapEntry> {
  const sourceDir = await mapDirFor(id)
  const sourceMapJsonPath = await join(sourceDir, 'map.json')
  if (!(await exists(sourceMapJsonPath))) {
    throw new Error(`Mapa "${id}" não encontrado em "${sourceMapJsonPath}".`)
  }

  const sourceContent = await readTextFile(sourceMapJsonPath)
  const sourceMap = deserializeMap(sourceContent)

  // Nomes existentes ANTES de copiar — evita que a pasta nova (ainda com o
  // `map.json` cru, id antigo) apareça duas vezes numa listagem intermediária.
  const existingNames = (await listSavedMaps()).map((entry) => entry.name)

  const newId = `map_${crypto.randomUUID()}`
  const destDir = await mapDirFor(newId)
  await copyDirRecursive(sourceDir, destDir)

  const finalName = uniqueMapName(sanitizeMapName(`${sourceMap.name} (cópia)`), existingNames)
  // `copyDirRecursive` já levou as imagens para a pasta nova; sem reapontar os
  // caminhos, o `map.json` da cópia continuaria lendo os arquivos da pasta de
  // ORIGEM — apagar o original deixaria a cópia sem fundo e sem token.
  const duplicated = rebaseMapImagePaths({ ...sourceMap, id: newId, name: finalName }, sourceDir, destDir)
  const destMapJsonPath = await join(destDir, 'map.json')
  await writeTextFileSafely(destMapJsonPath, serializeMap(duplicated))

  const info = await stat(destMapJsonPath)
  return {
    path: destMapJsonPath,
    id: newId,
    name: finalName,
    width: duplicated.width,
    height: duplicated.height,
    grid: duplicated.grid,
    mtimeMs: info.mtime ? info.mtime.getTime() : 0,
  }
}

/**
 * Apaga um mapa salvo do disco (pasta inteira, recursivo). Destrutivo e sem
 * volta — o chamador (`LoadMapScreen`) exige confirmação explícita na UI
 * antes de chamar isto; esta função não confirma nada sozinha.
 */
export async function deleteMap(id: string): Promise<void> {
  const mapDir = await mapDirFor(id)
  if (!(await exists(mapDir))) {
    throw new Error(`Mapa "${id}" não encontrado em "${mapDir}".`)
  }
  await remove(mapDir, { recursive: true })
}

/**
 * Salva de volta no caminho já escolhido pelo usuário (lista ou diálogo) — ao
 * contrário de `saveMapToAppData`, não passa por `mapDirFor`: o caminho não
 * vem de `map.id` (conteúdo não confiável), então a proteção de
 * `assertPathWithinRoot` não se aplica aqui.
 */
export async function saveMapToPath(map: MapData, path: string): Promise<void> {
  await writeTextFileSafely(path, serializeMap(map))
}

// ───────────────────────────────────────────────────────────────────────────
// Aventura: várias cenas numa pasta (`lib/adventure.ts`)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Uma cena da aventura: o mapa, o motivo de não estar disponível, ou
 * `pendente` — ainda não lida do disco (`openMapFileFirst` deixa as cenas de
 * fundo assim; `loadPendingScenes` as lê).
 */
export type SceneLoad =
  | { entry: SceneEntry; status: 'ok'; map: MapData }
  | { entry: SceneEntry; status: 'indisponivel'; reason: string }
  | { entry: SceneEntry; status: 'pendente' }

/** Cena de fundo que acabou de chegar do disco, pronta (ver `loadPendingScenes`). */
export type ArrivedScene = Extract<SceneLoad, { status: 'ok' }>

/** O que abrir um `map.json` devolve: o mapa pedido e, se ele é cena de uma aventura, a aventura inteira. */
export interface OpenedMapFile {
  /** O arquivo que a pessoa pediu para abrir. */
  path: string
  /** O mapa desse arquivo, já sem portal antigo. */
  map: MapData
  /** `null` = mapa solto, como sempre foi. */
  adventure: Adventure | null
  adventureDir: string | null
  activeSceneId: string | null
  /** Todas as cenas da aventura, a aberta inclusive, na ordem da lista; vazio para mapa solto. */
  scenes: SceneLoad[]
  /** Cenas cujo conteúdo em memória já não é o do disco (portal antigo convertido). */
  changedSceneIds: string[]
  /** A lista de cenas mudou ao abrir (portal antigo virou cena): o `adventure.json` precisa ser regravado. */
  adventureChanged: boolean
  /**
   * Destinos de portal antigo que esta abertura já trouxe como cena: o caminho
   * de ORIGEM e a cena nova. A cena nova mora em `scenes/<id>/map.json`, então
   * sem isto a passada das cenas de fundo (`loadPendingScenes`) não reconhece
   * o mesmo destino e cria outra cena igual; e é por aqui que o teto
   * `MAX_MIGRATED_SCENES` vale para a abertura inteira, não por passada.
   */
  legacySources: { path: string; sceneId: string }[]
}

/** Teto de cenas que a conversão de portais antigos cria de uma vez: corrente de andares, não labirinto infinito. */
const MAX_MIGRATED_SCENES = 32

/**
 * Quantas cenas de fundo são lidas do disco ao mesmo tempo. Uma por vez, a
 * aventura de 99 cenas somava 99 idas e voltas ao disco; todas de uma vez
 * dispararia 99 leituras na ponte do Tauri e 99 mapas inteiros em memória
 * esperando o parse no mesmo instante. Oito deixa o disco ocupado sem isso.
 */
export const SCENE_READ_CONCURRENCY = 8

/**
 * Caminho absoluto da cena, conferido contra a pasta da aventura. `file` vem
 * de um `adventure.json` que pode ter sido editado à mão: caminho absoluto ou
 * com `..` é recusado aqui, antes de qualquer leitura ou escrita.
 */
export async function scenePath(adventureDir: string, file: string): Promise<string> {
  if (!isSafeRelativeFile(file)) {
    throw new Error(`Cena com caminho inválido: "${file}" precisa ser relativo à pasta da aventura.`)
  }
  const path = await join(adventureDir, ...fileSegments(file))
  assertPathWithinRoot(path, adventureDir)
  return path
}

async function loadScene(adventureDir: string, entry: SceneEntry): Promise<SceneLoad> {
  try {
    const path = await scenePath(adventureDir, entry.file)
    if (!(await exists(path))) return { entry, status: 'indisponivel', reason: `arquivo não encontrado: ${entry.file}` }
    return { entry, status: 'ok', map: deserializeMap(await readTextFile(path)) }
  } catch (error) {
    return { entry, status: 'indisponivel', reason: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Procura o `adventure.json` de quem `mapPath` é cena: na pasta do próprio
 * arquivo (a primeira cena, `map.json`) e duas pastas acima (as cenas novas
 * moram em `scenes/<id>/map.json`). `adventure.json` quebrado conta como
 * ausente: o mapa abre solto em vez de não abrir.
 */
async function findAdventureFor(mapPath: string): Promise<{ adventure: Adventure; dir: string; sceneId: string } | null> {
  const ownDir = await dirname(mapPath)
  const candidates = [ownDir]
  try {
    candidates.push(await dirname(await dirname(ownDir)))
  } catch {
    // Arquivo perto da raiz do disco: não há pasta duas acima para olhar.
  }
  for (const dir of candidates) {
    if (dir.length === 0) continue
    const raw = await readIfExists(await join(dir, ADVENTURE_FILE))
    if (raw === null) continue
    let adventure: Adventure
    try {
      adventure = parseAdventure(raw)
    } catch {
      continue
    }
    for (const entry of adventure.scenes) {
      try {
        if (samePath(await scenePath(dir, entry.file), mapPath)) return { adventure, dir, sceneId: entry.id }
      } catch {
        // Cena com caminho inválido não é a que foi pedida.
      }
    }
  }
  return null
}

/**
 * Abre um `map.json` SEM esperar as outras cenas: lê o mapa pedido e, se ele é
 * cena de uma aventura, só o `adventure.json` — as outras cenas voltam
 * `pendente`, na ordem da lista, para `loadPendingScenes` ler depois. A
 * conversão do portal antigo (`convertLegacyPortals`) já corre sobre o que foi
 * lido; a das cenas de fundo corre quando elas chegam.
 */
export async function openMapFileFirst(path: string): Promise<OpenedMapFile> {
  const map = await loadMapFromDisk(path)
  const found = await findAdventureFor(path)
  if (found === null) {
    return convertLegacyPortals({ path, map, adventure: null, adventureDir: null, activeSceneId: null, scenes: [], changedSceneIds: [], adventureChanged: false, legacySources: [] })
  }
  const scenes = found.adventure.scenes.map((entry): SceneLoad => (entry.id === found.sceneId ? { entry, status: 'ok', map } : { entry, status: 'pendente' }))
  return convertLegacyPortals({
    path,
    map,
    adventure: found.adventure,
    adventureDir: found.dir,
    activeSceneId: found.sceneId,
    scenes,
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  })
}

/** `worker` sobre cada item, no máximo `limit` de cada vez; o resultado na ordem de `items`. */
async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const lane = async (): Promise<void> => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
  return results
}

/**
 * Lê as cenas `pendente` de `opened` (várias ao mesmo tempo, até
 * `SCENE_READ_CONCURRENCY`) e converte o portal antigo que houver NELAS. A
 * cena aberta e as que já tinham chegado ficam como estavam — é o mapa que já
 * está no editor. Sem cena pendente, devolve o próprio `opened`. Nunca rejeita
 * por causa de uma cena: a que não abre volta "indisponível" (`loadScene`).
 *
 * `onArrive` recebe cada cena lida SEM portal antigo assim que ela chega, sem
 * esperar as outras: a conversão não mexe nela, então o mapa que vai no aviso
 * é o mesmo que volta no resultado. A de portal antigo só vem no resultado,
 * depois da conversão.
 */
export async function loadPendingScenes(opened: OpenedMapFile, onArrive?: (load: ArrivedScene) => void): Promise<OpenedMapFile> {
  const dir = opened.adventureDir
  if (dir === null || !opened.scenes.some((load) => load.status === 'pendente')) return opened

  const fresh = await mapWithConcurrency(opened.scenes, SCENE_READ_CONCURRENCY, async (load) => {
    if (load.status !== 'pendente') return null
    const read = await loadScene(dir, load.entry)
    if (onArrive !== undefined && read.status === 'ok' && legacyPortalPaths(read.map).length === 0) onArrive(read)
    return read
  })
  // Só as recém-lidas passam pela conversão: as outras entram como `pendente`
  // (que a conversão pula) e voltam intactas logo abaixo.
  const kept = new Map<string, SceneLoad>()
  const toConvert = opened.scenes.map((load, index): SceneLoad => {
    const read = fresh[index]
    if (read !== null) return read
    kept.set(load.entry.id, load)
    return { entry: load.entry, status: 'pendente' }
  })
  const converted = await convertLegacyPortals({ ...opened, scenes: toConvert })
  return {
    ...converted,
    // A cena aberta não muda por causa do que chegou depois.
    map: opened.map,
    activeSceneId: opened.activeSceneId,
    scenes: converted.scenes.map((load) => kept.get(load.entry.id) ?? load),
    adventureChanged: opened.adventureChanged || converted.adventureChanged,
  }
}

/**
 * Abre um `map.json` com TODAS as cenas já lidas: `openMapFileFirst` e depois
 * `loadPendingScenes` (as que sumiram do disco voltam como "indisponível", sem
 * derrubar a abertura). O editor usa as duas metades separadas, para mostrar
 * a cena pedida antes de ler as outras.
 */
export async function openMapFile(path: string): Promise<OpenedMapFile> {
  return loadPendingScenes(await openMapFileFirst(path))
}

/** Chave de comparação de caminho: barra e maiúscula não contam (Windows). */
function pathKey(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/**
 * PORTAL ANTIGO (`Prop.linkedMapPath`, removido da interface): o mapa de
 * destino entra na aventura como cena e o campo é zerado. O destino é COPIADO
 * para `scenes/<id>/map.json` na próxima gravação — o `file` da aventura é
 * relativo à pasta dela, e o destino antigo morava em outra pasta. O arquivo
 * original fica onde estava.
 *
 * Destino ilegível (apagado, sem permissão) não vira cena e o campo daquele
 * prop NÃO é zerado: zerar apagaria a única pista de onde o mapa estava.
 * Mapa solto com portal vira aventura aqui mesmo — a primeira cena é ele.
 */
async function convertLegacyPortals(opened: OpenedMapFile): Promise<OpenedMapFile> {
  const rootEntry: SceneEntry = { id: newSceneId(), name: opened.map.name, file: baseName(opened.path) }
  const activeId = opened.activeSceneId ?? rootEntry.id
  const loads: SceneLoad[] = opened.adventure ? [...opened.scenes] : [{ entry: rootEntry, status: 'ok', map: opened.map }]
  const dir = opened.adventureDir ?? (await dirname(opened.path))

  // Caminho absoluto -> cena que já o representa.
  const sceneByPath = new Map<string, string>()
  for (const load of loads) {
    try {
      sceneByPath.set(pathKey(await scenePath(dir, load.entry.file)), load.entry.id)
    } catch {
      // Caminho inválido não casa com destino nenhum.
    }
  }
  // O destino que uma passada anterior já trouxe casa pelo caminho de ORIGEM,
  // que o `file` da cena nova (`scenes/<id>/map.json`) não guarda.
  for (const source of opened.legacySources) sceneByPath.set(pathKey(source.path), source.sceneId)

  const changed = new Set(opened.changedSceneIds)
  const sources = [...opened.legacySources]
  let added = 0
  for (let i = 0; i < loads.length; i += 1) {
    const load = loads[i]
    if (load.status !== 'ok') continue
    const resolved: string[] = []
    for (const target of legacyPortalPaths(load.map)) {
      if (sceneByPath.has(pathKey(target))) {
        resolved.push(target)
        continue
      }
      if (sources.length >= MAX_MIGRATED_SCENES) continue
      try {
        const destination = await loadMapFromDisk(target)
        const id = newSceneId()
        loads.push({ entry: { id, name: destination.name, file: sceneFileFor(id) }, status: 'ok', map: destination })
        sceneByPath.set(pathKey(target), id)
        sources.push({ path: target, sceneId: id })
        changed.add(id)
        added += 1
        resolved.push(target)
      } catch {
        // Destino ilegível: o campo fica, ver o comentário da função.
      }
    }
    const cleared = clearLegacyPortals(load.map, resolved)
    if (cleared !== load.map) {
      loads[i] = { ...load, map: cleared }
      changed.add(load.entry.id)
    }
  }

  if (changed.size === opened.changedSceneIds.length) return opened

  const activeLoad = loads.find((load) => load.entry.id === activeId)
  const activeMap = activeLoad && activeLoad.status === 'ok' ? activeLoad.map : opened.map
  const adventure: Adventure = opened.adventure
    ? { ...opened.adventure, scenes: loads.map((load) => load.entry) }
    : { version: ADVENTURE_VERSION, id: `adv_${crypto.randomUUID()}`, name: opened.map.name, startSceneId: rootEntry.id, scenes: loads.map((load) => load.entry) }
  return {
    ...opened,
    map: activeMap,
    adventure,
    adventureDir: dir,
    activeSceneId: activeId,
    scenes: loads,
    changedSceneIds: [...changed],
    adventureChanged: added > 0 || opened.adventure === null,
    legacySources: sources,
  }
}

/**
 * Grava as cenas pedidas e, POR ÚLTIMO, o `adventure.json` — nessa ordem para
 * a lista nunca apontar para uma cena que ainda não chegou ao disco.
 */
export async function saveAdventureToDisk(adventureDir: string, adventure: Adventure, writes: { file: string; map: MapData }[]): Promise<void> {
  await ensureDir(adventureDir)
  for (const write of writes) {
    const path = await scenePath(adventureDir, write.file)
    await ensureDir(await dirname(path))
    await writeTextFileSafely(path, serializeMap(write.map))
  }
  await writeTextFileSafely(await join(adventureDir, ADVENTURE_FILE), serializeAdventure(adventure))
}
