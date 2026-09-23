import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const readFileMock = vi.fn(async () => new Uint8Array([1, 2, 3]))
const writeFileMock = vi.fn(async () => undefined)
const mkdirMock = vi.fn(async () => undefined)
const existsMock = vi.fn(async () => false)
const openMock = vi.fn(async () => null as string | string[] | null)
const invokeMock = vi.fn(async () => undefined)
// Padrão `true`: os testes de importação existentes descrevem o comportamento
// DENTRO do aplicativo. O caso do navegador é ligado explicitamente onde
// interessa, com `isTauriMock.mockReturnValue(false)`.
const isTauriMock = vi.fn(() => true)
const computeResampleDimensionsMock = vi.fn(() => ({ width: 100, height: 50, needsResample: false }))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock,
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: readFileMock,
  writeFile: writeFileMock,
  mkdir: mkdirMock,
  exists: existsMock,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}))

vi.mock('@tauri-apps/api/path', () => ({
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('\\'))),
  join: vi.fn(async (...parts: string[]) => parts.join('\\')),
}))

vi.mock('./imageResample', () => ({
  computeResampleDimensions: computeResampleDimensionsMock,
}))

const {
  pickImageFile,
  pickBackgroundImage,
  importBackgroundImage,
  importPropImage,
  importTokenImage,
  ImagePickerUnavailableError,
  IMAGE_PICKER_UNAVAILABLE_MESSAGE,
  MAX_BACKGROUND_SIDE,
  MAX_PROP_SIDE,
} = await import('./imageImport')

// jsdom não implementa createImageBitmap nem canvas 2D de verdade — mocka os dois.
const createImageBitmapMock = vi.fn(async () => ({ width: 200, height: 100, close: vi.fn() }) as unknown as ImageBitmap)

let toBlobImpl: (callback: BlobCallback) => void = (callback) => callback(new Blob(['webp-bytes']))
let ctxImpl: { drawImage: ReturnType<typeof vi.fn> } | null = { drawImage: vi.fn() }

const originalCreateElement = document.createElement.bind(document)

function makeFakeCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctxImpl),
    toBlob: vi.fn((callback: BlobCallback) => toBlobImpl(callback)),
  } as unknown as HTMLCanvasElement
}

