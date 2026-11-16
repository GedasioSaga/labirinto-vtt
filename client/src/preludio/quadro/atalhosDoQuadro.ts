import type { Editor, TLContent, TLImageShape, VecLike } from 'tldraw'
import type { Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import { prepararMidia, urlDaMidia } from '../midia'
import { TIPOS_DE_CARTAO } from '../../lib/preparo/quadros'
import { idDoCartao, verbeteDoCartao, type CartaoDeVerbete } from './cartoes'
import { itemEmFoco } from './itemEmFoco'

/**
 * OS ATALHOS DO QUADRO QUE VIERAM DO GRIMÓRIO (`components/atalhosCanvas.ts`):
 *
 * - Espaço com um cartão escolhido abre o verbete dele (o duplo clique só abre
 *   e fecha o painel do texto); numa imagem solta, pergunta se ela vira verbete.
 * - Ctrl+C com um cartão escolhido copia o retrato (a imagem, não a forma); com
 *   um item escolhido na faixa do lugar, a imagem do item; numa imagem solta,
 *   o PNG dela (e o Ctrl+V do quadro a cola de volta como forma).
 *
 * Ficam na fase de captura do contêiner do editor, antes dos atalhos do tldraw
 * (Espaço é a mão de arrastar a vista; Ctrl+C copia a forma). Sem cartão nem
 * imagem escolhidos, ou digitando num campo, a tecla segue para o tldraw.
 */

export interface AcoesDosAtalhos {
  readonly abrirVerbete: (verbete: Verbete) => void
  /** `null` = o quadro só para ver: a imagem não vira verbete. */
  readonly imagemEmVerbete: ((imagem: TLImageShape) => void) | null
  readonly avisar: (texto: string, falhou: boolean) => void
}

function digitando(alvo: EventTarget | null): boolean {
  return alvo instanceof HTMLElement && alvo.closest('input, textarea, select, [contenteditable="true"]') !== null
}

function cartaoEscolhido(editor: Editor): { cartao: CartaoDeVerbete; verbete: Verbete | undefined } | null {
  const forma = editor.getOnlySelectedShape()
  if (forma === null || !TIPOS_DE_CARTAO.has(forma.type)) return null
  const cartao = forma as CartaoDeVerbete
  return { cartao, verbete: verbeteDoCartao(usePreludio.getState().verbetes, idDoCartao(cartao)) }
}

/**
 * Quanto a área de transferência tem para aceitar o PNG depois que ele fica
 * pronto. No WebView2 do Tauri a escrita já ficou pendurada para sempre, sem
 * erro (auditoria de 16/11, D2): sem prazo, o Ctrl+C some sem aviso.
 */
const PRAZO_DA_ESCRITA_MS = 2000
/** Abrir e converter a imagem tem prazo próprio e largo: imagem grande demora para virar PNG, e isso não é a escrita pendurada. */
const PRAZO_DO_PNG_MS = 20_000

function comPrazo<T>(promessa: Promise<T>, ms: number, motivoDoAtraso: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const relogio = setTimeout(() => reject(new Error(motivoDoAtraso)), ms)
    promessa.then(
      (valor) => {
        clearTimeout(relogio)
        resolve(valor)
      },
      (erro: unknown) => {
        clearTimeout(relogio)
        reject(erro)
      },
    )
  })
}

async function pngDoEndereco(endereco: string | PromiseLike<string>): Promise<Blob> {
  const resposta = await fetch(await endereco)
  if (!resposta.ok) throw new Error(`a imagem não abriu (${resposta.status})`)
  const bitmap = await createImageBitmap(await resposta.blob())
  try {
    const tela = document.createElement('canvas')
    tela.width = bitmap.width
    tela.height = bitmap.height
    const contexto = tela.getContext('2d')
    if (contexto === null) throw new Error('sem desenho 2D')
    contexto.drawImage(bitmap, 0, 0)
    return await new Promise<Blob>((resolve, reject) => tela.toBlob((blob) => (blob === null ? reject(new Error('o PNG não saiu')) : resolve(blob)), 'image/png'))
  } finally {
    bitmap.close()
  }
}

/**
 * Copia a imagem para a área de transferência como PNG e devolve o PNG que
 * foi para lá. O `ClipboardItem` recebe a PROMESSA da imagem:
 * `navigator.clipboard.write` é chamado na hora, ainda dentro do gesto do
 * Ctrl+C, senão o WebView recusa ("document is not focused") depois do
 * `fetch`. O PNG sai de um bitmap feito do Blob (sem tela "suja" por origem) e
 * qualquer formato vira PNG, que é o que a área aceita. Vai SÓ o `image/png`:
 * com um formato próprio da web junto, o WebView2 nunca termina a escrita.
 */
