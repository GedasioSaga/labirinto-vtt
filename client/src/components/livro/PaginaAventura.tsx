import type { ReactNode } from 'react'
import { Fichas } from '../grimorio/Ficha'
import { TituloDaPagina } from './FolhaDoLivro'

/**
 * Página Aventura do livro do mestre (fatia 18): Pinos, Agenda e Estado do
 * mundo, cada um já na ficha recolhível dele (`FichaDaPagina`), empilhados
 * como no protótipo; as setas passam de um cabeçalho ao outro.
 */
export function PaginaAventura({ children }: { children: ReactNode }) {
  return (
    <>
      <TituloDaPagina titulo="Aventura" sub="O que vale para todas as cenas" />
      <div className="lb-zona gr-paginas">
        <Fichas>{children}</Fichas>
      </div>
    </>
  )
}
