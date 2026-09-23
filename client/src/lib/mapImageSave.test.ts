import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const saveMock = vi.fn(async (): Promise<string | null> => null)
const writeFileMock = vi.fn(async (): Promise<void> => undefined)
const isTauriMock = vi.fn(() => true)

vi.mock('@tauri-apps/plugin-dialog', () => ({ save: saveMock }))
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: writeFileMock }))
vi.mock('@tauri-apps/api/core', () => ({ isTauri: isTauriMock }))

const { saveMapImage } = await import('./mapImageSave')

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

beforeEach(() => {
  saveMock.mockReset()
  writeFileMock.mockReset()
  isTauriMock.mockReset()
  isTauriMock.mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('saveMapImage (app desktop)', () => {
  it('abre a janela de salvar com o nome sugerido e filtro PNG, e grava os bytes no caminho escolhido', async () => {
    saveMock.mockResolvedValue('C:/Users/mestre/Desktop/Cripta do Farol.png')

    const path = await saveMapImage(PNG, 'Cripta do Farol.png')

    expect(path).toBe('C:/Users/mestre/Desktop/Cripta do Farol.png')
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(saveMock).toHaveBeenCalledWith({ defaultPath: 'Cripta do Farol.png', filters: [{ name: 'Imagem PNG', extensions: ['png'] }] })
    expect(writeFileMock).toHaveBeenCalledWith('C:/Users/mestre/Desktop/Cripta do Farol.png', PNG)
  })

  it('caminho escolhido sem extensão ganha .png', async () => {
    saveMock.mockResolvedValue('C:/mapas/cripta')
    expect(await saveMapImage(PNG, 'Cripta.png')).toBe('C:/mapas/cripta.png')
    expect(writeFileMock).toHaveBeenCalledWith('C:/mapas/cripta.png', PNG)
  })

  it('cancelar a janela não grava nada e devolve null', async () => {
    saveMock.mockResolvedValue(null)
    expect(await saveMapImage(PNG, 'Cripta.png')).toBeNull()
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('falha ao gravar sobe para quem chamou avisar', async () => {
    saveMock.mockResolvedValue('C:/sem-permissao/cripta.png')
    writeFileMock.mockRejectedValue(new Error('acesso negado'))
    await expect(saveMapImage(PNG, 'Cripta.png')).rejects.toThrow('acesso negado')
  })
})

describe('saveMapImage (navegador)', () => {
  it('baixa o arquivo pelo navegador, sem janela do sistema', async () => {
    isTauriMock.mockReturnValue(false)
    const createObjectURL = vi.fn(() => 'blob:cripta')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const clicks: Array<{ download: string; href: string }> = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ download: this.download, href: this.href })
    })

    vi.useFakeTimers()
    try {
      const result = await saveMapImage(PNG, 'Cripta do Farol.png')

      expect(result).toBe('Cripta do Farol.png')
      expect(saveMock).not.toHaveBeenCalled()
      expect(clicks).toEqual([{ download: 'Cripta do Farol.png', href: 'blob:cripta' }])
      expect(createObjectURL).toHaveBeenCalledTimes(1)
      // O blob só é solto depois que o download começou.
      expect(revokeObjectURL).not.toHaveBeenCalled()
      vi.runAllTimers()
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:cripta')
    } finally {
      vi.useRealTimers()
    }
  })
})