export function copiarImagem(endereco: string | PromiseLike<string>): Promise<Blob> {
  const png = comPrazo(pngDoEndereco(endereco), PRAZO_DO_PNG_MS, 'a imagem demorou demais para abrir')
  const escrita = navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
  // Com o PNG falhando, a escrita falha junto; o motivo que vale é o do PNG, e este só não fica como rejeição solta.
  void escrita.catch(() => undefined)
  return png.then((pronto) => comPrazo(escrita, PRAZO_DA_ESCRITA_MS, 'a área de transferência não respondeu').then(() => pronto))
}

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

// ─── Imagem solta (pedido de 16/11) ─────────────────────────────────────────

/**
 * Ctrl+C numa IMAGEM SOLTA (que não virou Personagem, Lugar nem Item) põe o
 * PNG na área de transferência do Windows, para colar no Paint ou no Discord.
 * Só o PNG vai para fora: com o HTML do tldraw junto, o Word e o WhatsApp
 * colariam o texto dele no lugar da imagem, e com um formato próprio da web
 * junto o WebView2 do Tauri nunca termina a escrita (D2 de 16/11). Para colar
 * DE VOLTA num quadro igual ao tldraw (o mesmo tamanho, recorte e arquivo, em
 * vez de uma imagem nova do PNG), a forma copiada fica aqui com a assinatura
 * do PNG que foi para a área. No Ctrl+V do quadro, o PNG com a mesma
 * assinatura devolve a forma; outra imagem segue como imagem nova. O WebView2
 * devolve na colagem os mesmos bytes que recebeu na escrita (sonda no app real).
 */
interface AssinaturaDoPng {
  readonly bytes: number
  readonly resumo: number
}

let copiaDoQuadro: { readonly assinatura: AssinaturaDoPng; readonly conteudo: TLContent } | null = null

/** FNV-1a de 32 bits: barato, e só precisa separar o PNG copiado de outra imagem do mesmo tamanho em bytes. */
const FNV_INICIO = 0x811c9dc5
const FNV_PRIMO = 0x01000193

async function resumoDosBytes(png: Blob): Promise<number> {
  const bytes = new Uint8Array(await png.arrayBuffer())
  let resumo = FNV_INICIO
  for (const byte of bytes) resumo = Math.imul(resumo ^ byte, FNV_PRIMO)
  return resumo >>> 0
}

async function assinaturaDoPng(png: Blob): Promise<AssinaturaDoPng> {
  return { bytes: png.size, resumo: await resumoDosBytes(png) }
}

/** O tamanho em bytes decide primeiro: outra imagem grande colada no quadro não é lida inteira à toa. */
async function eOPngCopiado(arquivo: Blob, assinatura: AssinaturaDoPng): Promise<boolean> {
  return arquivo.size === assinatura.bytes && (await resumoDosBytes(arquivo)) === assinatura.resumo
}

/** Onde a colagem cai, como no tldraw: Shift, ou o modo "colar no cursor", põem no ponteiro (um desliga o outro). */
function pontoDaColagem(editor: Editor): VecLike | undefined {
  return editor.inputs.getShiftKey() !== editor.user.getIsPasteAtCursorMode() ? editor.inputs.getCurrentPagePoint() : undefined
}

/** `true` = era uma imagem solta e o Ctrl+C é dela; senão a tecla segue para o tldraw. */
function copiarImagemSolta(editor: Editor, avisar: AcoesDosAtalhos['avisar']): boolean {
  const forma = editor.getOnlySelectedShape()
  if (forma === null || !editor.isShapeOfType(forma, 'image') || forma.props.assetId === null) return false
  const conteudo = editor.getContentFromCurrentPage([forma.id])
  if (conteudo === undefined) return false
  const asset = editor.getAsset(forma.props.assetId)
  const nome = asset?.type === 'image' && asset.props.name !== '' ? asset.props.name : 'A imagem'
  const endereco = editor.resolveAssetUrl(forma.props.assetId, { shouldResolveToOriginal: true }).then((url) => {
    if (url === null) throw new Error('a imagem não tem arquivo no Prelúdio')
    return url
  })
  void copiarImagem(endereco)
    .then(assinaturaDoPng)
    .then(
      (assinatura) => {
        copiaDoQuadro = { assinatura, conteudo }
        avisar(`${nome} copiada. Cole com Ctrl+V aqui ou em outro programa.`, false)
      },
      (erro: unknown) => avisar(`${nome} não foi copiada: ${motivo(erro)}.`, true),
    )
  return true
}

/**
 * O Ctrl+V do quadro, antes do tldraw: com a área só com uma imagem (o que o
 * Ctrl+C da imagem solta deixa) e o PNG com a assinatura da última cópia,
 * cola a forma copiada; com outra imagem, cola a imagem como o tldraw colaria.
 * Qualquer outra coisa (texto, formas copiadas pelo tldraw) segue para ele.
 */
