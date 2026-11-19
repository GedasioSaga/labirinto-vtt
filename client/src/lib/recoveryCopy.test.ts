import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Region } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { novoPersonagem } from './personagem'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'
// vi.mock abaixo é içado para antes deste import pelo vitest.
import { clearRecoveryCopy, formatRecoveryTime, parseRecoveryCopy, readRecoveryCopy, serializeRecoveryCopy, writeRecoveryCopy } from './recoveryCopy'

/**
 * Disco em memória no lugar do plugin-fs e do path do Tauri: o suficiente
 * para provar ONDE a cópia de recuperação grava e que ela nunca toca a pasta
 * de mapas salvos.
 */
const disco = vi.hoisted(() => ({ textos: new Map<string, string>(), pastas: new Set<string>() }))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: async () => 'C:/appdata',
  join: async (...partes: string[]) => partes.join('/'),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: async (caminho: string) => disco.textos.has(caminho) || disco.pastas.has(caminho),
  mkdir: async (caminho: string) => {
    disco.pastas.add(caminho)
  },
  writeTextFile: async (caminho: string, texto: string) => {
    disco.textos.set(caminho, texto)
  },
  readTextFile: async (caminho: string) => {
    const texto = disco.textos.get(caminho)
    if (texto === undefined) throw new Error(`arquivo não existe: ${caminho}`)
    return texto
  },
  remove: async (caminho: string) => {
    disco.textos.delete(caminho)
  },
}))


const FUSO = 'America/Sao_Paulo'
/** 23/09/2026 14:05 em Brasília (UTC-3). */
const COPIA_MS = Date.UTC(2026, 8, 23, 17, 5)

function mapaComSala(): MapData {
  const map = createEmptyMap('map_abc', 'Masmorra do Autosave', 30, 20, 64)
  const sala: Region = {
    id: 'r1',
    points: [
      { x: 0, y: 0 },
      { x: 64, y: 0 },
      { x: 64, y: 64 },
    ],
    tag: '',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
  }
  return { ...map, regions: [sala] }
}

beforeEach(() => {
  disco.textos.clear()
  disco.pastas.clear()
})

describe('cópia de recuperação: formato', () => {
  it('ida e volta preserva hora, caminho de origem e o mapa', () => {
    const map = mapaComSala()
    const copia = parseRecoveryCopy(serializeRecoveryCopy({ savedAtMs: COPIA_MS, mapPath: 'C:/appdata/maps/map_abc/map.json', map, scenes: {} }))
    expect(copia?.savedAtMs).toBe(COPIA_MS)
    expect(copia?.mapPath).toBe('C:/appdata/maps/map_abc/map.json')
    expect(copia?.map.name).toBe('Masmorra do Autosave')
    expect(copia?.map.regions).toHaveLength(1)
  })

  it('mapa novo, nunca salvo, volta com caminho nulo', () => {
    const copia = parseRecoveryCopy(serializeRecoveryCopy({ savedAtMs: COPIA_MS, mapPath: null, map: mapaComSala(), scenes: {} }))
    expect(copia?.mapPath).toBeNull()
  })

  it('aventura: cenas de fundo com mudança voltam junto; cena ilegível fica de fora', () => {
    const fundo = { ...mapaComSala(), id: 'map_fundo', name: 'Torre' }
    const texto = serializeRecoveryCopy({ savedAtMs: COPIA_MS, mapPath: null, map: mapaComSala(), scenes: { cena_torre: fundo } })
    expect(parseRecoveryCopy(texto)?.scenes.cena_torre?.name).toBe('Torre')

    const comLixo = JSON.stringify({ ...JSON.parse(texto), scenes: { cena_torre: fundo, cena_ruim: { sem: 'id' } } })
    expect(Object.keys(parseRecoveryCopy(comLixo)?.scenes ?? {})).toEqual(['cena_torre'])
  })

  it('campos opcionais ausentes: sem "scenes" e mapa só com "id" ainda viram oferta', () => {
    const copia = parseRecoveryCopy(JSON.stringify({ versao: 1, savedAtMs: COPIA_MS, mapPath: null, map: { id: 'map_min' } }))
    expect(copia?.scenes).toEqual({})
    expect(copia?.map.id).toBe('map_min')
    expect(copia?.map.regions).toEqual([])
  })

  it('arquivo corrompido ou de outro formato não vira oferta', () => {
    expect(parseRecoveryCopy('{nada')).toBeNull()
    expect(parseRecoveryCopy('null')).toBeNull()
    expect(parseRecoveryCopy(JSON.stringify({ versao: 1, savedAtMs: 'ontem', mapPath: null, map: {} }))).toBeNull()
    expect(parseRecoveryCopy(JSON.stringify({ versao: 1, savedAtMs: COPIA_MS, mapPath: 7, map: { id: 'x' } }))).toBeNull()
    expect(parseRecoveryCopy(JSON.stringify({ versao: 1, savedAtMs: COPIA_MS, mapPath: null, map: { sem: 'id' } }))).toBeNull()
  })
})

describe('cópia de recuperação: hora mostrada ao mestre', () => {
  it('mesmo dia: "hoje às HH:MM"', () => {
    expect(formatRecoveryTime(COPIA_MS, COPIA_MS + 60 * 60_000, FUSO)).toBe('hoje às 14:05')
  })

  it('outro dia: data e hora', () => {
    expect(formatRecoveryTime(COPIA_MS, COPIA_MS + 26 * 60 * 60_000, FUSO)).toBe('em 23/09 às 14:05')
  })
})

