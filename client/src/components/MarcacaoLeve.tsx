import { Fragment, useMemo, type ReactNode } from 'react'
import { partesComDestaque } from '../lib/buscaNoLivro'
import { lerMarcacao, type Linha, type Trecho } from '../lib/marcacaoLeve'

/**
 * Desenha a marcação leve do livro de regras (`lib/marcacaoLeve.ts`) só com
 * elementos React e texto: o texto do capítulo nunca vira HTML — o React
 * escapa cada pedaço, então `<script>` ou `<img onerror>` aparecem escritos.
 * Sem link: um `[x](javascript:...)` é só texto.
 */

export interface MarcacaoLeveProps {
  texto: string
  /** Consulta JÁ normalizada (`normalizarParaBusca`) cujos achados aparecem marcados; vazia = nada marcado. */
  destaque?: string
  className?: string
}

function textoComDestaque(texto: string, destaque: string): ReactNode {
  if (destaque.length === 0) return texto
  return partesComDestaque(texto, destaque).map((parte, i) => (parte.achado ? <mark key={i}>{parte.texto}</mark> : <Fragment key={i}>{parte.texto}</Fragment>))
}

function desenharTrechos(trechos: readonly Trecho[], destaque: string): ReactNode[] {
  return trechos.map((trecho, i) => {
    switch (trecho.tipo) {
      case 'texto':
        return <Fragment key={i}>{textoComDestaque(trecho.texto, destaque)}</Fragment>
      case 'codigo':
        return <code key={i}>{textoComDestaque(trecho.texto, destaque)}</code>
      case 'forte':
        return <strong key={i}>{desenharTrechos(trecho.filhos, destaque)}</strong>
      case 'enfase':
        return <em key={i}>{desenharTrechos(trecho.filhos, destaque)}</em>
      case 'sublinhado':
        return <u key={i}>{desenharTrechos(trecho.filhos, destaque)}</u>
      case 'riscado':
        return <s key={i}>{desenharTrechos(trecho.filhos, destaque)}</s>
    }
  })
}

/** Linhas de um parágrafo do Discord: a quebra simples continua quebra. */
function desenharLinhas(linhas: readonly Linha[], destaque: string): ReactNode[] {
  return linhas.map((linha, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {desenharTrechos(linha, destaque)}
    </Fragment>
  ))
}

export function MarcacaoLeve({ texto, destaque = '', className }: MarcacaoLeveProps) {
  const blocos = useMemo(() => lerMarcacao(texto), [texto])
  return (
    <div className={className === undefined ? 'lb-marcacao' : `lb-marcacao ${className}`}>
      {blocos.map((bloco, i) => {
        switch (bloco.tipo) {
          case 'titulo': {
            // O título do capítulo é o h2 do leitor: os de dentro descem a partir do h3.
            const conteudo = desenharTrechos(bloco.trechos, destaque)
            if (bloco.nivel === 1) return <h3 key={i}>{conteudo}</h3>
            if (bloco.nivel === 2) return <h4 key={i}>{conteudo}</h4>
            return <h5 key={i}>{conteudo}</h5>
          }
          case 'paragrafo':
            return <p key={i}>{desenharLinhas(bloco.linhas, destaque)}</p>
          case 'citacao':
            return <blockquote key={i}>{desenharLinhas(bloco.linhas, destaque)}</blockquote>
          case 'lista': {
            const itens = bloco.itens.map((item, j) => <li key={j}>{desenharTrechos(item, destaque)}</li>)
            return bloco.ordenada ? <ol key={i}>{itens}</ol> : <ul key={i}>{itens}</ul>
          }
          case 'regua':
            return <hr key={i} />
        }
      })}
    </div>
  )
}
