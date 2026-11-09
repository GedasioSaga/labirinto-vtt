import { Fragment, type ReactNode } from 'react'
import type { MarcaDoPacote, NoDoPacote, TextoDoPacote } from '../../lib/preparo/pacoteDoJogador'
import { urlDaMidia, useRaizDaMidia } from '../midia'

/**
 * O TEXTO COMO O JOGADOR LÊ: desenhado do JSON do pacote, sem o editor, como
 * o site do Lobby vai desenhar (plano §2: "o site desenha a partir do JSON").
 * Só existem aqui os nós que o pacote deixa sair; o React escapa todo texto.
 * O link fica marcado, sem abrir: no app, abrir trocaria a janela do Labirinto.
 */

interface Contexto {
  readonly raiz: string | null
  readonly aoAbrir: (verbeteId: string) => void
}

type Titulo = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
const TITULOS: readonly Titulo[] = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

function comMarca(dentro: ReactNode, marca: MarcaDoPacote): ReactNode {
  switch (marca.type) {
    case 'bold':
      return <strong>{dentro}</strong>
    case 'italic':
      return <em>{dentro}</em>
    case 'strike':
      return <s>{dentro}</s>
    case 'code':
      return <code>{dentro}</code>
    case 'underline':
      return <u>{dentro}</u>
    case 'link':
      return (
        <span className="pr-jogador__link" title={marca.attrs.href}>
          {dentro}
        </span>
      )
  }
}

function filhos(nos: readonly NoDoPacote[], contexto: Contexto): ReactNode[] {
  return nos.map((no, indice) => desenhar(no, indice, contexto))
}

function desenhar(no: NoDoPacote, chave: number, contexto: Contexto): ReactNode {
  switch (no.type) {
    case 'text':
      // A primeira marca fica por fora, como no editor.
      return <Fragment key={chave}>{(no.marks ?? []).reduceRight<ReactNode>(comMarca, no.text)}</Fragment>
    case 'hardBreak':
      return <br key={chave} />
    case 'horizontalRule':
      return <hr key={chave} />
    case 'mencao':
      return (
        <button key={chave} type="button" className="pr-mencao pr-jogador__mencao" onClick={() => contexto.aoAbrir(no.attrs.verbeteId)}>
          {no.attrs.rotulo || 'Sem nome'}
        </button>
      )
    case 'image': {
      const { midia, legenda, largura, align } = no.attrs
      const url = contexto.raiz === null ? null : urlDaMidia(contexto.raiz, midia)
      return (
        <figure key={chave} className="pr-figura" data-align={align ?? undefined}>
          {url === null ? (
            <span className="pr-figura__falta">Imagem sem arquivo no Prelúdio</span>
          ) : (
            <img src={url} alt={legenda ?? ''} loading="lazy" decoding="async" style={largura === null ? undefined : { width: `${largura}px` }} />
          )}
          {legenda !== null && <figcaption>{legenda}</figcaption>}
        </figure>
      )
    }
    case 'paragraph':
      return <p key={chave}>{filhos(no.content, contexto)}</p>
    case 'heading': {
      const Tag = TITULOS[no.attrs.level - 1] ?? 'h2'
      return <Tag key={chave}>{filhos(no.content, contexto)}</Tag>
    }
    case 'bulletList':
      return <ul key={chave}>{filhos(no.content, contexto)}</ul>
    case 'orderedList':
      return (
        <ol key={chave} start={no.attrs.start}>
          {filhos(no.content, contexto)}
        </ol>
      )
    case 'listItem':
      return <li key={chave}>{filhos(no.content, contexto)}</li>
    case 'blockquote':
      return <blockquote key={chave}>{filhos(no.content, contexto)}</blockquote>
    case 'codeBlock':
      return (
        <pre key={chave}>
          <code>{filhos(no.content, contexto)}</code>
        </pre>
      )
  }
}

interface TextoDoJogadorProps {
  readonly texto: TextoDoPacote
  /** Clicar numa menção abre o verbete, dentro do que o jogador vê. */
  readonly aoAbrir: (verbeteId: string) => void
}

export function TextoDoJogador({ texto, aoAbrir }: TextoDoJogadorProps) {
  const raiz = useRaizDaMidia()
  if (texto.content.length === 0) return <p className="pr-quieto">Texto vazio para o jogador.</p>
  return (
    <div className="pr-texto">
      <div className="pr-texto__campo pr-jogador__texto">{filhos(texto.content, { raiz, aoAbrir })}</div>
    </div>
  )
}
