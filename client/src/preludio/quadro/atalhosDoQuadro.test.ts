/**
 * D2 da auditoria de 16/11: no WebView2 do Tauri, a escrita na área de
 * transferência com um formato próprio da web junto do PNG ficava pendurada
 * para sempre, sem aviso. O Ctrl+C da imagem solta grava só o PNG, com prazo,
 * e o Ctrl+V do quadro reconhece a cópia pela assinatura do PNG. A área de
 * transferência, o desenho 2D e o editor são de mentira (o jsdom não tem).
 */
import type { Editor } from 'tldraw'
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
