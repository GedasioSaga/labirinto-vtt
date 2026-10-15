import type { ReactNode } from 'react'
import { TituloDaPagina } from './FolhaDoLivro'

/** Página Aventura do livro do mestre: Pinos, Agenda e Estado do mundo, como vinham (fatia 2, sem restilo). */
export function PaginaAventura({ children }: { children: ReactNode }) {
  return (
    <>
      <TituloDaPagina titulo="Aventura" sub="O que vale para todas as cenas" />
      <div className="lb-zona">{children}</div>
    </>
  )
}
