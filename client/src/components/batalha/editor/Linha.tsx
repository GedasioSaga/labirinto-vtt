import type { ReactNode } from 'react'
import type { IdDaLinha } from './fraseDoPapel'

/** O id da âncora de uma linha: o papel leva até ela pelo pedaço da frase. */
export function ancoraDaLinha(prefixo: string, linha: IdDaLinha): string {
  return `${prefixo}-linha-${linha}`
}

interface LinhaProps {
  prefixo: string
  linha: IdDaLinha
  nome: string
  /** A pergunta que a linha responde ("onde pega", "quanto tira"). */
  dica: string
  /** Muda a cada chegada pelo papel: o brilho de "você chegou aqui" toca de novo. */
  brilho: number
  children: ReactNode
}

/**
 * UMA LINHA do editor novo (ED3; protótipo `.dim`): o nome e a pergunta à
 * esquerda, os controles à direita. O brilho é só opacidade (vale também com
 * movimento reduzido) e não pega clique.
 */
export function Linha({ prefixo, linha, nome, dica, brilho, children }: LinhaProps) {
  const id = ancoraDaLinha(prefixo, linha)
  return (
    <section className="lb-ed__linha" id={id} data-linha={linha} aria-labelledby={`${id}-nome`}>
      <div className="lb-ed__linha-cab">
        <h3 className="lb-ed__linha-nome" id={`${id}-nome`}>
          {nome}
        </h3>
        <p className="lb-ed__linha-dica">{dica}</p>
      </div>
      <div className="lb-ed__linha-corpo">{children}</div>
      {brilho > 0 && <div key={brilho} className="lb-ed__brilho" aria-hidden="true" />}
    </section>
  )
}

/**
 * A linha que outra fase preenche (Golpe na ED1, Requisitos, Evolução,
 * Jogadores e Campos extras na ED5): o lugar já existe, com o que ela vai
 * responder, para a tela não mudar de forma quando ela chegar.
 */
export function LinhaQueVem({ texto }: { texto: string }) {
  return <p className="lb-ed__vem">{texto}</p>
}
