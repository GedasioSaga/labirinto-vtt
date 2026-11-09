import type { Editor, TLImageShape } from 'tldraw'
import type { Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import { prepararMidia, urlDaMidia } from '../midia'
import { TIPOS_DE_CARTAO } from '../../lib/preparo/quadros'
import { idDoCartao, verbeteDoCartao, type CartaoDeVerbete } from './cartoes'

/**
 * OS ATALHOS DO QUADRO QUE VIERAM DO GRIMÓRIO (`components/atalhosCanvas.ts`):
 *
 * - Espaço com um cartão escolhido abre o verbete dele (o duplo clique só abre
 *   e fecha o painel do texto); numa imagem solta, pergunta se ela vira verbete.
 * - Ctrl+C com um cartão escolhido copia o retrato (a imagem, não a forma).
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
 */
export function copiarImagem(endereco: string): Promise<void> {
  const png = (async (): Promise<Blob> => {
    const resposta = await fetch(endereco)
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
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

export function registrarAtalhosDoQuadro(editor: Editor, acoes: AcoesDosAtalhos): () => void {
  const aoTeclar = (evento: KeyboardEvent) => {
    if (editor.getEditingShapeId() !== null || digitando(evento.target)) return

    if ((evento.ctrlKey || evento.metaKey) && !evento.shiftKey && !evento.altKey && evento.key.toLowerCase() === 'c') {
      const escolhido = cartaoEscolhido(editor)
      if (escolhido === null || escolhido.verbete === undefined) return
      const verbete = escolhido.verbete
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
  conteiner.addEventListener('keydown', aoTeclar, { capture: true })
  return () => conteiner.removeEventListener('keydown', aoTeclar, { capture: true })
}
