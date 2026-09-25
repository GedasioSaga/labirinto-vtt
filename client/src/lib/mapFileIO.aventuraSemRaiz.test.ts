/**
 * Card de aventura SEM `map.json` na raiz em "Carregar Mapa" (como a
 * cidade-torre gerada: `adventure.json` + `scenes/<id>/map.json`).
 *
 * `listedAdventure` põe o nome da pasta como `id` do card, e a tela chama
 * `renameMap(id)`/`duplicateMap(id)` em todo card não danificado. Os dois
 * procuravam `<pasta>/map.json`, que nessa aventura não existe por definição:
 * Renomear e Duplicar sempre davam toast de erro. Aqui o disco é um mapa em
 * memória com `readDir` e `copyFile` de verdade, para a cópia poder ser lida
 * de volta.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData } from '../types/map'

const arquivos = new Map<string, string>()
const pastas = new Set<string>()

function temDentro(path: string): boolean {
  const prefixo = `${path}/`
  for (const chave of arquivos.keys()) if (chave.startsWith(prefixo)) return true
  for (const pasta of pastas) if (pasta.startsWith(prefixo)) return true
  return false
}

function filhosDe(path: string): { name: string; isDirectory: boolean; isFile: boolean; isSymlink: boolean }[] {
  const prefixo = `${path}/`
  const nomes = new Map<string, boolean>()
  for (const chave of [...arquivos.keys(), ...pastas]) {
    if (!chave.startsWith(prefixo)) continue
    const resto = chave.slice(prefixo.length)
    const barra = resto.indexOf('/')
    const nome = barra === -1 ? resto : resto.slice(0, barra)
    const ehPasta = barra !== -1 || pastas.has(chave)
    nomes.set(nome, (nomes.get(nome) ?? false) || ehPasta)
  }
  return [...nomes].map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }))
}

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async (path: string, data: string) => {
    arquivos.set(path, data)
  }),
  rename: vi.fn(async (from: string, to: string) => {
    const conteudo = arquivos.get(from)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${from}`)
    arquivos.set(to, conteudo)
    arquivos.delete(from)
  }),
  mkdir: vi.fn(async (path: string) => {
    pastas.add(path)
  }),
  exists: vi.fn(async (path: string) => arquivos.has(path) || pastas.has(path) || temDentro(path)),
  readTextFile: vi.fn(async (path: string) => {
    const conteudo = arquivos.get(path)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
    return conteudo
  }),
  readDir: vi.fn(async (path: string) => filhosDe(path)),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async (path: string) => {
    arquivos.delete(path)
  }),
  copyFile: vi.fn(async (from: string, to: string) => {
    const conteudo = arquivos.get(from)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${from}`)
    arquivos.set(to, conteudo)
  }),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(async () => null),
  open: vi.fn(async () => null),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/Users/test/AppData/Roaming/labirinto'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { listSavedMaps, renameMap, duplicateMap, openMapFileFirst } = await import('./mapFileIO')
const { serializeMap, deserializeMap } = await import('./mapFile')
const { createEmptyMap } = await import('./mapFactory')
const { parseAdventure, serializeAdventure } = await import('./adventure')

const MAPS = 'C:/Users/test/AppData/Roaming/labirinto/maps'
const TORRE = `${MAPS}/cidade-torre`
const ESGOTO_FILE = 'scenes/scene_esgoto/map.json'
const PICO_FILE = 'scenes/scene_pico/map.json'
const IMAGEM_DE_FORA = 'C:/imgs/goblin.png'

function mapa(id: string, name: string, overrides: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap(id, name, 30, 20, 64), ...overrides }
}

function lerAventura(dir: string) {
  const bruto = arquivos.get(`${dir}/adventure.json`)
  if (bruto === undefined) throw new Error(`sem adventure.json em ${dir}`)
  return parseAdventure(bruto)
}

function lerMapa(path: string): MapData {
  const bruto = arquivos.get(path)
  if (bruto === undefined) throw new Error(`sem mapa em ${path}`)
  return deserializeMap(bruto)
}

beforeEach(() => {
  arquivos.clear()
  pastas.clear()
  pastas.add(MAPS)
  arquivos.set(
    `${TORRE}/adventure.json`,
    serializeAdventure({
      version: 1,
      id: 'adv_torre',
      name: 'Cidade-Torre',
      startSceneId: 'scene_esgoto',
      scenes: [
        { id: 'scene_pico', name: 'Pico', file: PICO_FILE },
        { id: 'scene_esgoto', name: 'Esgoto', file: ESGOTO_FILE },
      ],
    }),
  )
  arquivos.set(
    `${TORRE}/${ESGOTO_FILE}`,
    serializeMap(
      mapa('map_esgoto', 'Esgoto', {
        background: { type: 'image', src: `${TORRE}/scenes/scene_esgoto/fundo.png` },
        tokens: [{ id: 't1', characterId: null, name: 'Goblin', x: 1, y: 2, size: 1, image: IMAGEM_DE_FORA }],
      }),
    ),
  )
  arquivos.set(`${TORRE}/scenes/scene_esgoto/fundo.png`, 'png-bytes')
  arquivos.set(`${TORRE}/${PICO_FILE}`, serializeMap(mapa('map_pico', 'Pico')))
  arquivos.set(`${MAPS}/map_outro/map.json`, serializeMap(mapa('map_outro', 'Masmorra')))
})

describe('renameMap no card de aventura sem map.json na raiz', () => {
  it('renomeia a aventura no adventure.json e a lista passa a mostrar o nome novo', async () => {
    const card = (await listSavedMaps()).find((entry) => entry.name === 'Cidade-Torre')
    expect(card?.id).toBe('cidade-torre')

    const finalName = await renameMap('cidade-torre', 'Torre Nova')

    expect(finalName).toBe('Torre Nova')
    const aventura = lerAventura(TORRE)
    expect(aventura.name).toBe('Torre Nova')
    // O resto da aventura fica como estava.
    expect(aventura.id).toBe('adv_torre')
    expect(aventura.startSceneId).toBe('scene_esgoto')
    expect(aventura.scenes.map((scene) => scene.file)).toEqual([PICO_FILE, ESGOTO_FILE])
    // Criar um map.json na raiz transformaria o card num mapa solto.
    expect(arquivos.has(`${TORRE}/map.json`)).toBe(false)
    expect((await listSavedMaps()).map((entry) => entry.name).sort()).toEqual(['Masmorra', 'Torre Nova'])
  })

  it('desambigua contra o nome de outro mapa salvo', async () => {
    const finalName = await renameMap('cidade-torre', 'Masmorra')

    expect(finalName).toBe('Masmorra (2)')
    expect(lerAventura(TORRE).name).toBe('Masmorra (2)')
  })

  it('pasta sem map.json nem adventure.json continua lançando "não encontrado"', async () => {
    pastas.add(`${MAPS}/vazia`)
    await expect(renameMap('vazia', 'Qualquer')).rejects.toThrow('não encontrado')
  })
})

describe('duplicateMap no card de aventura sem map.json na raiz', () => {
  it('copia a aventura inteira para uma pasta nova, com id e nome novos, e a cópia aparece na lista', async () => {
    const copia = await duplicateMap('cidade-torre')

    expect(copia.name).toBe('Cidade-Torre (cópia)')
    expect(copia.id).not.toBe('cidade-torre')
    const destino = `${MAPS}/${copia.id}`
    expect(copia.path).toBe(`${destino}/${ESGOTO_FILE}`)
    expect(copia.width).toBe(30)

    const aventura = lerAventura(destino)
    expect(aventura.name).toBe('Cidade-Torre (cópia)')
    expect(aventura.id).not.toBe('adv_torre')
    expect(aventura.startSceneId).toBe('scene_esgoto')
    expect(aventura.scenes.map((scene) => scene.file)).toEqual([PICO_FILE, ESGOTO_FILE])
    expect(arquivos.get(`${destino}/scenes/scene_esgoto/fundo.png`)).toBe('png-bytes')
    expect(lerMapa(`${destino}/${PICO_FILE}`).name).toBe('Pico')

    const nomes = (await listSavedMaps()).map((entry) => entry.name).sort()
    expect(nomes).toEqual(['Cidade-Torre', 'Cidade-Torre (cópia)', 'Masmorra'])
  })

  it('imagem que morava na pasta da aventura passa a apontar para a cópia; a de fora fica como estava', async () => {
    const copia = await duplicateMap('cidade-torre')
    const destino = `${MAPS}/${copia.id}`

    const esgoto = lerMapa(`${destino}/${ESGOTO_FILE}`)
    expect(esgoto.background).toEqual({ type: 'image', src: `${destino}/scenes/scene_esgoto/fundo.png` })
    expect(esgoto.tokens[0]?.image).toBe(IMAGEM_DE_FORA)
  })

  it('não mexe na aventura de origem', async () => {
    const antes = new Map([...arquivos].filter(([path]) => path.startsWith(`${TORRE}/`)))

    await duplicateMap('cidade-torre')

    const depois = new Map([...arquivos].filter(([path]) => path.startsWith(`${TORRE}/`)))
    expect(depois).toEqual(antes)
  })

  it('o caminho da cópia abre como a aventura copiada, na cena inicial', async () => {
    const copia = await duplicateMap('cidade-torre')

    const aberto = await openMapFileFirst(copia.path)

    expect(aberto.adventureDir).toBe(`${MAPS}/${copia.id}`)
    expect(aberto.adventure?.name).toBe('Cidade-Torre (cópia)')
    expect(aberto.activeSceneId).toBe('scene_esgoto')
  })

  it('cena com map.json ilegível é copiada crua, sem derrubar a duplicação', async () => {
    arquivos.set(`${TORRE}/${PICO_FILE}`, '{ isso não é json')

    const copia = await duplicateMap('cidade-torre')

    expect(arquivos.get(`${MAPS}/${copia.id}/${PICO_FILE}`)).toBe('{ isso não é json')
    expect(lerAventura(`${MAPS}/${copia.id}`).name).toBe('Cidade-Torre (cópia)')
  })

  it('aventura com adventure.json mínimo (sem id, sem nome) também duplica', async () => {
    arquivos.set(`${TORRE}/adventure.json`, JSON.stringify({ scenes: [{ id: 'scene_pico', name: 'Pico', file: PICO_FILE }] }))

    const copia = await duplicateMap('cidade-torre')

    expect(copia.name).toBe('Pico (cópia)')
    expect(copia.path).toBe(`${MAPS}/${copia.id}/${PICO_FILE}`)
  })
})
