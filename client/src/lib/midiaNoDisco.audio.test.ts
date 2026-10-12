/**
 * ÁUDIO DA MESA no disco do mestre (`guardarAudio`): a música importada do
 * minigame vai para a mesma pasta da imagem, com o hash no nome, e só se for
 * áudio aceito e couber nos 15 MB que o Rust serve.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const APPDATA = 'C:/Users/test/AppData/Roaming/labirinto'
const binarios = new Map<string, Uint8Array>()
const pastas = new Set<string>()

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => APPDATA),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}))

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((caminho: string) => `http://asset.localhost/${encodeURIComponent(caminho)}`),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => binarios.has(path) || pastas.has(path)),
  mkdir: vi.fn(async (path: string) => {
    pastas.add(path)
  }),
  writeFile: vi.fn(async (path: string, data: Uint8Array) => {
    binarios.set(path, data)
  }),
}))

const { writeFile } = await import('@tauri-apps/plugin-fs')
const { AUDIO_GRANDE_DEMAIS, AUDIO_NAO_E_AUDIO, guardarAudio, guardarMidia, MIDIA_NAO_E_IMAGEM } = await import('./midiaNoDisco')
const { MIDIA_AUDIO_MAX_BYTES } = await import('./midia')

const MP3 = Uint8Array.from([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0])
const OGG = Uint8Array.from([0x4f, 0x67, 0x67, 0x53, 0, 0x02, 0, 0])
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])

beforeEach(() => {
  binarios.clear()
  pastas.clear()
  vi.mocked(writeFile).mockClear()
})

describe('guardarAudio', () => {
  it('grava em <appData>/midia/<hash>.<ext> e devolve a referência', async () => {
    const ref = await guardarAudio(MP3)
    expect(ref).toMatch(/^midia:[0-9a-f]{64}\.mp3$/)
    expect(binarios.get(`${APPDATA}/midia/${ref.slice('midia:'.length)}`)).toEqual(MP3)
    expect(await guardarAudio(OGG)).toMatch(/\.ogg$/)
  })

  it('o mesmo conteúdo não grava de novo: o nome é o conteúdo', async () => {
    const primeira = await guardarAudio(MP3)
    expect(await guardarAudio(MP3.slice())).toBe(primeira)
    expect(writeFile).toHaveBeenCalledTimes(1)
  })

  it('as frases prontas são as combinadas', () => {
    expect(AUDIO_NAO_E_AUDIO).toBe('esse áudio não é MP3, OGG, WAV nem M4A')
    expect(AUDIO_GRANDE_DEMAIS).toBe('esse áudio passa de 15 MB')
  })

  it('recusa imagem, texto e o vazio como áudio', async () => {
    await expect(guardarAudio(PNG)).rejects.toThrow(AUDIO_NAO_E_AUDIO)
    await expect(guardarAudio(new TextEncoder().encode('<svg onload=alert(1)>'))).rejects.toThrow(AUDIO_NAO_E_AUDIO)
    await expect(guardarAudio(new Uint8Array())).rejects.toThrow(AUDIO_NAO_E_AUDIO)
    expect(binarios.size).toBe(0)
  })

  it('15 MB cabe; um byte a mais é recusado sem gravar', async () => {
    const noTeto = new Uint8Array(MIDIA_AUDIO_MAX_BYTES)
    noTeto.set(MP3)
    expect(await guardarAudio(noTeto)).toMatch(/\.mp3$/)
    binarios.clear()
    const acima = new Uint8Array(MIDIA_AUDIO_MAX_BYTES + 1)
    acima.set(MP3)
    await expect(guardarAudio(acima)).rejects.toThrow(AUDIO_GRANDE_DEMAIS)
    expect(binarios.size).toBe(0)
  })

  it('guardarMidia segue só de imagem: áudio não entra pelo caminho da imagem', async () => {
    await expect(guardarMidia(MP3)).rejects.toThrow(MIDIA_NAO_E_IMAGEM)
    expect(await guardarMidia(PNG)).toMatch(/\.png$/)
  })
})
