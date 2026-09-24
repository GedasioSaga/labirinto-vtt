import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Region } from '../types/map'
import { createEmptyMap } from './mapFactory'
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
