import type { ReactNode } from 'react'
import { TituloDaPagina } from './FolhaDoLivro'

/** Página Acervo do livro do mestre: o acervo de tokens e o de itens, como vinham (fatia 2, sem restilo). */
export function PaginaAcervo({ children }: { children: ReactNode }) {
  return (
    <>
      <TituloDaPagina titulo="Acervo" sub="Do app, vale para todas as aventuras" />
      {children}
    </>
  )
}
