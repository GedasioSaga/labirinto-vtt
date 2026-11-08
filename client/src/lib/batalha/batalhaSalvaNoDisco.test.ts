// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S5: a pasta da mesa que o plugin de arquivos
 * recusa (fora do escopo do app) volta como `sem-acesso`, sem erro, como o
 * `readIfExists` do mapa; qualquer outro erro do disco continua subindo.
 */
import { describe, expect, it, vi } from 'vitest'

const existe = vi.fn<(caminho: string) => Promise<boolean>>()

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: (caminho: string) => existe(caminho),
  readTextFile: vi.fn(async () => ''),
  remove: vi.fn(async () => undefined),
  stat: vi.fn(async () => ({ size: 0 })),
}))
vi.mock('@tauri-apps/api/path', () => ({ join: vi.fn(async (...partes: string[]) => partes.join('/')) }))
vi.mock('../mapFileIO', () => ({ writeTextFileSafely: vi.fn(async () => undefined) }))

const { lerBatalhaSalva } = await import('./batalhaSalvaNoDisco')

describe('S5: ler a batalha guardada numa pasta que o app não pode usar', () => {
  it('a recusa da pasta vira sem-acesso; os outros erros do disco continuam subindo', async () => {
    // O texto do erro do Tauri (tauri-plugin-fs, `Error::PathForbidden`).
    existe.mockRejectedValueOnce('forbidden path: D:/mesas/porto/batalha-em-andamento.json')
    await expect(lerBatalhaSalva('D:/mesas/porto')).resolves.toEqual({ ok: false, motivo: 'sem-acesso' })
    expect(existe).toHaveBeenCalledWith('D:/mesas/porto/batalha-em-andamento.json')

    existe.mockRejectedValueOnce(new Error('O dispositivo não está pronto. (os error 21)'))
    await expect(lerBatalhaSalva('E:/mesas/porto')).rejects.toThrow('os error 21')

    existe.mockResolvedValueOnce(false)
    await expect(lerBatalhaSalva('C:/appdata/maps/adv_porto')).resolves.toBeNull()
  })
})
