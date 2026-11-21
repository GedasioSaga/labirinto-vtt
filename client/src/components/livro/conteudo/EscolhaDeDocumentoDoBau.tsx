import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { tituloOuSemTitulo } from '../../../documentos/naFicha'
import type { Documento } from '../../../documentos/tipos'
import { normalizarParaBusca } from '../../../lib/buscaNoLivro'
import { IconeDoPapel } from '../../documentos/IconeDoPapel'
import { Icone } from './DesenhosDoConteudo'

/*
 * A ESCOLHA DE DOCUMENTO do baú (redesign de 21/11/2026, decisão 6): a mesma
 * moldura da escolha do acervo, em lista, com o papel em miniatura e a busca.
 * Os que já estão dentro ficam com o visto em vez de sumir. ↑ ↓ andam, Enter
 * põe a marcada, Esc fecha; depois de pôr, a marca anda para o próximo livre.
 * Só o baú usa esta: a dos puzzles continua o `select` de `EscolhaDeDocumento`.
 */

export interface EscolhaDeDocumentoDoBauProps {
  documentos: readonly Documento[]
  /** Os ids que já estão no objeto. */
  dentro: readonly string[]
  /** "no baú", "na caixa", "no barril". */
  noObjeto: string
  poe: string
  buscaRef: RefObject<HTMLInputElement | null>
  aoPor: (documento: Documento) => void
  aoFechar: () => void
  anunciar: (texto: string) => void
}

export function EscolhaDeDocumentoDoBau({ documentos, dentro, noObjeto, poe, buscaRef, aoPor, aoFechar, anunciar }: EscolhaDeDocumentoDoBauProps) {
  const [busca, setBusca] = useState('')
  const listaRef = useRef<HTMLUListElement>(null)
  const prontoRef = useRef<HTMLButtonElement>(null)
  const baseId = useId()
  const listaId = `${baseId}-docs`
  const opcaoId = (indice: number) => `${baseId}-dop-${indice}`
  const chave = normalizarParaBusca(busca)
  const achados = useMemo(() => documentos.filter((documento) => chave === '' || normalizarParaBusca(tituloOuSemTitulo(documento)).includes(chave)), [documentos, chave])
  const primeiroLivre = (lista: readonly Documento[], depoisDe = -1) => lista.findIndex((documento, indice) => indice > depoisDe && !dentro.includes(documento.id))
  const [ativo, setAtivo] = useState(() => Math.max(0, primeiroLivre(achados)))
  const marcado = achados.length === 0 ? -1 : Math.min(ativo, achados.length - 1)

  useEffect(() => {
    const campo = buscaRef.current
    if (campo !== null) campo.focus()
    else prontoRef.current?.focus()
  }, [buscaRef])

  useLayoutEffect(() => {
    if (marcado >= 0) listaRef.current?.children[marcado]?.scrollIntoView({ block: 'nearest' })
  }, [marcado])

  const por = (indice: number) => {
    const documento = achados[indice]
    if (documento === undefined) return
    if (dentro.includes(documento.id)) {
      anunciar(`${tituloOuSemTitulo(documento)} já está ${noObjeto}.`)
      return
    }
    aoPor(documento)
    // A marca anda para o próximo que ainda não está dentro (o de agora entra na conta).
    const proximo = achados.findIndex((outro, i) => i > indice && outro.id !== documento.id && !dentro.includes(outro.id))
    if (proximo >= 0) setAtivo(proximo)
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault()
      if (achados.length === 0) return
      setAtivo(Math.max(0, Math.min(achados.length - 1, marcado + (evento.key === 'ArrowDown' ? 1 : -1))))
    } else if (evento.key === 'Enter') {
      evento.preventDefault()
      if (marcado >= 0) por(marcado)
    }
  }

  const fecharComEsc = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== 'Escape') return
    evento.preventDefault()
    evento.stopPropagation()
    aoFechar()
  }

  const vazia = documentos.length === 0
  return (
    <div className="lb-conteudo__escolha" role="dialog" aria-label="Documentos da biblioteca" onKeyDown={fecharComEsc}>
      {!vazia && (
        <div className="lb-conteudo__busca-casa">
          <Icone nome="lupa" />
          <input
            ref={buscaRef}
            className="lb-conteudo__procura"
            type="search"
            placeholder="Procurar na biblioteca"
            aria-label="Procurar na biblioteca"
            aria-controls={listaId}
            aria-activedescendant={marcado < 0 ? undefined : opcaoId(marcado)}
            autoComplete="off"
            spellCheck={false}
            value={busca}
            onChange={(evento) => {
              setBusca(evento.target.value)
              setAtivo(0)
            }}
            onKeyDown={aoTeclar}
          />
        </div>
      )}
      {vazia ? (
        <div className="lb-conteudo__escolha-vazia">
          <span className="lb-conteudo__vaga lb-conteudo__vaga--vazia" aria-hidden="true">
            <IconeDoPapel papel="alfinete" />
          </span>
          <b>A biblioteca Documentos está vazia</b>
          <span>Crie documentos na página Documentos do livro.</span>
        </div>
      ) : achados.length === 0 ? (
        <div className="lb-conteudo__escolha-vazia" role="status">
          <b>Nada com “{busca.trim()}”</b>
          <button
            type="button"
            className="lb-conteudo__link"
            onClick={() => {
              setBusca('')
              setAtivo(0)
              buscaRef.current?.focus()
            }}
          >
            Limpar a busca
          </button>
        </div>
      ) : (
        <ul ref={listaRef} id={listaId} className="lb-conteudo__docs" role="listbox" aria-label="Documentos achados">
          {achados.map((documento, indice) => {
            const titulo = tituloOuSemTitulo(documento)
            const ja = dentro.includes(documento.id)
            return (
              <li
                key={documento.id}
                id={opcaoId(indice)}
                role="option"
                className="lb-conteudo__doc"
                aria-selected={indice === marcado}
                aria-disabled={ja || undefined}
                aria-label={ja ? `${titulo}, já está ${noObjeto}` : titulo}
                onMouseDown={(evento) => evento.preventDefault()}
                onClick={() => {
                  setAtivo(indice)
                  por(indice)
                }}
              >
                <span className="lb-conteudo__vaga" aria-hidden="true">
                  <IconeDoPapel papel={documento.papel} />
                </span>
                <span className="lb-conteudo__doc-titulo" title={titulo}>
                  {titulo}
                </span>
                {ja && (
                  <span className="lb-conteudo__doc-ja" aria-hidden="true">
                    <Icone nome="certo" />
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="lb-conteudo__escolha-pe">
        {!vazia && (
          <>
            <span>
              <kbd>Enter</kbd> {poe}
            </span>
            <span>
              <kbd>Esc</kbd> fecha
            </span>
          </>
        )}
        <button ref={prontoRef} type="button" className="lb-conteudo__bt lb-conteudo__bt--pe" onClick={aoFechar}>
          Pronto
        </button>
      </div>
    </div>
  )
}
