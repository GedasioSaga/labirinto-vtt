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
 * Copia a imagem para a área de transferência como PNG. O `ClipboardItem`
 * recebe a PROMESSA da imagem: `navigator.clipboard.write` é chamado na hora,
 * ainda dentro do gesto do Ctrl+C, senão o WebView recusa ("document is not
 * focused") depois do `fetch`. O PNG sai de um bitmap feito do Blob (sem tela
 * "suja" por origem) e qualquer formato vira PNG, que é o que a área aceita.
 * `junto` vai no mesmo item (a senha da imagem solta, `FORMATO_DA_SENHA`).
 */
export function copiarImagem(endereco: string | PromiseLike<string>, junto: Readonly<Record<string, Blob>> = {}): Promise<void> {
  const png = (async (): Promise<Blob> => {
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
  })()
  return navigator.clipboard.write([new ClipboardItem({ ...junto, 'image/png': png })])
}

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

// ─── Imagem solta (pedido de 16/11) ─────────────────────────────────────────

/**
 * Ctrl+C numa IMAGEM SOLTA (que não virou Personagem, Lugar nem Item) põe o
 * PNG na área de transferência do Windows, para colar no Paint ou no Discord.
 * Só o PNG vai para fora: com o HTML do tldraw junto, o Word e o WhatsApp
 * colariam o texto dele no lugar da imagem. Para colar DE VOLTA num quadro
 * igual ao tldraw (o mesmo tamanho, recorte e arquivo, em vez de uma imagem
 * nova do PNG), a forma copiada fica aqui, e a área leva só uma senha num
 * formato próprio da web, que os outros programas ignoram. No Ctrl+V do
 * quadro, a senha igual devolve a forma; outra imagem segue como imagem nova.
 */
const TIPO_DA_SENHA = 'application/x-labirinto-imagem-do-quadro'
/** O nome do formato leva "web " na frente; o Blob dele, o tipo puro (o Chromium recusa a escrita se não baterem). */
const FORMATO_DA_SENHA = `web ${TIPO_DA_SENHA}`

let copiaDoQuadro: { readonly senha: string; readonly conteudo: TLContent } | null = null

async function senhaNaArea(itens: readonly ClipboardItem[]): Promise<string | null> {
  const item = itens.find((cada) => cada.types.includes(FORMATO_DA_SENHA))
  return item === undefined ? null : (await item.getType(FORMATO_DA_SENHA)).text()
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
  // Sem formato próprio da web (WebView velho), vai só o PNG: o Ctrl+V do quadro faz uma imagem nova dele.
  const senha = ClipboardItem.supports(FORMATO_DA_SENHA) ? crypto.randomUUID() : null
  const junto: Record<string, Blob> = senha === null ? {} : { [FORMATO_DA_SENHA]: new Blob([senha], { type: TIPO_DA_SENHA }) }
  void copiarImagem(endereco, junto).then(
    () => {
      copiaDoQuadro = senha === null ? null : { senha, conteudo }
      avisar(`${nome} copiada. Cole com Ctrl+V aqui ou em outro programa.`, false)
    },
    (erro: unknown) => avisar(`${nome} não foi copiada: ${motivo(erro)}.`, true),
  )
  return true
}

/**
 * O Ctrl+V do quadro, antes do tldraw: com a área só com uma imagem (o que o
 * Ctrl+C da imagem solta deixa) e a senha igual à da última cópia, cola a
 * forma copiada; com outra imagem, cola a imagem como o tldraw colaria.
 * Qualquer outra coisa (texto, formas copiadas pelo tldraw) segue para ele.
 */
function colarImagemSolta(editor: Editor, evento: ClipboardEvent, avisar: AcoesDosAtalhos['avisar']): void {
  const copia = copiaDoQuadro
  const dados = evento.clipboardData
  if (copia === null || dados === null || !editor.getInstanceState().isFocused || editor.getEditingShapeId() !== null || digitando(evento.target)) return
  const arquivos = Array.from(dados.files)
  if (arquivos.length !== 1 || dados.types.includes('text/html') || dados.types.includes('text/plain')) return
  evento.preventDefault()
  evento.stopImmediatePropagation()
  const ponto = pontoDaColagem(editor)
  void navigator.clipboard
    .read()
    .then(senhaNaArea)
    .catch(() => null)
    .then((senha) => {
      editor.markHistoryStoppingPoint('paste')
      return editor.putExternalContent(senha === copia.senha ? { type: 'tldraw', content: copia.conteudo, point: ponto } : { type: 'files', files: arquivos, point: ponto })
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
