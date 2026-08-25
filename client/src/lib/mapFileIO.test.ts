import { describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:\\Users\\test\\AppData\\Roaming\\labirinto'),
  join: vi.fn(async (...parts: string[]) => parts.join('\\')),
}))

const { defaultMapsDir, mapDirFor } = await import('./mapFileIO')

describe('defaultMapsDir', () => {
  it('junta o diretório de dados do app com "maps"', async () => {
    const dir = await defaultMapsDir()
    expect(dir).toBe('C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps')
  })
})

describe('mapDirFor', () => {
  it('junta o diretório de mapas com o id do mapa', async () => {
    const dir = await mapDirFor('map_1')
    expect(dir).toBe('C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps\\map_1')
  })

  it('usa ids diferentes para mapas diferentes', async () => {
    const dirA = await mapDirFor('map_a')
    const dirB = await mapDirFor('map_b')
    expect(dirA).not.toBe(dirB)
  })
})