beforeEach(() => {
  vi.clearAllMocks()
  readFileMock.mockResolvedValue(new Uint8Array([1, 2, 3]))
  existsMock.mockResolvedValue(false)
  openMock.mockResolvedValue(null)
  computeResampleDimensionsMock.mockReturnValue({ width: 100, height: 50, needsResample: false })
  isTauriMock.mockReturnValue(true)
  toBlobImpl = (callback) => callback(new Blob(['webp-bytes']))
  ctxImpl = { drawImage: vi.fn() }
  vi.stubGlobal('createImageBitmap', createImageBitmapMock)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return makeFakeCanvas()
    return originalCreateElement(tag)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('pickBackgroundImage', () => {
  it('retorna o caminho selecionado quando o usuário escolhe um arquivo', async () => {
    openMock.mockResolvedValue('C:\\imgs\\foto.png')

    const path = await pickBackgroundImage()

    expect(path).toBe('C:\\imgs\\foto.png')
    expect(openMock).toHaveBeenCalledWith({
      multiple: false,
      filters: [{ name: 'Imagem', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    })
  })

  it('retorna null quando o usuário cancela a seleção', async () => {
    openMock.mockResolvedValue(null)

    const path = await pickBackgroundImage()

    expect(path).toBeNull()
  })

  it('retorna null quando a seleção retorna um array (multiple desativado, defensivo)', async () => {
    openMock.mockResolvedValue(['C:\\a.png', 'C:\\b.png'])

    const path = await pickBackgroundImage()

    expect(path).toBeNull()
  })
})

describe('pickImageFile fora do aplicativo', () => {
  it('lança ImagePickerUnavailableError em vez de chamar o diálogo do Tauri', async () => {
    isTauriMock.mockReturnValue(false)

    await expect(pickImageFile()).rejects.toThrow(ImagePickerUnavailableError)
    // O ponto do guarda: `open()` nunca é alcançado, então não há como estourar
    // "Cannot read properties of undefined (reading 'invoke')".
    expect(openMock).not.toHaveBeenCalled()
  })

  it('leva a mesma falha para pickBackgroundImage (o caminho do fundo passa por aqui)', async () => {
    isTauriMock.mockReturnValue(false)

    await expect(pickBackgroundImage()).rejects.toThrow(ImagePickerUnavailableError)
    expect(openMock).not.toHaveBeenCalled()
  })

  it('a mensagem fala de falha em português, e não de detalhe técnico', () => {
    expect(IMAGE_PICKER_UNAVAILABLE_MESSAGE).toMatch(/s[óo] funciona|n[ãa]o tem acesso|instalad/i)
    expect(IMAGE_PICKER_UNAVAILABLE_MESSAGE).not.toMatch(/undefined|invoke|__TAURI/i)
    expect(new ImagePickerUnavailableError().message).toBe(IMAGE_PICKER_UNAVAILABLE_MESSAGE)
  })

  it('dentro do aplicativo o guarda não atrapalha: o diálogo é chamado normalmente', async () => {
    isTauriMock.mockReturnValue(true)
    openMock.mockResolvedValue('C:\\imgs\\foto.png')

    await expect(pickImageFile()).resolves.toBe('C:\\imgs\\foto.png')
    expect(openMock).toHaveBeenCalledTimes(1)
  })
})

describe('importBackgroundImage', () => {
  it('concede acesso ao diretório de origem e ao diretório do mapa', async () => {
    await importBackgroundImage('C:\\imgs\\foto.png', 'C:\\maps\\map_1')

    expect(invokeMock).toHaveBeenCalledWith('grant_fs_access', { path: 'C:\\imgs' })
    expect(invokeMock).toHaveBeenCalledWith('grant_fs_access', { path: 'C:\\maps\\map_1' })
  })

  it('cria o diretório do mapa quando ele ainda não existe', async () => {
    existsMock.mockResolvedValue(false)

    await importBackgroundImage('C:\\imgs\\foto.png', 'C:\\maps\\map_1')

    expect(mkdirMock).toHaveBeenCalledWith('C:\\maps\\map_1', { recursive: true })
  })

  it('não cria o diretório do mapa quando ele já existe', async () => {
    existsMock.mockResolvedValue(true)

    await importBackgroundImage('C:\\imgs\\foto.png', 'C:\\maps\\map_1')

    expect(mkdirMock).not.toHaveBeenCalled()
  })

  it('extrai a extensão original do caminho de origem para nomear o arquivo salvo', async () => {
    await importBackgroundImage('C:\\imgs\\foto.jpeg', 'C:\\maps\\map_1')

    expect(writeFileMock).toHaveBeenCalledWith(
      'C:\\maps\\map_1\\background_original.jpeg',
      expect.any(Uint8Array),
    )
  })

  it('quando o caminho não tem ponto, usa o caminho inteiro como extensão (comportamento atual de split)', async () => {
    await importBackgroundImage('C:\\imgs\\fotoSemExtensao', 'C:\\maps\\map_1')

    expect(writeFileMock).toHaveBeenCalledWith(
      'C:\\maps\\map_1\\background_original.C:\\imgs\\fotoSemExtensao',
      expect.any(Uint8Array),
    )
  })

  it('quando needsResample é false, grava apenas o background_original e retorna seu caminho', async () => {
    computeResampleDimensionsMock.mockReturnValue({ width: 200, height: 100, needsResample: false })

    const result = await importBackgroundImage('C:\\imgs\\foto.png', 'C:\\maps\\map_1')

    expect(result).toBe('C:\\maps\\map_1\\background_original.png')
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock).toHaveBeenCalledWith(
      'C:\\maps\\map_1\\background_original.png',
      expect.any(Uint8Array),
    )
  })

  it('quando needsResample é true, grava o background_original e também o background.webp reamostrado, retornando o caminho do webp', async () => {
    computeResampleDimensionsMock.mockReturnValue({ width: 100, height: 50, needsResample: true })

    const result = await importBackgroundImage('C:\\imgs\\foto.png', 'C:\\maps\\map_1')

    expect(result).toBe('C:\\maps\\map_1\\background.webp')
    expect(writeFileMock).toHaveBeenCalledTimes(2)
    expect(writeFileMock).toHaveBeenNthCalledWith(
      1,
      'C:\\maps\\map_1\\background_original.png',
      expect.any(Uint8Array),
    )
    expect(writeFileMock).toHaveBeenNthCalledWith(
      2,
      'C:\\maps\\map_1\\background.webp',
      expect.any(Uint8Array),
    )
    expect(ctxImpl?.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 100, 50)
  })

  it('propaga erro quando canvas.toBlob falha em gerar o blob', async () => {
    computeResampleDimensionsMock.mockReturnValue({ width: 100, height: 50, needsResample: true })
    toBlobImpl = (callback) => callback(null)

    await expect(importBackgroundImage('C:\\imgs\\foto.png', 'C:\\maps\\map_1')).rejects.toThrow(
      'Falha ao gerar WebP',
    )
  })

  it('usa MAX_BACKGROUND_SIDE ao calcular as dimensões de reamostragem', async () => {
    await importBackgroundImage('C:\\imgs\\foto.png', 'C:\\maps\\map_1')

    expect(computeResampleDimensionsMock).toHaveBeenCalledWith(200, 100, MAX_BACKGROUND_SIDE)
  })
})

describe('importPropImage', () => {
  it('gera prop_<id>_original.<ext> quando a imagem não precisa reamostrar', async () => {
    computeResampleDimensionsMock.mockReturnValue({ width: 200, height: 100, needsResample: false })

    const result = await importPropImage('C:\\imgs\\arvore.png', 'C:\\maps\\map_1', 'prop123')

    expect(result.destPath).toBe('C:\\maps\\map_1\\prop_prop123_original.png')
    expect(result.width).toBe(200)
    expect(result.height).toBe(100)
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock).toHaveBeenCalledWith(
      'C:\\maps\\map_1\\prop_prop123_original.png',
      expect.any(Uint8Array),
    )
  })

  it('gera prop_<id>.webp reamostrado quando a imagem excede MAX_PROP_SIDE', async () => {
    computeResampleDimensionsMock.mockReturnValue({ width: 512, height: 256, needsResample: true })

    const result = await importPropImage('C:\\imgs\\arvore.png', 'C:\\maps\\map_1', 'prop123')

    expect(result.destPath).toBe('C:\\maps\\map_1\\prop_prop123.webp')
    expect(result.width).toBe(512)
    expect(result.height).toBe(256)
    expect(writeFileMock).toHaveBeenCalledTimes(2)
    expect(writeFileMock).toHaveBeenNthCalledWith(
      1,
      'C:\\maps\\map_1\\prop_prop123_original.png',
      expect.any(Uint8Array),
    )
    expect(writeFileMock).toHaveBeenNthCalledWith(
      2,
      'C:\\maps\\map_1\\prop_prop123.webp',
      expect.any(Uint8Array),
    )
  })

  it('usa MAX_PROP_SIDE (não MAX_BACKGROUND_SIDE) ao calcular as dimensões de reamostragem', async () => {
    await importPropImage('C:\\imgs\\arvore.png', 'C:\\maps\\map_1', 'prop123')

    expect(computeResampleDimensionsMock).toHaveBeenCalledWith(200, 100, MAX_PROP_SIDE)
    expect(MAX_PROP_SIDE).not.toBe(MAX_BACKGROUND_SIDE)
  })
})

describe('importTokenImage', () => {
  it('gera token_<id>_original.<ext> quando a imagem não precisa reamostrar', async () => {
    computeResampleDimensionsMock.mockReturnValue({ width: 200, height: 100, needsResample: false })

    const result = await importTokenImage('C:\\imgs\\heroi.png', 'C:\\maps\\map_1', 'token123')

    expect(result.destPath).toBe('C:\\maps\\map_1\\token_token123_original.png')
    expect(result.width).toBe(200)
    expect(result.height).toBe(100)
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock).toHaveBeenCalledWith(
      'C:\\maps\\map_1\\token_token123_original.png',
      expect.any(Uint8Array),
    )
  })

  it('gera token_<id>.webp reamostrado quando a imagem excede MAX_PROP_SIDE', async () => {
    computeResampleDimensionsMock.mockReturnValue({ width: 512, height: 256, needsResample: true })

    const result = await importTokenImage('C:\\imgs\\heroi.png', 'C:\\maps\\map_1', 'token123')

    expect(result.destPath).toBe('C:\\maps\\map_1\\token_token123.webp')
    expect(writeFileMock).toHaveBeenCalledTimes(2)
    expect(writeFileMock).toHaveBeenNthCalledWith(
      2,
      'C:\\maps\\map_1\\token_token123.webp',
      expect.any(Uint8Array),
    )
  })

  it('usa o mesmo teto de reamostragem de importPropImage (MAX_PROP_SIDE) — token não precisa de resolução maior', async () => {
    await importTokenImage('C:\\imgs\\heroi.png', 'C:\\maps\\map_1', 'token123')

    expect(computeResampleDimensionsMock).toHaveBeenCalledWith(200, 100, MAX_PROP_SIDE)
  })
})
