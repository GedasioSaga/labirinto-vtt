/**
 * MÍDIA DA MESA no disco do mestre (`lib/midiaNoDisco.ts`): cada imagem é
 * gravada UMA vez com o hash do conteúdo no nome, na pasta que a sala serve.
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
const { baseDaMidiaConhecida, baseDaMidiaNoMestre, guardarDataUrl, guardarMidia, MIDIA_GRANDE_DEMAIS, MIDIA_NAO_E_IMAGEM } = await import('./midiaNoDisco')
const { MIDIA_MAX_BYTES, resolverComBase } = await import('./midia')

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])

beforeEach(() => {
  binarios.clear()
  pastas.clear()
  vi.mocked(writeFile).mockClear()
})

describe('guardarMidia', () => {
  it('grava em <appData>/midia/<hash>.<ext> e devolve a referência', async () => {
    const ref = await guardarMidia(PNG)
    expect(ref).toMatch(/^midia:[0-9a-f]{64}\.png$/)
    const caminho = `${APPDATA}/midia/${ref.slice('midia:'.length)}`
    expect(binarios.get(caminho)).toEqual(PNG)
  })

  it('o mesmo conteúdo não grava de novo: o nome é o conteúdo', async () => {
    const primeira = await guardarMidia(PNG)
    const segunda = await guardarMidia(PNG.slice())
    expect(segunda).toBe(primeira)
    expect(writeFile).toHaveBeenCalledTimes(1)
  })

  it('recusa o que não é imagem e o que passa do teto', async () => {
    await expect(guardarMidia(new TextEncoder().encode('<svg onload=alert(1)>'))).rejects.toThrow(MIDIA_NAO_E_IMAGEM)
    const grande = new Uint8Array(MIDIA_MAX_BYTES + 1)
    grande.set(PNG)
    await expect(guardarMidia(grande)).rejects.toThrow(MIDIA_GRANDE_DEMAIS)
    expect(binarios.size).toBe(0)
  })

  it('a embutida de antes vira mídia; o que não é embutida volta null', async () => {
    const ref = await guardarDataUrl(`data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`)
    expect(ref).toBe(await guardarMidia(PNG))
    expect(await guardarDataUrl('C:/retrato.png')).toBeNull()
  })
})

describe('base da mídia no mestre', () => {
  it('a URL da ponte de arquivos sem o nome do arquivo: base + id abre a imagem', async () => {
    const base = await baseDaMidiaNoMestre()
    const ref = await guardarMidia(PNG)
    const id = ref.slice('midia:'.length)
    expect(resolverComBase(base)(ref)).toBe(`http://asset.localhost/${encodeURIComponent(`${APPDATA}/midia/${id}`)}`)
    expect(baseDaMidiaConhecida()).toBe(base)
  })
})