function colarImagemSolta(editor: Editor, evento: ClipboardEvent, avisar: AcoesDosAtalhos['avisar']): void {
  const copia = copiaDoQuadro
  const dados = evento.clipboardData
  if (copia === null || dados === null || !editor.getInstanceState().isFocused || editor.getEditingShapeId() !== null || digitando(evento.target)) return
  const arquivos = Array.from(dados.files)
  const [arquivo] = arquivos
  if (arquivos.length !== 1 || dados.types.includes('text/html') || dados.types.includes('text/plain')) return
  evento.preventDefault()
  evento.stopImmediatePropagation()
  const ponto = pontoDaColagem(editor)
  // Sem ler o arquivo (permissão, arquivo sumido), vale como outra imagem: cola uma imagem nova, como o tldraw.
  void eOPngCopiado(arquivo, copia.assinatura)
    .catch(() => false)
    .then((mesmo) => {
      editor.markHistoryStoppingPoint('paste')
      return editor.putExternalContent(mesmo ? { type: 'tldraw', content: copia.conteudo, point: ponto } : { type: 'files', files: arquivos, point: ponto })
    })
    .catch((erro: unknown) => avisar(`Não colou: ${motivo(erro)}.`, true))
}

export function registrarAtalhosDoQuadro(editor: Editor, acoes: AcoesDosAtalhos): () => void {
  const aoTeclar = (evento: KeyboardEvent) => {
    if (editor.getEditingShapeId() !== null || digitando(evento.target)) return

    if ((evento.ctrlKey || evento.metaKey) && !evento.shiftKey && !evento.altKey && evento.key.toLowerCase() === 'c') {
      const escolhido = cartaoEscolhido(editor)
      if (escolhido === null) {
        // Sem a tecla padrão, o evento "copy" não nasce, e o tldraw não sobrescreve o PNG com as formas dele.
        if (copiarImagemSolta(editor, acoes.avisar)) {
          evento.preventDefault()
          evento.stopPropagation()
        }
        return
      }
      if (escolhido.verbete === undefined) return
      // Com um item escolhido na faixa do lugar, copia a imagem do item (Grimório, `faixaItensFoco`).
      const foco = itemEmFoco()
      const doItem = foco !== null && foco.formaId === escolhido.cartao.id ? verbeteDoCartao(usePreludio.getState().verbetes, foco.itemId) : undefined
      const verbete = doItem ?? escolhido.verbete
      const forma = verbete.formas.find((cada) => cada.id === verbete.formaAtivaId) ?? verbete.formas[0]
      const nome = verbete.titulo || 'Sem nome'
      // Sem retrato, o Ctrl+C do tldraw copia o cartão, como sempre.
      if (forma?.retrato === undefined) return
      evento.preventDefault()
      evento.stopPropagation()
      const retrato = forma.retrato
      // A pasta já foi lida para desenhar o cartão: a promessa resolve na hora.
      void prepararMidia()
        .then((raiz) => {
          const endereco = raiz === null ? null : urlDaMidia(raiz, retrato)
          if (endereco === null) throw new Error('o retrato não tem arquivo no Prelúdio')
          return copiarImagem(endereco)
        })
        .then(
          () => acoes.avisar(`Retrato de ${nome} copiado. Cole com Ctrl+V.`, false),
          (erro: unknown) => acoes.avisar(`O retrato de ${nome} não foi copiado: ${motivo(erro)}.`, true),
        )
      return
    }

    if (evento.key !== ' ' || evento.repeat || evento.ctrlKey || evento.metaKey || evento.altKey) return
    const escolhido = cartaoEscolhido(editor)
    if (escolhido !== null) {
      if (escolhido.verbete === undefined) return
      evento.preventDefault()
      evento.stopPropagation()
      acoes.abrirVerbete(escolhido.verbete)
      return
    }
    const forma = editor.getOnlySelectedShape()
    if (forma?.type === 'image' && acoes.imagemEmVerbete !== null) {
      evento.preventDefault()
      evento.stopPropagation()
      acoes.imagemEmVerbete(forma as TLImageShape)
    }
  }
  const conteiner = editor.getContainer()
  // O tldraw ouve o "paste" no documento, na volta: aqui ele passa antes, na ida.
  const documento = conteiner.ownerDocument
  const aoColar = (evento: ClipboardEvent) => colarImagemSolta(editor, evento, acoes.avisar)
  conteiner.addEventListener('keydown', aoTeclar, { capture: true })
  documento.addEventListener('paste', aoColar, { capture: true })
  return () => {
    conteiner.removeEventListener('keydown', aoTeclar, { capture: true })
    documento.removeEventListener('paste', aoColar, { capture: true })
  }
}
