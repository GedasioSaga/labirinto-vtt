import { writeTextFile, mkdir, exists, readTextFile, readDir, stat, remove, copyFile } from '@tauri-apps/plugin-fs'
import { save, open } from '@tauri-apps/plugin-dialog'
import { appDataDir, join, dirname } from '@tauri-apps/api/path'
import { invoke } from '@tauri-apps/api/core'
import type { MapData } from '../types/map'
import { serializeMap, deserializeMap } from './mapFile'

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
  await writeTextFile(filePath, serializeMap(map))
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
}

/**
 * Lista os mapas salvos em `%APPDATA%/maps`, para a tela "Carregar Mapa".
 * Ordenada por recência (mais recente primeiro) — item 23 do
 * PLANO-REFINAMENTO.md.
 *
 * Um `map.json` corrompido não pode derrubar a tela inteira — por isso cada
 * `deserializeMap` roda num `try/catch` individual, e a entrada ruim é só
 * omitida da lista, nunca propagada.
 */
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

    try {
      const content = await readTextFile(mapJsonPath)
      const map = deserializeMap(content)
      const info = await stat(mapJsonPath)
      const mtimeMs = info.mtime ? info.mtime.getTime() : 0
      maps.push({ path: mapJsonPath, id: map.id, name: map.name, width: map.width, height: map.height, grid: map.grid, mtimeMs })
    } catch {
      // map.json inválido (JSON malformado ou sem "id") — pula a entrada.
      continue
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

  await writeTextFile(mapJsonPath, serializeMap({ ...map, name: finalName }))
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
 * `map.json` da cópia com o `id` novo e um nome único ("<nome> (cópia)",
 * desambiguado por `uniqueMapName`). `Token.image`/`Prop.src`/background são
 * caminho absoluto fora da pasta do mapa (`types/map.ts:192`) — a cópia não
 * precisa tocar neles para as referências de imagem continuarem válidas.
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
  const duplicated = { ...sourceMap, id: newId, name: finalName }
  const destMapJsonPath = await join(destDir, 'map.json')
  await writeTextFile(destMapJsonPath, serializeMap(duplicated))

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
  await writeTextFile(path, serializeMap(map))
}