describe('cópia de recuperação: disco', () => {
  it('grava fora da pasta de mapas e lê de volta', async () => {
    const map = mapaComSala()
    await writeRecoveryCopy({ savedAtMs: COPIA_MS, mapPath: 'C:/appdata/maps/map_abc/map.json', map, scenes: {} })

    const gravados = Array.from(disco.textos.keys())
    expect(gravados).toHaveLength(1)
    expect(gravados[0].startsWith('C:/appdata/maps')).toBe(false)

    const lida = await readRecoveryCopy()
    expect(lida?.map.regions).toHaveLength(1)
    expect(lida?.savedAtMs).toBe(COPIA_MS)
  })

  it('sem arquivo não há oferta; apagar some com a oferta', async () => {
    expect(await readRecoveryCopy()).toBeNull()
    await writeRecoveryCopy({ savedAtMs: COPIA_MS, mapPath: null, map: mapaComSala(), scenes: {} })
    await clearRecoveryCopy()
    expect(await readRecoveryCopy()).toBeNull()
    // Apagar de novo, sem arquivo, não é erro.
    await expect(clearRecoveryCopy()).resolves.toBeUndefined()
  })

  it('arquivo ilegível no disco não derruba a leitura', async () => {
    await writeRecoveryCopy({ savedAtMs: COPIA_MS, mapPath: null, map: mapaComSala(), scenes: {} })
    const [caminho] = Array.from(disco.textos.keys())
    disco.textos.set(caminho, '{"versao":1,"savedAtMs":')
    expect(await readRecoveryCopy()).toBeNull()
  })
})

describe('cópia de recuperação: aventura e cópia guardada (18/11/2026)', () => {
  it('a aventura nunca gravada volta na cópia (lista de cenas, cena aberta, mapa da raiz); aventura torta fica de fora e o mapa volta', () => {
    const dados = {
      version: 1 as const,
      id: 'map_abc',
      name: 'Masmorra do Autosave',
      startSceneId: 'map_abc',
      scenes: [
        { id: 'map_abc', name: 'Masmorra do Autosave', file: 'map.json' },
        { id: 'scene_porao', name: 'Porão', file: 'scenes/scene_porao/map.json' },
      ],
    }
    const aventura = { dados, activeSceneId: 'scene_porao', dir: null, rootPath: null, rootMapId: 'map_abc' }
    const lida = parseRecoveryCopy(serializeRecoveryCopy({ savedAtMs: COPIA_MS, mapPath: null, map: mapaComSala(), scenes: {}, aventura }))
    expect(lida?.aventura?.dados.scenes.map((cena) => cena.id)).toEqual(['map_abc', 'scene_porao'])
    expect(lida?.aventura).toMatchObject({ activeSceneId: 'scene_porao', dir: null, rootPath: null, rootMapId: 'map_abc' })

    const torta = parseRecoveryCopy(serializeRecoveryCopy({ savedAtMs: COPIA_MS, mapPath: null, map: mapaComSala(), scenes: {}, aventura: { ...aventura, activeSceneId: 'scene_sumiu' } }))
    expect(torta?.aventura).toBeUndefined()
    expect(torta?.map.regions).toHaveLength(1)
  })

  it('a cópia da abertura anterior é posta de lado antes de a nova gravar e volta como oferta quando a nova sai', async () => {
    const { setAsideRecoveryCopy, readPendingRecoveryCopy } = await import('./recoveryCopy')
    await writeRecoveryCopy({ savedAtMs: COPIA_MS, mapPath: 'C:/mapas/queda/map.json', map: mapaComSala(), scenes: {} })
    await setAsideRecoveryCopy()
    // A abertura nova grava a dela por cima e depois salva (a dela some).
    await writeRecoveryCopy({ savedAtMs: COPIA_MS + 60_000, mapPath: null, map: createEmptyMap('map_novo', 'Novo', 10, 10, 64), scenes: {} })
    expect((await readPendingRecoveryCopy())?.setAside).toBe(false)
    await clearRecoveryCopy()
    const oferta = await readPendingRecoveryCopy()
    expect(oferta?.setAside).toBe(true)
    expect(oferta?.copy.mapPath).toBe('C:/mapas/queda/map.json')
    expect(oferta?.copy.map.regions).toHaveLength(1)
  })

  it('retrato completo (análise 18/11/2026, seção 3, causa 4): as fichas da aventura e o rpg.json da pasta voltam iguais', () => {
    const luffy = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'pers_luffy', recursos: { hp: 37 } }
    const zoro = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Zoro'), id: 'pers_zoro' }
    const dados = {
      version: 1 as const,
      id: 'adv_ilha',
      name: 'Ilha',
      startSceneId: 'map_abc',
      scenes: [{ id: 'map_abc', name: 'Praia', file: 'map.json' }],
      sistemaDeRpg: SISTEMA_ONE_PIECE.id,
      personagens: [luffy],
    }
    const aventura = { dados, activeSceneId: 'map_abc', dir: 'C:/mapas/ilha', rootPath: null, rootMapId: null }
    const pasta = { pastaId: 'pasta_mar', rpg: { sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [zoro] } }
    const lida = parseRecoveryCopy(serializeRecoveryCopy({ savedAtMs: COPIA_MS, mapPath: 'C:/mapas/ilha/map.json', map: mapaComSala(), scenes: {}, aventura, pasta }))
    expect(lida?.aventura?.dados.personagens).toEqual([luffy])
    expect(lida?.aventura?.dados.sistemaDeRpg).toBe(SISTEMA_ONE_PIECE.id)
    expect(lida?.pasta?.pastaId).toBe('pasta_mar')
    expect(lida?.pasta?.rpg.sistemaDeRpg).toBe(SISTEMA_ONE_PIECE.id)
    expect(lida?.pasta?.rpg.personagens).toEqual([zoro])
  })
})
