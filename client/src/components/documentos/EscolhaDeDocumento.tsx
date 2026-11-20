import { useEffect } from 'react'
import { tituloOuSemTitulo } from '../../documentos/naFicha'
import type { Documento } from '../../documentos/tipos'
import { useDocumentosStore } from '../../stores/documentosStore'

/*
 * O DOCUMENTO DA BIBLIOTECA ligado a outra coisa (ligação L1 do plano dos
 * puzzles): a dica e o desfecho do puzzle, e o conteúdo do baú, da caixa e do
 * barril. Só o id fica gravado; o título vem da biblioteca de agora, e o
 * documento apagado lá aparece como tal (o host não entrega o que sumiu).
 */

/** A biblioteca na memória; aberta antes da página Documentos, ela é lida aqui uma vez. */
export function useBibliotecaDeDocumentos(): Documento[] {
  const documentos = useDocumentosStore((estado) => estado.documentos)
  useEffect(() => {
    const biblioteca = useDocumentosStore.getState()
    if (!biblioteca.podeGravar && biblioteca.documentos.length === 0) void biblioteca.recarregar()
  }, [])
  return documentos
}

export const DOCUMENTO_APAGADO_DA_BIBLIOTECA = 'Documento apagado da biblioteca'
export const BIBLIOTECA_DE_DOCUMENTOS_VAZIA = 'A biblioteca Documentos está vazia. Crie documentos na página Documentos do livro.'

/** O título do documento ligado; `null` = o mestre o apagou da biblioteca. */
export function tituloNaBiblioteca(documentos: readonly Documento[], docId: string): string | null {
  const documento = documentos.find((candidato) => candidato.id === docId)
  return documento === undefined ? null : tituloOuSemTitulo(documento)
}

interface PropsDaEscolha {
  documentos: readonly Documento[]
  /** O nome acessível do campo (o rótulo visível, quando há, fica no `label` de quem usa). */
  rotulo: string
  /** A primeira opção, sem documento: "Escolha o documento", "+ Documento da biblioteca". */
  marcador: string
  /** O documento escolhido; `null` = nenhum (a primeira opção). */
  valor: string | null
  /** Os que já estão ligados e não se repetem na lista. */
  fora?: readonly string[]
  /** A classe da caixa, a da página onde ela entra (`gr-entrada` no editor do puzzle, `lb-input` no livro). */
  classe: string
  aoEscolher: (docId: string) => void
}

/** A caixa nativa: teclado, leitor de tela e a lista longa já vêm do navegador. */
export function EscolhaDeDocumento({ documentos, rotulo, marcador, valor, fora = [], classe, aoEscolher }: PropsDaEscolha) {
  const opcoes = documentos.filter((documento) => documento.id === valor || !fora.includes(documento.id))
  return (
    <select
      className={classe}
      aria-label={rotulo}
      value={valor ?? ''}
      onChange={(evento) => {
        const docId = evento.currentTarget.value
        if (docId !== '') aoEscolher(docId)
      }}
    >
      <option value="">{marcador}</option>
      {opcoes.map((documento) => (
        <option key={documento.id} value={documento.id}>
          {tituloOuSemTitulo(documento)}
        </option>
      ))}
    </select>
  )
}
