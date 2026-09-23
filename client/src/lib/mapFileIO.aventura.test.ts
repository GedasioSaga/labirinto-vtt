/**
 * Aventura com várias cenas no disco (`lib/mapFileIO.ts` + `lib/adventure.ts`).
 *
 * O que a jornada `e2e/task-jornada-varias-cenas.spec.ts` não cobre:
 *  (a) mapa salvo ANTES das cenas existirem abre igual — solto, sem regravar nada;
 *  (b) mapa com portal antigo (`Prop.linkedMapPath`) abre, o destino vira cena
 *      da aventura e o campo zera — e o que foi convertido sobrevive a gravar e reabrir;
 *  (c) `adventure.json` com cena apontando para arquivo que sumiu não derruba
 *      a abertura: a cena volta marcada como indisponível.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData, Prop } from '../types/map'

const arquivos = new Map<string, string>()
const pastas = new Set<string>()

const writeTextFileMock = vi.fn(async (path: string, data: string) => {
  arquivos.set(path, data)
})

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: writeTextFileMock,
  rename: vi.fn(async (from: string, to: string) => {
    const conteudo = arquivos.get(from)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${from}`)
    arquivos.set(to, conteudo)
    arquivos.delete(from)
  }),
  mkdir: vi.fn(async (path: string) => {
    pastas.add(path)
  }),
  exists: vi.fn(async (path: string) => arquivos.has(path) || pastas.has(path)),
  readTextFile: vi.fn(async (path: string) => {
    const conteudo = arquivos.get(path)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
    return conteudo
  }),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async (path: string) => {
    arquivos.delete(path)
  }),
  copyFile: vi.fn(async () => undefined),
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

const { openMapFile, saveAdventureToDisk } = await import('./mapFileIO')
const { serializeMap, deserializeMap } = await import('./mapFile')
const { createEmptyMap } = await import('./mapFactory')
const { parseAdventure, serializeAdventure } = await import('./adventure')

const MAPS = 'C:/Users/test/AppData/Roaming/labirinto/maps'

function mapa(id: string, name: string, overrides: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap(id, name, 30, 20, 64), ...overrides }
}

function portal(id: string, destino: string | null): Prop {
  return { id, src: 'C:/imgs/escada.png', x: 64, y: 64, width: 64, height: 64, linkedMapPath: destino }
}

function gravar(path: string, map: MapData): void {
  arquivos.set(path, serializeMap(map))
}

beforeEach(() => {
  arquivos.clear()
  pastas.clear()
  writeTextFileMock.mockClear()
})

describe('(a) mapa salvo antes das cenas existirem', () => {
  it('abre igual: solto, com o mesmo conteúdo, e sem escrever nada no disco', async () => {
    const caminho = `${MAPS}/map_velho/map.json`
    // JSON cru de antes: sem gridOffset, sem pins, sem linkedMapPath no prop.
    const cru = JSON.stringify({
      id: 'map_velho',
      name: 'Masmorra antiga',
      width: 30,
      height: 20,
      grid: 64,
      walls: [],
      regions: [],
      tokens: [{ id: 't1', characterId: null, name: 'Grog', x: 96, y: 96, size: 1 }],
      props: [{ id: 'p1', src: 'C:/imgs/mesa.png', x: 0, y: 0, width: 64, height: 64 }],
    })
    arquivos.set(caminho, cru)

    const aberto = await openMapFile(caminho)

    expect(aberto.adventure).toBeNull()
    expect(aberto.scenes).toEqual([])
    expect(aberto.changedSceneIds).toEqual([])
    expect(aberto.adventureChanged).toBe(false)
    expect(aberto.map).toEqual(deserializeMap(cru))
    expect(aberto.map.tokens.map((t) => t.name)).toEqual(['Grog'])
    expect(writeTextFileMock).not.toHaveBeenCalled()
  })

  it('adventure.json quebrado ao lado do mapa não impede o mapa de abrir (abre solto)', async () => {
    const caminho = `${MAPS}/map_x/map.json`
    gravar(caminho, mapa('map_x', 'Torre'))
    arquivos.set(`${MAPS}/map_x/adventure.json`, '{ isto não é json')

    const aberto = await openMapFile(caminho)

    expect(aberto.adventure).toBeNull()
    expect(aberto.map.name).toBe('Torre')
  })
})

describe('(b) portal antigo (Prop.linkedMapPath)', () => {
  const caminhoA = `${MAPS}/map_a/map.json`
  const caminhoB = `${MAPS}/map_b/map.json`

  it('o destino vira cena da aventura e o campo do prop é zerado', async () => {
    gravar(caminhoA, mapa('map_a', 'Térreo', { props: [portal('escada', caminhoB), portal('mesa', null)] }))
    gravar(caminhoB, mapa('map_b', 'Porão', { tokens: [{ id: 'rato', characterId: null, name: 'Rato', x: 64, y: 64, size: 1, image: null }] }))

    const aberto = await openMapFile(caminhoA)

    expect(aberto.adventure).not.toBeNull()
    const cenas = aberto.adventure?.scenes ?? []
    expect(cenas.map((c) => c.name)).toEqual(['Térreo', 'Porão'])
    expect(cenas[0].file).toBe('map.json')
    expect(cenas[1].file).toBe(`scenes/${cenas[1].id}/map.json`)
    expect(aberto.activeSceneId).toBe(cenas[0].id)
    expect(aberto.adventureDir).toBe(`${MAPS}/map_a`)
    // O mapa aberto já sem o portal; a peça continua lá.
    expect(aberto.map.props.map((p) => [p.id, p.linkedMapPath])).toEqual([
      ['escada', null],
      ['mesa', null],
    ])
    // O destino veio inteiro, com o que tinha dentro.
    const porao = aberto.scenes.find((s) => s.entry.id === cenas[1].id)
    expect(porao?.status).toBe('ok')
    expect(porao && porao.status === 'ok' ? porao.map.tokens.map((t) => t.name) : []).toEqual(['Rato'])
    // As duas cenas estão fora do disco: a conversão tem de ser gravada.
    expect([...aberto.changedSceneIds].sort()).toEqual([cenas[0].id, cenas[1].id].sort())
    expect(aberto.adventureChanged).toBe(true)
    // Abrir não grava: quem grava é o Salvar.
    expect(writeTextFileMock).not.toHaveBeenCalled()
  })

  it('gravar e reabrir traz as duas cenas, com o campo zerado no disco', async () => {
    gravar(caminhoA, mapa('map_a', 'Térreo', { props: [portal('escada', caminhoB)] }))
    gravar(caminhoB, mapa('map_b', 'Porão'))
    const aberto = await openMapFile(caminhoA)
    const aventura = aberto.adventure
    if (aventura === null || aberto.adventureDir === null) throw new Error('a conversão deveria ter criado a aventura')

    const escritas = aberto.scenes.flatMap((s) => (s.status === 'ok' ? [{ file: s.entry.file, map: s.map }] : []))
    await saveAdventureToDisk(aberto.adventureDir, aventura, escritas)

    const noDisco = parseAdventure(arquivos.get(`${MAPS}/map_a/adventure.json`) ?? '')
    expect(noDisco.scenes.map((c) => c.name)).toEqual(['Térreo', 'Porão'])
    const reaberto = await openMapFile(caminhoA)
    expect(reaberto.adventure?.scenes.map((c) => c.id)).toEqual(noDisco.scenes.map((c) => c.id))
    expect(reaberto.changedSceneIds).toEqual([])
    expect(reaberto.map.props[0].linkedMapPath).toBeNull()
    expect(reaberto.scenes.map((s) => s.status)).toEqual(['ok', 'ok'])
    // A cena copiada abre também pelo próprio arquivo, reconhecida como cena da aventura.
    const pelaCena = await openMapFile(`${MAPS}/map_a/${noDisco.scenes[1].file}`)
    expect(pelaCena.activeSceneId).toBe(noDisco.scenes[1].id)
    expect(pelaCena.map.name).toBe('Porão')
  })

  it('destino que sumiu não vira cena e o campo FICA (é a única pista de onde o mapa estava)', async () => {
    gravar(caminhoA, mapa('map_a', 'Térreo', { props: [portal('escada', `${MAPS}/map_sumiu/map.json`)] }))

    const aberto = await openMapFile(caminhoA)

    expect(aberto.adventure).toBeNull()
    expect(aberto.map.props[0].linkedMapPath).toBe(`${MAPS}/map_sumiu/map.json`)
  })

  it('dois portais para o mesmo destino e destino que aponta de volta viram UMA cena', async () => {
    gravar(caminhoA, mapa('map_a', 'Térreo', { props: [portal('escada', caminhoB), portal('alçapão', caminhoB)] }))
    gravar(caminhoB, mapa('map_b', 'Porão', { props: [portal('volta', caminhoA)] }))

    const aberto = await openMapFile(caminhoA)

    expect(aberto.adventure?.scenes.map((c) => c.name)).toEqual(['Térreo', 'Porão'])
    const porao = aberto.scenes[1]
    expect(porao.status === 'ok' ? porao.map.props[0].linkedMapPath : 'indisponível').toBeNull()
  })
})

describe('(c) cena cujo arquivo sumiu', () => {
  it('a aventura abre e a cena volta como indisponível, com o motivo', async () => {
    const pasta = `${MAPS}/map_av`
    gravar(`${pasta}/map.json`, mapa('map_av', 'Vila'))
    arquivos.set(
      `${pasta}/adventure.json`,
      serializeAdventure({
        version: 1,
        id: 'adv_1',
        name: 'Vila',
        startSceneId: 'scene_vila',
        scenes: [
          { id: 'scene_vila', name: 'Vila', file: 'map.json' },
          { id: 'scene_cripta', name: 'Cripta', file: 'scenes/scene_cripta/map.json' },
          { id: 'scene_fora', name: 'Fora da pasta', file: '../map_outro/map.json' },
        ],
      }),
    )

    const aberto = await openMapFile(`${pasta}/map.json`)

    expect(aberto.adventure?.scenes.map((c) => c.id)).toEqual(['scene_vila', 'scene_cripta', 'scene_fora'])
    expect(aberto.scenes.map((s) => [s.entry.id, s.status])).toEqual([
      ['scene_vila', 'ok'],
      ['scene_cripta', 'indisponivel'],
      ['scene_fora', 'indisponivel'],
    ])
    const cripta = aberto.scenes[1]
    expect(cripta.status === 'indisponivel' ? cripta.reason : '').toMatch(/não encontrado/)
    // Caminho que sai da pasta da aventura é recusado ANTES de ler.
    const fora = aberto.scenes[2]
    expect(fora.status === 'indisponivel' ? fora.reason : '').toMatch(/relativo/)
    expect(aberto.map.name).toBe('Vila')
  })
})
