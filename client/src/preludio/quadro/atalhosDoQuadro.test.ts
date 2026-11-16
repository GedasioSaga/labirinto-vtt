/**
 * D2 da auditoria de 16/11: no WebView2 do Tauri, a escrita na área de
 * transferência com um formato próprio da web junto do PNG ficava pendurada
 * para sempre, sem aviso. O Ctrl+C da imagem solta grava só o PNG, com prazo,
 * e o Ctrl+V do quadro reconhece a cópia pela assinatura do PNG. A área de
 * transferência, o desenho 2D e o editor são de mentira (o jsdom não tem).
 *
 * Os dois últimos usam o editor do tldraw de verdade: no app, dois Ctrl+V e
 * dois Ctrl+Z deixaram as duas imagens, e aqui cada colagem do quadro (a mesma
 * forma ou a imagem nova) tem de ser um passo do desfazer, como a do tldraw.
 */
import {
  AssetRecordType,
  atom,
  createShapeId,
  createTLStore,
  defaultBindingUtils,
  defaultShapeTools,
  defaultShapeUtils,
  defaultTools,
  Editor,
  registerDefaultExternalContentHandlers,
  type TLImageAsset,
} from 'tldraw'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registrarAtalhosDoQuadro } from './atalhosDoQuadro'

const PNG_COPIADO = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 7, 1, 2, 3])
/** Mesmo tamanho em bytes do copiado: só o resumo dos bytes separa os dois. */
const OUTRO_PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 7, 1, 2, 4])
const COPIADA = 'farol.png copiada. Cole com Ctrl+V aqui ou em outro programa.'

class ItemDaAreaFalso {
  constructor(readonly itens: Readonly<Record<string, unknown>>) {}
}

let pararAtalhos: (() => void) | null = null
let editorDeVerdade: Editor | null = null
const getContextDoJsdom = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')

beforeEach(() => {
  vi.stubGlobal('ClipboardItem', ItemDaAreaFalso)
  vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, blob: async () => new Blob([new Uint8Array([1, 2])], { type: 'image/webp' }) }))
  vi.stubGlobal('createImageBitmap', async () => ({ width: 3, height: 2, close: () => undefined }))
  // O jsdom não tem desenho 2D e o código só chama drawImage. Pelo descritor, e não por vi.spyOn: o tipo do spy pega a última sobrecarga (webgpu).
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => ({ drawImage: () => undefined }), configurable: true, writable: true })
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((pronto) => pronto(new Blob([PNG_COPIADO], { type: 'image/png' })))
})

afterEach(() => {
  pararAtalhos?.()
  pararAtalhos = null
  editorDeVerdade?.dispose()
  editorDeVerdade = null
  if (getContextDoJsdom !== undefined) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', getContextDoJsdom)
  Reflect.deleteProperty(navigator, 'clipboard')
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function areaDeTransferencia(escrever: (itens: readonly ItemDaAreaFalso[]) => Promise<void>) {
  const write = vi.fn(escrever)
  Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true })
  return write
}

/** Uma imagem solta escolhida no quadro, com o que os atalhos leem do editor. */
function quadroComImagemSolta(avisar: (texto: string, falhou: boolean) => void) {
  const conteiner = document.body.appendChild(document.createElement('div'))
  const conteudo = { shapes: [{ id: 'shape:farol' }], rootShapeIds: ['shape:farol'], assets: [{ id: 'asset:farol' }], schema: {} }
  const forma = { id: 'shape:farol', type: 'image', props: { assetId: 'asset:farol' } }
  const putExternalContent = vi.fn(async (_conteudo: unknown) => undefined)
  const editor = {
    getEditingShapeId: () => null,
    getOnlySelectedShape: () => forma,
    isShapeOfType: (alvo: { readonly type: string }, tipo: string) => alvo.type === tipo,
    getContentFromCurrentPage: () => conteudo,
    getAsset: () => ({ type: 'image', props: { name: 'farol.png' } }),
    resolveAssetUrl: async () => 'teste://farol.webp',
    getContainer: () => conteiner,
    getInstanceState: () => ({ isFocused: true }),
    markHistoryStoppingPoint: () => undefined,
    putExternalContent,
    inputs: { getShiftKey: () => false, getCurrentPagePoint: () => ({ x: 0, y: 0 }) },
    user: { getIsPasteAtCursorMode: () => false },
  }
  // O Editor do tldraw não monta no jsdom; o falso tem só os métodos que os atalhos chamam.
  pararAtalhos = registrarAtalhosDoQuadro(editor as unknown as Editor, { abrirVerbete: () => undefined, imagemEmVerbete: null, avisar })
  const ctrlC = () => conteiner.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true }))
  return { ctrlC, conteudo, putExternalContent }
}

function colar(png: Uint8Array): Event {
  const evento = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(evento, 'clipboardData', { value: { files: [new File([png], 'image.png', { type: 'image/png' })], types: ['Files'] } })
  document.dispatchEvent(evento)
  return evento
}

it('o Ctrl+C da imagem solta grava só image/png e, com a escrita pendurada como no WebView2, avisa a falha em 2 s', async () => {
  vi.useFakeTimers()
  const write = areaDeTransferencia(() => new Promise<void>(() => undefined))
  const avisar = vi.fn()
  const { ctrlC } = quadroComImagemSolta(avisar)

  ctrlC()

  expect(write).toHaveBeenCalledTimes(1)
  expect(write.mock.calls[0][0].map((item) => Object.keys(item.itens))).toEqual([['image/png']])
  await vi.advanceTimersByTimeAsync(1900)
  expect(avisar).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(200)
  expect(avisar).toHaveBeenCalledWith('farol.png não foi copiada: a área de transferência não respondeu.', true)
})

it('o Ctrl+V do quadro cola a mesma forma quando o PNG da área tem a assinatura da cópia; outra imagem vira imagem nova', async () => {
  areaDeTransferencia(async () => undefined)
  const avisar = vi.fn()
  const { ctrlC, conteudo, putExternalContent } = quadroComImagemSolta(avisar)
  ctrlC()
  await vi.waitFor(() => expect(avisar).toHaveBeenCalledWith(COPIADA, false))

  expect(colar(PNG_COPIADO).defaultPrevented).toBe(true)
  await vi.waitFor(() => expect(putExternalContent).toHaveBeenCalledTimes(1))
  expect(putExternalContent.mock.calls[0][0]).toEqual({ type: 'tldraw', content: conteudo, point: undefined })

  colar(OUTRO_PNG)
  await vi.waitFor(() => expect(putExternalContent).toHaveBeenCalledTimes(2))
  expect(putExternalContent.mock.calls[1][0]).toMatchObject({ type: 'files' })
})

/** O tldraw de verdade (sem a interface React), com os tratadores de colagem que o `Tldraw` registra, e uma imagem solta escolhida. */
function quadroDeVerdadeComImagem(avisar: (texto: string, falhou: boolean) => void) {
  const conteiner = document.body.appendChild(document.createElement('div'))
  const editor = new Editor({
    store: createTLStore({ shapeUtils: defaultShapeUtils, bindingUtils: defaultBindingUtils }),
    shapeUtils: defaultShapeUtils,
    bindingUtils: defaultBindingUtils,
    tools: [...defaultTools, ...defaultShapeTools],
    getContainer: () => conteiner,
  })
  editorDeVerdade = editor
  registerDefaultExternalContentHandlers(editor, {
    toasts: { addToast: () => '', removeToast: () => '', clearToasts: () => undefined, toasts: atom('avisos do tldraw', []) },
    msg: (id) => id ?? '',
  })
  const asset: TLImageAsset = {
    id: AssetRecordType.createId('farol'),
    typeName: 'asset',
    type: 'image',
    props: { w: 64, h: 64, name: 'farol.png', isAnimated: false, mimeType: 'image/png', src: 'https://quadro.invalid/farol.png' },
    meta: {},
  }
  const formaId = createShapeId('farol')
  editor.createAssets([asset])
  editor.createShape({ id: formaId, type: 'image', props: { w: 64, h: 64, assetId: asset.id } })
  editor.select(formaId)
  editor.focus({ focusContainer: false })
  pararAtalhos = registrarAtalhosDoQuadro(editor, { abrirVerbete: () => undefined, imagemEmVerbete: null, avisar })
  const ctrlC = () => conteiner.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true }))
  const imagens = () => editor.getCurrentPageShapes().filter((forma) => forma.type === 'image').length
  return { editor, ctrlC, imagens }
}

it('cada Ctrl+V do quadro é um passo do desfazer: dois Ctrl+Z tiram as duas coladas, e o refazer devolve a última', async () => {
  areaDeTransferencia(async () => undefined)
  const avisar = vi.fn()
  const { editor, ctrlC, imagens } = quadroDeVerdadeComImagem(avisar)
  ctrlC()
  await vi.waitFor(() => expect(avisar).toHaveBeenCalledWith(COPIADA, false))

  colar(PNG_COPIADO)
  await vi.waitFor(() => expect(imagens()).toBe(2))
  colar(PNG_COPIADO)
  await vi.waitFor(() => expect(imagens()).toBe(3))

  editor.undo()
  expect(imagens()).toBe(2)
  editor.undo()
  expect(imagens()).toBe(1)
  editor.redo()
  expect(imagens()).toBe(2)
})

/** O jsdom não carrega imagem: esta "carrega" logo depois de ganhar o endereço, com o tamanho de um PNG pequeno (o tldraw mede a imagem nova assim). */
class ImagemQueCarrega {
  readonly naturalWidth = 3
  readonly naturalHeight = 2
  readonly style: Record<string, string> = {}
  crossOrigin: string | null = null
  referrerPolicy = ''
  onload: (() => void) | null = null
  onerror: ((erro: unknown) => void) | null = null
  set src(_endereco: string) {
    queueMicrotask(() => this.onload?.())
  }
}

it('outra imagem colada no quadro também é um passo do desfazer por colagem, e o refazer a devolve', async () => {
  vi.stubGlobal('Image', ImagemQueCarrega)
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:quadro-inventado')
  vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined)
  areaDeTransferencia(async () => undefined)
  const avisar = vi.fn()
  const { editor, ctrlC, imagens } = quadroDeVerdadeComImagem(avisar)
  ctrlC()
  await vi.waitFor(() => expect(avisar).toHaveBeenCalledWith(COPIADA, false))
  // O arquivo da imagem nova sobe depois da forma: o Ctrl+Z vem com ele já gravado, como no app.
  const subiram = () => editor.getAssets().every((asset) => asset.props.src !== null)

  colar(OUTRO_PNG)
  await vi.waitFor(() => expect(imagens()).toBe(2))
  await vi.waitFor(() => expect(subiram()).toBe(true))
  colar(OUTRO_PNG)
  await vi.waitFor(() => expect(imagens()).toBe(3))
  await vi.waitFor(() => expect(subiram()).toBe(true))

  editor.undo()
  expect(imagens()).toBe(2)
  editor.undo()
  expect(imagens()).toBe(1)
  editor.redo()
  expect(imagens()).toBe(2)
})
